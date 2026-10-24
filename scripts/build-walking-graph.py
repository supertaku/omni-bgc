"""Reproducible, unapproved walking candidates from pinned retained OSM XML.

Standard library only. No source acquisition, catalog edits, entrance invention,
sidewalk offsets, geometric junction snapping or production graph installation.
"""
import argparse
from collections import Counter, defaultdict
import gzip
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SCOPE_ID = 'omni-bgc:service-area:high-street-pilot-v1'
BOUNDARY = [[121.0475, 14.54865], [121.05205, 14.54865], [121.05205, 14.5524], [121.0475, 14.5524], [121.0475, 14.54865]]
SOURCE = ROOT / 'assets/generated/context/source'
INVENTORY = SOURCE.parent / 'source-inventory.json'
DEST = ROOT / 'assets/generated/walking-candidate'
PEDESTRIAN = {'footway', 'path', 'pedestrian', 'steps', 'living_street'}
STREETS = {'residential', 'service', 'unclassified', 'tertiary', 'secondary', 'primary'}
PERMITTED = {None, 'yes', 'designated', 'permissive', 'public'}
REVIEW = {'status': 'candidate', 'fieldVerifiedAt': None, 'validUntil': '', 'reviewer': '', 'evidenceId': ''}


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode('utf-8')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def inside(coordinate):
    return len(coordinate) == 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in coordinate) and BOUNDARY[0][0] <= coordinate[0] <= BOUNDARY[1][0] and BOUNDARY[0][1] <= coordinate[1] <= BOUNDARY[2][1]


def distance(a, b):
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(math.radians(b[0] - a[0]) / 2) ** 2
    return 12742017.6 * math.asin(math.sqrt(min(1, max(0, h))))


def grade(tags):
    try:
        layer, level = float(tags.get('layer', '0')), float(tags.get('level', '0'))
        if not math.isfinite(layer) or not math.isfinite(level):
            return None
    except ValueError:
        return None
    bridge = tags.get('bridge', 'no') not in ('no', 'false', '0')
    tunnel = tags.get('tunnel', 'no') not in ('no', 'false', '0')
    if bridge and tunnel:
        return None
    return f'layer:{layer:g};level:{level:g};bridge:{int(bridge)};tunnel:{int(tunnel)}'


def restricted(tags):
    # A candidate has no clock/profile interpretation for conditional access.
    return any(tags.get(key) not in PERMITTED for key in ('access', 'foot', 'foot:forward', 'foot:backward')) or any(tags.get(key) for key in ('access:conditional', 'foot:conditional'))


def blocked(tags):
    return restricted(tags) or tags.get('barrier') not in (None, 'no') or tags.get('crossing') == 'no'


def node_grade_compatible(node_tags, way_tags):
    return all(key not in node_tags or node_tags[key] == way_tags.get(key, '0' if key in ('level', 'layer') else 'no') for key in ('level', 'layer', 'bridge', 'tunnel'))


