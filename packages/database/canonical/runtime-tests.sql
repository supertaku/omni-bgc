-- SYNTHETIC ONLY. All tests run inside a rolled-back transaction.
BEGIN;
SET LOCAL search_path TO omni,public;
SET LOCAL omni.actor='TEST_ONLY canonical runtime QA';
CREATE FUNCTION pg_temp.uid(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
CREATE FUNCTION pg_temp.ent(n integer,k text) RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN INSERT INTO entity(id,kind,review) VALUES(pg_temp.uid(n),k,'approved'); RETURN pg_temp.uid(n); END $$;
CREATE FUNCTION pg_temp.claim(n integer,s uuid,p text,v jsonb) RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_temp.ent(n,'fact');
 INSERT INTO fact(id,subject_id,property,knowledge,value_json,review,freshness,valid_from,valid_until)
 VALUES(pg_temp.uid(n),s,p,'asserted',v,'approved','current','2026-10-01T00:00:00Z','2026-11-01T00:00:00Z');
 INSERT INTO fact_evidence VALUES(pg_temp.uid(n),pg_temp.uid(2),'supports');
 RETURN pg_temp.uid(n);
END $$;
CREATE FUNCTION pg_temp.assert_true(condition boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'assertion failed: %',label; END IF; END $$;
CREATE FUNCTION pg_temp.must_fail(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN RETURN; END;
 RAISE EXCEPTION 'unexpected successful adversary: %',statement;
END $$;
SELECT pg_temp.ent(1,'source_snapshot'),pg_temp.ent(2,'evidence'),pg_temp.ent(10,'building'),pg_temp.ent(20,'place'),pg_temp.ent(21,'place'),pg_temp.ent(22,'menu_item');
INSERT INTO source(source_id,owner,source_url_or_document,source_kind,category,data_license,redistribution_allowed,menu_text_allowed,document_text_allowed,attribution_text,jurisdiction,retention_terms,consent_reference,reviewer,review_timestamp,review_status)
 VALUES('TEST_ONLY','Synthetic owner','urn:synthetic:m4','synthetic','synthetic','TEST ONLY license','true','true','true','Synthetic attribution','TEST ONLY','TEST ONLY','TEST ONLY consent','TEST ONLY reviewer','2026-10-02T00:00:00Z','APPROVED');
INSERT INTO source_snapshot(id,source_id,source_version,data_extract_version,raw_sha256,retained_relative_path,fetched_at_utc,valid_until)
 VALUES(pg_temp.uid(1),'TEST_ONLY','synthetic-v1','synthetic-v1',repeat('a',64),'synthetic/source.txt','2026-10-01T00:00:00Z','2026-11-01T00:00:00Z');
INSERT INTO source_use_policy(snapshot_id,source_id,raw_sha256,permitted_use,offline_cache_allowed,policy_evidence,valid_until,reviewed_at_utc,license_obligations_satisfied,human_rights_review,parent_engineering_review,user_distribution_authorized)
 SELECT pg_temp.uid(1),'TEST_ONLY',repeat('a',64),u,'true','TEST ONLY evidence','2026-11-01T00:00:00Z','2026-10-02T00:00:00Z',true,true,true,true FROM unnest(ARRAY['data','menu_text','document_text']) u;
INSERT INTO evidence(id,snapshot_id,locator,observed_at,valid_until,review,reviewer,verified_at,verification_method,confidence_reason)
 VALUES(pg_temp.uid(2),pg_temp.uid(1),'synthetic line 1','2026-10-01T00:00:00Z','2026-11-01T00:00:00Z','approved','TEST ONLY reviewer','2026-10-02T00:00:00Z','synthetic fixture','TEST ONLY');
INSERT INTO building(id) VALUES(pg_temp.uid(10));
INSERT INTO place(id,branch_role) VALUES(pg_temp.uid(20),'branch'),(pg_temp.uid(21),'branch');
UPDATE entity SET location_quality='verified' WHERE id=pg_temp.uid(20);
INSERT INTO menu_item(id) VALUES(pg_temp.uid(22));
SELECT pg_temp.claim(100,pg_temp.uid(20),'name','"Synthetic same-name branch"'),pg_temp.claim(101,pg_temp.uid(21),'name','"Synthetic same-name branch"');
SELECT pg_temp.claim(102,pg_temp.uid(20),'coordinate','{"longitude":121.05,"latitude":14.55,"crs":"EPSG:4326"}');
INSERT INTO point_geometry VALUES(pg_temp.uid(102),pg_temp.uid(20),ST_SetSRID(ST_MakePoint(121.05,14.55),4326),'EPSG:4326','identity');
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM approved_facts('2026-10-10T00:00:00Z')),'positive approved facts');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM approved_facts('2026-10-10T00:00:00Z') WHERE property='name'),'same-name branches remain separate');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM find_nearby_places(121.05,14.55,10,'2026-10-10T00:00:00Z')),'nearby geography metres');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM get_source_evidence(pg_temp.uid(20),'coordinate','2026-10-10T00:00:00Z')),'citation identity preserved');
SELECT pg_temp.must_fail('UPDATE entity SET id=''20000000-0000-4000-8000-000000000020'' WHERE id=pg_temp.uid(20)');
SELECT pg_temp.must_fail('DELETE FROM entity WHERE id=pg_temp.uid(21)');
SELECT pg_temp.must_fail('UPDATE fact SET value_json=''"mutated"'' WHERE id=pg_temp.uid(100)');
SELECT pg_temp.must_fail('DELETE FROM source_snapshot WHERE id=pg_temp.uid(1)');
SELECT pg_temp.must_fail('UPDATE source_snapshot SET raw_sha256=repeat(''b'',64) WHERE id=pg_temp.uid(1)');
SELECT pg_temp.must_fail('INSERT INTO source_use_policy(snapshot_id,source_id,raw_sha256,permitted_use,policy_evidence,valid_until) VALUES(pg_temp.uid(1),''TEST_ONLY'',repeat(''b'',64),''image'',''synthetic'',''2026-11-01T00:00:00Z'')');
SELECT pg_temp.must_fail('INSERT INTO building(id) VALUES(pg_temp.uid(21))');
SELECT pg_temp.must_fail('INSERT INTO point_geometry VALUES(pg_temp.uid(100),pg_temp.uid(20),ST_SetSRID(ST_MakePoint(121.05,14.55),4326),''EPSG:4326'',''identity'')');
SELECT pg_temp.claim(103,pg_temp.uid(21),'coordinate','{"longitude":121.06,"latitude":14.56,"crs":"EPSG:32651"}');
SELECT pg_temp.must_fail('INSERT INTO point_geometry VALUES(pg_temp.uid(103),pg_temp.uid(21),ST_SetSRID(ST_MakePoint(121.06,14.56),4326),''EPSG:32651'',''invalid identity'')');
SELECT pg_temp.must_fail('SELECT * FROM find_nearby_places(999,14.55,10,''2026-10-10T00:00:00Z'')');
SELECT pg_temp.claim(104,pg_temp.uid(22),'name','"Synthetic menu item"');
UPDATE source SET menu_text_allowed='UNKNOWN' WHERE source_id='TEST_ONLY';
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM approved_facts('2026-10-10T00:00:00Z') WHERE fact_id=pg_temp.uid(104)),'menu names require menu rights');
UPDATE source SET menu_text_allowed='true',review_status='REVOKED' WHERE source_id='TEST_ONLY';
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM approved_facts('2026-10-10T00:00:00Z')),'revocation removes all source facts');
UPDATE source SET review_status='APPROVED' WHERE source_id='TEST_ONLY';
UPDATE source SET data_license=' N/A ' WHERE source_id='TEST_ONLY';
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM approved_facts('2026-10-10T00:00:00Z')),'placeholder license denies');
UPDATE source SET data_license='TEST ONLY license',attribution_text='null' WHERE source_id='TEST_ONLY';
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM approved_facts('2026-10-10T00:00:00Z')),'placeholder attribution denies');
UPDATE source SET attribution_text='Synthetic attribution' WHERE source_id='TEST_ONLY';
UPDATE source_use_policy SET valid_until='2026-10-09T00:00:00Z' WHERE permitted_use='data';
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM approved_facts('2026-10-10T00:00:00Z') WHERE fact_id=pg_temp.uid(100)),'expired rights deny');
UPDATE source_use_policy SET valid_until='2026-11-01T00:00:00Z' WHERE permitted_use='data';
SELECT pg_temp.claim(105,pg_temp.uid(20),'name','"Conflicting branch name"');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM approved_facts('2026-10-10T00:00:00Z') WHERE entity_id=pg_temp.uid(20) AND property='name'),'conflicting current singleton claims denied');
INSERT INTO fact_history VALUES(pg_temp.uid(100),pg_temp.uid(105),'2026-10-03T00:00:00Z','TEST ONLY reviewer','synthetic rename');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM approved_facts('2026-10-10T00:00:00Z') WHERE fact_id=pg_temp.uid(105)),'supersession retains new fact');
SELECT pg_temp.must_fail('INSERT INTO fact_history VALUES(pg_temp.uid(101),pg_temp.uid(105),''2026-10-03T00:00:00Z'',''TEST ONLY'',''invalid cross-branch'')');
SELECT pg_temp.assert_true((SELECT count(*)>0 FROM audit_event),'audit exists');
SELECT pg_temp.must_fail('DELETE FROM audit_event');
SELECT pg_temp.ent(30,'route_node'),pg_temp.ent(31,'route_node'),pg_temp.ent(32,'route_edge'),pg_temp.ent(50,'geographic_feature');
SELECT pg_temp.claim(106,pg_temp.uid(30),'level','0');
SELECT pg_temp.must_fail('INSERT INTO route_node(id,coordinate_fact_id,level_fact_id) VALUES(pg_temp.uid(30),pg_temp.uid(102),pg_temp.uid(106))');
SELECT pg_temp.claim(107,pg_temp.uid(30),'coordinate','{"longitude":121.05,"latitude":14.55,"crs":"EPSG:4326"}'),pg_temp.claim(108,pg_temp.uid(31),'coordinate','{"longitude":121.051,"latitude":14.55,"crs":"EPSG:4326"}'),pg_temp.claim(109,pg_temp.uid(31),'level','0');
INSERT INTO point_geometry VALUES(pg_temp.uid(107),pg_temp.uid(30),ST_SetSRID(ST_MakePoint(121.05,14.55),4326),'EPSG:4326','identity'),(pg_temp.uid(108),pg_temp.uid(31),ST_SetSRID(ST_MakePoint(121.051,14.55),4326),'EPSG:4326','identity');
INSERT INTO route_node(id,coordinate_fact_id,level_fact_id) VALUES(pg_temp.uid(30),pg_temp.uid(107),pg_temp.uid(106)),(pg_temp.uid(31),pg_temp.uid(108),pg_temp.uid(109));
SELECT pg_temp.claim(110,pg_temp.uid(50),'geometry','{"type":"LineString","coordinates":[[121.05,14.55],[121.051,14.55]]}'),pg_temp.claim(111,pg_temp.uid(32),'access','{"public":true}');
INSERT INTO geometry_claim VALUES(pg_temp.uid(110),pg_temp.uid(50),ST_GeomFromText('LINESTRING(121.05 14.55,121.051 14.55)',4326),'EPSG:4326','identity');
SELECT pg_temp.must_fail('INSERT INTO route_edge(id,from_node_id,to_node_id,geometry_fact_id,length_m,length_crs,public_access_fact_id) VALUES(pg_temp.uid(32),pg_temp.uid(30),pg_temp.uid(31),pg_temp.uid(110),107,''geodesic:WGS84'',pg_temp.uid(111))');
SELECT pg_temp.claim(112,pg_temp.uid(32),'geometry','{"type":"LineString","coordinates":[[121.05,14.55],[121.051,14.55]]}');
INSERT INTO geometry_claim VALUES(pg_temp.uid(112),pg_temp.uid(32),ST_GeomFromText('LINESTRING(121.05 14.55,121.051 14.55)',4326),'EPSG:4326','identity');
INSERT INTO route_edge(id,from_node_id,to_node_id,geometry_fact_id,length_m,length_crs,public_access_fact_id) VALUES(pg_temp.uid(32),pg_temp.uid(30),pg_temp.uid(31),pg_temp.uid(112),107,'geodesic:WGS84',pg_temp.uid(111));
SELECT pg_temp.assert_true((SELECT topology_review='candidate' FROM route_edge WHERE id=pg_temp.uid(32)),'valid geometry does not approve safe topology');
SELECT pg_temp.ent(40,'knowledge_document');
INSERT INTO knowledge_document(id,snapshot_id,locator,content_sha256,extracted_text,extraction_tool_version,language_code,document_version,text_length,observed_at,valid_until)
 SELECT pg_temp.uid(40),pg_temp.uid(1),'synthetic document',encode(sha256(convert_to(t,'UTF8')),'hex'),t,'synthetic fixture v1','en','synthetic-v1',length(t),'2026-10-01T00:00:00Z','2026-11-01T00:00:00Z' FROM (VALUES('Synthetic document text 🚶')) x(t);
