package expo.modules.omnilocalai

import org.junit.Assert.*
import org.junit.Test

class OwnershipTest {
  @Test fun doneCallbackCannotPromoteThermalOrUserCancellationToSuccessfulCompletion() {
    val owner = Ownership(); owner.begin("one", 1)
    assertEquals(CompletionReason.COMPLETE, owner.completionReason(false))
    assertEquals(CompletionReason.THERMAL_BLOCK, owner.completionReason(true))
    owner.cancel("one", 1)
    assertEquals(CompletionReason.CANCELLED, owner.completionReason(false))
    assertEquals(CompletionReason.THERMAL_BLOCK, owner.completionReason(true))
    assertTrue(owner.terminal("one", 1)); assertFalse(owner.idle())
  }
  @Test fun callerTerminalDoesNotGrantIdleAndDuplicatesAreIgnored() {
    val owner = Ownership(); owner.begin("one", 1)
    assertTrue(owner.terminal("one", 1)); assertFalse(owner.terminal("one", 1))
    assertFalse(owner.idle()); owner.cleanupSucceeded("one", 1); assertTrue(owner.idle())
  }
  @Test fun poisonCannotBeResetByLateCleanup() {
    val owner = Ownership(); owner.begin("one", 1); owner.poison(); owner.cleanupSucceeded("one", 1)
    assertFalse(owner.idle())
    try { owner.begin("two", 2); fail("poisoned native context reused") } catch (_: IllegalStateException) {}
  }
  @Test fun staleEpochAndCancellationDoNotFreeOwnership() {
    val owner = Ownership(); owner.begin("one", 3); assertFalse(owner.cancel("other", 3)); assertTrue(owner.cancel("one", 3))
    assertTrue(owner.cancelling()); assertFalse(owner.idle()); owner.cleanupSucceeded("one", 2); assertFalse(owner.idle())
    owner.cleanupSucceeded("one", 3)
    try { owner.begin("two", 3); fail("epoch replay") } catch (_: IllegalStateException) {}
    owner.begin("two", 4); assertTrue(owner.matches("two", 4))
  }
}
