"""Focused candidate graph regressions; standard library only, no acquisition."""
import gzip
import hashlib
import json
import math
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
builder = runpy.run_path(str(ROOT / 'scripts/build-walking-graph.py'))
build_graph = builder['build_graph']


def node(x, y, **tags):
    return {'coordinate': [x, y], 'tags': tags, 'version': '1', 'sourceFiles': ['fixture.xml.gz']}


def way(refs, **tags):
    return {'refs': refs, 'tags': tags, 'version': '1', 'sourceFiles': ['fixture.xml.gz']}


def fixtures():
    nodes = {'1': node(121.049, 14.55), '2': node(121.05, 14.55),
             '3': node(121.051, 14.55), '4': node(121.05, 14.549),
             '5': node(121.05, 14.551)}
    roads = {'10': way(['1', '2', '3'], highway='residential'),
             '11': way(['4', '2', '5'], highway='residential')}
    assert not build_graph(nodes, roads)['edges'], 'road fallback must be opt-in'
    graph = build_graph(nodes, roads, corner_fallback=True)
    assert len(graph['edges']) == 4
    assert len(graph['diagnostics']['components']) == 1, 'compatible source corner connects'
    assert graph['diagnostics']['cornerAssumptions'][0]['sourceNodeRef'] == 'osm:node:2'
    assert all(e['classification'] == 'assumed-street-centerline' for e in graph['edges'])
    assert graph['status'] == 'candidate' and not graph['connectors']
    assert graph['diagnostics']['verifiedEntrances'] == 0
    separated = {**roads, '11': way(['4', '2', '5'], highway='residential', bridge='yes', layer='1')}
    assert len(build_graph(nodes, separated, corner_fallback=True)['diagnostics']['components']) == 2
    for tags in ({'access': 'private'}, {'foot': 'no'}, {'highway': 'motorway'}, {'access': 'customers'}, {'foot:forward': 'no'}, {'foot:conditional': 'no @ (Mo-Fr)'}):
        restricted = {**roads, '11': way(['4', '2', '5'], **{'highway': 'residential', **tags})}
        assert len(build_graph(nodes, restricted, corner_fallback=True)['edges']) == 2
    blocked = {**nodes, '2': node(121.05, 14.55, barrier='gate')}
    assert not build_graph(blocked, roads, corner_fallback=True)['edges']
    # A barrier line crossing a street is a veto, never a new junction.
    barrier = {**roads, '12': way(['4', '5'], barrier='fence')}
    assert not build_graph(nodes, barrier, corner_fallback=True)['edges']
    # Rendered intersections have different source IDs and cannot connect.
    unshared = {**nodes, '6': node(121.05, 14.55)}
    crossing = {**roads, '11': way(['4', '6', '5'], highway='residential')}
    assert len(build_graph(unshared, crossing, corner_fallback=True)['diagnostics']['components']) == 2
    pedestrian = {'10': way(['1', '2', '3'], highway='footway', **{'oneway:foot': '-1'})}
    graph = build_graph(nodes, pedestrian)
    assert all(e['direction'] == 'reverse' for e in graph['edges'])
    assert [e['coordinates'] for e in graph['edges']] == [[nodes['1']['coordinate'], nodes['2']['coordinate']], [nodes['2']['coordinate'], nodes['3']['coordinate']]]
    assert len(build_graph(nodes, {'10': way(['1', '1', '2'], highway='footway')})['edges']) == 1
    # No grade change is silently called a surveyed stair/ramp connection.
    level_node = {**nodes, '2': node(121.05, 14.55, level='1')}
    assert not build_graph(level_node, pedestrian)['edges']
    entrance_nodes = {**nodes, '2': node(121.05, 14.55, entrance='main')}
    assert build_graph(entrance_nodes, pedestrian)['diagnostics']['observedEntranceNodes'] == 1
    assert build_graph(entrance_nodes, pedestrian)['diagnostics']['verifiedEntrances'] == 0
    vehicle_oneway = {'10': way(['1', '2', '3'], highway='residential', oneway='yes')}
    assert all(e['direction'] == 'both' for e in build_graph(nodes, vehicle_oneway, corner_fallback=True)['edges']), 'vehicle direction must not invent pedestrian restrictions'
    area = {'10': way(['1', '2', '3', '1'], highway='pedestrian', area='yes')}
    assert not build_graph(nodes, area)['edges'], 'a plaza perimeter is not a surveyed walking route'
    # Source-restricted foot turn relations cannot be erased by centerline fallback.
    foot_turn = {'20': {'tags': {'restriction:foot': 'no_left_turn'}, 'members': [{'type': 'way', 'ref': '10'}, {'type': 'way', 'ref': '11'}]}}
    assert not build_graph(nodes, roads, corner_fallback=True, relations=foot_turn)['edges']
    # Boundary is the loader's engineering pilot, never expanded display coverage.
    installed = (ROOT / 'src/routing/installed.ts').read_text(encoding='utf-8')
    import re
    boundary = json.loads(re.search(r'const BOUNDARY = (\[.*?\]);', installed).group(1))
    assert boundary == builder['BOUNDARY']
    assert builder['SCOPE_ID'] in installed
    assert graph == build_graph(nodes, pedestrian), 'stable output for identical input'


