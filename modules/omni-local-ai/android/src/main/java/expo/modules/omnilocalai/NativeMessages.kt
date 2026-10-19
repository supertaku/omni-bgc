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
  fun decode(rows: List<*>, allowed: Set<String>): List<Message> {
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
          Message.tool(Contents.of(Content.ToolResponse(name, value)))
        }
        else -> throw NativeProtocolException()
      }
    }
    if (pending.isNotEmpty()) throw NativeProtocolException()
    return decoded
  }
}
