package expo.modules.omnilocalai

internal enum class CompletionReason { COMPLETE, CANCELLED }

/** No JNI call runs under this monitor. A timeout never grants ownership. */
internal class Ownership {
  private val lock = Any()
  private var active: Pair<String, Int>? = null
  private var lastEpoch = -1
  private var terminal = false
  private var cancelling = false
  private var poisoned = false
  fun begin(id: String, epoch: Int) = synchronized(lock) {
    check(!poisoned && active == null && epoch > lastEpoch) { "SESSION_POISONED" }
    active = Pair(id, epoch); lastEpoch = epoch; terminal = false; cancelling = false
  }
  fun matches(id: String, epoch: Int): Boolean = synchronized(lock) { active == Pair(id, epoch) }
  fun terminal(id: String, epoch: Int): Boolean = synchronized(lock) {
    if (active != Pair(id, epoch) || terminal) false else { terminal = true; true }
  }
  fun idle(): Boolean = synchronized(lock) { active == null && !poisoned }
  fun cancel(id: String, epoch: Int): Boolean = synchronized(lock) { if (active != Pair(id, epoch)) false else { cancelling = true; true } }
  fun cancelling(): Boolean = synchronized(lock) { cancelling }
  fun completionReason(): CompletionReason = synchronized(lock) {
    if (cancelling) CompletionReason.CANCELLED else CompletionReason.COMPLETE
  }
  fun cleanupSucceeded(id: String, epoch: Int) = synchronized(lock) { if (active == Pair(id, epoch)) active = null }
  fun poison() = synchronized(lock) { poisoned = true }
}
