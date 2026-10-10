const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Reproducible CNG asset copy; generated native files are never hand-edited.
module.exports = config => withDangerousMod(config, ['android', async cfg => {
  const source = path.join(cfg.modRequest.projectRoot, 'assets/generated/omni');
  if (!fs.existsSync(path.join(source, 'manifest.json'))) {
    throw new Error('Build the reviewed internal offline pilot with pipelines/map-pack/build.py first.');
  }
  const bytes=fs.readFileSync(path.join(source,'manifest.json'));
  const reviewed=fs.readFileSync(path.join(cfg.modRequest.projectRoot,'../../data/manifests/offline-pilot-inventory.json'));
  if (!bytes.equals(reviewed)) throw new Error('Offline pilot inventory changed; parent review required.');
  const style=fs.readFileSync(path.join(cfg.modRequest.projectRoot,'src/map/pilot-style.json'));
  if (!style.equals(fs.readFileSync(path.join(source,'style.json')))) throw new Error('Authored map style does not match generated reviewed pack.');
  for (const entry of JSON.parse(bytes).files) {
    if (entry.path.startsWith('/') || entry.path.split('/').some(x=>x==='..'||!x)) throw new Error('Invalid asset path');
    const data=fs.readFileSync(path.join(source,entry.path));
    if(data.length!==entry.bytes || crypto.createHash('sha256').update(data).digest('hex')!==entry.sha256) throw new Error('Bundled map resource failed checksum: '+entry.path);
  }
  const target = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/assets/omni');
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  return cfg;
}]);
