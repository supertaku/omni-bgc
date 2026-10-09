"""Independent M0 bundle reachability evidence; not production security clearance."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[4]
maps = list((root / 'apps/mobile/artifacts/security-export').rglob('*.js.map'))
assert len(maps) == 1, 'Expected exactly one Android source map'
source_map = json.loads(maps[0].read_text(encoding='utf-8'))
sources = source_map['sources']
assert sources, 'Empty source map cannot establish reachability'
names = ['braces', 'node-forge', 'uuid', 'micromatch', 'xcode', '@expo/code-signing-certificates']
matches = {name: [s for s in sources if ('/node_modules/' + name + '/') in s.replace('\\', '/') or ('node_modules/' + name + '/') in s.replace('\\', '/')] for name in names}
audit = json.loads((Path(__file__).parent / 'npm-audit-online-retry.json').read_text(encoding='utf-8-sig'))
assert 'error' not in audit and 'metadata' in audit, 'Audit request failed'
result = {
    'scope': 'unchanged M0 Android JS export, minified production-mode JS, Hermes bytecode disabled for inspection',
    'source_count': len(sources),
    'advisory_package_source_matches': matches,
    'online_audit': audit['metadata']['vulnerabilities'],
    'bundle_map_sha256': hashlib.sha256(maps[0].read_bytes()).hexdigest(),
    'package_lock_sha256': hashlib.sha256((root / 'apps/mobile/package-lock.json').read_bytes()).hexdigest(),
    'production_security_accepted': False,
    'limits': ['Not a release APK', 'No reachability conclusion for future code or native libraries', 'Host build/development tooling remains vulnerable', 'Offline npm audit zero is not an authoritative vulnerability check'],
}
(Path(__file__).parent / 'bundle-review.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
