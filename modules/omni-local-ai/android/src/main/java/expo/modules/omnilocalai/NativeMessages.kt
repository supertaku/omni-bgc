package expo.modules.omnilocalai

import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.ToolCall
import com.google.gson.Gson
import com.google.gson.JsonParser

internal class NativeProtocolException : IllegalArgumentException("TOOL_PROTOCOL_INVALID")

/** Pinned manual-tool transcript codec. No native engine/JNI is touched by this codec. */
internal object NativeMessages {
  private val gson = Gson()
  private val toolName = Regex("[a-z][a-z0-9_]{0,63}")
  fun bridgeToolCall(call: ToolCall): Map<String, Any?> = mapOf(
    // Gson lazy Number values become undefined across Expo JSI; recursively box them as Double.
    "version" to 1, "name" to call.name, "arguments" to bridgeValue(call.arguments)
  )
  private fun bridgeValue(value: Any?): Any? = when (value) {
    null, is String, is Boolean -> value
    is Number -> value.toDouble().also { if (!it.isFinite()) throw NativeProtocolException() }
    is Map<*, *> -> value.entries.associate { (key, item) ->
      (key as? String ?: throw NativeProtocolException()) to bridgeValue(item)
    }
    is List<*> -> value.map(::bridgeValue)
    else -> throw NativeProtocolException()
  }
  // This exact export's a8178d7d template renders only text content parts under the tool role.
  fun requiresToolResponseText(sha256: String): Boolean = sha256 == "03e7da1eb1108b50dffaa9bb52cc7bcbad2eb0c66ca990267f480c1e545d2856"
  fun decode(rows: List<*>, allowed: Set<String>, toolResponseText: Boolean = false): List<Message> {
    if (rows.size !in 1..24 || gson.toJson(rows).length > 16384) throw NativeProtocolException()
    val pending = mutableListOf<String>()
    val decoded = rows.map { raw ->
      val row = raw as? Map<*, *> ?: throw NativeProtocolException()
      val text = row["text"] as? String ?: throw NativeProtocolException()
      if (text.length > 8192) throw NativeProtocolException()
      if (row["toolCalls"] != null && row["toolCalls"] !is List<*>) throw NativeProtocolException()
      val calls = (row["toolCalls"] as? List<*>) ?: emptyList<Any>()
      if (calls.size > 8 || (calls.isNotEmpty() && row["role"] != "assistant") || (row["toolName"] != null && row["role"] != "tool")) throw NativeProtocolException()
      if (pending.isNotEmpty() && row["role"] != "tool") throw NativeProtocolException()
      when (row["role"]) {
        "system" -> Message.system(text)
        "user" -> Message.user(text)
        "assistant" -> {
          val validated = calls.map { rawCall ->
            val call = rawCall as? Map<*, *> ?: throw NativeProtocolException()
            val name = call["name"] as? String ?: throw NativeProtocolException()
            if (!toolName.matches(name) || name !in allowed) throw NativeProtocolException()
            val arguments = call["arguments"] as? Map<*, *> ?: throw NativeProtocolException()
            val values = arguments.entries.associate { entry ->
              val key = entry.key as? String ?: throw NativeProtocolException()
              key to entry.value
            }
            pending.add(name)
            ToolCall(name, values)
          }
          if (text.isEmpty()) Message.model(toolCalls = validated)
          else Message.model(Contents.of(text), toolCalls = validated)
        }
        "tool" -> {
          if (calls.isNotEmpty()) throw NativeProtocolException()
          val name = row["toolName"] as? String ?: throw NativeProtocolException()
          if (!toolName.matches(name) || name !in allowed || !pending.remove(name)) throw NativeProtocolException()
          val value = try { gson.fromJson(JsonParser.parseString(text), Any::class.java) } catch (_: Exception) { throw NativeProtocolException() }
          val response = Content.ToolResponse(name, value)
          // Retain the named structured result; the legacy template also needs its validated JSON as text.
          Message.tool(if (toolResponseText) Contents.of(response, Content.Text(gson.toJson(value))) else Contents.of(response))
        }
        else -> throw NativeProtocolException()
      }
    }
    if (pending.isNotEmpty()) throw NativeProtocolException()
    return decoded
  }
}
