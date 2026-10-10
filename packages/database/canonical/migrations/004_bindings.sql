SET search_path TO omni, public;
-- Cross-row CHECKs are deliberately avoided. Immutable fact values and immutable
-- domain pointers make these insert guards durable until an explicit migration.
CREATE FUNCTION bind_fact() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data jsonb:=to_jsonb(NEW); f fact;
BEGIN
 SELECT * INTO f FROM fact WHERE id=(row_data->>TG_ARGV[0])::uuid;
 IF f.id IS NULL OR f.subject_id IS DISTINCT FROM (row_data->>TG_ARGV[1])::uuid OR f.property IS DISTINCT FROM TG_ARGV[2]
 THEN RAISE EXCEPTION 'wrong fact subject/property on %',TG_TABLE_NAME; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER occupancy_fact BEFORE INSERT ON branch_occupancy FOR EACH ROW EXECUTE FUNCTION bind_fact('occupancy_fact_id','place_id','occupancy');
CREATE TRIGGER entrance_fact BEFORE INSERT ON place_entrance FOR EACH ROW EXECUTE FUNCTION bind_fact('access_fact_id','place_id','entrance_access');
CREATE TRIGGER geometry_fact BEFORE INSERT ON geometry_claim FOR EACH ROW EXECUTE FUNCTION bind_fact('fact_id','entity_id','geometry');
CREATE TRIGGER point_fact BEFORE INSERT ON point_geometry FOR EACH ROW EXECUTE FUNCTION bind_fact('coordinate_fact_id','entity_id','coordinate');
CREATE TRIGGER category_fact BEFORE INSERT ON place_category FOR EACH ROW EXECUTE FUNCTION bind_fact('fact_id','place_id','category');
CREATE TRIGGER alias_fact BEFORE INSERT ON place_alias FOR EACH ROW EXECUTE FUNCTION bind_fact('alias_fact_id','place_id','alias');
CREATE TRIGGER contact_fact BEFORE INSERT ON place_contact FOR EACH ROW EXECUTE FUNCTION bind_fact('fact_id','place_id','contact');
CREATE TRIGGER hours_fact BEFORE INSERT ON operating_hours FOR EACH ROW EXECUTE FUNCTION bind_fact('hours_fact_id','place_id','hours');
CREATE TRIGGER exception_fact BEFORE INSERT ON holiday_exception FOR EACH ROW EXECUTE FUNCTION bind_fact('hours_fact_id','place_id','hours');
CREATE TRIGGER service_fact BEFORE INSERT ON place_service FOR EACH ROW EXECUTE FUNCTION bind_fact('fact_id','place_id','service');
CREATE TRIGGER amenity_fact BEFORE INSERT ON place_amenity FOR EACH ROW EXECUTE FUNCTION bind_fact('fact_id','place_id','amenity');
CREATE TRIGGER menu_assignment_fact BEFORE INSERT ON branch_menu_assignment FOR EACH ROW EXECUTE FUNCTION bind_fact('assignment_fact_id','place_id','menu_assignment');
CREATE TRIGGER item_assignment_fact BEFORE INSERT ON menu_item_assignment FOR EACH ROW EXECUTE FUNCTION bind_fact('assignment_fact_id','item_id','item_assignment');
CREATE TRIGGER price_fact BEFORE INSERT ON menu_price FOR EACH ROW EXECUTE FUNCTION bind_fact('fact_id','item_id','price');
CREATE TRIGGER dietary_fact BEFORE INSERT ON menu_dietary_attribute FOR EACH ROW EXECUTE FUNCTION bind_fact('fact_id','item_id','dietary');
CREATE TRIGGER allergen_fact BEFORE INSERT ON menu_allergen_claim FOR EACH ROW EXECUTE FUNCTION bind_fact('fact_id','item_id','allergen');
CREATE TRIGGER pattern_fact BEFORE INSERT ON transit_route_variant FOR EACH ROW EXECUTE FUNCTION bind_fact('pattern_fact_id','id','route_pattern');
CREATE TRIGGER sequence_fact BEFORE INSERT ON transit_stop_sequence FOR EACH ROW EXECUTE FUNCTION bind_fact('fact_id','variant_id','stop_sequence');
CREATE TRIGGER calendar_fact BEFORE INSERT ON transit_service_calendar FOR EACH ROW EXECUTE FUNCTION bind_fact('calendar_fact_id','id','calendar');
CREATE TRIGGER stoptime_fact BEFORE INSERT ON transit_stop_time FOR EACH ROW EXECUTE FUNCTION bind_fact('fact_id','trip_id','stop_time');
CREATE TRIGGER fare_fact BEFORE INSERT ON transit_fare FOR EACH ROW EXECUTE FUNCTION bind_fact('fare_fact_id','id','fare');
CREATE TRIGGER transfer_fact BEFORE INSERT ON transit_transfer FOR EACH ROW EXECUTE FUNCTION bind_fact('fact_id','from_stop_id','transfer');
CREATE TRIGGER edge_access_fact BEFORE INSERT ON route_edge FOR EACH ROW EXECUTE FUNCTION bind_fact('public_access_fact_id','id','access');
CREATE TRIGGER level_fact BEFORE INSERT ON route_node FOR EACH ROW EXECUTE FUNCTION bind_fact('level_fact_id','id','level');
CREATE TRIGGER restriction_fact BEFORE INSERT ON route_access_restriction FOR EACH ROW EXECUTE FUNCTION bind_fact('restriction_fact_id','edge_id','access');
CREATE TRIGGER crossing_fact BEFORE INSERT ON crossing FOR EACH ROW EXECUTE FUNCTION bind_fact('crossing_fact_id','id','access');
CREATE TRIGGER document_link_fact BEFORE INSERT ON document_entity_link FOR EACH ROW EXECUTE FUNCTION bind_fact('link_fact_id','entity_id','document_link');
CREATE TRIGGER node_coordinate_fact BEFORE INSERT ON route_node FOR EACH ROW EXECUTE FUNCTION bind_fact('coordinate_fact_id','id','coordinate');
CREATE TRIGGER stop_coordinate_fact BEFORE INSERT ON transport_stop_location FOR EACH ROW EXECUTE FUNCTION bind_fact('coordinate_fact_id','stop_id','coordinate');
CREATE TRIGGER edge_geometry_fact BEFORE INSERT ON route_edge FOR EACH ROW EXECUTE FUNCTION bind_fact('geometry_fact_id','id','geometry');
CREATE TRIGGER accessibility_fact BEFORE INSERT ON accessibility_feature FOR EACH ROW EXECUTE FUNCTION bind_fact('access_fact_id','id','access');
CREATE FUNCTION guard_typed_value() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE f fact;
BEGIN
 IF TG_TABLE_NAME='point_geometry' THEN
  SELECT * INTO f FROM fact WHERE id=NEW.coordinate_fact_id;
  IF f.knowledge<>'asserted' OR jsonb_typeof(f.value_json->'longitude') IS DISTINCT FROM 'number'
   OR jsonb_typeof(f.value_json->'latitude') IS DISTINCT FROM 'number'
   OR (f.value_json->>'crs') IS DISTINCT FROM 'EPSG:4326'
   OR (f.value_json->>'longitude')::double precision IS DISTINCT FROM ST_X(NEW.geom)
   OR (f.value_json->>'latitude')::double precision IS DISTINCT FROM ST_Y(NEW.geom)
  THEN RAISE EXCEPTION 'coordinate fact/CRS mismatch'; END IF;
 ELSIF TG_TABLE_NAME='geometry_claim' THEN
  SELECT * INTO f FROM fact WHERE id=NEW.fact_id;
  IF f.knowledge<>'asserted' OR NOT ST_Equals(NEW.geom,ST_SetSRID(ST_GeomFromGeoJSON(f.value_json::text),4326))
  THEN RAISE EXCEPTION 'geometry fact mismatch'; END IF;
 ELSIF TG_TABLE_NAME='place_category' THEN
  SELECT * INTO f FROM fact WHERE id=NEW.fact_id;
  IF f.knowledge<>'asserted' OR f.value_json IS DISTINCT FROM to_jsonb(NEW.category_code)
  THEN RAISE EXCEPTION 'category fact mismatch'; END IF;
 ELSIF TG_TABLE_NAME='branch_occupancy' THEN
  SELECT * INTO f FROM fact WHERE id=NEW.occupancy_fact_id;
  IF f.knowledge<>'asserted' OR f.value_json IS DISTINCT FROM jsonb_build_object('building',NEW.building_id,'floor',NEW.floor_id,'unit',NEW.unit_id)
   OR (f.valid_from,f.valid_until) IS DISTINCT FROM (NEW.valid_from,NEW.valid_until)
  THEN RAISE EXCEPTION 'occupancy relationship/period mismatch'; END IF;
 ELSIF TG_TABLE_NAME='place_entrance' THEN
  SELECT * INTO f FROM fact WHERE id=NEW.access_fact_id;
  IF f.knowledge<>'asserted' OR (f.value_json->>'entrance') IS DISTINCT FROM NEW.entrance_id::text
  THEN RAISE EXCEPTION 'entrance relationship mismatch'; END IF;
 ELSIF TG_TABLE_NAME='branch_menu_assignment' THEN
  SELECT * INTO f FROM fact WHERE id=NEW.assignment_fact_id;
  IF f.knowledge<>'asserted' OR (f.value_json->>'menu') IS DISTINCT FROM NEW.menu_id::text
  THEN RAISE EXCEPTION 'menu branch relationship mismatch'; END IF;
 ELSIF TG_TABLE_NAME='menu_item_assignment' THEN
  SELECT * INTO f FROM fact WHERE id=NEW.assignment_fact_id;
  IF f.knowledge<>'asserted' OR (f.value_json->>'menu') IS DISTINCT FROM NEW.menu_id::text
   OR (f.value_json->>'section') IS DISTINCT FROM NEW.section_id::text
  THEN RAISE EXCEPTION 'item menu relationship mismatch'; END IF;
 ELSIF TG_TABLE_NAME='menu_price' THEN
  SELECT * INTO f FROM fact WHERE id=NEW.fact_id;
  IF f.knowledge IS DISTINCT FROM NEW.knowledge OR (f.knowledge='asserted' AND
   f.value_json IS DISTINCT FROM jsonb_build_object('branch',NEW.place_id,'menu',NEW.menu_id,'variant',NEW.variant_id,'amount_minor',NEW.amount_minor,'currency',btrim(NEW.currency)))
  THEN RAISE EXCEPTION 'branch price value mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['point_geometry','geometry_claim','place_category','branch_occupancy','place_entrance','branch_menu_assignment','menu_item_assignment','menu_price'] LOOP
  EXECUTE format('CREATE TRIGGER typed_value BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION guard_typed_value()',t);
 END LOOP;
