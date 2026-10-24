package expo.modules.omnilocalai

import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Role
import com.google.ai.edge.litertlm.ToolCall
import com.google.gson.JsonParser

fun main() {
  // LiteRT's JsonConverters.toValue uses getAsNumber: Gson's lazy Number is not an Expo JSI boxed number.
  val lazyNumber = JsonParser.parseString("3").asNumber
  val bridged = NativeMessages.bridgeToolCall(ToolCall("find_places", mapOf("query" to "coffee", "limit" to lazyNumber,
    "nested" to listOf(mapOf("durationMinutes" to JsonParser.parseString("15").asNumber)))))
  val arguments = bridged["arguments"] as Map<*, *>
  check(arguments["query"] == "coffee")
  check(arguments["limit"] is Double && arguments["limit"] == 3.0) { "SDK numeric tool arguments must be boxed Double for Expo, got ${arguments["limit"]?.javaClass?.name}" }
  val nested = (arguments["nested"] as List<*>).single() as Map<*, *>
  check(nested["durationMinutes"] is Double && nested["durationMinutes"] == 15.0)
  for (invalidValue in listOf(Double.NaN, Double.POSITIVE_INFINITY, Any())) {
    check(runCatching { NativeMessages.bridgeToolCall(ToolCall("find_places", mapOf("limit" to invalidValue))) }.exceptionOrNull() is NativeProtocolException)
  }
  val name = "omni_model_smoke"
  val rows = listOf(
    mapOf("role" to "user", "text" to "Retrieve the startup token."),
    mapOf("role" to "assistant", "text" to "", "toolCalls" to listOf(mapOf("name" to name, "arguments" to emptyMap<String, Any>()))),
    mapOf("role" to "tool", "toolName" to name, "text" to "{\"token\":\"READY_FRESH_NONCE\"}")
  )
  val modern = NativeMessages.decode(rows, setOf(name)).last()
  check(modern.role == Role.TOOL)
  check(modern.contents.contents.size == 1)
  check(modern.contents.contents.single() is Content.ToolResponse)
  val legacy = NativeMessages.decode(rows, setOf(name), true).last()
  check(legacy.role == Role.TOOL)
  check(legacy.contents.contents.size == 2)
  check(legacy.contents.contents.filterIsInstance<Content.ToolResponse>().single().name == name)
  val visible = legacy.contents.contents.filterIsInstance<Content.Text>().single().text
  check(JsonParser.parseString(visible).asJsonObject["token"].asString == "READY_FRESH_NONCE")
  check(NativeMessages.requiresToolResponseText("03e7da1eb1108b50dffaa9bb52cc7bcbad2eb0c66ca990267f480c1e545d2856"))
  check(!NativeMessages.requiresToolResponseText("2a72330b504a6596d53a2c00923c57173b10f1b83e6a541213ffec08d1fc5de8"))
  val invalid = listOf(rows.takeLast(1), rows + rows.last(), rows.dropLast(1), rows.dropLast(1) + mapOf("role" to "tool", "toolName" to "unbound", "text" to "{}"), rows.dropLast(1) + mapOf("role" to "tool", "toolName" to name, "text" to "{"))
  for (transcript in invalid) {
    check(runCatching { NativeMessages.decode(transcript, setOf(name), true) }.exceptionOrNull() is NativeProtocolException)
  }
  println("PASS real LiteRT-LM 0.18 codec: recursive Expo numeric arguments, SHA-bound legacy tool text, structured tool role/name, strict pending/JSON validation")
}