def intersects(a, b, c, d):
    """Conservative barrier veto; this never creates a network junction."""
    def turn(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    if max(a[0], b[0]) < min(c[0], d[0]) or max(c[0], d[0]) < min(a[0], b[0]) or max(a[1], b[1]) < min(c[1], d[1]) or max(c[1], d[1]) < min(a[1], b[1]):
        return False
    return turn(a, b, c) * turn(a, b, d) <= 0 and turn(c, d, a) * turn(c, d, b) <= 0


def load_sources():
    inventory = json.loads(INVENTORY.read_text(encoding='utf-8'))
    files = inventory['sourceFiles']
    if len(files) != 22 or len({r['path'] for r in files}) != len(files):
        raise ValueError('Expected the pinned 22-file retained OSM inventory')
    nodes, ways, relations = {}, {}, {}
    for row in sorted(files, key=lambda r: r['path']):
        path = SOURCE / row['path']
        if path.name != row['path'] or path.stat().st_size != row['bytes'] or sha(path.read_bytes()) != row['sha256']:
            raise ValueError(f'Pinned retained source mismatch: {row["path"]}')
        with gzip.open(path, 'rb') as stream:
            for _, elem in ET.iterparse(stream, events=('end',)):
                if elem.tag not in ('node', 'way', 'relation'):
                    continue
                item = {'tags': {t.attrib['k']: t.attrib['v'] for t in elem.findall('tag')}, 'version': elem.attrib.get('version'), 'sourceFiles': [path.name]}
                if elem.tag == 'node':
                    item['coordinate'] = [float(elem.attrib['lon']), float(elem.attrib['lat'])]
                    if not all(math.isfinite(v) for v in item['coordinate']) or abs(item['coordinate'][0]) > 180 or abs(item['coordinate'][1]) > 90:
                        raise ValueError('Invalid retained source coordinate')
                    table = nodes
                elif elem.tag == 'way':
                    item['refs'] = [n.attrib['ref'] for n in elem.findall('nd')]
                    table = ways
                else:
                    item['members'] = [dict(m.attrib) for m in elem.findall('member')]
                    table = relations
                oid = elem.attrib['id']
                if oid in table:
                    previous = table[oid]
                    # Duplicate extract observations must agree; do not pick a last writer.
                    if {k: v for k, v in previous.items() if k != 'sourceFiles'} != {k: v for k, v in item.items() if k != 'sourceFiles'}:
                        raise ValueError(f'Conflicting retained {elem.tag} {oid}; reconcile snapshots before building')
                    previous['sourceFiles'].append(path.name)
                else:
                    table[oid] = item
                elem.clear()
    return nodes, ways, relations, inventory


def components(nodes, edges):
    adjacency = {n['id']: set() for n in nodes}
    for edge in edges:
        adjacency[edge['from']].add(edge['to'])
        adjacency[edge['to']].add(edge['from'])
    unseen = set(adjacency)
    output = []
    while unseen:
        root = min(unseen)
        stack, group = [root], set()
        while stack:
            current = stack.pop()
            if current in group:
                continue
            group.add(current)
            stack.extend(adjacency[current] - group)
        unseen -= group
        output.append({'id': root, 'nodeCount': len(group), 'edgeCount': sum(e['from'] in group for e in edges)})
    return output


def build_graph(nodes, ways, corner_fallback=False, relations=None):
    relations = relations or {}
    rejected = []
    candidates = []
    barriers = []
    evidence = {}
    foot_restrictions = {m['ref'] for r in relations.values() if r['tags'].get('restriction:foot') for m in r['members'] if m['type'] == 'way'}
    for oid, way in sorted(ways.items(), key=lambda item: int(item[0])):
        tags, refs = way['tags'], way['refs']
        if tags.get('barrier') not in (None, 'no'):
            barriers.extend((nodes[a]['coordinate'], nodes[b]['coordinate'], f'osm:way:{oid}') for a, b in zip(refs, refs[1:]) if a in nodes and b in nodes)
        highway = tags.get('highway')
        if not highway or not any(r in nodes and inside(nodes[r]['coordinate']) for r in refs):
            continue
        evidence[f'osm:way:{oid}'] = way
        reason = None
        if highway not in PEDESTRIAN and not (corner_fallback and highway in STREETS):
            reason = 'not-pedestrian-way-or-fallback-disabled'
        elif restricted(tags) or tags.get('barrier') not in (None, 'no') or oid in foot_restrictions:
            reason = 'restricted-access-barrier-or-foot-turn-restriction'
        elif tags.get('area') == 'yes':
            reason = 'area-needs-surveyed-path-topology'
        elif any(r not in nodes for r in refs):
            reason = 'missing-source-node'
        elif grade(tags) is None:
            reason = 'unknown-or-ambiguous-grade'
        direction = tags.get('oneway:foot', tags.get('oneway', 'no') if highway in PEDESTRIAN else 'no')
        if direction not in ('yes', '1', 'true', '-1', 'reverse', 'no', '0', 'false'):
            reason = reason or 'unsupported-foot-direction'
        if reason:
            rejected.append({'sourceRef': f'osm:way:{oid}', 'reason': reason})
            continue
        classification = 'source-pedestrian-way' if highway in PEDESTRIAN else 'assumed-street-centerline'
        for index, (a, b) in enumerate(zip(refs, refs[1:])):
            coordinates = [nodes[a]['coordinate'], nodes[b]['coordinate']]
            reason = None
            if not all(inside(c) for c in coordinates):
                reason = 'outside-pilot-no-invented-boundary-junction'
            elif distance(*coordinates) <= 0:
                reason = 'zero-length'
            elif any(blocked(nodes[r]['tags']) for r in (a, b)):
                reason = 'blocked-or-unknown-node-access-barrier'
            elif any(not node_grade_compatible(nodes[r]['tags'], tags) for r in (a, b)):
                reason = 'node-way-grade-conflict'
            if reason:
                rejected.append({'sourceRef': f'osm:way:{oid}', 'segment': index, 'reason': reason})
            else:
                candidates.append({'way': oid, 'segment': index, 'refs': [a, b], 'coordinates': coordinates, 'grade': grade(tags), 'classification': classification, 'direction': 'forward' if direction in ('yes', '1', 'true') else 'reverse' if direction in ('-1', 'reverse') else 'both'})
    surviving = []
    for segment in candidates:
        hit = next((ref for a, b, ref in barriers if intersects(*segment['coordinates'], a, b)), None)
        if hit:
            rejected.append({'sourceRef': f'osm:way:{segment["way"]}', 'segment': segment['segment'], 'reason': 'source-barrier-intersection', 'barrierSourceRef': hit})
        else:
            surviving.append(segment)
    candidates = surviving
    arms = defaultdict(dict)
    for segment in candidates:
        if segment['classification'] != 'assumed-street-centerline':
            continue
        a, b = segment['refs']
        arms[a, segment['grade']][b] = nodes[b]['coordinate']
        arms[b, segment['grade']][a] = nodes[a]['coordinate']
    corners = set()
    assumptions = []
    for (ref, elevation), neighbours in sorted(arms.items()):
        if len(neighbours) < 3:
            continue
        center = nodes[ref]['coordinate']
        vectors = [((c[0] - center[0]) * math.cos(math.radians(center[1])), c[1] - center[1]) for c in neighbours.values()]
        # horizontal/vertical means local orthogonal street axes, not a latitude grid.
        if not any(abs(a[0] * b[0] + a[1] * b[1]) <= 0.342 * math.hypot(*a) * math.hypot(*b) for i, a in enumerate(vectors) for b in vectors[i + 1:]):
            continue
        corners.add((ref, elevation))
        assumptions.append({'sourceNodeRef': f'osm:node:{ref}', 'grade': elevation, 'adjacentSourceNodeRefs': [f'osm:node:{r}' for r in sorted(neighbours, key=int)], 'basis': 'shared-source-junction-with-orthogonal-street-arms; assumed-corner-crossing; no-surveyed-sidewalk-position'})
    graph_nodes = {}
    edges = []
    for segment in candidates:
        oid, elevation = segment['way'], segment['grade']
        tags = ways[oid]['tags']
        ids = []
        for ref in segment['refs']:
            # Roads share topology only at qualifying corners. Pedestrian paths
            # retain real shared OSM nodes at the same source grade.
            suffix = '' if segment['classification'] == 'source-pedestrian-way' or (ref, elevation) in corners else f':scaffold-way:{oid}'
            identity = f'osm:node:{ref}:{elevation}{suffix}'
            ids.append(identity)
            graph_nodes[identity] = {'id': identity, 'coordinate': nodes[ref]['coordinate'], 'grade': elevation, 'barrier': 'unknown', 'review': REVIEW, 'sourceRef': f'osm:node:{ref}'}
        edges.append({'id': f'osm:way:{oid}:segment:{segment["segment"]}', 'from': ids[0], 'to': ids[1], 'coordinates': segment['coordinates'], 'direction': segment['direction'], 'access': 'allowed' if tags.get('access') in PERMITTED - {None} else 'unknown', 'foot': 'allowed' if tags.get('foot') in PERMITTED - {None} or segment['classification'] == 'source-pedestrian-way' else 'unknown', 'review': REVIEW, 'gradeTransition': 'none', 'label': tags.get('name', tags['highway']), 'sourceRef': f'osm:way:{oid}', 'sourceNodeRefs': [f'osm:node:{r}' for r in segment['refs']], 'classification': segment['classification']})
    ordered_nodes = sorted(graph_nodes.values(), key=lambda n: n['id'])
    observed_entrances = [f'osm:node:{r}' for r, n in sorted(nodes.items(), key=lambda item: int(item[0])) if inside(n['coordinate']) and n['tags'].get('entrance') not in (None, 'no')]
    observed_crossings = [f'osm:node:{r}' for r, n in sorted(nodes.items(), key=lambda item: int(item[0])) if inside(n['coordinate']) and n['tags'].get('highway') == 'crossing']
    return {'schemaVersion': 1, 'version': '0.0.0-candidate-corners' if corner_fallback else '0.0.0-candidate-pedestrian', 'status': 'candidate', 'scopeId': SCOPE_ID, 'review': REVIEW, 'boundary': BOUNDARY, 'nodes': ordered_nodes, 'edges': edges, 'connectors': [], 'sourceEvidence': {'ways': evidence, 'taggedNodes': {f'osm:node:{r}': n for r, n in sorted(nodes.items(), key=lambda item: int(item[0])) if inside(n['coordinate']) and n['tags']}, 'barrierWays': {f'osm:way:{oid}': row for oid, row in sorted(ways.items(), key=lambda item: int(item[0])) if row['tags'].get('barrier') not in (None, 'no') and any(r in nodes and inside(nodes[r]['coordinate']) for r in row['refs'])}}, 'diagnostics': {'cornerFallbackEnabled': corner_fallback, 'cornerAssumptions': assumptions, 'components': components(ordered_nodes, edges), 'componentMeaning': 'weak source-topology components; not a directed reachability or safe-access claim', 'edgeClassifications': dict(sorted(Counter(e['classification'] for e in edges).items())), 'rejectedCounts': dict(sorted(Counter(r['reason'] for r in rejected).items())), 'rejected': rejected, 'observedEntranceNodes': len(observed_entrances), 'observedEntranceRefs': observed_entrances, 'observedCrossingNodes': len(observed_crossings), 'observedCrossingRefs': observed_crossings, 'verifiedEntrances': 0, 'approvedEdges': 0, 'releaseBlockers': ['No independent field review, reviewer, evidence IDs or validity period.', 'No verified public destination entrances or surveyed entrance connectors.', 'Source grade defaults, crossing safety, barriers, opening/access conditions and current construction remain unverified.', 'Street centerlines are candidate scaffolds, not measured sidewalks; no diagonal or offset corner geometry is fabricated.', 'Boundary-crossing source segments are omitted, and disconnected components are retained.']}}


def build_artifacts(corner_fallback=False):
    nodes, ways, relations, inventory = load_sources()
    snapshot = {'id': 'omni-bgc:osm-retained:2026-10-20-21', 'source': 'OpenStreetMap API 0.6 retained XML extracts', 'license': 'ODbL-1.0', 'attribution': '© OpenStreetMap contributors', 'sourceFiles': sorted(inventory['sourceFiles'], key=lambda row: row['path'])}
    snapshot_sha = sha(canonical(snapshot))
    graph = build_graph(nodes, ways, corner_fallback, relations)
    graph.update(sourceSha256=snapshot_sha, sourceSnapshotId=snapshot['id'], sourceSnapshot=snapshot)
    content = gzip.compress(canonical(graph) + b'\n', mtime=0)
    prefix = 'corner-fallback' if corner_fallback else 'pedestrian'
    path = DEST / f'{prefix}.graph.json.gz'
    receipt = {'formatVersion': 1, 'status': 'candidate', 'navigationEligible': False, 'scopeId': SCOPE_ID, 'boundary': BOUNDARY, 'boundarySha256': sha(canonical(BOUNDARY)), 'sourceSnapshotId': snapshot['id'], 'sourceSnapshotSha256': snapshot_sha, 'sourceInventorySha256': sha(INVENTORY.read_bytes()), 'builderSha256': sha(Path(__file__).read_bytes()), 'cornerFallbackEnabled': corner_fallback, 'nodes': len(graph['nodes']), 'edges': len(graph['edges']), 'components': len(graph['diagnostics']['components']), 'observedEntranceNodes': graph['diagnostics']['observedEntranceNodes'], 'verifiedEntrances': 0, 'observedCrossingNodes': graph['diagnostics']['observedCrossingNodes'], 'cornerAssumptions': len(graph['diagnostics']['cornerAssumptions']), 'edgeClassifications': graph['diagnostics']['edgeClassifications'], 'rejectedCounts': graph['diagnostics']['rejectedCounts'], 'output': {'path': path.relative_to(ROOT).as_posix(), 'encoding': 'gzip-json', 'bytes': len(content), 'sha256': sha(content), 'uncompressedSha256': sha(gzip.decompress(content))}, 'releaseBlockers': graph['diagnostics']['releaseBlockers']}
    return {path: content, DEST / f'{prefix}.receipt.json': json.dumps(receipt, indent=2, ensure_ascii=False).encode('utf-8') + b'\n'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--corner-fallback', action='store_true', help='include unreviewed centerline scaffolds and same-grade source-junction corner assumptions')
    args = parser.parse_args()
    artifacts = build_artifacts(args.corner_fallback)
    DEST.mkdir(parents=True, exist_ok=True)
    for output, content in artifacts.items():
        output.write_bytes(content)
        print(f'{output.relative_to(ROOT).as_posix()}: {len(content)} bytes sha256={sha(content)}')
