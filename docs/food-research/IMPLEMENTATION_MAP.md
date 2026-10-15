# Food research integration — 2026-10-14

Basis: clean local main, preserving completed R1 and offline AI work. No inference runtime or schema migration.

1. FOOD-0/1: `pipelines/etl/place-intake/import_food_research.py` reads BOM-safe CSVs, joins external IDs, validates precise PHP amounts, preserves raw fields, emits deterministic local JSON, validation/reconciliation reports and checksum manifest. Generated/raw assets stay ignored under existing rights gates. Overview owns restaurant fields; detail owns items. Conflicts retain both values. UUIDv5 namespace is permanent.
2. FOOD-2/3: `features/food/` owns explicit research contracts/service/projection. Explore adds coordinate-null research places and searchable zone/floor/menu fields. No canonical citation promotion, coordinate inheritance or implicit name merge. Details use separate research sections with bounded menu rendering.
3. FOOD-4: explicit research payloads and bounded read-only search before the legacy fallback, after navigation/live-status restrictions. Legacy canonical retrieval and menu approval checks remain intact; approved named records take precedence.
4. FOOD-5/6: importer adversarial/determinism tests, typed service and ten Assistant examples, UI rendering checks, existing quality runner. Report host performance separately from Android.

Acceptance: 278 restaurants, 1279 priced items, 356 published and 923 estimated; no-menu records retained; no fabricated geography; costs use BigInt centavos; hours and branch evidence separate; malicious text treated as inert strings; repeat import byte-identical. Risks: ambiguous same-name identities, source replacement characters, incomplete branch menus, absent rights approval, physical-device availability. No publication/main integration. Native runtime benchmark remains a separate gate.
