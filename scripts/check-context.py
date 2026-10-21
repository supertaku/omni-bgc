"""Host geometry/lineage regressions; not device visual/performance acceptance."""
import runpy, gzip, json, hashlib
from pathlib import Path
scope=runpy.run_path(str(Path(__file__).with_name('build-map-context.py')))
from shapely.geometry import shape
from shapely import covers
root=scope['ROOT']; dest=scope['DEST']
receipt=json.loads((dest/'provenance.json').read_text())
assert receipt['builderSha256']==scope['digest'](Path(__file__).with_name('build-map-context.py'))
assert receipt['detailedArchiveSha256']==scope['digest'](root/'assets/generated/gex/gex.pmtiles')
records=json.loads(gzip.decompress((dest/'features.geojson.gz').read_bytes()))
assert len({row['sourceRef'] for row in records})==len(records)
counts={kind:0 for kind in receipt['featureCounts']}
quadrants=set(); relations=0
for row in records:
 p=row['properties']; k=p['kind']; counts[k]+=1
 original=shape(row['sourceGeometry']); derived=shape(row['derivedGeometry'])
 assert original.is_valid and derived.is_valid, row['sourceRef']
 assert p.get('navigation_eligible',False) is False
 if k=='building':
  assert p['visual_height']>p['visual_base']>=0
  assert p['height_basis'] in ('osm-height-unverified','osm-levels-estimate-3m','illustrative-6m')
  x,y=derived.representative_point().coords[0]; quadrants.add((x>121.0525,y>14.5525))
  # Derived polygon must remain within original source support (projection roundoff only).
  assert derived.difference(original.buffer(1e-10)).area<1e-10, row['sourceRef']
 if row['sourceRef'].startswith('osm:relation:'): relations+=1
assert counts==receipt['featureCounts']
assert counts['building']>40000 and counts['landmark']==1
assert len(quadrants)==4 and relations>0
assert scope['heights']({})==(6,0,'illustrative-6m')
assert scope['heights']({'building:levels':'3'})==(9,0,'osm-levels-estimate-3m')
assert scope['heights']({'height':'12 m','min_height':'3'})==(12,3,'osm-height-unverified')
print('Context: source-bound valid geometry, four-quadrant coverage, relations, height provenance and checksums passed.')
