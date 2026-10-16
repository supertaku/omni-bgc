package expo.modules.omnilocalai

import com.google.ai.edge.litertlm.Content
import org.junit.Assert.*
import org.junit.Test

class NativeMessagesTest {
  private val call = mapOf("role" to "assistant", "text" to "", "toolCalls" to listOf(mapOf("name" to "find_places", "arguments" to mapOf("query" to "TEST ONLY"))))
  private val response = mapOf("role" to "tool", "toolName" to "find_places", "text" to "{\"status\":\"ok\",\"data\":[]}")
  @Test fun manualToolRoundUsesRealTypedSdkToolCallAndToolResponse() {
    val messages = NativeMessages.decode(listOf(mapOf("role" to "user", "text" to "TEST ONLY"), call, response), setOf("find_places"))
    assertEquals("find_places", messages[1].toolCalls.single().name)
    assertTrue(messages[1].contents.contents.isEmpty())
    assertEquals("TEST ONLY", messages[1].toolCalls.single().arguments["query"])
    val result = messages[2].contents.contents.single() as Content.ToolResponse
    assertEquals("find_places", result.name)
    assertEquals("ok", (result.response as Map<*, *>)["status"])
  }
  @Test fun ordinaryReferenceContextIsUserTextAndNeedsNoToolEnvelope() {
    assertEquals("REFERENCE DATA", NativeMessages.decode(listOf(mapOf("role" to "user", "text" to "REFERENCE DATA")), emptySet()).single().toString())
  }
  @Test fun unnamedOrOrphanedOrUnknownToolMessagesAreRejected() {
    for (rows in listOf(listOf(response), listOf(call), listOf(call, response - "toolName"), listOf(call, response + ("toolName" to "unknown")))) {
      try { NativeMessages.decode(rows, setOf("find_places")); fail("invalid transcript accepted") } catch (_: NativeProtocolException) {}
    }
    try { NativeMessages.decode(listOf(call, response), emptySet()); fail("unknown tool accepted") } catch (_: NativeProtocolException) {}
  }
}
