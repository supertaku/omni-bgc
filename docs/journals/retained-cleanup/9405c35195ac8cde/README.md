# Offline food research directory

2026-10-14 Asia/Manila. Internal development use only. Research records are separate from canonical approved facts and historical presentation candidates.

## Reproduce

Unchanged snapshots of the supplied files are retained in ignored `data/raw/food-research/`.

```powershell
python pipelines/etl/place-intake/import_food_research.py `
  --overview data/raw/food-research/BGC_Restaurant_Research_Overview_With_Prices_2026-10-14.csv `
  --details data/raw/food-research/BGC_Restaurants_Menus_Hours_Locations_Priced_2026-10-14.csv
```

Outputs: `apps/mobile/assets/generated/food-research/directory.json` (normalized data and raw lineage), adjacent `manifest.json` (hashes, versions, source URLs, dates, counts and rights status), and `.g/food-research/import/validation.json` (rejects, duplicates, conflicts, reconciliation and sample QA). Raw/generated artifacts stay ignored under existing rights gates. A fresh checkout needs the authorized CSVs and importer before mobile compilation. Do not force-add or publish these datasets/bundles without separate permission.

Metro includes the directory through a static local import; the app requires neither Python nor network retrieval. Only actual acquired CSV bytes receive source hashes. The 104 external URLs are lineage references; their contents were not reacquired or independently verified. URL availability does not grant a menu-text license. The canonical register/exporter and reviewed pack catalogue are unchanged.

## Identity and source precedence

Permanent UUIDv5 namespace: `b9446af3-dab7-5c92-afec-cb48b8195425`. Restaurant UUID name is the original external ID, such as `BGC-F001`. Item UUID name is external restaurant ID, `|`, NFKC/casefold/whitespace-normalized item name, `|`, normalized section. Distinct colliding variants receive a deterministic SHA256 of original fields as suffix; exact repeated rows are rejected diagnostically. No row numbers/random IDs or canonical ID changes.

Overview owns restaurant identity, building, floor, hours, research status and notes. Detail owns each menu item, branch, category, price and source. All three `BGC-F004` conflicts retain both values: menu branch, menu-source URL and research notes. Restaurant display follows overview; each item keeps its detailed branch/source.

Ten exact-name historical-candidate overlaps remain ambiguous. Reconciliation records candidate IDs/references, buildings/floors and research location sources. Identities remain separate; no coordinates/entrances are inherited. All 278 research places have null coordinates and empty entrances. Existing IDs/coordinates remain unchanged; the High Street map coverage is not expanded.

## Retrieval contracts

`features/food/contracts.ts` owns research restaurant/menu/hours/evidence types. These do not implement canonical `Citation` or confer approval. The presentation adapter supplies candidate `Place` records with empty canonical menus/citations; separate research components display the evidence.

`createFoodResearchService` validates the asset before projection, copies/freeze-protects records and excludes raw diagnostics from returned objects. Invalid content disables only research; it never accesses SQLite, favorites or packs. Search uses NFKC/lowercase/exact tokens, stable name/section/category ordering and ID tie-breaks. Price/token/ID indexes are local and read-only.

| Operation | Result |
| --- | --- |
| `searchFoodEstablishments` | Restaurant/name/menu/type/building/floor/zone and inclusive budget filters; bounded summaries and exact total |
| `getFoodEstablishmentDetails` | Restaurant summary and menu count, without embedded full menus |
| `getFoodEstablishmentMenu` | Exact restaurant association, offset pagination, maximum 100 items |
| `searchFoodMenuItems` | Item/category/tag, restaurant, venue/floor/zone/type and precise price filters, maximum 100 items |
| `getFoodEstablishmentHours` | Original hours text, schedule context and separate venue reference |
| `getFoodResearchEvidence` | Sources, dates, research status, item price/branch/estimate evidence |

The internal full registry supports UI projection. A future model adapter must expose only bounded operations and treat source strings as untrusted data, never instructions/tool commands. There is no new inference runtime or full-directory system prompt.

Prices use exact decimal strings, separate from display formatting; budget comparisons reuse BigInt centavos. Evidence is `published-menu`, `published-starting`, `published-research` or `estimated`. Starting prices are minimum listings, not fixed variant charges; estimates remain visibly approximate and usable in filters. Original category labels remain in raw lineage. Descriptions are never invented; dietary safety/ingredients are not inferred.

Hours distinguish restaurant, delivery, ordering and unknown contexts. Venue hours retain separate text/source. Only complete unambiguous single daily intervals get weekly schedules; complex sessions/day groups remain literal. Historical schedules do not establish live opening status or holiday closures. Unresolved floors stay null while original location wording is retained.

## App behavior

Explore startup/refresh includes all 278 records. Search includes name, venue, zone, floor, item, category and tag fields. The Food chip covers research establishments without changing legacy category policy. Existing expandable details add grouped menus, prices/descriptions, branch context and separate hours/source disclosure; 20 rows are initially visible with Show more. No-menu records show “Menu information is not yet available.” Source text renders as inert React text, with no evaluation or command dispatch.

The deterministic Assistant receives explicit research injection. Existing navigation/planning/saved-query precedence and canonical menu approval predicates remain. Explicitly named approved records retain precedence; other food results use distinct `food-menus`/`food-hours` payloads. An unambiguous restaurant response supplies in-memory context for “this restaurant” hours; ambiguous contexts require a name. Unsupported dietary/live-status requests receive limitations. Map/pager, Back/Chat, cancellation and saved storage ownership remain intact.

See [implementation report](IMPLEMENTATION_REPORT.md) and [work journal](WORK_JOURNAL.md).
