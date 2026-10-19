package expo.modules.omnilocalai

import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.LogSeverity
import com.google.ai.edge.litertlm.OpenApiTool
import com.google.ai.edge.litertlm.ThinkingConfig
import com.google.ai.edge.litertlm.tool
import com.google.gson.Gson
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.CancellationException
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

class OmniLocalAiModule : Module() {
  // worker serializes initialization, send invocation and cleanup; control never queues behind JNI.
  private val worker = Executors.newSingleThreadExecutor()
  private val control = Executors.newCachedThreadPool()
  private val health = Executors.newSingleThreadScheduledExecutor()
  private val conversationLock = Any()
  private val ownership = Ownership()
  private var engine: Engine? = null
  @Volatile private var conversation: Conversation? = null
  @Volatile private var loading = false
  @Volatile private var destroying = false
  private val gson = Gson()
  private val traceSerial = AtomicInteger(0)
  @Volatile private var engineTrace = 0
  @Volatile private var generationTrace = 0

  override fun definition() = ModuleDefinition {
    Name("OmniLocalAi")
    Events("onGeneration")
    AsyncFunction("getCapabilities") {
      mapOf("android" to true, "abi" to Build.SUPPORTED_ABIS.toList(), "backends" to listOf("cpu", "gpu"), "thermalBlocked" to thermalBlocked())
    }
    // Read-only QA metadata; no caller-controlled path or command. Exact preview package only.
    AsyncFunction("getEvaluationIdentity") { promise: Promise ->
      control.execute { complete(promise) {
        val context = requireNotNull(appContext.reactContext)
        require(context.packageName == "com.omnibgc.aipreview") { "RUNTIME_UNSUPPORTED" }
        mapOf("packageName" to context.packageName, "apkSha256" to sha256(File(context.applicationInfo.sourceDir)))
      } }
    }
    AsyncFunction("getEvaluationHealth") {
      val context = requireNotNull(appContext.reactContext)
      require(context.packageName == "com.omnibgc.aipreview") { "RUNTIME_UNSUPPORTED" }
      val memAvailableKiB = File("/proc/meminfo").useLines { lines ->
        val fields = lines.firstOrNull { it.startsWith("MemAvailable:") }?.substringAfter(':')?.trim()?.split(Regex("\\s+"))
        fields?.takeIf { it.getOrNull(1) == "kB" }?.firstOrNull()?.toLongOrNull() ?: -1L
      }
      val power = context.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
      mapOf("packageName" to context.packageName, "appPssKiB" to android.os.Debug.getPss(),
        "memAvailableKiB" to memAvailableKiB,
        "thermalStatus" to if (Build.VERSION.SDK_INT >= 29) power.currentThermalStatus else 0)
    }
    AsyncFunction("privateModelsDirectory") { modelRoot().absolutePath }
    AsyncFunction("sha256File") { path: String, promise: Promise ->
      control.execute { complete(promise) {
        val trace = traceSerial.incrementAndGet()
        perf("verify_hash_start", trace)
        try { sha256(privateFile(path)).also { perf("verify_hash_complete", trace) } }
        catch (error: Throwable) { perf("verify_hash_failed", trace, mapOf("code" to code(error))); throw error }
      } }
    }
    AsyncFunction("initialize") { input: Map<String, Any?>, promise: Promise ->
      // Reserve before queueing so concurrent initialize/release cannot interleave.
      synchronized(this@OmniLocalAiModule) {
        if (loading || destroying || engine != null || !ownership.idle()) throw failure("SESSION_POISONED")
        loading = true
      }
      val trace = traceSerial.incrementAndGet()
      engineTrace = trace
      perf("initialize_requested", trace)
      worker.execute {
        complete(promise) {
          try {
            perf("initialize_worker_start", trace)
            if (thermalBlocked()) throw failure("THERMAL_BLOCK")
            val file = privateFile(input.string("verifiedAbsoluteModelPath"))
            if (!file.isFile) throw failure("MODEL_MISSING")
            perf("initialize_hash_start", trace)
            if (file.length() != input.number("expectedBytes").toLong() || sha256(file) != input.string("expectedSha256").lowercase()) throw failure("MODEL_HASH_MISMATCH")
            perf("initialize_hash_complete", trace)
            val context = input.number("contextTokens").toInt()
            require(context in 256..4096) { "CONTEXT_OVERFLOW" }
            val backend = when (input.string("backend")) { "cpu" -> Backend.CPU(); "gpu" -> Backend.GPU(); else -> throw failure("RUNTIME_UNSUPPORTED") }
            perf("engine_initialize_start", trace, mapOf("backend_requested" to input.string("backend"), "context_tokens" to context))
            Engine.setNativeMinLogSeverity(LogSeverity.ERROR)
            val created = Engine(EngineConfig(modelPath = file.absolutePath, backend = backend, maxNumTokens = context, cacheDir = File(modelRoot(), "runtime-cache").apply { mkdirs() }.absolutePath))
            engine = created
            try { created.initialize() } catch (error: Throwable) { ownership.poison(); throw error }
            perf("engine_initialize_complete", trace)
            null
          } catch (error: Throwable) {
            perf("initialize_failed", trace, mapOf("code" to code(error))); throw error
          } finally { loading = false; perf("initialize_finished", trace, mapOf("idle" to ownership.idle())) }
        }
      }
    }
    AsyncFunction("generate") { input: Map<String, Any?>, promise: Promise ->
      val id = input.string("requestId"); val epoch = input.number("epoch").toInt()
      if (loading || destroying || engine == null) throw failure("MODEL_MISSING")
      ownership.begin(id, epoch)
      val trace = traceSerial.incrementAndGet()
      generationTrace = trace
      perf("generate_accepted", trace, mapOf("epoch" to epoch, "engine_trace" to engineTrace))
      worker.execute {
        perf("generate_worker_start", trace)
        val sequence = AtomicInteger(0)
        val firstCallback = AtomicBoolean(false)
        val firstText = AtomicBoolean(false)
        val thermalCancellation = AtomicBoolean(false)
        val thermalCheck = AtomicReference<ScheduledFuture<*>?>(null)
        fun emit(type: String, fields: Map<String, Any?>) {
          if (!destroying && ownership.matches(id, epoch)) sendEvent("onGeneration", fields + mapOf("type" to type, "requestId" to id, "epoch" to epoch, "sequence" to sequence.getAndIncrement()))
        }
        fun terminal(reason: String, error: Throwable? = null) {
          if (!ownership.terminal(id, epoch)) return
          perf("terminal_callback", trace, mapOf("reason" to reason, "code" to error?.let { code(it) }))
          thermalCheck.getAndSet(null)?.cancel(false)
          // Queue closure after send invocation returns and terminal callback finishes.
          worker.execute {
            try {
              perf("conversation_close_start", trace)
              synchronized(conversationLock) { conversation?.close(); conversation = null }
              ownership.cleanupSucceeded(id, epoch)
              perf("native_cleanup_complete", trace, mapOf("idle" to ownership.idle(), "sequence_count" to sequence.get()))
              if (!destroying) sendEvent("onGeneration", mapOf("type" to "terminal", "requestId" to id, "epoch" to epoch, "sequence" to sequence.getAndIncrement(), "reason" to reason, "errorCode" to error?.let { code(it) }))
              destroyWhenIdle()
            } catch (_: Throwable) {
              ownership.poison()
              perf("native_cleanup_failed", trace, mapOf("code" to "SESSION_POISONED"))
              if (!destroying) sendEvent("onGeneration", mapOf("type" to "terminal", "requestId" to id, "epoch" to epoch, "sequence" to sequence.getAndIncrement(), "reason" to "error", "errorCode" to "SESSION_POISONED"))
            }
          }
        }
        try {
          if (thermalBlocked()) throw failure("THERMAL_BLOCK")
          val rawMessages = input["messages"] as? List<*> ?: throw failure("TOOL_PROTOCOL_INVALID")
          val tools = (input["tools"] as? List<*>) ?: emptyList<Any>()
          require(tools.size <= 16 && gson.toJson(tools).length <= 32768)
          val names = tools.map { (it as? Map<*, *>)?.get("name") as? String ?: throw NativeProtocolException() }.toSet()
          val messages = NativeMessages.decode(rawMessages, names)
          val output = input.number("maxOutputTokens").toInt(); require(output in 1..512)
          val providers = tools.map { schema ->
            val json = gson.toJson(schema)
            tool(object : OpenApiTool {
              override fun getToolDescriptionJsonString(): String = json
              override fun execute(paramsJsonString: String): String = throw failure("TOOL_PROTOCOL_INVALID")
            })
          }
          val current = engine!!.createConversation(ConversationConfig(initialMessages = messages.dropLast(1), tools = providers, automaticToolCalling = false, maxOutputToken = output, thinkingConfig = ThinkingConfig(enableThinking = false, thinkingTokenBudget = 0)))
          conversation = current
          thermalCheck.set(health.scheduleAtFixedRate({
            if (ownership.matches(id, epoch) && thermalBlocked() && thermalCancellation.compareAndSet(false, true)) {
              control.execute { try { cancelCurrent(id, epoch) } catch (_: Throwable) { ownership.poison() } }
            }
          }, 5, 5, TimeUnit.SECONDS))
          perf("generate_send_start", trace)
          current.sendMessageAsync(messages.last(), object : MessageCallback {
            override fun onMessage(message: Message) {
              if (firstCallback.compareAndSet(false, true)) perf("first_callback", trace)
              val text = message.contents.contents.filterIsInstance<Content.Text>().joinToString("") { it.text }
              if (text.isNotEmpty() && firstText.compareAndSet(false, true)) perf("first_text_delta", trace)
              if (text.isNotEmpty()) emit("delta", mapOf("text" to text, "mode" to "delta"))
              for (proposal in message.toolCalls) emit("tool", mapOf("value" to mapOf("version" to 1, "name" to proposal.name, "arguments" to proposal.arguments)))
            }
            override fun onDone() {
              when (ownership.completionReason(thermalCancellation.get())) {
                CompletionReason.THERMAL_BLOCK -> terminal("error", failure("THERMAL_BLOCK"))
                CompletionReason.CANCELLED -> terminal("cancelled")
                CompletionReason.COMPLETE -> terminal("complete")
              }
            }
            override fun onError(throwable: Throwable) {
              if (thermalCancellation.get()) terminal("error", failure("THERMAL_BLOCK"))
              else terminal(if (throwable is CancellationException) "cancelled" else "error", throwable)
            }
          }, maxOutputToken = output)
          perf("generate_send_return", trace)
          if (ownership.cancelling()) cancelCurrent(id, epoch)
          promise.resolve(null)
        } catch (error: Throwable) { terminal("error", error); promise.reject(failure(code(error))) }
      }
    }
    AsyncFunction("cancel") { input: Map<String, Any?>, promise: Promise ->
      val id = input.string("requestId"); val epoch = input.number("epoch").toInt()
      val trace = if (ownership.matches(id, epoch)) generationTrace else 0
      perf("cancel_requested", trace, mapOf("epoch" to epoch))
      control.execute {
        complete(promise) {
          val accepted = ownership.cancel(id, epoch)
          if (accepted) cancelCurrent(id, epoch)
          perf("cancel_acknowledged", trace, mapOf("accepted" to accepted, "idle" to ownership.idle()))
          // Acknowledgement is deliberately not quiescence.
          mapOf("accepted" to accepted, "nativeQuiescent" to ownership.idle())
        }
      }
    }
    AsyncFunction("awaitNativeIdle") { promise: Promise ->
      val trace = generationTrace
      perf("await_idle_start", trace)
      control.execute {
        val until = System.nanoTime() + 4_000_000_000L
        while ((!ownership.idle() || loading) && System.nanoTime() < until) Thread.sleep(10)
        val idle = ownership.idle() && !loading
        if (!idle) ownership.poison()
        perf("await_idle_complete", trace, mapOf("idle" to idle))
        promise.resolve(mapOf("idle" to idle))
      }
    }
    AsyncFunction("release") { promise: Promise ->
      val trace = engineTrace
      perf("release_requested", trace)
      synchronized(this@OmniLocalAiModule) { if (!ownership.idle() || loading) throw failure("SESSION_POISONED"); loading = true }
      worker.execute { complete(promise) { try {
        if (!ownership.idle()) throw failure("SESSION_POISONED")
        perf("engine_close_start", trace)
        engine?.let { if (it.isInitialized()) it.close() }; engine = null
        perf("engine_close_complete", trace)
        null
      } catch (error: Throwable) { perf("release_failed", trace, mapOf("code" to code(error))); throw error }
        finally { loading = false; perf("release_finished", trace, mapOf("idle" to ownership.idle())) }
      } }
    }
    OnDestroy {
      destroying = true
      // Never close an actively generating native context from JS teardown.
      control.execute { try { cancelCurrent() } catch (_: Throwable) { if (!ownership.idle()) ownership.poison() } }
      worker.execute { destroyWhenIdle() }
    }
  }
  /** Teardown completes after terminal cleanup, never after a mere cancellation acknowledgment. */
  private fun destroyWhenIdle() {
    if (!destroying || loading || !ownership.idle()) return
    try {
      engine?.let { if (it.isInitialized()) it.close() }; engine = null
      health.shutdown(); control.shutdown(); worker.shutdown()
    } catch (_: Throwable) { ownership.poison() }
  }
  // JNI cancel and delete must not race between upstream isAlive checks and native calls.
  // This monitor is deliberately never held while native inference runs.
  private fun cancelCurrent(requestId: String? = null, epoch: Int? = null) = synchronized(conversationLock) {
    // Reconcile inside the close/cancel fence: a delayed old control task cannot cancel a newer turn.
    if (requestId == null || (epoch != null && ownership.matches(requestId, epoch))) {
      conversation?.let { if (it.isAlive) {
        val trace = generationTrace
        perf("cancel_jni_start", trace)
        it.cancelProcess()
        perf("cancel_jni_return", trace)
      } }
    }
  }
  /** Preview-only bounded metadata. Never include prompts, text, tools, paths or SDK messages. */
  private fun perf(event: String, trace: Int, fields: Map<String, Any?> = emptyMap()) {
    try {
      if (appContext.reactContext?.packageName != "com.omnibgc.aipreview") return
      Log.i("OmniAiPerf", gson.toJson(fields + mapOf("v" to 1, "event" to event,
        "trace" to trace, "uptime_ns" to SystemClock.elapsedRealtimeNanos())))
    } catch (_: Throwable) { /* Diagnostics must never change native ownership or inference. */ }
  }
  private fun modelRoot(): File = File(requireNotNull(appContext.reactContext).filesDir, "omni-ai-models").apply { mkdirs() }.canonicalFile
  private fun privateFile(path: String): File {
    val file = File(path).canonicalFile
    if (!File(path).isAbsolute || !file.toPath().startsWith(modelRoot().toPath())) throw failure("MODEL_MISSING")
    return file
  }
  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().buffered(1024 * 1024).use { stream ->
      val buffer = ByteArray(1024 * 1024)
      while (true) { val count = stream.read(buffer); if (count < 0) break; digest.update(buffer, 0, count) }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }
  private fun thermalBlocked(): Boolean {
    if (Build.VERSION.SDK_INT < 29) return false
    val power = appContext.reactContext?.getSystemService(PowerManager::class.java) ?: return false
    return power.currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE
  }
  private fun failure(code: String) = CodedException(code, "Local inference unavailable ($code).", null)
  private fun code(error: Throwable): String = when (error) { is OutOfMemoryError -> "OOM"; is NativeProtocolException -> "TOOL_PROTOCOL_INVALID"; is CodedException -> error.code; else -> "UNEXPECTED_NATIVE_FAILURE" }
  private fun Map<String, Any?>.string(key: String) = this[key] as? String ?: throw failure("TOOL_PROTOCOL_INVALID")
  private fun Map<String, Any?>.number(key: String) = this[key] as? Number ?: throw failure("TOOL_PROTOCOL_INVALID")
  private fun complete(promise: Promise, work: () -> Any?) { try { promise.resolve(work()) } catch (error: Throwable) { promise.reject(failure(code(error))) } }
}
