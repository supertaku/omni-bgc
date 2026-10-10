-- Additive canonical target. Apply only through migrate.py to an explicit local DB.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA omni;
REVOKE ALL ON SCHEMA omni FROM PUBLIC;
SET search_path TO omni, public;

CREATE DOMAIN review_state AS text CHECK (VALUE IN ('candidate','pending','approved','rejected','quarantined'));
CREATE DOMAIN knowledge_state AS text CHECK (VALUE IN ('asserted','unknown','absent','not_applicable'));
CREATE DOMAIN sha256_hex AS text CHECK (VALUE ~ '^[0-9a-f]{64}$');
CREATE DOMAIN meaningful_text AS text CHECK (length(btrim(VALUE)) > 0 AND lower(btrim(VALUE)) NOT IN ('unknown','null','n/a','none','pending','not_reviewed','tbd','placeholder'));
CREATE TABLE entity (
 id uuid PRIMARY KEY CHECK (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 kind text NOT NULL CHECK(kind IN ('service_area','zone','building','building_geometry','building_complex','building_wing','floor','premises_unit','entrance','place','place_alias','organization','business','branch_occupancy','menu','menu_section','menu_item','menu_variant','menu_modifier','operating_hours','holiday_exception','geographic_feature','accessibility_feature','public_facility','transit_agency','transit_route','transit_route_variant','transit_stop','transit_service_calendar','transit_trip','transit_fare','route_node','route_edge','route_access_restriction','crossing','knowledge_document','source_snapshot','evidence','fact','review_queue','audit_event','saved_place','saved_itinerary','pack_manifest')), review review_state NOT NULL DEFAULT 'candidate',
 location_quality text NOT NULL DEFAULT 'unknown' CHECK (location_quality IN ('verified','ambiguous','unknown')),
 recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(), UNIQUE (id,kind)
);
CREATE TABLE source (
 source_id meaningful_text PRIMARY KEY, owner meaningful_text NOT NULL,
 source_url_or_document meaningful_text NOT NULL, source_kind meaningful_text NOT NULL,
 category meaningful_text NOT NULL, data_license text NOT NULL,
 redistribution_allowed text NOT NULL DEFAULT 'UNKNOWN' CHECK (redistribution_allowed IN ('true','false','UNKNOWN')),
 images_allowed text NOT NULL DEFAULT 'UNKNOWN' CHECK (images_allowed IN ('true','false','UNKNOWN')),
 menu_text_allowed text NOT NULL DEFAULT 'UNKNOWN' CHECK (menu_text_allowed IN ('true','false','UNKNOWN')),
 document_text_allowed text NOT NULL DEFAULT 'UNKNOWN' CHECK (document_text_allowed IN ('true','false','UNKNOWN')),
 attribution_text text NOT NULL DEFAULT '', jurisdiction text, retention_terms text,
 consent_reference text, reviewer text, review_timestamp timestamptz,
 review_status text NOT NULL DEFAULT 'CANDIDATE' CHECK (review_status IN ('CANDIDATE','RESEARCH_ONLY','APPROVED','REJECTED','BLOCKED','STALE','REVOKED'))
);
CREATE TABLE source_snapshot (
 id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'source_snapshot' CHECK (kind='source_snapshot'),
 FOREIGN KEY (id,kind) REFERENCES entity(id,kind),
 source_id text NOT NULL REFERENCES source(source_id), source_version text,
 data_extract_version meaningful_text NOT NULL, raw_sha256 sha256_hex NOT NULL,
 retained_relative_path meaningful_text NOT NULL, fetched_at_utc timestamptz NOT NULL,
 source_published_at timestamptz, source_crs text,
 valid_until timestamptz NOT NULL CHECK (valid_until > fetched_at_utc),
 UNIQUE (source_id,data_extract_version), UNIQUE (id,source_id,raw_sha256)
);
CREATE TABLE acquisition_run (
 id uuid PRIMARY KEY, source_id text NOT NULL REFERENCES source(source_id),
 snapshot_id uuid REFERENCES source_snapshot(id), idempotency_key meaningful_text NOT NULL,
 started_at timestamptz NOT NULL, finished_at timestamptz,
 state text NOT NULL CHECK (state IN ('planned','denied','failed','complete')),
 tool_version meaningful_text NOT NULL, diagnostics jsonb NOT NULL DEFAULT '{}',
 CHECK (finished_at IS NULL OR finished_at >= started_at), UNIQUE (source_id,idempotency_key)
);
CREATE TABLE source_use_policy (
 snapshot_id uuid NOT NULL, source_id text NOT NULL, raw_sha256 sha256_hex NOT NULL,
 permitted_use text NOT NULL CHECK (permitted_use IN ('data','menu_text','document_text','image')),
 FOREIGN KEY (snapshot_id,source_id,raw_sha256) REFERENCES source_snapshot(id,source_id,raw_sha256),
 offline_cache_allowed text NOT NULL DEFAULT 'UNKNOWN' CHECK (offline_cache_allowed IN ('true','false','UNKNOWN')),
 policy_evidence meaningful_text NOT NULL, valid_until timestamptz NOT NULL, reviewed_at_utc timestamptz,
 license_obligations_satisfied boolean NOT NULL DEFAULT false,
 human_rights_review boolean NOT NULL DEFAULT false,
 parent_engineering_review boolean NOT NULL DEFAULT false,
 user_distribution_authorized boolean NOT NULL DEFAULT false,
 PRIMARY KEY (snapshot_id,permitted_use)
);
CREATE TABLE evidence (
 id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'evidence' CHECK (kind='evidence'),
 FOREIGN KEY (id,kind) REFERENCES entity(id,kind),
 snapshot_id uuid NOT NULL REFERENCES source_snapshot(id), locator meaningful_text NOT NULL,
 observed_at timestamptz NOT NULL, valid_until timestamptz NOT NULL CHECK (valid_until > observed_at),
 review review_state NOT NULL DEFAULT 'candidate', reviewer text, verified_at timestamptz,
 verification_method text NOT NULL DEFAULT 'unknown', confidence_reason text NOT NULL DEFAULT 'unknown',
 CHECK (review <> 'approved' OR (reviewer IS NOT NULL AND lower(btrim(reviewer)) NOT IN ('','unknown')
  AND verified_at IS NOT NULL AND verified_at >= observed_at
  AND lower(btrim(verification_method)) NOT IN ('','unknown') AND lower(btrim(confidence_reason)) NOT IN ('','unknown')))
);
CREATE TABLE fact (
 id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'fact' CHECK (kind='fact'),
 FOREIGN KEY (id,kind) REFERENCES entity(id,kind), subject_id uuid NOT NULL REFERENCES entity(id),
 property meaningful_text NOT NULL, knowledge knowledge_state NOT NULL,
 value_json jsonb, review review_state NOT NULL DEFAULT 'candidate',
 freshness text NOT NULL DEFAULT 'unknown' CHECK (freshness IN ('current','stale','unknown')),
 valid_from timestamptz NOT NULL, valid_until timestamptz NOT NULL CHECK (valid_until > valid_from),
 recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 CHECK ((knowledge='asserted' AND value_json IS NOT NULL AND value_json <> 'null'::jsonb)
   OR (knowledge <> 'asserted' AND value_json IS NULL)), UNIQUE (id,subject_id,property)
);
CREATE INDEX fact_lookup ON fact(subject_id,property,review,valid_from,valid_until);
CREATE TABLE fact_evidence (
 fact_id uuid NOT NULL REFERENCES fact(id), evidence_id uuid NOT NULL REFERENCES evidence(id),
 role text NOT NULL CHECK (role IN ('supports','contradicts','context')), PRIMARY KEY (fact_id,evidence_id)
);
CREATE TABLE fact_history (
 old_fact_id uuid PRIMARY KEY REFERENCES fact(id), new_fact_id uuid NOT NULL REFERENCES fact(id),
 recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(), actor meaningful_text NOT NULL,
 reason meaningful_text NOT NULL, CHECK (old_fact_id <> new_fact_id)
);
CREATE TABLE external_reference (
 entity_id uuid NOT NULL REFERENCES entity(id), source_id text NOT NULL REFERENCES source(source_id),
 external_id meaningful_text NOT NULL, PRIMARY KEY (source_id,external_id)
);
CREATE TABLE review_decision (
 id uuid PRIMARY KEY, subject_id uuid NOT NULL REFERENCES entity(id), actor meaningful_text NOT NULL,
 decision review_state NOT NULL, reason meaningful_text NOT NULL,
 evidence_ids uuid[] NOT NULL DEFAULT '{}', recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE review_queue (
 id uuid PRIMARY KEY, subject_id uuid NOT NULL REFERENCES entity(id), reason meaningful_text NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','rejected')),
 resolution_decision_id uuid REFERENCES review_decision(id), CHECK (status='open' OR resolution_decision_id IS NOT NULL)
);
CREATE TABLE identity_candidate (
 id uuid PRIMARY KEY, left_id uuid NOT NULL REFERENCES entity(id), right_id uuid NOT NULL REFERENCES entity(id),
 score numeric CHECK (score BETWEEN 0 AND 1), signals jsonb NOT NULL, CHECK (left_id <> right_id)
);
CREATE TABLE identity_resolution (
 candidate_id uuid PRIMARY KEY REFERENCES identity_candidate(id),
 decision text NOT NULL CHECK (decision IN ('distinct','same_identity_candidate','defer','reversed')),
 review_decision_id uuid NOT NULL REFERENCES review_decision(id)
);
CREATE TABLE audit_event (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, table_name text NOT NULL,
 action text NOT NULL, actor meaningful_text NOT NULL, happened_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 before_json jsonb, after_json jsonb
);
CREATE FUNCTION deny_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'append-only table: %', TG_TABLE_NAME; END $$;
CREATE FUNCTION guard_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'canonical identities cannot be recycled'; END IF;
 IF NEW.id <> OLD.id OR NEW.kind <> OLD.kind THEN RAISE EXCEPTION 'canonical identity is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER entity_identity BEFORE UPDATE OR DELETE ON entity FOR EACH ROW EXECUTE FUNCTION guard_identity();
CREATE FUNCTION audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor text := current_setting('omni.actor',true);
BEGIN
 IF actor IS NULL OR lower(btrim(actor)) IN ('','unknown') THEN RAISE EXCEPTION 'SET LOCAL omni.actor to a reviewer before mutation'; END IF;
 INSERT INTO audit_event(table_name,action,actor,before_json,after_json)
 VALUES(TG_TABLE_NAME,TG_OP,actor,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
 CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER entity_audit AFTER INSERT OR UPDATE ON entity FOR EACH ROW EXECUTE FUNCTION audit_mutation();
CREATE TRIGGER source_audit AFTER INSERT OR UPDATE OR DELETE ON source FOR EACH ROW EXECUTE FUNCTION audit_mutation();
CREATE TRIGGER policy_audit AFTER INSERT OR UPDATE OR DELETE ON source_use_policy FOR EACH ROW EXECUTE FUNCTION audit_mutation();
CREATE TRIGGER evidence_audit AFTER INSERT OR UPDATE ON evidence FOR EACH ROW EXECUTE FUNCTION audit_mutation();
CREATE TRIGGER fact_audit AFTER INSERT OR UPDATE ON fact FOR EACH ROW EXECUTE FUNCTION audit_mutation();
CREATE FUNCTION guard_fact_value() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'retain historical facts'; END IF;
 IF (NEW.id,NEW.kind,NEW.subject_id,NEW.property,NEW.knowledge,NEW.value_json,NEW.valid_from,NEW.valid_until,NEW.recorded_at)
 IS DISTINCT FROM (OLD.id,OLD.kind,OLD.subject_id,OLD.property,OLD.knowledge,OLD.value_json,OLD.valid_from,OLD.valid_until,OLD.recorded_at)
 THEN RAISE EXCEPTION 'append a new fact version'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fact_value BEFORE UPDATE OR DELETE ON fact FOR EACH ROW EXECUTE FUNCTION guard_fact_value();
CREATE FUNCTION guard_evidence_lineage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'retain historical evidence'; END IF;
 IF (NEW.id,NEW.kind,NEW.snapshot_id,NEW.locator,NEW.observed_at,NEW.valid_until)
 IS DISTINCT FROM (OLD.id,OLD.kind,OLD.snapshot_id,OLD.locator,OLD.observed_at,OLD.valid_until)
 THEN RAISE EXCEPTION 'append new evidence'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER evidence_lineage BEFORE UPDATE OR DELETE ON evidence FOR EACH ROW EXECUTE FUNCTION guard_evidence_lineage();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['source_snapshot','fact_evidence','fact_history','external_reference','review_decision','identity_resolution','audit_event'] LOOP
  EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION deny_mutation()',t);
 END LOOP;
END $$;
