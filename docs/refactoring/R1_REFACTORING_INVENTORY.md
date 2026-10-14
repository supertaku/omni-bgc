# R1 refactoring inventory

| Location | Confirmed concern / evidence | Principle | Risk | Smallest proposal / verification |
|---|---|---|---|---|
| App.tsx / Application | Startup, navigation, alerts, downloads and seven panel bodies coupled in one closure | SRP | Medium | Extract initialization/navigation/pack UI hooks and cohesive panel renderer; execute actual callbacks with host harness; native gate remains pending |
| AssistantScreen.tsx | Timer/cancellation/message IDs/draft embedded among JSX | SoC | Medium | Conversation hook preserving 160ms, IDs, latest records and scroll intent; cancellation, repeated requests and unmount tests |
| Assistant directory / retrieval | Identical 12-digit PHP regex and BigInt centavo conversion; null vs throw differs | DRY | Low | Pure parser with explicit null return; retrieval error wrapper; exact boundary/error/differential tests |
| Explore vs Assistant vs lexical | NFC vs NFKC, bakery alias and evidence policies differ | KISS | High if merged | Retain distinct search/category/evidence policies; characterize differences rather than unify vocabulary |
| updates/index.ts ↔ style.ts | Static import cycle from validation and active resource loading in one module | Low coupling | Medium | Pure offline style contract module; preserve compatibility exports and adversarial style checks |
| data/store.ts / CURRENT_FACTS | Complex security-sensitive SQL embedded in connection orchestration | SoC | Medium | Move exact query bytes into queries.ts; compare SQL and temporal regression tests |
| MapCanvas.tsx | Pure render-mode style transformation/POI collection embedded in native component | Testability | Low | Extract pure presentation functions; exact differential GeoJSON/style tests; preserve camera and native effects |
| Pack integrity reads | recovery hashes every manifest file and checks each dependency on every read | Integrity before optimization | High | Retain uncached validation; instrument isolated fixture invocation/byte counts; no latency claim without device measurement |
| Pipeline/shared modules | Stage functions and pure routing already exist; no demonstrated need for broad rearrangement | KISS | High for generated churn | Target static quality issues only; rerun existing deterministic outputs/geometry/topology suites |
| Tests / VM imports | Several harnesses mock every unknown import as empty object; extraction can falsely skip real logic | Explicit contracts | Medium | Resolve extracted local modules explicitly, fail unknown imports; preserve callback assertions |
| README | Says no implementation exists despite runnable native app | Accuracy | Low | Rewrite with actual capabilities, setup/checks and device/source limitations |
| Quality tooling | No lint/format scripts; strict TS present; Python checks only tests | Consistency | Low | Pinned dev-only ESLint/Prettier/Ruff, scoped authored-file formatting and additive CI gates |

Priority follows R1 order; no module is defective merely because it is long. No dead compatibility path is removed without reference evidence. Native camera dependency omissions are recorded for separate behavioral review; changing them could introduce repeated animations.
