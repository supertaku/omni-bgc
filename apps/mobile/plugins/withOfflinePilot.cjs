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
  const catalogPath=path.join(cfg.modRequest.projectRoot,'src/map/bundled-map-catalog.json');
  if(fs.existsSync(catalogPath)) {
    const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
    if(catalog.formatVersion!==1 || catalog.use!=='INTERNAL_RESEARCH_PREVIEW_ONLY' || catalog.publicDistributionAuthorized!==false)throw new Error('Unreviewed map catalog policy');
    if(catalog.selected!=='pilot') {
      const choice=catalog.entries.find(e=>e.id===catalog.selected);
      if(!choice || choice.assetDirectory!=='gex' || choice.inventory!=='expanded-resources.json' || choice.style!=='expanded-style.json')throw new Error('Unknown expanded map catalog selection');
      const resources=JSON.parse(fs.readFileSync(path.join(cfg.modRequest.projectRoot,'src/map',choice.inventory),'utf8'));
      const approvalBytes=fs.readFileSync(path.join(cfg.modRequest.projectRoot,'../../docs/geography/internal-pack-approval.json'));
      const approval=JSON.parse(approvalBytes);
      const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
      if(hash(approvalBytes)!==resources.internalApprovalSha256 || approval.parent_decision!=='ACCEPT' || approval.use!=='INTERNAL_RESEARCH_PREVIEW_BUNDLE_ONLY' || approval.public_distribution_authorized!==false || approval.navigation_authorized!==false || approval.sourceManifestSha256!==resources.packSha256)throw new Error('Expanded internal bundle lacks exact parent review');
      const expanded=path.join(cfg.modRequest.projectRoot,'assets/generated/gex');
      const manifestBytes=fs.readFileSync(path.join(expanded,'manifest.json'));
      const manifest=JSON.parse(manifestBytes);
      if(hash(manifestBytes)!==resources.packSha256 || manifest.scopeManifestSha256!==resources.scopeManifestSha256 || manifest.active!==false || manifest.distribution_authorized!==false || manifest.navigation_eligible_edges!==0 || JSON.stringify(manifest.files)!==JSON.stringify(resources.files))throw new Error('Expanded manifest binding changed');
      const expandedStyle=fs.readFileSync(path.join(cfg.modRequest.projectRoot,'src/map',choice.style));
      if(hash(expandedStyle)!==resources.styleSha256 || !expandedStyle.equals(fs.readFileSync(path.join(expanded,'style.json'))))throw new Error('Expanded style changed without review');
      for(const entry of resources.files) {
        if(entry.path.startsWith('/') || entry.path.includes('\\') || entry.path.split('/').some(p=>p==='..'||p==='.'||!p))throw new Error('Invalid expanded asset path');
        const resourcePath=path.join(expanded,entry.path);
        if(!fs.realpathSync(resourcePath).startsWith(fs.realpathSync(expanded)+path.sep))throw new Error('Expanded resource escapes bundle');
        const data=fs.readFileSync(resourcePath);
        if(data.length!==entry.bytes || hash(data)!==entry.sha256)throw new Error('Expanded asset failed checksum: '+entry.path);
      }
      const destination=path.join(cfg.modRequest.platformProjectRoot,'app/src/main/assets/gex');
      fs.mkdirSync(destination,{recursive:true});
      for(const entry of resources.files) {const dest=path.join(destination,entry.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(expanded,entry.path),dest);}
      fs.copyFileSync(path.join(expanded,'manifest.json'),path.join(destination,'manifest.json'));
    }
  }
  return cfg;
}]);