END $$;
CREATE FUNCTION guard_document_span() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d knowledge_document; s document_section; e evidence;
BEGIN
 SELECT * INTO d FROM knowledge_document WHERE id=NEW.document_id;
 IF NEW.end_offset>d.text_length THEN RAISE EXCEPTION 'span exceeds source document'; END IF;
 IF TG_TABLE_NAME='document_section' AND NEW.parent_id IS NOT NULL THEN
  SELECT * INTO s FROM document_section WHERE id=NEW.parent_id;
  IF NEW.start_offset<s.start_offset OR NEW.end_offset>s.end_offset THEN RAISE EXCEPTION 'section outside parent'; END IF;
 ELSIF TG_TABLE_NAME='retrieval_passage' THEN
  SELECT * INTO s FROM document_section WHERE id=NEW.section_id;
  SELECT * INTO e FROM evidence WHERE id=NEW.evidence_id;
  IF NEW.start_offset<s.start_offset OR NEW.end_offset>s.end_offset
   OR length(NEW.body)<>NEW.end_offset-NEW.start_offset OR e.snapshot_id IS DISTINCT FROM d.snapshot_id
   OR NEW.body IS DISTINCT FROM substring(d.extracted_text FROM NEW.start_offset+1 FOR NEW.end_offset-NEW.start_offset)
   OR NEW.content_sha256::text IS DISTINCT FROM encode(sha256(convert_to(NEW.body,'UTF8')),'hex')
  THEN RAISE EXCEPTION 'passage bounds/hash/snapshot mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER section_span BEFORE INSERT ON document_section FOR EACH ROW EXECUTE FUNCTION guard_document_span();
