BEGIN IMMEDIATE;
CREATE TABLE local_favorite(place_id TEXT PRIMARY KEY CHECK(length(place_id)=36));
CREATE TABLE local_itinerary(sequence INTEGER PRIMARY KEY CHECK(sequence>=0),place_id TEXT NOT NULL CHECK(length(place_id)=36),duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 0 AND 1440));
CREATE TABLE local_settings(singleton INTEGER PRIMARY KEY CHECK(singleton=1),start_time TEXT CHECK(start_time IS NULL OR (length(start_time)=5 AND start_time GLOB '[0-2][0-9]:[0-5][0-9]' AND substr(start_time,1,2)<'24')));
INSERT INTO local_settings VALUES(1,NULL);
CREATE TABLE local_recent_place(place_id TEXT PRIMARY KEY CHECK(length(place_id)=36),viewed_at TEXT NOT NULL CHECK(julianday(viewed_at) IS NOT NULL));
INSERT INTO schema_migration VALUES(2,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
COMMIT;
