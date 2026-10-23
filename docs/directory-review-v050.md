# Directory relationship research — 2026-10-23

The official [BGC shopping directory](https://bgc.com.ph/go/shop/) exposes building
and floor references that can improve future place relationships. A bounded review
checked these individual pages, without copying descriptions, photographs or the
whole directory:

| Research lead | Source building/floor text | Primary source |
|---|---|---|
| ABC Mart | Bonifacio High Street Central C1 building, UGF/LGF | [BGC entry](https://bgc.com.ph/directory/abc-mart/) |
| Belo Medical Clinic | One Bonifacio High Street, 2F | [BGC entry](https://bgc.com.ph/directory/belo-medical-clinic/) |

These are research leads, not approved application records. The pages do not establish
verified geographic coordinates, public entrances, immutable building identities, dataset
redistribution permission or current operating acceptance. No business, menu, price,
coordinate or floor record is added to the approved catalog from this research.

Before ingestion, capture the source snapshot and checksum, confirm reuse rights and
freshness, resolve each actual building to its canonical ID, then review the relationship
and individual facts. Preserve unknown floor/unit and entrance fields. Existing approved
SQLite parent relationships now expose `Place.buildingId` alongside the displayed building
name; this ID is assigned only when the supported parent/building facts agree. Existing
office tenant and entrance contracts remain authoritative for their own evidence gates.
