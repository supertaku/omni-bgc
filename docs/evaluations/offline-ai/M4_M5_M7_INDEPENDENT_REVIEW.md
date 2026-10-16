# Independent M4 / M5 / M7 review — 2026-10-15

Reviewer: M2 model-management owner, independent of retrieval/tool/grounding implementation. Parent retains milestone acceptance authority.

Inspected the unified retrieval facade, canonical retrieval/evidence predicates, tool decoder/schema registry, dispatcher, prompt observations, orchestrator, answer composer and focused evidence document. Independently ran `node --test tests/ai/agent-security.test.cjs tests/ai/agent-research.test.cjs`: exit 0, **18 passed, 0 failed, 0 skipped**.

Initial review requested three repairs: explicit denial of research must not authorize research; ordinary location/hours prose must be rejected without requiring the words BGC or a currency symbol; bounded observations must preserve valid JSON instead of slicing serialized JSON. Owner implemented all three, added targeted regression tests, and reviewer re-read the changes and reran both suites successfully. Parent's separately identified generation epoch and streaming-prefix issues are also reflected in the reviewed current source.

No remaining blocking issue was identified in this review of those focused host contracts. Recommended disposition: parent may accept these host code contracts after its own integration checks. This review does not approve data rights, actual model behavior, or device operation. General prose filters are conservative lexical defenses and are not a measured semantic factuality score; factual user queries render validated typed records and source lineage. Synthetic fixtures and controlled providers do not establish true Gemma tool quality, POCO streaming/cancellation, offline Android behavior or physical map actions. M1/M9 native compilation and M10 physical evidence remain separate gates.