CREATE TRIGGER passage_span BEFORE INSERT ON retrieval_passage FOR EACH ROW EXECUTE FUNCTION guard_document_span();
CREATE FUNCTION guard_source_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.source_id<>OLD.source_id THEN RAISE EXCEPTION 'retain immutable source identity'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER source_identity BEFORE UPDATE OR DELETE ON source FOR EACH ROW EXECUTE FUNCTION guard_source_id();
CREATE FUNCTION guard_queue_resolution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status<>'open' AND NOT EXISTS(SELECT 1 FROM review_decision d WHERE d.id=NEW.resolution_decision_id AND d.subject_id=NEW.subject_id)
 THEN RAISE EXCEPTION 'queue decision must review the same subject'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id,NEW.subject_id,NEW.reason) IS DISTINCT FROM (OLD.id,OLD.subject_id,OLD.reason)
 THEN RAISE EXCEPTION 'queue identity/context is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER queue_resolution BEFORE INSERT OR UPDATE ON review_queue FOR EACH ROW EXECUTE FUNCTION guard_queue_resolution();
CREATE TRIGGER queue_retain BEFORE DELETE ON review_queue FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE FUNCTION guard_edge_geometry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE line geometry; origin geometry; destination geometry;
BEGIN
 SELECT geom INTO line FROM geometry_claim WHERE fact_id=NEW.geometry_fact_id;
 SELECT p.geom INTO origin FROM route_node n JOIN point_geometry p ON p.coordinate_fact_id=n.coordinate_fact_id WHERE n.id=NEW.from_node_id;
 SELECT p.geom INTO destination FROM route_node n JOIN point_geometry p ON p.coordinate_fact_id=n.coordinate_fact_id WHERE n.id=NEW.to_node_id;
 IF ST_GeometryType(line) IS DISTINCT FROM 'ST_LineString' OR NOT ST_Equals(ST_StartPoint(line),origin) OR NOT ST_Equals(ST_EndPoint(line),destination)
 THEN RAISE EXCEPTION 'edge geometry must be a LineString with exact node endpoints'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER edge_endpoints BEFORE INSERT ON route_edge FOR EACH ROW EXECUTE FUNCTION guard_edge_geometry();
CREATE FUNCTION guard_document_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM fact f WHERE f.id=NEW.link_fact_id AND f.knowledge='asserted' AND f.value_json=to_jsonb(NEW.document_id::text))
 THEN RAISE EXCEPTION 'document entity relationship mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER document_link_value BEFORE INSERT ON document_entity_link FOR EACH ROW EXECUTE FUNCTION guard_document_link();
-- Function-local path persists across fresh sessions and excludes caller schemas.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='omni' LOOP
  EXECUTE format('ALTER FUNCTION %s SET search_path TO pg_catalog, omni, public, pg_temp',f.oid::regprocedure);
 END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA omni FROM PUBLIC;
