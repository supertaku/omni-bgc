// Execute the existing reviewed asset plugin against an isolated host directory.
// This does not authorize publication or change any source approval.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');
const output = path.join(root, '.g/ai-layer/assets-check');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function main() {
  let verify;
  const context = { module: { exports: {} }, require(name) {
    if (name === 'expo/config-plugins') return { withDangerousMod(config, [, callback]) { verify = callback; return config; } };
    return require(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../plugins/withOfflinePilot.cjs'), 'utf8'), context);
  context.module.exports({});
  await verify({ modRequest: { projectRoot: path.join(root, 'apps/mobile'), platformProjectRoot: path.join(output, 'android') } });
  const files = [
    'apps/mobile/assets/generated/food-research/directory.json',
    'apps/mobile/assets/generated/food-research/manifest.json',
    'apps/mobile/assets/generated/offices/research.json',
    'apps/mobile/assets/generated/omni/manifest.json',
    'apps/mobile/assets/generated/gex/manifest.json',
    'docs/geography/internal-pack-approval.json',
  ];
  const receipt = { status: 'PASS_INTERNAL_HOST_ONLY', publicDistributionAuthorized: false,
    assetPlugin: 'withOfflinePilot.cjs (unchanged)', files: files.map(name => {
      const bytes = fs.readFileSync(path.join(root, name));
      return { path: name, bytes: bytes.length, sha256: hash(bytes) };
    }), device: 'NOT_RUN_BY_USER_REQUEST' };
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