INSERT INTO document_section(id,document_id,ordinal,heading,start_offset,end_offset) VALUES(pg_temp.uid(41),pg_temp.uid(40),0,'Synthetic section',0,25);
SELECT pg_temp.must_fail('INSERT INTO retrieval_passage(id,document_id,section_id,start_offset,end_offset,body,citation_id,evidence_id,content_sha256,review) VALUES(pg_temp.uid(42),pg_temp.uid(40),pg_temp.uid(41),0,9,''Fabricate'',''TEST ONLY fabricated'',pg_temp.uid(2),encode(sha256(convert_to(''Fabricate'',''UTF8'')),''hex''),''approved'')');
INSERT INTO retrieval_passage(id,document_id,section_id,start_offset,end_offset,body,citation_id,evidence_id,content_sha256,review) VALUES(pg_temp.uid(42),pg_temp.uid(40),pg_temp.uid(41),0,9,'Synthetic','TEST ONLY citation',pg_temp.uid(2),encode(sha256(convert_to('Synthetic','UTF8')),'hex'),'approved');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM relevant_knowledge_passages('Synthetic','2026-10-10T00:00:00Z')),'lexical passage positive with exact citation');
UPDATE source SET document_text_allowed='UNKNOWN' WHERE source_id='TEST_ONLY';
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM relevant_knowledge_passages('Synthetic','2026-10-10T00:00:00Z')),'document rights unknown deny retrieval');
SET LOCAL search_path TO public;
CREATE TEMP TABLE entity(id uuid,kind text,review text);
CREATE TEMP TABLE fact(LIKE omni.fact);
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM omni.approved_facts('2026-10-10T00:00:00Z')),'fresh default path and shadow table do not redirect governed functions');
SELECT 'PASS synthetic identity, lineage, geography, rights, conflicts, history and audit runtime assertions';
ROLLBACK;
