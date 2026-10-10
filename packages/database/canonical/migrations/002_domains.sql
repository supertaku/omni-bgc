SET search_path TO omni, public;
-- Stable domain rows describe identities and relationships. Values become public
-- only through reviewed facts; these tables are NEVER a publication interface.
CREATE TABLE service_area (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'service_area' CHECK(kind='service_area'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), boundary_fact_id uuid REFERENCES fact(id), authority text NOT NULL CHECK(authority IN ('working','authoritative','unknown')));
CREATE TABLE zone (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'zone' CHECK(kind='zone'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), service_area_id uuid NOT NULL REFERENCES service_area(id));
CREATE TABLE building_complex (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'building_complex' CHECK(kind='building_complex'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind));
CREATE TABLE building (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'building' CHECK(kind='building'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), zone_id uuid REFERENCES zone(id), complex_id uuid REFERENCES building_complex(id));
CREATE TABLE building_wing (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'building_wing' CHECK(kind='building_wing'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), building_id uuid NOT NULL REFERENCES building(id), UNIQUE(id,building_id));
CREATE TABLE floor (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'floor' CHECK(kind='floor'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), building_id uuid NOT NULL REFERENCES building(id), wing_id uuid, label text NOT NULL CHECK(length(btrim(label))>0), UNIQUE(id,building_id), FOREIGN KEY(wing_id,building_id) REFERENCES building_wing(id,building_id));
CREATE VIEW building_floor AS SELECT * FROM floor;
CREATE TABLE premises_unit (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'premises_unit' CHECK(kind='premises_unit'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), building_id uuid NOT NULL REFERENCES building(id), floor_id uuid NOT NULL, label text NOT NULL CHECK(length(btrim(label))>0), FOREIGN KEY(floor_id,building_id) REFERENCES floor(id,building_id), UNIQUE(id,building_id,floor_id));
CREATE TABLE organization (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'organization' CHECK(kind='organization'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind));
-- M1 business IDs are retained. Explicit identity review is needed before
-- deciding whether a legacy business denotes a brand or an organization.
CREATE TABLE business (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'business' CHECK(kind='business'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), organization_id uuid REFERENCES organization(id), identity_role text NOT NULL DEFAULT 'unknown' CHECK(identity_role IN ('brand','organization','unknown')));
CREATE VIEW brand AS SELECT * FROM business WHERE identity_role='brand';
CREATE TABLE place (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'place' CHECK(kind='place'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), business_id uuid REFERENCES business(id), branch_role text NOT NULL DEFAULT 'unknown' CHECK(branch_role IN ('branch','facility','unknown')));
CREATE VIEW business_branch AS SELECT * FROM place WHERE branch_role='branch';
CREATE TABLE branch_occupancy (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'branch_occupancy' CHECK(kind='branch_occupancy'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), place_id uuid NOT NULL REFERENCES place(id), building_id uuid NOT NULL REFERENCES building(id), floor_id uuid, unit_id uuid, occupancy_fact_id uuid NOT NULL REFERENCES fact(id), valid_from timestamptz NOT NULL, valid_until timestamptz NOT NULL CHECK(valid_until>valid_from), FOREIGN KEY(floor_id,building_id) REFERENCES floor(id,building_id), FOREIGN KEY(unit_id,building_id,floor_id) REFERENCES premises_unit(id,building_id,floor_id), CHECK(unit_id IS NULL OR floor_id IS NOT NULL));
CREATE INDEX occupancy_lookup ON branch_occupancy(place_id,valid_from,valid_until);
CREATE TABLE entrance (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'entrance' CHECK(kind='entrance'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), building_id uuid NOT NULL REFERENCES building(id), floor_id uuid, FOREIGN KEY(floor_id,building_id) REFERENCES floor(id,building_id));
CREATE TABLE place_entrance (place_id uuid NOT NULL REFERENCES place(id), entrance_id uuid NOT NULL REFERENCES entrance(id), access_fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(place_id,entrance_id,access_fact_id));
CREATE TABLE geographic_feature (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'geographic_feature' CHECK(kind='geographic_feature'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), feature_type text NOT NULL, zone_id uuid REFERENCES zone(id));
CREATE TABLE geometry_claim (fact_id uuid PRIMARY KEY REFERENCES fact(id), entity_id uuid NOT NULL REFERENCES entity(id), geom geometry(Geometry,4326) NOT NULL, source_crs text NOT NULL, transformation text NOT NULL, CHECK(NOT ST_IsEmpty(geom) AND ST_IsValid(geom) AND ST_NDims(geom)=2), CHECK(ST_XMin(Box3D(geom))>=-180 AND ST_XMax(Box3D(geom))<=180 AND ST_YMin(Box3D(geom))>=-90 AND ST_YMax(Box3D(geom))<=90));
CREATE INDEX geometry_claim_gist ON geometry_claim USING gist(geom);
-- Multiple candidate coordinates coexist. Close points never imply access.
CREATE TABLE point_geometry (coordinate_fact_id uuid PRIMARY KEY REFERENCES fact(id), entity_id uuid NOT NULL REFERENCES entity(id), geom geometry(Point,4326) NOT NULL, source_crs text NOT NULL, transformation text NOT NULL, CHECK(NOT ST_IsEmpty(geom) AND ST_NDims(geom)=2 AND ST_X(geom) BETWEEN -180 AND 180 AND ST_Y(geom) BETWEEN -90 AND 90));
CREATE INDEX point_geometry_gist ON point_geometry USING gist(geom);
CREATE INDEX point_geography_gist ON point_geometry USING gist((geom::geography));
CREATE TABLE accessibility_feature (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'accessibility_feature' CHECK(kind='accessibility_feature'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), entrance_id uuid REFERENCES entrance(id), feature_type text NOT NULL, access_fact_id uuid NOT NULL REFERENCES fact(id));
CREATE TABLE category (code text PRIMARY KEY, label text NOT NULL, parent_code text REFERENCES category(code), taxonomy_version integer NOT NULL CHECK(taxonomy_version>0), review review_state NOT NULL DEFAULT 'candidate');
CREATE TABLE place_category (place_id uuid NOT NULL REFERENCES place(id), category_code text NOT NULL REFERENCES category(code), fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(place_id,category_code,fact_id));
CREATE VIEW place_category_assignment AS SELECT * FROM place_category;
CREATE TABLE place_alias (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'place_alias' CHECK(kind='place_alias'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), place_id uuid NOT NULL REFERENCES place(id), alias_fact_id uuid NOT NULL REFERENCES fact(id));
CREATE TABLE place_contact (place_id uuid NOT NULL REFERENCES place(id), contact_type text NOT NULL CHECK(contact_type IN ('public_phone','official_website','public_email')), fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(place_id,contact_type,fact_id));
CREATE TABLE operating_hours (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'operating_hours' CHECK(kind='operating_hours'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), place_id uuid NOT NULL REFERENCES place(id), weekday integer NOT NULL CHECK(weekday BETWEEN 0 AND 6), hours_fact_id uuid NOT NULL REFERENCES fact(id));
CREATE VIEW opening_hours AS SELECT * FROM operating_hours;
CREATE TABLE holiday_exception (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'holiday_exception' CHECK(kind='holiday_exception'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), place_id uuid NOT NULL REFERENCES place(id), local_date date NOT NULL, hours_fact_id uuid NOT NULL REFERENCES fact(id));
CREATE VIEW opening_hours_exception AS SELECT * FROM holiday_exception;
CREATE TABLE place_service (place_id uuid NOT NULL REFERENCES place(id), service_code text NOT NULL, fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(place_id,service_code,fact_id));
CREATE TABLE place_amenity (place_id uuid NOT NULL REFERENCES place(id), amenity_code text NOT NULL, fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(place_id,amenity_code,fact_id));
CREATE TABLE public_facility (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'public_facility' CHECK(kind='public_facility'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), place_id uuid REFERENCES place(id), facility_type text NOT NULL REFERENCES category(code));

