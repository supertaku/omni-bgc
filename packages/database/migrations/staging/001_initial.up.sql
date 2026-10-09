PRAGMA foreign_keys=ON;
BEGIN IMMEDIATE;
CREATE TABLE schema_migration(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
INSERT INTO schema_migration VALUES(1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE entity(
 id TEXT PRIMARY KEY CHECK(length(id)=36 AND id=lower(id) AND substr(id,9,1)='-' AND substr(id,14,1)='-' AND substr(id,19,1)='-' AND substr(id,24,1)='-' AND substr(id,15,1) GLOB '[1-8]' AND substr(id,20,1) GLOB '[89ab]' AND replace(id,'-','') NOT GLOB '*[^0-9a-f]*' AND length(replace(id,'-',''))=32),
 kind TEXT NOT NULL CHECK(kind IN ('service_area','zone','building','building_geometry','floor','entrance','place','place_alias','business','menu','menu_item','operating_hours','holiday_exception','public_facility','transit_agency','transit_route','transit_stop','transit_trip','route_node','route_edge','route_access_restriction','source_snapshot','evidence','fact','review_queue','audit_event','saved_place','saved_itinerary','pack_manifest')),
 review TEXT NOT NULL DEFAULT 'candidate' CHECK(review IN ('candidate','pending','approved','rejected','quarantined')),
 location_quality TEXT NOT NULL DEFAULT 'unknown' CHECK(location_quality IN ('verified','ambiguous','unknown'))
);
CREATE TRIGGER entity_identity_immutable BEFORE UPDATE OF id,kind ON entity BEGIN SELECT RAISE(ABORT,'canonical identity is immutable'); END;
CREATE TRIGGER entity_no_delete BEFORE DELETE ON entity BEGIN SELECT RAISE(ABORT,'canonical identities cannot be recycled'); END;
CREATE TABLE source(
 source_id TEXT PRIMARY KEY, owner TEXT NOT NULL, category TEXT NOT NULL, source_url_or_document TEXT NOT NULL,
 source_kind TEXT NOT NULL, data_license TEXT NOT NULL,
 redistribution_allowed TEXT NOT NULL CHECK(redistribution_allowed IN ('true','false','UNKNOWN')),
 images_allowed TEXT NOT NULL CHECK(images_allowed IN ('true','false','UNKNOWN')),
 menu_text_allowed TEXT NOT NULL CHECK(menu_text_allowed IN ('true','false','UNKNOWN')),
 attribution_text TEXT NOT NULL, collection_method TEXT NOT NULL, fetched_at_utc TEXT, raw_sha256 TEXT,
 source_version TEXT, restriction_notes TEXT, consent_reference TEXT, reviewer TEXT,
 review_status TEXT NOT NULL CHECK(review_status IN ('CANDIDATE','RESEARCH_ONLY','APPROVED','REJECTED','BLOCKED','STALE','REVOKED')),
 jurisdiction TEXT, source_published_at TEXT, data_extract_version TEXT, retention_terms TEXT, review_timestamp TEXT,
 CHECK(raw_sha256 IS NULL OR (length(raw_sha256)=64 AND raw_sha256 NOT GLOB '*[^0-9a-f]*'))
);
CREATE TABLE source_use_policy(
 source_id TEXT NOT NULL REFERENCES source(source_id), snapshot_id TEXT NOT NULL REFERENCES source_snapshot(id),
 permitted_use TEXT NOT NULL CHECK(permitted_use IN ('data','menu_text')),
 raw_sha256 TEXT NOT NULL CHECK(length(raw_sha256)=64 AND raw_sha256 NOT GLOB '*[^0-9a-f]*'),
 offline_cache_allowed TEXT NOT NULL CHECK(offline_cache_allowed IN ('true','false','UNKNOWN')),
 policy_evidence TEXT NOT NULL, valid_until TEXT NOT NULL CHECK(julianday(valid_until) IS NOT NULL),
 license_obligations_satisfied INTEGER NOT NULL DEFAULT 0 CHECK(license_obligations_satisfied IN (0,1)),
 human_rights_review INTEGER NOT NULL DEFAULT 0 CHECK(human_rights_review IN (0,1)),
 parent_engineering_review INTEGER NOT NULL DEFAULT 0 CHECK(parent_engineering_review IN (0,1)),
 user_distribution_authorized INTEGER NOT NULL DEFAULT 0 CHECK(user_distribution_authorized IN (0,1)),
 reviewed_at_utc TEXT CHECK(julianday(reviewed_at_utc) IS NOT NULL),
 CHECK(offline_cache_allowed!='true' OR length(trim(policy_evidence))>0),
 PRIMARY KEY(snapshot_id,permitted_use)
);
CREATE TRIGGER source_identity_immutable BEFORE UPDATE OF source_id ON source BEGIN SELECT RAISE(ABORT,'source identity immutable'); END;
CREATE TABLE source_snapshot(
 id TEXT PRIMARY KEY REFERENCES entity(id), source_id TEXT NOT NULL REFERENCES source(source_id),
 source_version TEXT, data_extract_version TEXT NOT NULL CHECK(length(trim(data_extract_version))>0),
 raw_sha256 TEXT NOT NULL CHECK(length(raw_sha256)=64 AND raw_sha256 NOT GLOB '*[^0-9a-f]*'),
 fetched_at_utc TEXT NOT NULL CHECK(julianday(fetched_at_utc) IS NOT NULL), source_crs TEXT,
 valid_until TEXT NOT NULL CHECK(julianday(valid_until) IS NOT NULL AND julianday(valid_until)>julianday(fetched_at_utc)),
 UNIQUE(source_id,data_extract_version)
);
CREATE TRIGGER snapshot_immutable BEFORE UPDATE ON source_snapshot BEGIN SELECT RAISE(ABORT,'snapshot is immutable; create a new extract'); END;
CREATE TABLE evidence(
 id TEXT PRIMARY KEY REFERENCES entity(id), snapshot_id TEXT NOT NULL REFERENCES source_snapshot(id),
 locator TEXT NOT NULL CHECK(length(trim(locator))>0),
 review TEXT NOT NULL CHECK(review IN ('candidate','pending','approved','rejected','quarantined')),
 observed_at TEXT NOT NULL CHECK(julianday(observed_at) IS NOT NULL),
 valid_until TEXT NOT NULL CHECK(julianday(valid_until) IS NOT NULL AND julianday(valid_until)>julianday(observed_at)),
 reviewer TEXT, verified_at TEXT CHECK(verified_at IS NULL OR julianday(verified_at) IS NOT NULL),
 verification_method TEXT NOT NULL DEFAULT 'unknown', confidence_reason TEXT NOT NULL DEFAULT 'unknown',
 CHECK(review!='approved' OR (reviewer IS NOT NULL AND length(trim(reviewer))>0 AND lower(trim(reviewer))!='unknown' AND verified_at IS NOT NULL AND julianday(verified_at)>=julianday(observed_at) AND lower(trim(verification_method))!='unknown' AND length(trim(verification_method))>0 AND lower(trim(confidence_reason))!='unknown' AND length(trim(confidence_reason))>0))
);
CREATE TRIGGER evidence_lineage_immutable BEFORE UPDATE OF snapshot_id,locator ON evidence BEGIN SELECT RAISE(ABORT,'replace evidence rather than rewrite lineage'); END;
CREATE TABLE fact(
 id TEXT PRIMARY KEY REFERENCES entity(id), subject_id TEXT NOT NULL REFERENCES entity(id),
 property TEXT NOT NULL CHECK(length(trim(property))>0),
 knowledge TEXT NOT NULL CHECK(knowledge IN ('asserted','unknown','absent','not_applicable')),
 value_json TEXT CHECK(value_json IS NULL OR json_valid(value_json)),
 review TEXT NOT NULL CHECK(review IN ('candidate','pending','approved','rejected','quarantined')),
 freshness TEXT NOT NULL CHECK(freshness IN ('current','stale','unknown')),
 valid_from TEXT NOT NULL CHECK(julianday(valid_from) IS NOT NULL),
 valid_until TEXT NOT NULL CHECK(julianday(valid_until) IS NOT NULL AND julianday(valid_until)>julianday(valid_from)),
 CHECK((knowledge='asserted' AND value_json IS NOT NULL) OR (knowledge!='asserted' AND value_json IS NULL))
);
CREATE INDEX fact_subject_property ON fact(subject_id,property,review);
CREATE TABLE fact_evidence(fact_id TEXT REFERENCES fact(id), evidence_id TEXT REFERENCES evidence(id), role TEXT NOT NULL CHECK(role IN ('supports','contradicts','context')), PRIMARY KEY(fact_id,evidence_id));
CREATE TABLE external_reference(entity_id TEXT REFERENCES entity(id), source_id TEXT REFERENCES source(source_id), external_id TEXT NOT NULL, PRIMARY KEY(source_id,external_id));
CREATE TABLE service_area(id TEXT PRIMARY KEY REFERENCES entity(id), boundary_fact_id TEXT REFERENCES fact(id), authority TEXT NOT NULL CHECK(authority IN ('working','authoritative','unknown')));
CREATE TABLE zone(id TEXT PRIMARY KEY REFERENCES entity(id), service_area_id TEXT NOT NULL REFERENCES service_area(id));
CREATE TABLE building(id TEXT PRIMARY KEY REFERENCES entity(id), zone_id TEXT REFERENCES zone(id));
CREATE TABLE building_geometry(id TEXT PRIMARY KEY REFERENCES entity(id), building_id TEXT NOT NULL REFERENCES building(id), geometry_fact_id TEXT NOT NULL REFERENCES fact(id), min_lon REAL NOT NULL CHECK(min_lon BETWEEN -180 AND 180), max_lon REAL NOT NULL CHECK(max_lon BETWEEN -180 AND 180 AND max_lon>=min_lon), min_lat REAL NOT NULL CHECK(min_lat BETWEEN -90 AND 90), max_lat REAL NOT NULL CHECK(max_lat BETWEEN -90 AND 90 AND max_lat>=min_lat));
CREATE TABLE floor(id TEXT PRIMARY KEY REFERENCES entity(id), building_id TEXT NOT NULL REFERENCES building(id), label TEXT NOT NULL, UNIQUE(building_id,label), UNIQUE(id,building_id));
CREATE TABLE entrance(id TEXT PRIMARY KEY REFERENCES entity(id), building_id TEXT NOT NULL REFERENCES building(id), floor_id TEXT, FOREIGN KEY(floor_id,building_id) REFERENCES floor(id,building_id));
CREATE TABLE business(id TEXT PRIMARY KEY REFERENCES entity(id));
CREATE TABLE place(id TEXT PRIMARY KEY REFERENCES entity(id), building_id TEXT REFERENCES building(id), business_id TEXT REFERENCES business(id), floor_id TEXT, CHECK(floor_id IS NULL OR building_id IS NOT NULL), FOREIGN KEY(floor_id,building_id) REFERENCES floor(id,building_id));
CREATE INDEX place_building_business ON place(building_id,business_id,floor_id);
CREATE TABLE place_entrance(place_id TEXT REFERENCES place(id), entrance_id TEXT REFERENCES entrance(id), access_fact_id TEXT NOT NULL REFERENCES fact(id), PRIMARY KEY(place_id,entrance_id));
CREATE TABLE place_alias(id TEXT PRIMARY KEY REFERENCES entity(id), place_id TEXT NOT NULL REFERENCES place(id), alias_fact_id TEXT NOT NULL REFERENCES fact(id));
CREATE TABLE taxonomy_version(version INTEGER PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('proposed','approved','retired')), created_at TEXT NOT NULL);
INSERT INTO taxonomy_version VALUES(1,'proposed','2026-10-09T00:00:00Z');
CREATE TABLE category(code TEXT PRIMARY KEY, label TEXT NOT NULL, parent_code TEXT REFERENCES category(code), knowledge TEXT NOT NULL CHECK(knowledge IN ('asserted','unknown','not_applicable')), taxonomy_version INTEGER NOT NULL REFERENCES taxonomy_version(version));
INSERT INTO category VALUES('unknown','Unknown',NULL,'unknown',1),('place','Place',NULL,'asserted',1),('food_drink','Food and drink','place','asserted',1),('restaurant','Restaurant','food_drink','asserted',1),('cafe','Cafe','food_drink','asserted',1),('retail','Retail','place','asserted',1),('grocery','Grocery','retail','asserted',1),('health','Health','place','asserted',1),('pharmacy','Pharmacy','health','asserted',1),('public_facility','Public facility','place','asserted',1),('restroom','Restroom','public_facility','asserted',1),('park','Park','place','asserted',1),('transit','Transit','place','asserted',1),('bus_stop','Bus stop','transit','asserted',1),('not_applicable','Not applicable',NULL,'not_applicable',1);
CREATE TABLE place_category(place_id TEXT REFERENCES place(id), category_code TEXT REFERENCES category(code), fact_id TEXT NOT NULL REFERENCES fact(id), PRIMARY KEY(place_id,category_code));
CREATE INDEX category_place ON place_category(category_code,place_id);
CREATE TABLE menu(id TEXT PRIMARY KEY REFERENCES entity(id), place_id TEXT NOT NULL REFERENCES place(id));
CREATE TABLE menu_item(id TEXT PRIMARY KEY REFERENCES entity(id), menu_id TEXT NOT NULL REFERENCES menu(id));
CREATE TABLE menu_tag(menu_item_id TEXT REFERENCES menu_item(id), tag_code TEXT NOT NULL, knowledge TEXT NOT NULL CHECK(knowledge IN ('asserted','unknown','absent','not_applicable')), fact_id TEXT NOT NULL REFERENCES fact(id), PRIMARY KEY(menu_item_id,tag_code));
CREATE TABLE operating_hours(id TEXT PRIMARY KEY REFERENCES entity(id), place_id TEXT NOT NULL REFERENCES place(id), weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6), hours_fact_id TEXT NOT NULL REFERENCES fact(id));
CREATE TABLE holiday_exception(id TEXT PRIMARY KEY REFERENCES entity(id), place_id TEXT NOT NULL REFERENCES place(id), local_date TEXT NOT NULL CHECK(date(local_date)=local_date), hours_fact_id TEXT NOT NULL REFERENCES fact(id));
CREATE TABLE public_facility(id TEXT PRIMARY KEY REFERENCES entity(id), place_id TEXT REFERENCES place(id), facility_type TEXT NOT NULL REFERENCES category(code));
CREATE TABLE transit_agency(id TEXT PRIMARY KEY REFERENCES entity(id));
CREATE TABLE transit_route(id TEXT PRIMARY KEY REFERENCES entity(id), agency_id TEXT NOT NULL REFERENCES transit_agency(id));
CREATE TABLE transit_stop(id TEXT PRIMARY KEY REFERENCES entity(id), zone_id TEXT REFERENCES zone(id));
CREATE TABLE transit_trip(id TEXT PRIMARY KEY REFERENCES entity(id), route_id TEXT NOT NULL REFERENCES transit_route(id), calendar_fact_id TEXT NOT NULL REFERENCES fact(id));
CREATE TABLE transit_stop_time(trip_id TEXT REFERENCES transit_trip(id), sequence INTEGER CHECK(sequence>=0), stop_id TEXT NOT NULL REFERENCES transit_stop(id), arrival_seconds INTEGER CHECK(arrival_seconds>=0), departure_seconds INTEGER CHECK(departure_seconds>=arrival_seconds), time_fact_id TEXT NOT NULL REFERENCES fact(id), PRIMARY KEY(trip_id,sequence));
CREATE TABLE route_node(id TEXT PRIMARY KEY REFERENCES entity(id), entrance_id TEXT REFERENCES entrance(id), coordinate_fact_id TEXT NOT NULL REFERENCES fact(id), level_fact_id TEXT NOT NULL REFERENCES fact(id));
CREATE TABLE route_edge(id TEXT PRIMARY KEY REFERENCES entity(id), from_node_id TEXT NOT NULL REFERENCES route_node(id), to_node_id TEXT NOT NULL REFERENCES route_node(id), geometry_fact_id TEXT NOT NULL REFERENCES fact(id), length_m REAL NOT NULL CHECK(length_m>=0 AND length_m<10000000), length_method TEXT NOT NULL CHECK(length_method IN ('geodesic','projected')), length_crs TEXT NOT NULL, length_implementation TEXT NOT NULL CHECK(length(trim(length_implementation))>0), CHECK(length_method!='projected' OR length_crs!='EPSG:4326'), CHECK(from_node_id!=to_node_id));
CREATE INDEX route_edge_from ON route_edge(from_node_id);
CREATE INDEX route_edge_to ON route_edge(to_node_id);
CREATE TABLE route_access_restriction(id TEXT PRIMARY KEY REFERENCES entity(id), edge_id TEXT NOT NULL REFERENCES route_edge(id), restriction_fact_id TEXT NOT NULL REFERENCES fact(id));
CREATE TABLE point_geometry(entity_id TEXT PRIMARY KEY REFERENCES entity(id), coordinate_fact_id TEXT NOT NULL REFERENCES fact(id), longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180), latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90), crs TEXT NOT NULL CHECK(crs='EPSG:4326'));
CREATE VIRTUAL TABLE point_bbox USING rtree(rowid,min_lon,max_lon,min_lat,max_lat);
CREATE TRIGGER point_insert AFTER INSERT ON point_geometry BEGIN INSERT INTO point_bbox VALUES(new.rowid,new.longitude,new.longitude,new.latitude,new.latitude); END;
CREATE TRIGGER point_update AFTER UPDATE ON point_geometry BEGIN UPDATE point_bbox SET min_lon=new.longitude,max_lon=new.longitude,min_lat=new.latitude,max_lat=new.latitude WHERE rowid=old.rowid; END;
CREATE TRIGGER point_delete AFTER DELETE ON point_geometry BEGIN DELETE FROM point_bbox WHERE rowid=old.rowid; END;
CREATE VIRTUAL TABLE building_bbox USING rtree(rowid,min_lon,max_lon,min_lat,max_lat);
CREATE TRIGGER building_insert AFTER INSERT ON building_geometry BEGIN INSERT INTO building_bbox VALUES(new.rowid,new.min_lon,new.max_lon,new.min_lat,new.max_lat); END;
CREATE TRIGGER building_update AFTER UPDATE ON building_geometry BEGIN UPDATE building_bbox SET min_lon=new.min_lon,max_lon=new.max_lon,min_lat=new.min_lat,max_lat=new.max_lat WHERE rowid=old.rowid; END;
CREATE TRIGGER building_delete AFTER DELETE ON building_geometry BEGIN DELETE FROM building_bbox WHERE rowid=old.rowid; END;
CREATE TABLE review_queue(id TEXT PRIMARY KEY REFERENCES entity(id), subject_id TEXT NOT NULL REFERENCES entity(id), reason TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('open','resolved','rejected')), reviewer TEXT);
CREATE TABLE audit_event(id TEXT PRIMARY KEY REFERENCES entity(id), subject_id TEXT REFERENCES entity(id), actor TEXT NOT NULL, happened_at TEXT NOT NULL CHECK(julianday(happened_at) IS NOT NULL), action TEXT NOT NULL, before_json TEXT CHECK(before_json IS NULL OR json_valid(before_json)), after_json TEXT CHECK(after_json IS NULL OR json_valid(after_json)));
CREATE TRIGGER audit_immutable BEFORE UPDATE ON audit_event BEGIN SELECT RAISE(ABORT,'audit is append only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_event BEGIN SELECT RAISE(ABORT,'audit is append only'); END;
CREATE TABLE saved_place(id TEXT PRIMARY KEY REFERENCES entity(id), place_id TEXT NOT NULL REFERENCES place(id));
CREATE TABLE saved_itinerary(id TEXT PRIMARY KEY REFERENCES entity(id));
CREATE TABLE saved_itinerary_stop(itinerary_id TEXT REFERENCES saved_itinerary(id), sequence INTEGER CHECK(sequence>=0), place_id TEXT NOT NULL REFERENCES place(id), PRIMARY KEY(itinerary_id,sequence));
CREATE TABLE pack_manifest(id TEXT PRIMARY KEY REFERENCES entity(id), schema_version INTEGER NOT NULL CHECK(schema_version>0), api_version INTEGER NOT NULL CHECK(api_version>0), sha256 TEXT NOT NULL CHECK(length(sha256)=64 AND sha256 NOT GLOB '*[^0-9a-f]*'), coverage_fact_id TEXT NOT NULL REFERENCES fact(id), created_at TEXT NOT NULL, valid_until TEXT NOT NULL, size_bytes INTEGER NOT NULL CHECK(size_bytes>=0), channel TEXT NOT NULL, license_bundle TEXT NOT NULL, dependencies_json TEXT NOT NULL CHECK(json_valid(dependencies_json)));
CREATE TRIGGER source_snapshot_kind_insert BEFORE INSERT ON source_snapshot WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='source_snapshot') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: source_snapshot'); END;
CREATE TRIGGER source_snapshot_kind_update BEFORE UPDATE ON source_snapshot WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='source_snapshot') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: source_snapshot'); END;
CREATE TRIGGER source_snapshot_id_immutable BEFORE UPDATE OF id ON source_snapshot BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER evidence_kind_insert BEFORE INSERT ON evidence WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='evidence') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: evidence'); END;
CREATE TRIGGER evidence_kind_update BEFORE UPDATE ON evidence WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='evidence') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: evidence'); END;
CREATE TRIGGER evidence_id_immutable BEFORE UPDATE OF id ON evidence BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER fact_kind_insert BEFORE INSERT ON fact WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='fact') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: fact'); END;
CREATE TRIGGER fact_kind_update BEFORE UPDATE ON fact WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='fact') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: fact'); END;
CREATE TRIGGER fact_id_immutable BEFORE UPDATE OF id ON fact BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER service_area_kind_insert BEFORE INSERT ON service_area WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='service_area') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: service_area'); END;
CREATE TRIGGER service_area_kind_update BEFORE UPDATE ON service_area WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='service_area') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: service_area'); END;
CREATE TRIGGER service_area_id_immutable BEFORE UPDATE OF id ON service_area BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER zone_kind_insert BEFORE INSERT ON zone WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='zone') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: zone'); END;
CREATE TRIGGER zone_kind_update BEFORE UPDATE ON zone WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='zone') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: zone'); END;
CREATE TRIGGER zone_id_immutable BEFORE UPDATE OF id ON zone BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER building_kind_insert BEFORE INSERT ON building WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='building') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: building'); END;
CREATE TRIGGER building_kind_update BEFORE UPDATE ON building WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='building') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: building'); END;
CREATE TRIGGER building_id_immutable BEFORE UPDATE OF id ON building BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER building_geometry_kind_insert BEFORE INSERT ON building_geometry WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='building_geometry') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: building_geometry'); END;
CREATE TRIGGER building_geometry_kind_update BEFORE UPDATE ON building_geometry WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='building_geometry') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: building_geometry'); END;
CREATE TRIGGER building_geometry_id_immutable BEFORE UPDATE OF id ON building_geometry BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER floor_kind_insert BEFORE INSERT ON floor WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='floor') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: floor'); END;
CREATE TRIGGER floor_kind_update BEFORE UPDATE ON floor WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='floor') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: floor'); END;
CREATE TRIGGER floor_id_immutable BEFORE UPDATE OF id ON floor BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER entrance_kind_insert BEFORE INSERT ON entrance WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='entrance') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: entrance'); END;
CREATE TRIGGER entrance_kind_update BEFORE UPDATE ON entrance WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='entrance') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: entrance'); END;
CREATE TRIGGER entrance_id_immutable BEFORE UPDATE OF id ON entrance BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER business_kind_insert BEFORE INSERT ON business WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='business') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: business'); END;
CREATE TRIGGER business_kind_update BEFORE UPDATE ON business WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='business') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: business'); END;
CREATE TRIGGER business_id_immutable BEFORE UPDATE OF id ON business BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER place_kind_insert BEFORE INSERT ON place WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='place') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: place'); END;
CREATE TRIGGER place_kind_update BEFORE UPDATE ON place WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='place') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: place'); END;
CREATE TRIGGER place_id_immutable BEFORE UPDATE OF id ON place BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER place_alias_kind_insert BEFORE INSERT ON place_alias WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='place_alias') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: place_alias'); END;
CREATE TRIGGER place_alias_kind_update BEFORE UPDATE ON place_alias WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='place_alias') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: place_alias'); END;
CREATE TRIGGER place_alias_id_immutable BEFORE UPDATE OF id ON place_alias BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER menu_kind_insert BEFORE INSERT ON menu WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='menu') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: menu'); END;
CREATE TRIGGER menu_kind_update BEFORE UPDATE ON menu WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='menu') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: menu'); END;
CREATE TRIGGER menu_id_immutable BEFORE UPDATE OF id ON menu BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER menu_item_kind_insert BEFORE INSERT ON menu_item WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='menu_item') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: menu_item'); END;
CREATE TRIGGER menu_item_kind_update BEFORE UPDATE ON menu_item WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='menu_item') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: menu_item'); END;
CREATE TRIGGER menu_item_id_immutable BEFORE UPDATE OF id ON menu_item BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER operating_hours_kind_insert BEFORE INSERT ON operating_hours WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='operating_hours') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: operating_hours'); END;
CREATE TRIGGER operating_hours_kind_update BEFORE UPDATE ON operating_hours WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='operating_hours') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: operating_hours'); END;
CREATE TRIGGER operating_hours_id_immutable BEFORE UPDATE OF id ON operating_hours BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER holiday_exception_kind_insert BEFORE INSERT ON holiday_exception WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='holiday_exception') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: holiday_exception'); END;
CREATE TRIGGER holiday_exception_kind_update BEFORE UPDATE ON holiday_exception WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='holiday_exception') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: holiday_exception'); END;
CREATE TRIGGER holiday_exception_id_immutable BEFORE UPDATE OF id ON holiday_exception BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER public_facility_kind_insert BEFORE INSERT ON public_facility WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='public_facility') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: public_facility'); END;
CREATE TRIGGER public_facility_kind_update BEFORE UPDATE ON public_facility WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='public_facility') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: public_facility'); END;
CREATE TRIGGER public_facility_id_immutable BEFORE UPDATE OF id ON public_facility BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER transit_agency_kind_insert BEFORE INSERT ON transit_agency WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='transit_agency') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: transit_agency'); END;
CREATE TRIGGER transit_agency_kind_update BEFORE UPDATE ON transit_agency WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='transit_agency') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: transit_agency'); END;
CREATE TRIGGER transit_agency_id_immutable BEFORE UPDATE OF id ON transit_agency BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER transit_route_kind_insert BEFORE INSERT ON transit_route WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='transit_route') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: transit_route'); END;
CREATE TRIGGER transit_route_kind_update BEFORE UPDATE ON transit_route WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='transit_route') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: transit_route'); END;
CREATE TRIGGER transit_route_id_immutable BEFORE UPDATE OF id ON transit_route BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER transit_stop_kind_insert BEFORE INSERT ON transit_stop WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='transit_stop') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: transit_stop'); END;
CREATE TRIGGER transit_stop_kind_update BEFORE UPDATE ON transit_stop WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='transit_stop') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: transit_stop'); END;
CREATE TRIGGER transit_stop_id_immutable BEFORE UPDATE OF id ON transit_stop BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER transit_trip_kind_insert BEFORE INSERT ON transit_trip WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='transit_trip') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: transit_trip'); END;
CREATE TRIGGER transit_trip_kind_update BEFORE UPDATE ON transit_trip WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='transit_trip') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: transit_trip'); END;
CREATE TRIGGER transit_trip_id_immutable BEFORE UPDATE OF id ON transit_trip BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER route_node_kind_insert BEFORE INSERT ON route_node WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='route_node') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: route_node'); END;
CREATE TRIGGER route_node_kind_update BEFORE UPDATE ON route_node WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='route_node') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: route_node'); END;
CREATE TRIGGER route_node_id_immutable BEFORE UPDATE OF id ON route_node BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER route_edge_kind_insert BEFORE INSERT ON route_edge WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='route_edge') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: route_edge'); END;
CREATE TRIGGER route_edge_kind_update BEFORE UPDATE ON route_edge WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='route_edge') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: route_edge'); END;
CREATE TRIGGER route_edge_id_immutable BEFORE UPDATE OF id ON route_edge BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER route_access_restriction_kind_insert BEFORE INSERT ON route_access_restriction WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='route_access_restriction') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: route_access_restriction'); END;
CREATE TRIGGER route_access_restriction_kind_update BEFORE UPDATE ON route_access_restriction WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='route_access_restriction') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: route_access_restriction'); END;
CREATE TRIGGER route_access_restriction_id_immutable BEFORE UPDATE OF id ON route_access_restriction BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER review_queue_kind_insert BEFORE INSERT ON review_queue WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='review_queue') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: review_queue'); END;
CREATE TRIGGER review_queue_kind_update BEFORE UPDATE ON review_queue WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='review_queue') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: review_queue'); END;
CREATE TRIGGER review_queue_id_immutable BEFORE UPDATE OF id ON review_queue BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER audit_event_kind_insert BEFORE INSERT ON audit_event WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='audit_event') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: audit_event'); END;
CREATE TRIGGER audit_event_kind_update BEFORE UPDATE ON audit_event WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='audit_event') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: audit_event'); END;
CREATE TRIGGER audit_event_id_immutable BEFORE UPDATE OF id ON audit_event BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER saved_place_kind_insert BEFORE INSERT ON saved_place WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='saved_place') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: saved_place'); END;
CREATE TRIGGER saved_place_kind_update BEFORE UPDATE ON saved_place WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='saved_place') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: saved_place'); END;
CREATE TRIGGER saved_place_id_immutable BEFORE UPDATE OF id ON saved_place BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER saved_itinerary_kind_insert BEFORE INSERT ON saved_itinerary WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='saved_itinerary') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: saved_itinerary'); END;
CREATE TRIGGER saved_itinerary_kind_update BEFORE UPDATE ON saved_itinerary WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='saved_itinerary') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: saved_itinerary'); END;
CREATE TRIGGER saved_itinerary_id_immutable BEFORE UPDATE OF id ON saved_itinerary BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER pack_manifest_kind_insert BEFORE INSERT ON pack_manifest WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='pack_manifest') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: pack_manifest'); END;
CREATE TRIGGER pack_manifest_kind_update BEFORE UPDATE ON pack_manifest WHEN NOT EXISTS(SELECT 1 FROM entity WHERE id=new.id AND kind='pack_manifest') BEGIN SELECT RAISE(ABORT,'wrong entity subtype: pack_manifest'); END;
CREATE TRIGGER pack_manifest_id_immutable BEFORE UPDATE OF id ON pack_manifest BEGIN SELECT RAISE(ABORT,'identity is immutable'); END;
CREATE TRIGGER service_area_boundary_fact_id_insert BEFORE INSERT ON service_area WHEN new.boundary_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.boundary_fact_id AND subject_id=new.id AND property='boundary') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER service_area_boundary_fact_id_update BEFORE UPDATE ON service_area WHEN new.boundary_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.boundary_fact_id AND subject_id=new.id AND property='boundary') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER building_geometry_geometry_fact_id_insert BEFORE INSERT ON building_geometry WHEN new.geometry_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.geometry_fact_id AND subject_id=new.building_id AND property='geometry') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER building_geometry_geometry_fact_id_update BEFORE UPDATE ON building_geometry WHEN new.geometry_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.geometry_fact_id AND subject_id=new.building_id AND property='geometry') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER place_alias_alias_fact_id_insert BEFORE INSERT ON place_alias WHEN new.alias_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.alias_fact_id AND subject_id=new.place_id AND property='alias') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER place_alias_alias_fact_id_update BEFORE UPDATE ON place_alias WHEN new.alias_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.alias_fact_id AND subject_id=new.place_id AND property='alias') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER place_category_fact_id_insert BEFORE INSERT ON place_category WHEN new.fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.fact_id AND subject_id=new.place_id AND property='category') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER place_category_fact_id_update BEFORE UPDATE ON place_category WHEN new.fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.fact_id AND subject_id=new.place_id AND property='category') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER menu_tag_fact_id_insert BEFORE INSERT ON menu_tag WHEN new.fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.fact_id AND subject_id=new.menu_item_id AND property='tag') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER menu_tag_fact_id_update BEFORE UPDATE ON menu_tag WHEN new.fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.fact_id AND subject_id=new.menu_item_id AND property='tag') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER operating_hours_hours_fact_id_insert BEFORE INSERT ON operating_hours WHEN new.hours_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.hours_fact_id AND subject_id=new.place_id AND property='hours') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER operating_hours_hours_fact_id_update BEFORE UPDATE ON operating_hours WHEN new.hours_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.hours_fact_id AND subject_id=new.place_id AND property='hours') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER holiday_exception_hours_fact_id_insert BEFORE INSERT ON holiday_exception WHEN new.hours_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.hours_fact_id AND subject_id=new.place_id AND property='hours') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER holiday_exception_hours_fact_id_update BEFORE UPDATE ON holiday_exception WHEN new.hours_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.hours_fact_id AND subject_id=new.place_id AND property='hours') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER transit_trip_calendar_fact_id_insert BEFORE INSERT ON transit_trip WHEN new.calendar_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.calendar_fact_id AND subject_id=new.id AND property='calendar') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER transit_trip_calendar_fact_id_update BEFORE UPDATE ON transit_trip WHEN new.calendar_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.calendar_fact_id AND subject_id=new.id AND property='calendar') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER transit_stop_time_time_fact_id_insert BEFORE INSERT ON transit_stop_time WHEN new.time_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.time_fact_id AND subject_id=new.trip_id AND property='stop_time') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER transit_stop_time_time_fact_id_update BEFORE UPDATE ON transit_stop_time WHEN new.time_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.time_fact_id AND subject_id=new.trip_id AND property='stop_time') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER route_node_coordinate_fact_id_insert BEFORE INSERT ON route_node WHEN new.coordinate_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.coordinate_fact_id AND subject_id=new.id AND property='coordinate') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER route_node_coordinate_fact_id_update BEFORE UPDATE ON route_node WHEN new.coordinate_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.coordinate_fact_id AND subject_id=new.id AND property='coordinate') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER route_node_level_fact_id_insert BEFORE INSERT ON route_node WHEN new.level_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.level_fact_id AND subject_id=new.id AND property='level') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER route_node_level_fact_id_update BEFORE UPDATE ON route_node WHEN new.level_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.level_fact_id AND subject_id=new.id AND property='level') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER route_edge_geometry_fact_id_insert BEFORE INSERT ON route_edge WHEN new.geometry_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.geometry_fact_id AND subject_id=new.id AND property='geometry') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER route_edge_geometry_fact_id_update BEFORE UPDATE ON route_edge WHEN new.geometry_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.geometry_fact_id AND subject_id=new.id AND property='geometry') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER route_access_restriction_restriction_fact_id_insert BEFORE INSERT ON route_access_restriction WHEN new.restriction_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.restriction_fact_id AND subject_id=new.edge_id AND property='access') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER route_access_restriction_restriction_fact_id_update BEFORE UPDATE ON route_access_restriction WHEN new.restriction_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.restriction_fact_id AND subject_id=new.edge_id AND property='access') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER point_geometry_coordinate_fact_id_insert BEFORE INSERT ON point_geometry WHEN new.coordinate_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.coordinate_fact_id AND subject_id=new.entity_id AND property='coordinate') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER point_geometry_coordinate_fact_id_update BEFORE UPDATE ON point_geometry WHEN new.coordinate_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.coordinate_fact_id AND subject_id=new.entity_id AND property='coordinate') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER place_entrance_access_fact_id_insert BEFORE INSERT ON place_entrance WHEN new.access_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.access_fact_id AND subject_id=new.place_id AND property='entrance_access') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER place_entrance_access_fact_id_update BEFORE UPDATE ON place_entrance WHEN new.access_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.access_fact_id AND subject_id=new.place_id AND property='entrance_access') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER pack_manifest_coverage_fact_id_insert BEFORE INSERT ON pack_manifest WHEN new.coverage_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.coverage_fact_id AND subject_id=new.id AND property='coverage') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER pack_manifest_coverage_fact_id_update BEFORE UPDATE ON pack_manifest WHEN new.coverage_fact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fact WHERE id=new.coverage_fact_id AND subject_id=new.id AND property='coverage') BEGIN SELECT RAISE(ABORT,'wrong fact subject/property'); END;
CREATE TRIGGER fact_identity_immutable BEFORE UPDATE OF subject_id,property ON fact BEGIN SELECT RAISE(ABORT,'fact subject/property immutable'); END;
CREATE TRIGGER point_value_insert BEFORE INSERT ON point_geometry WHEN NOT EXISTS(SELECT 1 FROM fact WHERE id=new.coordinate_fact_id AND knowledge='asserted' AND json_type(value_json,'$.longitude') IN ('integer','real') AND json_type(value_json,'$.latitude') IN ('integer','real') AND json_extract(value_json,'$.longitude')=new.longitude AND json_extract(value_json,'$.latitude')=new.latitude AND json_extract(value_json,'$.crs')='EPSG:4326') BEGIN SELECT RAISE(ABORT,'coordinate fact mismatch'); END;
CREATE TRIGGER point_value_update BEFORE UPDATE ON point_geometry WHEN NOT EXISTS(SELECT 1 FROM fact WHERE id=new.coordinate_fact_id AND knowledge='asserted' AND json_type(value_json,'$.longitude') IN ('integer','real') AND json_type(value_json,'$.latitude') IN ('integer','real') AND json_extract(value_json,'$.longitude')=new.longitude AND json_extract(value_json,'$.latitude')=new.latitude AND json_extract(value_json,'$.crs')='EPSG:4326') BEGIN SELECT RAISE(ABORT,'coordinate fact mismatch'); END;
CREATE TRIGGER coordinate_value_guard BEFORE UPDATE OF value_json,knowledge ON fact WHEN EXISTS(SELECT 1 FROM point_geometry WHERE coordinate_fact_id=old.id) BEGIN SELECT RAISE(ABORT,'replace coordinate fact and point transactionally'); END;
CREATE TRIGGER policy_snapshot_insert BEFORE INSERT ON source_use_policy WHEN NOT EXISTS(SELECT 1 FROM source_snapshot WHERE id=new.snapshot_id AND source_id=new.source_id AND raw_sha256=new.raw_sha256) BEGIN SELECT RAISE(ABORT,'policy snapshot/source/hash mismatch'); END;
CREATE TRIGGER policy_identity_immutable BEFORE UPDATE OF source_id,snapshot_id,raw_sha256,permitted_use ON source_use_policy BEGIN SELECT RAISE(ABORT,'replace policy rather than rebind rights'); END;
CREATE TABLE search_document(id INTEGER PRIMARY KEY,fact_id TEXT NOT NULL UNIQUE REFERENCES fact(id),subject_id TEXT NOT NULL REFERENCES entity(id),text TEXT NOT NULL);
CREATE VIRTUAL TABLE search_fts USING fts5(text,content='search_document',content_rowid='id',tokenize='unicode61');
CREATE TRIGGER search_insert AFTER INSERT ON search_document BEGIN INSERT INTO search_fts(rowid,text) VALUES(new.id,new.text); END;
CREATE TRIGGER search_update AFTER UPDATE ON search_document BEGIN INSERT INTO search_fts(search_fts,rowid,text) VALUES('delete',old.id,old.text); INSERT INTO search_fts(rowid,text) VALUES(new.id,new.text); END;
CREATE TRIGGER search_delete AFTER DELETE ON search_document BEGIN INSERT INTO search_fts(search_fts,rowid,text) VALUES('delete',old.id,old.text); END;
CREATE TRIGGER fact_search_insert AFTER INSERT ON fact WHEN new.knowledge='asserted' AND new.property IN ('name','alias','description') AND json_type(new.value_json)='text' BEGIN INSERT INTO search_document(fact_id,subject_id,text) VALUES(new.id,new.subject_id,json_extract(new.value_json,'$')); END;
CREATE TRIGGER fact_search_update AFTER UPDATE OF value_json,knowledge ON fact BEGIN DELETE FROM search_document WHERE fact_id=old.id; INSERT INTO search_document(fact_id,subject_id,text) SELECT new.id,new.subject_id,json_extract(new.value_json,'$') WHERE new.knowledge='asserted' AND new.property IN ('name','alias','description') AND json_type(new.value_json)='text'; END;
CREATE TRIGGER fact_search_delete AFTER DELETE ON fact BEGIN DELETE FROM search_document WHERE fact_id=old.id; END;
CREATE TRIGGER entity_no_replace BEFORE INSERT ON entity WHEN EXISTS(SELECT 1 FROM entity WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER source_snapshot_no_replace BEFORE INSERT ON source_snapshot WHEN EXISTS(SELECT 1 FROM source_snapshot WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER evidence_no_replace BEFORE INSERT ON evidence WHEN EXISTS(SELECT 1 FROM evidence WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER fact_no_replace BEFORE INSERT ON fact WHEN EXISTS(SELECT 1 FROM fact WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER service_area_no_replace BEFORE INSERT ON service_area WHEN EXISTS(SELECT 1 FROM service_area WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER zone_no_replace BEFORE INSERT ON zone WHEN EXISTS(SELECT 1 FROM zone WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER building_no_replace BEFORE INSERT ON building WHEN EXISTS(SELECT 1 FROM building WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER building_geometry_no_replace BEFORE INSERT ON building_geometry WHEN EXISTS(SELECT 1 FROM building_geometry WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER floor_no_replace BEFORE INSERT ON floor WHEN EXISTS(SELECT 1 FROM floor WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER entrance_no_replace BEFORE INSERT ON entrance WHEN EXISTS(SELECT 1 FROM entrance WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER business_no_replace BEFORE INSERT ON business WHEN EXISTS(SELECT 1 FROM business WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER place_no_replace BEFORE INSERT ON place WHEN EXISTS(SELECT 1 FROM place WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER place_alias_no_replace BEFORE INSERT ON place_alias WHEN EXISTS(SELECT 1 FROM place_alias WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER menu_no_replace BEFORE INSERT ON menu WHEN EXISTS(SELECT 1 FROM menu WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER menu_item_no_replace BEFORE INSERT ON menu_item WHEN EXISTS(SELECT 1 FROM menu_item WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER operating_hours_no_replace BEFORE INSERT ON operating_hours WHEN EXISTS(SELECT 1 FROM operating_hours WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER holiday_exception_no_replace BEFORE INSERT ON holiday_exception WHEN EXISTS(SELECT 1 FROM holiday_exception WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER public_facility_no_replace BEFORE INSERT ON public_facility WHEN EXISTS(SELECT 1 FROM public_facility WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER transit_agency_no_replace BEFORE INSERT ON transit_agency WHEN EXISTS(SELECT 1 FROM transit_agency WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER transit_route_no_replace BEFORE INSERT ON transit_route WHEN EXISTS(SELECT 1 FROM transit_route WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER transit_stop_no_replace BEFORE INSERT ON transit_stop WHEN EXISTS(SELECT 1 FROM transit_stop WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER transit_trip_no_replace BEFORE INSERT ON transit_trip WHEN EXISTS(SELECT 1 FROM transit_trip WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER route_node_no_replace BEFORE INSERT ON route_node WHEN EXISTS(SELECT 1 FROM route_node WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER route_edge_no_replace BEFORE INSERT ON route_edge WHEN EXISTS(SELECT 1 FROM route_edge WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER route_access_restriction_no_replace BEFORE INSERT ON route_access_restriction WHEN EXISTS(SELECT 1 FROM route_access_restriction WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER review_queue_no_replace BEFORE INSERT ON review_queue WHEN EXISTS(SELECT 1 FROM review_queue WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER audit_event_no_replace BEFORE INSERT ON audit_event WHEN EXISTS(SELECT 1 FROM audit_event WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER saved_place_no_replace BEFORE INSERT ON saved_place WHEN EXISTS(SELECT 1 FROM saved_place WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER saved_itinerary_no_replace BEFORE INSERT ON saved_itinerary WHEN EXISTS(SELECT 1 FROM saved_itinerary WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER pack_manifest_no_replace BEFORE INSERT ON pack_manifest WHEN EXISTS(SELECT 1 FROM pack_manifest WHERE id=new.id) BEGIN SELECT RAISE(ABORT,'identity cannot be replaced/upserted'); END;
CREATE TRIGGER source_snapshot_no_delete BEFORE DELETE ON source_snapshot BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER evidence_no_delete BEFORE DELETE ON evidence BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER fact_no_delete BEFORE DELETE ON fact BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER service_area_no_delete BEFORE DELETE ON service_area BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER zone_no_delete BEFORE DELETE ON zone BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER building_no_delete BEFORE DELETE ON building BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER building_geometry_no_delete BEFORE DELETE ON building_geometry BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER floor_no_delete BEFORE DELETE ON floor BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER entrance_no_delete BEFORE DELETE ON entrance BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER business_no_delete BEFORE DELETE ON business BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER place_no_delete BEFORE DELETE ON place BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER place_alias_no_delete BEFORE DELETE ON place_alias BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER menu_no_delete BEFORE DELETE ON menu BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER menu_item_no_delete BEFORE DELETE ON menu_item BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER operating_hours_no_delete BEFORE DELETE ON operating_hours BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER holiday_exception_no_delete BEFORE DELETE ON holiday_exception BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER public_facility_no_delete BEFORE DELETE ON public_facility BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER transit_agency_no_delete BEFORE DELETE ON transit_agency BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER transit_route_no_delete BEFORE DELETE ON transit_route BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER transit_stop_no_delete BEFORE DELETE ON transit_stop BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER transit_trip_no_delete BEFORE DELETE ON transit_trip BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER route_node_no_delete BEFORE DELETE ON route_node BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER route_edge_no_delete BEFORE DELETE ON route_edge BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER route_access_restriction_no_delete BEFORE DELETE ON route_access_restriction BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER review_queue_no_delete BEFORE DELETE ON review_queue BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER audit_event_no_delete BEFORE DELETE ON audit_event BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER saved_place_no_delete BEFORE DELETE ON saved_place BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER saved_itinerary_no_delete BEFORE DELETE ON saved_itinerary BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER pack_manifest_no_delete BEFORE DELETE ON pack_manifest BEGIN SELECT RAISE(ABORT,'canonical identity cannot be deleted/recycled'); END;
CREATE TRIGGER source_no_replace BEFORE INSERT ON source WHEN EXISTS(SELECT 1 FROM source WHERE source_id=new.source_id) BEGIN SELECT RAISE(ABORT,'source identity cannot be replaced'); END;
CREATE TRIGGER source_no_delete BEFORE DELETE ON source BEGIN SELECT RAISE(ABORT,'source identity cannot be recycled'); END;
COMMIT;
