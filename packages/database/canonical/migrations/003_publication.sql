SET search_path TO omni, public;
-- No broad free-form fact allowlist. Every added public property needs reviewed
-- semantics plus a new migration; menu data uses the conservative menu_text gate.
CREATE TABLE property_policy (property text PRIMARY KEY, permitted_use text NOT NULL CHECK(permitted_use IN ('data','menu_text','document_text')), value_type text NOT NULL CHECK(value_type IN ('string','object','array','boolean','number','any')), cardinality text NOT NULL DEFAULT 'one' CHECK(cardinality IN ('one','many')));
INSERT INTO property_policy(property,permitted_use,value_type) VALUES
 ('name','data','string'),('alias','data','string'),('description','data','string'),
 ('coordinate','data','object'),('geometry','data','object'),('category','data','string'),
 ('building','data','string'),('floor','data','string'),('place','data','string'),
 ('menu','menu_text','string'),('agency','data','string'),('occupancy','data','object'),
 ('hours','data','object'),('contact','data','object'),('amenity','data','string'),('service','data','string'),
 ('access','data','object'),('entrance_access','data','object'),('level','data','any'),
 ('route_pattern','data','object'),('calendar','data','object'),('stop_sequence','data','array'),
 ('stop_time','data','object'),('fare','data','object'),('transfer','data','object'),
 ('cuisine','menu_text','string'),('price','menu_text','object'),('tag','menu_text','string'),
 ('ingredient','menu_text','string'),('dietary','menu_text','object'),('allergen','menu_text','object'),
 ('menu_assignment','menu_text','object'),('item_assignment','menu_text','object'),('document_link','document_text','string');
