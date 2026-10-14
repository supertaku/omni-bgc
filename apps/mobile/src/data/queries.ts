// Mobile projection has only exporter-approved facts. Recheck temporal lineage and conflicts
// on every read so an installed formerly-current pack cannot turn stale facts into current UI.
export const CURRENT_FACTS = `SELECT f.id fact_id,e.id entity_id,e.kind,e.parent_id,f.property,f.value_json,f.knowledge,
 s.source_id,s.license,s.attribution,s.id snapshot_id,s.raw_sha256,l.evidence_id,l.observed_at,l.verified_at,l.locator,l.verification_method
 FROM entity e JOIN fact f ON f.subject_id=e.id JOIN fact_lineage l ON l.fact_id=f.id JOIN source_snapshot s ON s.id=l.snapshot_id
 WHERE julianday(f.valid_from)<=julianday(?) AND julianday(f.valid_until)>julianday(?)
 AND julianday(l.observed_at)<=julianday(?) AND julianday(l.verified_at)<=julianday(?) AND julianday(l.valid_until)>julianday(?)
 AND julianday(s.fetched_at_utc)<=julianday(?) AND julianday(s.valid_until)>julianday(?)
 AND lower(trim(l.reviewer)) NOT IN ('','unknown','unassigned')
 AND lower(trim(s.license)) NOT IN ('','unknown','unassigned')
 AND NOT EXISTS(SELECT 1 FROM fact other WHERE other.subject_id=f.subject_id AND other.property=f.property AND other.id!=f.id
 AND f.property!='alias' AND julianday(other.valid_from)<=julianday(?) AND julianday(other.valid_until)>julianday(?)
 AND (other.knowledge!=f.knowledge OR other.value_json IS NOT f.value_json)) ORDER BY e.id,f.property,l.evidence_id`;