CREATE TABLE menu (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'menu' CHECK(kind='menu'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind));
CREATE TABLE branch_menu_assignment (place_id uuid NOT NULL REFERENCES place(id), menu_id uuid NOT NULL REFERENCES menu(id), assignment_fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(place_id,menu_id,assignment_fact_id));
CREATE TABLE menu_section (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'menu_section' CHECK(kind='menu_section'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), menu_id uuid NOT NULL REFERENCES menu(id), sequence integer NOT NULL CHECK(sequence>=0), UNIQUE(id,menu_id));
CREATE TABLE menu_item (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'menu_item' CHECK(kind='menu_item'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind));
CREATE TABLE menu_item_assignment (menu_id uuid NOT NULL REFERENCES menu(id), item_id uuid NOT NULL REFERENCES menu_item(id), section_id uuid, assignment_fact_id uuid NOT NULL REFERENCES fact(id), FOREIGN KEY(section_id,menu_id) REFERENCES menu_section(id,menu_id), PRIMARY KEY(menu_id,item_id,assignment_fact_id));
CREATE TABLE menu_variant (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'menu_variant' CHECK(kind='menu_variant'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), item_id uuid NOT NULL REFERENCES menu_item(id), UNIQUE(id,item_id));
CREATE TABLE menu_modifier (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'menu_modifier' CHECK(kind='menu_modifier'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), item_id uuid NOT NULL REFERENCES menu_item(id));
CREATE TABLE menu_price (fact_id uuid PRIMARY KEY REFERENCES fact(id), place_id uuid NOT NULL REFERENCES place(id), menu_id uuid NOT NULL REFERENCES menu(id), item_id uuid NOT NULL REFERENCES menu_item(id), variant_id uuid, amount_minor bigint CHECK(amount_minor>=0), currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), knowledge knowledge_state NOT NULL, FOREIGN KEY(variant_id,item_id) REFERENCES menu_variant(id,item_id), CHECK((knowledge='asserted' AND amount_minor IS NOT NULL) OR (knowledge<>'asserted' AND amount_minor IS NULL)));
CREATE INDEX menu_price_filters ON menu_price(place_id,item_id,currency,amount_minor);
CREATE TABLE menu_dietary_attribute (item_id uuid NOT NULL REFERENCES menu_item(id), attribute_code text NOT NULL, fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(item_id,attribute_code,fact_id));
CREATE TABLE menu_allergen_claim (item_id uuid NOT NULL REFERENCES menu_item(id), allergen_code text NOT NULL, fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(item_id,allergen_code,fact_id));

