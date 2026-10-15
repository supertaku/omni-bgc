"""Host-only adversarial scope, immutable-output, identity and tile contracts."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
import gzip
import mapbox_vector_tile
from shapely.geometry import shape, Polygon, Point

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'pipelines/map-pack'))
spec=importlib.util.spec_from_file_location('expansion',ROOT/'pipelines/map-pack/expansion.py')
expansion=importlib.util.module_from_spec(spec);spec.loader.exec_module(expansion)


def feature(ident='osm:way:1',geometry=None,tags=None,context=False):
    return {'type':'Feature','id':ident,'geometry':geometry or {'type':'LineString','coordinates':[[121.05,14.55],[121.051,14.551]]},'properties':{'osm_id':1,'osm_type':'way','source_ref':'osm:way:1','tags':tags or {'highway':'primary','name':'Test Street'},'provenance':{'distribution_authorized':False,'raw_sha256':'a'*64},'render_only':True,'navigation_eligible':False,'status':'CANDIDATE_HISTORICAL','display_policy':'LIMITED_CONTEXT' if context else 'SERVICE_DETAIL'}}


class ExpansionContracts(unittest.TestCase):
    def setUp(self):
        self.scope=shape({'type':'Polygon','coordinates':[[[121.049,14.549],[121.052,14.549],[121.052,14.552],[121.049,14.552],[121.049,14.549]]]})
        self.project=expansion.Transformer.from_crs(4326,3857,always_xy=True).transform

    def test_canonical_identity_roundtrips(self):
        records,_,_=expansion.records_for([feature(),feature('osm:relation:1')],self.scope,self.project)
        self.assertNotEqual(records[0][2],records[1][2])
        tiles,audit=expansion.make_tiles(records,self.scope.bounds,18,18)
        self.assertTrue(tiles);self.assertTrue(audit)
        props=[f['properties'] for _,data in tiles for f in mapbox_vector_tile.decode(gzip.decompress(data))['geometry']['features']]
        self.assertEqual({p['feature_id'] for p in props},{'osm:way:1','osm:relation:1'})
        self.assertTrue(all(p['source_ref']=='osm:way:1' and not p['navigation_eligible'] for p in props))

    def test_duplicate_identity_rejected(self):
        with self.assertRaisesRegex(ValueError,'identity'):expansion.records_for([feature(),feature()],self.scope,self.project)

    def test_detail_outside_scope_rejected(self):
        f=feature();f['geometry']['coordinates'][0]=[121.04,14.54]
        with self.assertRaisesRegex(ValueError,'outside'):expansion.records_for([f],self.scope,self.project)

    def test_context_buildings_rejected(self):
        geometry={'type':'Polygon','coordinates':[[[121.05,14.55],[121.051,14.55],[121.051,14.551],[121.05,14.55]]]}
        with self.assertRaisesRegex(ValueError,'Only roads'):expansion.records_for([feature(geometry=geometry,tags={'building':'yes'},context=True)],self.scope,self.project)

    def test_context_road_requires_bound_context(self):
        f=feature(context=True)
        with self.assertRaisesRegex(ValueError,'context boundary'):expansion.records_for([f],self.scope,self.project)
        self.assertEqual(len(expansion.records_for([f],self.scope,self.project,self.scope)[0]),1)
        f['properties']['tags']['highway']='residential'
        with self.assertRaisesRegex(ValueError,'major-road'):expansion.records_for([f],self.scope,self.project,self.scope)

    def test_detail_exclusion_precedence(self):
        forbidden=shape({'type':'Polygon','coordinates':[[[121.0499,14.5499],[121.0502,14.5499],[121.0502,14.5502],[121.0499,14.5502],[121.0499,14.5499]]]})
        with self.assertRaisesRegex(ValueError,'outside'):expansion.records_for([feature()],self.scope.difference(forbidden),self.project)

    def test_navigation_authority_rejected(self):
        f=feature();f['properties']['navigation_eligible']=True
        with self.assertRaisesRegex(ValueError,'render-only'):expansion.records_for([f],self.scope,self.project)

    def test_rights_flag_rejected(self):
        f=feature();f['properties']['provenance']['distribution_authorized']=True
        with self.assertRaisesRegex(ValueError,'rights'):expansion.records_for([f],self.scope,self.project)

    def test_manifest_paths_and_hashes(self):
        with tempfile.TemporaryDirectory(prefix='gex-unit-',dir=ROOT/'data/generated/map-pack') as folder:
            root=Path(folder);p=root/'ok.json';p.write_text('{}')
            manifest={'files':[{'path':'ok.json','bytes':2,'sha256':expansion.sha(p)}]}
            self.assertEqual(expansion.check_inventory(root,manifest),{'ok.json'})
            manifest['files'][0]['sha256']='0'*64
            with self.assertRaisesRegex(ValueError,'hash'):expansion.check_inventory(root,manifest)
            with self.assertRaisesRegex(ValueError,'escapes'):expansion.checked_path(root,'../outside')

    def test_output_guard_preserves_pilot(self):
        with self.assertRaisesRegex(ValueError,'gex-'):expansion.output_path(ROOT/'data/generated/map-pack/starter')
        with self.assertRaisesRegex(ValueError,'gex-'):expansion.output_path(ROOT/'apps/mobile/assets/generated/gex-test')

    def test_gzip_and_tiles_deterministic(self):
        records,_,_=expansion.records_for([feature()],self.scope,self.project)
        self.assertEqual(expansion.make_tiles(records,self.scope.bounds),expansion.make_tiles(records,self.scope.bounds))

    def test_archive_full_traversal_and_missing_tile_rejected(self):
        records,_,_=expansion.records_for([feature()],self.scope,self.project)
        tiles,audit=expansion.make_tiles(records,self.scope.bounds,18,18)
        with tempfile.TemporaryDirectory(prefix='gex-unit-',dir=ROOT/'data/generated/map-pack') as folder:
            archive=Path(folder)/'test.pmtiles'
            with expansion.write(str(archive)) as writer:
                for ident,data in sorted(tiles):writer.write_tile(ident,data)
                writer.finalize({'tile_type':expansion.TileType.MVT,'tile_compression':expansion.Compression.GZIP},{'test':True})
            report=expansion.validate_archive(archive,audit,{'osm:way:1'})
            self.assertEqual(report['represented_source_features'],1)
            self.assertEqual(sum(report['tiles_by_zoom'].values()),len(tiles))
            with self.assertRaisesRegex(ValueError,'inventory'):expansion.validate_archive(archive,audit[:-1],{'osm:way:1'})

    def test_existing_output_is_immutable(self):
        with tempfile.TemporaryDirectory(prefix='gex-unit-',dir=ROOT/'data/generated/map-pack') as folder:
            with self.assertRaisesRegex(ValueError,'already exists'):expansion.output_path(folder)

    def test_quantized_narrow_neck_is_audited_without_source_repair(self):
        z=18;x,y=expansion.xy(121.05,14.55,z);world=20037508.342789244
        size=2*world/2**z;q=size/4096;left=-world+x*size;bottom=world-(y+1)*size
        ring=[(0,0),(4,0),(4,4),(2.1,4),(2.1,6),(4,6),(4,10),(0,10),(0,6),(1.9,6),(1.9,4),(0,4),(0,0)]
        geometry=Polygon([(left+(1000+a)*q,bottom+(1000+b)*q) for a,b in ring])
        self.assertTrue(geometry.is_valid);before=geometry.wkb
        props={'kind':'plaza','feature_id':'synthetic:narrow-neck','source_ref':'synthetic:original','navigation_eligible':False}
        tree_props={'kind':'tree','feature_id':'synthetic:tree','source_ref':'synthetic:tree','navigation_eligible':False}
        rows=[(geometry,props,1),(Point(left+1020*q,bottom+1020*q),tree_props,2)]
        tiles,audit=expansion.make_tiles(rows,self.scope.bounds,z,z)
        self.assertEqual(geometry.wkb,before)
        self.assertTrue(any(n['feature_id']=='synthetic:narrow-neck' and n['area_delta_grid_units']==0 for r in audit for n in r['quantized_fill_normalizations']))
        self.assertTrue(all(not r['invalid_quantized_omissions'] for r in audit))
        self.assertTrue(any(f['properties']['feature_id']=='synthetic:narrow-neck' for _,data in tiles for f in mapbox_vector_tile.decode(gzip.decompress(data))['geometry']['features']))
        self.assertTrue(all(shape(f['geometry']).is_valid for _,data in tiles for f in mapbox_vector_tile.decode(gzip.decompress(data))['geometry']['features']))

    def test_engineering_acceptance_binds_review_and_geometry(self):
        document=expansion.load(ROOT/'data/manifests/service-area-v2.json')
        status,review=expansion.validated_scope_status(document)
        self.assertEqual(status,'CANDIDATE_PACK_ACCEPTED_ENGINEERING_SCOPE');self.assertTrue(review)
        document['geometry']['coordinates'][0][0][0]+=.00001
        with self.assertRaisesRegex(ValueError,'exact geometry'):expansion.validated_scope_status(document)

    def test_source_landmark_label_is_placement_not_entrance(self):
        f=feature(geometry={'type':'Polygon','coordinates':[[[121.05,14.55],[121.051,14.55],[121.051,14.551],[121.05,14.55]]]},tags={'name':'Historical Named Site','landuse':'commercial'})
        before=shape(f['geometry']).wkb
        rows,qa,chars=expansion.landmark_labels([f],[{'source_ref':'osm:way:1','anchor_id':'site'}],self.scope,self.project)
        self.assertEqual(len(rows),1);self.assertEqual(rows[0][1]['name'],'Historical Named Site')
        self.assertFalse(rows[0][1]['navigation_eligible']);self.assertFalse(qa['labels'][0]['entrance_verified'])
        self.assertEqual(shape(f['geometry']).wkb,before)
        self.assertTrue(shape(f['geometry']).covers(Point(qa['labels'][0]['display_point_wgs84'])))
        self.assertTrue(set('Historical Named Site').issubset(chars))
        f['properties']['tags']={}
        rows,qa,_=expansion.landmark_labels([f],[{'source_ref':'osm:way:1','anchor_id':'site'}],self.scope,self.project)
        self.assertEqual(rows,[]);self.assertEqual(qa['unlabeled_anchor_groups'][0]['anchor_id'],'site')

    def test_unknown_non_map_point_is_not_invented(self):
        f=feature(geometry={'type':'Point','coordinates':[121.05,14.55]},tags={'amenity':'restaurant'})
        self.assertEqual(expansion.records_for([f],self.scope,self.project)[0],[])

    def test_corridor_is_path(self):
        self.assertEqual(expansion.kind_for(shape(feature()['geometry']),{'highway':'corridor'}),'path')


if __name__=='__main__':unittest.main()
