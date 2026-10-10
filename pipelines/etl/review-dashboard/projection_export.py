"""Approved-only M1 projection extension. Local export, never publication or rights grant."""
import importlib.util
import json
import sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]

def current_supported(db,fact_id,now):
    row=db.execute('SELECT f.subject_id,f.property,f.value_json FROM fact f WHERE f.id=? AND f.knowledge=\'asserted\' AND julianday(f.valid_from)<=julianday(?) AND julianday(f.valid_until)>julianday(?) AND EXISTS(SELECT 1 FROM fact_lineage l JOIN source_snapshot s ON s.id=l.snapshot_id WHERE l.fact_id=f.id AND julianday(l.observed_at)<=julianday(?) AND julianday(l.verified_at)<=julianday(?) AND julianday(l.valid_until)>julianday(?) AND julianday(s.fetched_at_utc)<=julianday(?) AND julianday(s.valid_until)>julianday(?))',(fact_id,now,now,now,now,now,now,now)).fetchone()
    if not row:raise ValueError('Missing/current evidence fact')
    return row[0],row[1],json.loads(row[2])

def coords(value):
    if not isinstance(value,list) or len(value)<2:raise ValueError('Route needs actual coordinate sequence')
    for p in value:
        if not isinstance(p,list) or len(p)!=2 or any(isinstance(x,bool) or not isinstance(x,(int,float)) for x in p) or not -180<=p[0]<=180 or not -90<=p[1]<=90:raise ValueError('Invalid route WGS84')

def extend_projection(mobile,proposal,now):
    """Input proposal is explicit reviewed relation mapping; no building-based inference."""
    migration=(ROOT/'packages/database/migrations/mobile/003_read_projection.up.sql').read_text()
    mobile.executescript(migration.rsplit('COMMIT;',1)[0])
    with mobile:
        for link in proposal.get('place_entrances',[]):
            subject,prop,value=current_supported(mobile,link['access_fact_id'],now)
            if subject!=link['place_id'] or prop!='entrance_access' or value.get('entrance_id')!=link['entrance_id'] or value.get('eligible') is not True or value.get('access')!='public':raise ValueError('Unbound access claim')
            points=mobile.execute("SELECT p.fact_id FROM point p JOIN entity e ON e.id=p.entity_id WHERE p.entity_id=? AND e.kind='entrance'",(link['entrance_id'],)).fetchone()
            if not points:raise ValueError('Entrance lacks verified coordinate')
            current_supported(mobile,points[0],now)
            if not mobile.execute("SELECT 1 FROM fact_lineage WHERE fact_id=? AND verification_method='field_survey'",(points[0],)).fetchone():raise ValueError('Entrance requires field evidence')
            mobile.execute('INSERT INTO read_place_entrance VALUES(?,?,?)',(link['place_id'],link['entrance_id'],link['access_fact_id']))
        for route in proposal.get('transit_routes',[]):
            subject,prop,shape=current_supported(mobile,route['shape_fact_id'],now)
            if subject!=route['route_id'] or prop!='route_shape' or shape.get('crs')!='EPSG:4326':raise ValueError('Wrong route shape subject')
            coords(shape.get('coordinates'))
            subject,prop,calendar=current_supported(mobile,route['calendar_fact_id'],now)
            if subject!=route['route_id'] or prop!='calendar' or not isinstance(calendar.get('description'),str) or not calendar['description'].strip():raise ValueError('Missing operating calendar')
            if len(route['stops'])<2 or [s['sequence'] for s in route['stops']]!=list(range(len(route['stops']))):raise ValueError('Invalid/gapped stop sequence')
            mobile.execute('INSERT INTO read_transit_route VALUES(?,?,?)',(route['route_id'],route['shape_fact_id'],route['calendar_fact_id']))
            for stop in route['stops']:
                subject,prop,value=current_supported(mobile,stop['sequence_fact_id'],now)
                if subject!=route['route_id'] or prop!='route_stop_sequence' or not isinstance(value,list) or not any(v.get('stop_id')==stop['stop_id'] and v.get('sequence')==stop['sequence'] for v in value if isinstance(v,dict)):raise ValueError('Unbound route stop sequence')
                point=mobile.execute('SELECT fact_id FROM point WHERE entity_id=?',(stop['stop_id'],)).fetchone()
                if not point:raise ValueError('Transit stop coordinate missing')
                current_supported(mobile,point[0],now)
                mobile.execute('INSERT INTO read_transit_stop VALUES(?,?,?,?)',(route['route_id'],stop['sequence'],stop['stop_id'],stop['sequence_fact_id']))

def export_read_projection(staging,proposal,now):
    # Isolated module instance reuses ALL accepted M1 rights/freshness/identity gates;
    # only extend its supported-property set, never mutate shared source or module state.
    spec=importlib.util.spec_from_file_location('isolated_m1_projection',ROOT/'packages/database/export_mobile.py')
    exporter=importlib.util.module_from_spec(spec);spec.loader.exec_module(exporter)
    exporter.PROPERTIES=exporter.PROPERTIES|{'route_shape','calendar','route_stop_sequence'}
    mobile,report=exporter.export_mobile(staging,now)
    try:
        extend_projection(mobile,proposal,now)
        return mobile,report|{'read_projection_version':3}
    except Exception:
        mobile.close();raise