CREATE TABLE transit_agency (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'transit_agency' CHECK(kind='transit_agency'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind));
CREATE TABLE transit_route (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'transit_route' CHECK(kind='transit_route'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), agency_id uuid NOT NULL REFERENCES transit_agency(id));
CREATE TABLE transit_route_variant (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'transit_route_variant' CHECK(kind='transit_route_variant'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), route_id uuid NOT NULL REFERENCES transit_route(id), pattern_fact_id uuid NOT NULL REFERENCES fact(id));
CREATE TABLE transit_stop (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'transit_stop' CHECK(kind='transit_stop'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), zone_id uuid REFERENCES zone(id));
CREATE TABLE transport_stop_location (stop_id uuid NOT NULL REFERENCES transit_stop(id), coordinate_fact_id uuid NOT NULL REFERENCES point_geometry(coordinate_fact_id), entrance_id uuid REFERENCES entrance(id), PRIMARY KEY(stop_id,coordinate_fact_id));
CREATE TABLE transit_stop_sequence (variant_id uuid NOT NULL REFERENCES transit_route_variant(id), sequence integer NOT NULL CHECK(sequence>=0), stop_id uuid NOT NULL REFERENCES transit_stop(id), fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(variant_id,sequence));
CREATE TABLE transit_service_calendar (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'transit_service_calendar' CHECK(kind='transit_service_calendar'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), starts_on date NOT NULL, ends_on date NOT NULL CHECK(ends_on>=starts_on), weekdays boolean[] NOT NULL CHECK(cardinality(weekdays)=7 AND array_ndims(weekdays)=1 AND array_position(weekdays,NULL) IS NULL), calendar_fact_id uuid NOT NULL REFERENCES fact(id));
CREATE TABLE transit_trip (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'transit_trip' CHECK(kind='transit_trip'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), variant_id uuid NOT NULL REFERENCES transit_route_variant(id), calendar_id uuid NOT NULL REFERENCES transit_service_calendar(id));
CREATE TABLE transit_stop_time (trip_id uuid NOT NULL REFERENCES transit_trip(id), sequence integer NOT NULL CHECK(sequence>=0), stop_id uuid NOT NULL REFERENCES transit_stop(id), arrival_seconds integer CHECK(arrival_seconds>=0), departure_seconds integer CHECK(departure_seconds>=arrival_seconds), fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(trip_id,sequence));
CREATE TABLE transit_fare (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'transit_fare' CHECK(kind='transit_fare'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), route_id uuid NOT NULL REFERENCES transit_route(id), amount_minor bigint CHECK(amount_minor>=0), currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), fare_fact_id uuid NOT NULL REFERENCES fact(id));
CREATE TABLE transit_transfer (from_stop_id uuid NOT NULL REFERENCES transit_stop(id), to_stop_id uuid NOT NULL REFERENCES transit_stop(id), minimum_seconds integer CHECK(minimum_seconds>=0), fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(from_stop_id,to_stop_id,fact_id), CHECK(from_stop_id<>to_stop_id));
CREATE TABLE route_node (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'route_node' CHECK(kind='route_node'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), entrance_id uuid REFERENCES entrance(id), coordinate_fact_id uuid NOT NULL REFERENCES point_geometry(coordinate_fact_id), level_fact_id uuid NOT NULL REFERENCES fact(id));
CREATE VIEW pedestrian_node AS SELECT * FROM route_node;
CREATE TABLE route_edge (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'route_edge' CHECK(kind='route_edge'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), from_node_id uuid NOT NULL REFERENCES route_node(id), to_node_id uuid NOT NULL REFERENCES route_node(id), geometry_fact_id uuid NOT NULL REFERENCES geometry_claim(fact_id), length_m numeric NOT NULL CHECK(length_m>=0 AND length_m<10000000), length_crs text NOT NULL CHECK(length_crs IN ('geodesic:WGS84','EPSG:32651')), topology_review review_state NOT NULL DEFAULT 'candidate', public_access_fact_id uuid NOT NULL REFERENCES fact(id), CHECK(from_node_id<>to_node_id));
CREATE INDEX route_edge_from ON route_edge(from_node_id);
CREATE VIEW pedestrian_edge AS SELECT * FROM route_edge;
CREATE TABLE route_access_restriction (edge_id uuid NOT NULL REFERENCES route_edge(id), restriction_fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(edge_id,restriction_fact_id));
CREATE TABLE crossing (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'crossing' CHECK(kind='crossing'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), edge_id uuid NOT NULL REFERENCES route_edge(id), crossing_fact_id uuid NOT NULL REFERENCES fact(id));