UPDATE property_policy SET cardinality='many' WHERE property IN ('category','alias','tag','ingredient','cuisine','amenity','service','contact','menu_assignment','item_assignment','document_link','entrance_access','price');
CREATE TRIGGER property_policy_immutable BEFORE UPDATE OR DELETE ON property_policy FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE FUNCTION required_use(entity_kind text,requested_property text) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN entity_kind IN ('menu','menu_section','menu_item','menu_variant','menu_modifier') THEN 'menu_text' ELSE permitted_use END FROM property_policy WHERE property=requested_property
$$;
CREATE FUNCTION has_meaningful_text(value text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT value IS NOT NULL AND lower(btrim(value)) NOT IN ('','unknown','null','n/a','none','pending','not_reviewed','tbd','placeholder')
$$;

CREATE FUNCTION eligible_evidence(at_utc timestamptz, requested_use text)
RETURNS TABLE(evidence_id uuid,snapshot_id uuid,source_id text,locator text,raw_sha256 text,attribution_text text)
LANGUAGE sql STABLE AS $$
 SELECT e.id, ss.id, s.source_id::text, e.locator::text, ss.raw_sha256::text, s.attribution_text
 FROM evidence e JOIN entity ee ON ee.id=e.id
 JOIN source_snapshot ss ON ss.id=e.snapshot_id JOIN entity se ON se.id=ss.id
 JOIN source s ON s.source_id=ss.source_id
 JOIN source_use_policy p ON p.snapshot_id=ss.id AND p.source_id=s.source_id AND p.raw_sha256=ss.raw_sha256 AND p.permitted_use=requested_use
 WHERE at_utc IS NOT NULL AND requested_use IN ('data','menu_text','document_text','image')
 AND e.review='approved' AND ee.review='approved' AND se.review='approved'
 AND e.observed_at<=at_utc AND e.verified_at<=at_utc AND e.valid_until>at_utc
 AND ss.fetched_at_utc<=at_utc AND ss.valid_until>at_utc
 AND s.review_status='APPROVED' AND s.redistribution_allowed='true'
 AND has_meaningful_text(s.data_license) AND has_meaningful_text(s.attribution_text)
 AND has_meaningful_text(s.jurisdiction) AND has_meaningful_text(s.retention_terms)
 AND has_meaningful_text(s.consent_reference) AND has_meaningful_text(s.reviewer)
 AND has_meaningful_text(ss.source_version) AND has_meaningful_text(e.reviewer)
 AND has_meaningful_text(e.verification_method) AND has_meaningful_text(e.confidence_reason)
 AND s.review_timestamp>=ss.fetched_at_utc AND s.review_timestamp<=at_utc
 AND p.offline_cache_allowed='true' AND p.valid_until>at_utc AND p.reviewed_at_utc<=at_utc AND p.reviewed_at_utc>=ss.fetched_at_utc
 AND p.license_obligations_satisfied AND p.human_rights_review AND p.parent_engineering_review AND p.user_distribution_authorized
 AND lower(btrim(s.source_kind)) NOT IN ('public_osm_raster','osmf_public_raster')
 AND lower(btrim(s.category))<>'public_raster_tile_policy' AND lower(s.source_url_or_document) NOT LIKE '%tile.openstreetmap.org%'
 AND (requested_use<>'menu_text' OR s.menu_text_allowed='true')
 AND (requested_use<>'document_text' OR s.document_text_allowed='true')
 AND (requested_use<>'image' OR s.images_allowed='true')
$$;

CREATE FUNCTION approved_facts(at_utc timestamptz)
RETURNS TABLE(fact_id uuid,entity_id uuid,property text,knowledge text,value_json jsonb,citation_ids uuid[],verified_at timestamptz,valid_until timestamptz)
LANGUAGE sql STABLE AS $$
 SELECT f.id, f.subject_id, f.property::text, f.knowledge::text, f.value_json,
 array_agg(DISTINCT ee.evidence_id ORDER BY ee.evidence_id), max(ev.verified_at),
 least(f.valid_until,min(ev.valid_until),min(ss.valid_until),min(p.valid_until))
 FROM fact f JOIN entity subject ON subject.id=f.subject_id JOIN entity fei ON fei.id=f.id
 JOIN property_policy pp ON pp.property=f.property
 JOIN fact_evidence fe ON fe.fact_id=f.id AND fe.role='supports'
 JOIN LATERAL eligible_evidence(at_utc,required_use(subject.kind,f.property)) ee ON ee.evidence_id=fe.evidence_id
 JOIN evidence ev ON ev.id=ee.evidence_id JOIN source_snapshot ss ON ss.id=ee.snapshot_id
 JOIN source_use_policy p ON p.snapshot_id=ss.id AND p.permitted_use=required_use(subject.kind,f.property)
 WHERE f.review='approved' AND fei.review='approved' AND subject.review='approved'
 AND f.freshness='current' AND f.valid_from<=at_utc AND f.valid_until>at_utc
 AND (f.knowledge<>'asserted' OR pp.value_type='any' OR jsonb_typeof(f.value_json)=pp.value_type)
 AND (f.knowledge<>'asserted' OR pp.value_type<>'string' OR length(btrim(f.value_json#>>'{}'))>0)
 AND (f.property<>'coordinate' OR EXISTS(SELECT 1 FROM point_geometry pg WHERE pg.coordinate_fact_id=f.id AND pg.entity_id=f.subject_id))
 AND (f.property<>'geometry' OR EXISTS(SELECT 1 FROM geometry_claim gc WHERE gc.fact_id=f.id AND gc.entity_id=f.subject_id))
 AND (f.property<>'category' OR EXISTS(SELECT 1 FROM place_category pc JOIN category c ON c.code=pc.category_code WHERE pc.fact_id=f.id AND pc.place_id=f.subject_id AND c.review='approved'))
 AND NOT EXISTS(SELECT 1 FROM review_queue q WHERE q.subject_id IN (f.subject_id,f.id) AND q.status='open')
 AND NOT EXISTS(SELECT 1 FROM fact_history h WHERE h.old_fact_id=f.id AND h.recorded_at<=at_utc)
 AND NOT EXISTS(SELECT 1 FROM fact_evidence cx JOIN evidence ce ON ce.id=cx.evidence_id
   WHERE cx.fact_id=f.id AND cx.role='contradicts' AND ce.review='approved' AND ce.observed_at<=at_utc AND ce.valid_until>at_utc)
 AND NOT EXISTS(SELECT 1 FROM fact cf WHERE cf.id<>f.id AND cf.subject_id=f.subject_id AND cf.property=f.property
   AND cf.review='approved' AND cf.freshness='current' AND cf.valid_from<=at_utc AND cf.valid_until>at_utc
   AND (pp.cardinality='one' OR (f.property='price' AND (cf.value_json->'branch',cf.value_json->'menu',cf.value_json->'variant') IS NOT DISTINCT FROM (f.value_json->'branch',f.value_json->'menu',f.value_json->'variant')))
   AND (cf.knowledge,cf.value_json) IS DISTINCT FROM (f.knowledge,f.value_json)
   AND NOT EXISTS(SELECT 1 FROM fact_history h WHERE h.old_fact_id=cf.id AND h.recorded_at<=at_utc))
 GROUP BY f.id,f.subject_id,f.property,f.knowledge,f.value_json,f.valid_until
$$;

CREATE FUNCTION get_source_evidence(subject uuid, requested_property text, at_utc timestamptz)
RETURNS TABLE(fact_id uuid,evidence_id uuid,snapshot_id uuid,source_id text,locator text,raw_sha256 text,attribution_text text)
LANGUAGE sql STABLE AS $$
 SELECT f.fact_id, ee.* FROM approved_facts(at_utc) f JOIN entity e ON e.id=f.entity_id
 JOIN LATERAL eligible_evidence(at_utc,required_use(e.kind,f.property)) ee ON ee.evidence_id=ANY(f.citation_ids)
 WHERE f.entity_id=subject AND f.property=requested_property
$$;
CREATE FUNCTION find_nearby_places(lon double precision, lat double precision, radius_m double precision, at_utc timestamptz)
RETURNS TABLE(place_id uuid,name text,longitude double precision,latitude double precision,distance_m double precision,coordinate_fact_id uuid,citation_ids uuid[])
LANGUAGE plpgsql STABLE AS $$
BEGIN
 IF lon IS NULL OR lat IS NULL OR radius_m IS NULL OR lon NOT BETWEEN -180 AND 180 OR lat NOT BETWEEN -90 AND 90 OR radius_m NOT BETWEEN 0 AND 10000
 THEN RAISE EXCEPTION 'WGS84 coordinates and radius 0..10000 metres required'; END IF;
 RETURN QUERY SELECT pl.id,n.value_json#>>'{}',ST_X(pg.geom),ST_Y(pg.geom),
 ST_Distance(pg.geom::geography,ST_SetSRID(ST_MakePoint(lon,lat),4326)::geography),pg.coordinate_fact_id,c.citation_ids
 FROM place pl JOIN point_geometry pg ON pg.entity_id=pl.id
 JOIN approved_facts(at_utc) c ON c.fact_id=pg.coordinate_fact_id AND c.entity_id=pl.id AND c.property='coordinate' AND c.knowledge='asserted'
 JOIN approved_facts(at_utc) n ON n.entity_id=pl.id AND n.property='name' AND n.knowledge='asserted'
 JOIN entity identity ON identity.id=pl.id AND identity.location_quality='verified'
 WHERE ST_DWithin(pg.geom::geography,ST_SetSRID(ST_MakePoint(lon,lat),4326)::geography,radius_m)
 ORDER BY 5,pl.id;
END $$;
CREATE FUNCTION relevant_knowledge_passages(query_text text,at_utc timestamptz,entity_filter uuid DEFAULT NULL)
RETURNS TABLE(passage_id uuid,citation_id text,body text,document_id uuid,section_id uuid,start_offset integer,end_offset integer,evidence_id uuid)
LANGUAGE sql STABLE AS $$
 SELECT p.id,p.citation_id::text,p.body,p.document_id,p.section_id,p.start_offset,p.end_offset,p.evidence_id
 FROM retrieval_passage p JOIN knowledge_document d ON d.id=p.document_id JOIN entity de ON de.id=d.id
 JOIN eligible_evidence(at_utc,'document_text') ee ON ee.evidence_id=p.evidence_id AND ee.snapshot_id=d.snapshot_id
 WHERE p.review='approved' AND de.review='approved' AND d.observed_at<=at_utc AND d.valid_until>at_utc
 AND to_tsvector('simple',p.body) @@ plainto_tsquery('simple',query_text)
 AND (entity_filter IS NULL OR EXISTS(SELECT 1 FROM document_entity_link dl JOIN approved_facts(at_utc) f ON f.fact_id=dl.link_fact_id
  WHERE dl.document_id=d.id AND dl.entity_id=entity_filter AND f.property='document_link' AND f.knowledge='asserted'))
 ORDER BY p.id LIMIT 50
$$;
CREATE VIEW verification_record AS SELECT id AS evidence_id,review,reviewer,verified_at,verification_method,confidence_reason FROM evidence;
CREATE VIEW license_permission AS SELECT * FROM source_use_policy;
CREATE VIEW source_attribution AS SELECT source_id,data_license,attribution_text FROM source;
CREATE VIEW retrieval_eligibility AS SELECT p.id,p.document_id,p.review,d.snapshot_id,d.valid_until FROM retrieval_passage p JOIN knowledge_document d ON d.id=p.document_id;
COMMENT ON VIEW retrieval_eligibility IS 'Reviewer metadata only; actual eligibility requires relevant_knowledge_passages with explicit as-of time and current rights.';
REVOKE ALL ON ALL TABLES IN SCHEMA omni FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA omni FROM PUBLIC;
-- History links cannot supersede a fact belonging to another subject/property.
CREATE FUNCTION guard_supersession() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_f fact; new_f fact;
BEGIN
 SELECT * INTO old_f FROM fact WHERE id=NEW.old_fact_id;
 SELECT * INTO new_f FROM fact WHERE id=NEW.new_fact_id;
 IF (old_f.subject_id,old_f.property) IS DISTINCT FROM (new_f.subject_id,new_f.property)
 THEN RAISE EXCEPTION 'supersession must preserve subject and property'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER supersession_subject BEFORE INSERT ON fact_history FOR EACH ROW EXECUTE FUNCTION guard_supersession();