def validate(graph):
    assert graph['schemaVersion'] == 1 and graph['status'] == 'candidate'
    assert graph['review']['status'] == 'candidate' and graph['review']['fieldVerifiedAt'] is None
    nodes = {n['id']: n for n in graph['nodes']}
    assert len(nodes) == len(graph['nodes'])
    ids = set()
    for edge in graph['edges']:
        assert edge['id'] not in ids
        ids.add(edge['id'])
        assert edge['from'] in nodes and edge['to'] in nodes
        assert edge['coordinates'][0] == nodes[edge['from']]['coordinate']
        assert edge['coordinates'][-1] == nodes[edge['to']]['coordinate']
        assert builder['distance'](*edge['coordinates']) > 0
        assert all(builder['inside'](c) for c in edge['coordinates'])
        assert edge['access'] != 'restricted' and edge['foot'] != 'restricted'
        assert edge['review']['status'] == 'candidate' and edge['gradeTransition'] == 'none'
        assert nodes[edge['from']]['grade'] == nodes[edge['to']]['grade']
    for n in nodes.values():
        assert all(math.isfinite(v) for v in n['coordinate'])
        assert abs(n['coordinate'][0]) <= 180 and abs(n['coordinate'][1]) <= 90
    assert not graph['connectors'] and graph['diagnostics']['verifiedEntrances'] == 0
    assert sum(c['edgeCount'] for c in graph['diagnostics']['components']) == len(graph['edges'])


if __name__ == '__main__':
    fixtures()
    source_nodes, source_ways, _, _ = builder['load_sources']()
    for fallback in (False, True):
        generated = builder['build_artifacts'](corner_fallback=fallback)
        for path, content in generated.items():
            assert path.read_bytes() == content, f'{path} is stale; rebuild candidate'
        prefix = 'corner-fallback' if fallback else 'pedestrian'
        graph_path = ROOT / f'assets/generated/walking-candidate/{prefix}.graph.json.gz'
        receipt = json.loads((graph_path.parent / f'{prefix}.receipt.json').read_text())
        assert receipt['output']['sha256'] == hashlib.sha256(graph_path.read_bytes()).hexdigest()
        graph = json.loads(gzip.decompress(graph_path.read_bytes()))
        validate(graph)
        for edge in graph['edges']:
            refs = source_ways[edge['sourceRef'].split(':')[-1]]['refs']
            index = int(edge['id'].split(':')[-1])
            assert edge['sourceNodeRefs'] == [f'osm:node:{r}' for r in refs[index:index + 2]]
            assert edge['coordinates'] == [source_nodes[r]['coordinate'] for r in refs[index:index + 2]], 'real source segment geometry must survive exactly'
        assert graph['sourceSha256'] == builder['sha'](builder['canonical'](graph['sourceSnapshot']))
        print(f'{prefix}: {len(graph["nodes"])} nodes, {len(graph["edges"])} edges, {len(graph["diagnostics"]["components"])} components; exact rebuild/receipt passed')
    print('Walking candidate fixtures passed; no field approval or device acceptance claimed.')