-- Private authorized extraction bytes: never import text merely because public.
-- This full immutable text binds passage offsets and prevents fabricated slices.
CREATE TABLE knowledge_document (id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'knowledge_document' CHECK(kind='knowledge_document'), FOREIGN KEY(id,kind) REFERENCES entity(id,kind), snapshot_id uuid NOT NULL REFERENCES source_snapshot(id), locator meaningful_text NOT NULL, title_fact_id uuid REFERENCES fact(id), content_sha256 sha256_hex NOT NULL, extracted_text text NOT NULL, extraction_tool_version meaningful_text NOT NULL, language_code text NOT NULL, document_version meaningful_text NOT NULL, text_length integer NOT NULL CHECK(text_length>=0 AND text_length=length(extracted_text)), CHECK(content_sha256::text=encode(sha256(convert_to(extracted_text,'UTF8')),'hex')), observed_at timestamptz NOT NULL, valid_until timestamptz NOT NULL CHECK(valid_until>observed_at));
CREATE TABLE document_section (id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES knowledge_document(id), parent_id uuid, ordinal integer NOT NULL CHECK(ordinal>=0), heading text NOT NULL, start_offset integer NOT NULL CHECK(start_offset>=0), end_offset integer NOT NULL CHECK(end_offset>start_offset), UNIQUE(id,document_id), FOREIGN KEY(parent_id,document_id) REFERENCES document_section(id,document_id), CHECK(parent_id IS NULL OR parent_id<>id));
CREATE TABLE retrieval_passage (id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES knowledge_document(id), section_id uuid NOT NULL, start_offset integer NOT NULL CHECK(start_offset>=0), end_offset integer NOT NULL CHECK(end_offset>start_offset), body text NOT NULL, citation_id meaningful_text NOT NULL UNIQUE, evidence_id uuid NOT NULL REFERENCES evidence(id), content_sha256 sha256_hex NOT NULL, review review_state NOT NULL DEFAULT 'candidate', FOREIGN KEY(section_id,document_id) REFERENCES document_section(id,document_id));
CREATE INDEX passage_lexical ON retrieval_passage USING gin(to_tsvector('simple',body));
CREATE TABLE document_entity_link (document_id uuid NOT NULL REFERENCES knowledge_document(id), entity_id uuid NOT NULL REFERENCES entity(id), link_fact_id uuid NOT NULL REFERENCES fact(id), PRIMARY KEY(document_id,entity_id,link_fact_id));
CREATE TABLE retrieval_evaluation_case (id text PRIMARY KEY, query text NOT NULL, filters jsonb NOT NULL, expected_entity_ids uuid[] NOT NULL DEFAULT '{}', expected_citation_ids text[] NOT NULL DEFAULT '{}', assertion text NOT NULL, synthetic boolean NOT NULL DEFAULT true);
CREATE TABLE publication_batch (id uuid PRIMARY KEY, as_of_utc timestamptz NOT NULL, actor meaningful_text NOT NULL, state text NOT NULL CHECK(state IN ('proposed','accepted','rejected')), rights_manifest_sha256 sha256_hex NOT NULL, review_reference meaningful_text NOT NULL);
CREATE TABLE dataset_version (id uuid PRIMARY KEY, publication_batch_id uuid NOT NULL REFERENCES publication_batch(id), schema_version integer NOT NULL CHECK(schema_version>0), api_version integer NOT NULL CHECK(api_version>0), created_at timestamptz NOT NULL, valid_until timestamptz NOT NULL CHECK(valid_until>created_at));
CREATE TABLE export_manifest (dataset_version_id uuid PRIMARY KEY REFERENCES dataset_version(id), file_sha256 sha256_hex NOT NULL, size_bytes bigint NOT NULL CHECK(size_bytes>=0), counts jsonb NOT NULL, license_bundle jsonb NOT NULL);
-- Domain relations are append-only versions, never silent pointer edits.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema='omni' AND table_type='BASE TABLE' AND table_name NOT IN ('entity','source','source_use_policy','evidence','fact','review_queue','identity_candidate','audit_event','source_snapshot','fact_evidence','fact_history','external_reference','review_decision','identity_resolution','acquisition_run','business','place','route_edge','retrieval_passage','category','publication_batch') LOOP
  EXECUTE format('CREATE TRIGGER immutable_domain BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION deny_mutation()',t);
 END LOOP;
