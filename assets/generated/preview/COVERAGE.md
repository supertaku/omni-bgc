# Offline preview coverage

Generated deterministically from retained repository sources and explicit enrichment inputs.

| Measure | Count |
|---|---:|
| sourceDirectoryPlaces | 161 |
| sourceRestaurants | 278 |
| directoryOnlyRestaurants | 57 |
| restaurants | 335 |
| sourceOffices | 179 |
| sourceMenuItems | 1279 |
| canonicalPlaces | 609 |
| explicitIdentityMerges | 9 |
| menuItems | 3518 |
| generatedMenuItems | 2239 |
| restaurantsWithEightItems | 335 |
| placesWithDescriptions | 609 |
| placesWithImages | 609 |
| recordedPoints | 161 |
| buildingAnchors | 362 |
| unlocated | 86 |
| refreshedOfficialRestaurantSources | 5 |

## Geographic quality

| Measure | Count |
|---|---:|
| canonicalPlaces | 609 |
| recordedPlacePoints | 161 |
| confirmedBuildingRelationships | 362 |
| reviewedBuildingAssociations | 27 |
| derivedBuildingAnchors | 362 |
| unresolvedIdentities | 86 |
| ambiguousBuildingMatches | 2 |
| missingCoordinateEvidence | 11 |
| missingBuildingPolygon | 73 |
| staleGeographicEvidence | 0 |
| undatedMappedEvidence | 0 |
| publicationRestricted | 609 |
| officeRightsUnknown | 179 |

Evidence age uses the pinned 2026-10-24 build observation date and a one-calendar-year review threshold; stale is a review flag. Each unresolved identity and its polygon-match reason is in quality.json.

## Limits

- Preview menus and estimates are generated where branch sources are missing; no approval status was upgraded.
- Building anchors represent retained address claims, not surveyed points, entrances or verified occupancy.
- Installed approved SQLite packs were not available for this source audit; runtime approved identities retain precedence.
- Source rights remain pending where imported evidence says so; no publication authorization is granted.
- Individual unresolved records and research-refresh gaps are in exceptions.json.
- Fictional demo merchants remain outside this real-establishment overlay and remain unlocated.

Input fingerprint: 4c240f4b6b98ec0cf41f99631fb5780547a6c70018cb6078579d73d1c37090ba
