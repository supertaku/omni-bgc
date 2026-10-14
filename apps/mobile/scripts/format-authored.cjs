// Explicit R1 enrollment avoids formatting checksum-sensitive artifacts or
// unrelated historical source. Extend when another authored module is reviewed.
const { spawnSync } = require('node:child_process');
const files = [
  'App.tsx',
  'eslint.config.mjs',
  '.prettierrc.json',
  'package.json',
  'scripts/format-authored.cjs',
  'scripts/dependency-audit.cjs',
  'src/app/**/*.ts',
  'src/app/**/*.tsx',
  'src/features/explore/ExplorePanels.tsx',
  'src/features/assistant/AssistantScreen.tsx',
  'src/features/assistant/useDirectoryConversation.ts',
  'src/domain/**/*.ts',
  'src/data/queries.ts',
  'src/data/retrieval.ts',
  'src/data/store.ts',
  'src/features/assistant/directory.ts',
  'src/map/presentation.ts',
  'src/map/MapCanvas.tsx',
  'src/updates/style.ts',
  'src/updates/style-contract.ts',
];
const result = spawnSync(
  process.execPath,
  [
    require.resolve('prettier/bin/prettier.cjs'),
    process.argv.includes('--write') ? '--write' : '--check',
    ...files,
  ],
  { cwd: require('node:path').resolve(__dirname, '..'), stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