END $$;
CREATE FUNCTION guard_domain_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-TG_ARGV) IS DISTINCT FROM (to_jsonb(OLD)-TG_ARGV)
 THEN RAISE EXCEPTION 'append new domain relationship rather than rewrite history'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER business_version BEFORE UPDATE OR DELETE ON business FOR EACH ROW EXECUTE FUNCTION guard_domain_version('identity_role');
CREATE TRIGGER place_version BEFORE UPDATE OR DELETE ON place FOR EACH ROW EXECUTE FUNCTION guard_domain_version('branch_role');
CREATE TRIGGER edge_version BEFORE UPDATE OR DELETE ON route_edge FOR EACH ROW EXECUTE FUNCTION guard_domain_version('topology_review');
CREATE TRIGGER passage_version BEFORE UPDATE OR DELETE ON retrieval_passage FOR EACH ROW EXECUTE FUNCTION guard_domain_version('review');
CREATE TRIGGER category_version BEFORE UPDATE OR DELETE ON category FOR EACH ROW EXECUTE FUNCTION guard_domain_version('review');
CREATE TRIGGER batch_version BEFORE UPDATE OR DELETE ON publication_batch FOR EACH ROW EXECUTE FUNCTION guard_domain_version('state');
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['business','place','route_edge','retrieval_passage','category','publication_batch','review_queue'] LOOP
  EXECUTE format('CREATE TRIGGER domain_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_mutation()',t);
 END LOOP;
END $$;
