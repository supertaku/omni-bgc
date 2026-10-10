# Deterministic content proposals and retrieval

Existing SQLite staging migration 1 and mobile content migrations 1/3 remain
unchanged. User state stays in its separate 1/2 database. PostgreSQL/PostGIS is a
provisional canonical target; its unimplemented bridge cannot be used to publish.

`build_content.py` reuses the M1 exporter and read-projection extension, then binds
every exported identity, fact value, complete lineage tuple, point and snapshot
metadata to exact immutable reviewed M4 intakes. Retained raw, permission and
evidence bytes are rehashed. Revoked source rights exclude previously approved
records. Output is atomic, immutable and content-checksummed; repeating input,
explicit time and projection produces the same SQLite hash. FTS5/RTree/FK/integrity
checks run before output. No favorites, itinerary, location history or settings
are exported. Synthetic intakes require an explicit test-only API flag that the
real CLI does not expose.

```powershell
python packages/database/build_content.py --help
```

Version directories must be beneath ignored `data/generated/m4/content/`.
`export-manifest.json` is **LOCAL_PROPOSAL_NOT_REMOTE_TRUST_MANIFEST** with
publication_authorized=false. The M13 reviewed catalogue remains empty. Concrete
human rights/obligations review, parent export inspection and explicit user
distribution authorization precede any remote packaging or distribution.

`retrieval.py` opens a caller-trusted content file read-only and requires an
explicit UTC query time. It supports place details/listing, category/building
directory, literal Unicode lexical search, branch-specific menus, exact decimal
budget plus currency, explicit tags, nearby facilities using RTree plus geodesic
distance, verified entrance records and exact fact evidence. Current fact,
evidence and snapshot periods and conflicts are checked on every query. Stale
parents become unknown; stale menu chains disappear. Unknown prices fail budget
filters; source tags do not imply allergens or dietary suitability. Proximity is
never a walkable route. Verified entrances still require graph review/attachment.

Details, lexical hits and spatial candidates fetch their parent lineage rather
than scanning all facts. Full listings/menu scans remain unpaginated. The host
benchmark is synthetic and does not establish mobile latency, memory or power.
Reader trust is supplied by the pack activation layer; this reference reader does
not authenticate arbitrary SQLite files or create publication permission.

Native `apps/mobile/src/data/retrieval.ts` wraps the existing current store used
by UI: findPlaces, getPlaceDetails, getRestaurantMenu, findMenuItems and
getVerifiedEntrances. Menu amounts use explicit strings and integer centavos;
unknown/non-PHP values cannot satisfy PHP budgets. Native parser now requires
current menu/place/item and building relationships and retains exact citation
fields, with separate price/tag/relationship citations. Optional fields are
additive TypeScript contracts, not SQL migrations. Existing Map/Search/Places/
Menu/Transit flows use the same store. New native runtime behavior is untested.

Future assistant clients can call these structured services and canonical lexical
document span contracts. Outputs preserve unknown/stale states and citation IDs.
No model, embedding, vector search, RAG pipeline or planner is installed. Fuzzy
ranking, retrieval pagination, merchant ingestion and native nearby/query
optimization remain future measured work.
