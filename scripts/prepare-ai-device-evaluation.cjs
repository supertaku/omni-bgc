// Authored CC0 input derivative. No expected answers are read into the APK asset.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const uuid = (kind, id) => {
  const raw = sha(`omni-device-fixture-v1/${kind}/${id}`);
  return `${raw.slice(0,8)}-${raw.slice(8,12)}-4${raw.slice(13,16)}-8${raw.slice(17,20)}-${raw.slice(20,32)}`;
};
const bytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
function prepare(sourceRoot, outputRoot, write = true) {
  const suiteBytes = fs.readFileSync(path.join(sourceRoot, 'tests/ai/questions.json'));
  const directoryBytes = fs.readFileSync(path.join(sourceRoot, 'tests/ai/synthetic-directory.json'));
  const suite = JSON.parse(suiteBytes.toString('utf8'));
  const original = JSON.parse(directoryBytes.toString('utf8'));
  if (suite.synthetic !== true || original.synthetic !== true || suite.questions.length !== 120)
    throw Error('Expected frozen synthetic120 inputs');
  const idMap = Object.fromEntries(original.places.flatMap(p => [[p.id, uuid('place', p.id)], ...p.menus.map(i => [i.id, uuid('item', i.id)])]));
  const rawDocuments = { ...original.rawDocuments };
  const derivedRelationships = [];
  function citation(c, salt = '') {
    if (!c || sha(original.rawDocuments[c.sourceId] ?? '') !== c.rawSha256)
      throw Error('Original source checksum mismatch');
    return { ...c,
      observedAt: /^\d{4}-\d{2}-\d{2}$/.test(c.observedAt) ? c.observedAt+'T00:00:00Z' : c.observedAt,
      verifiedAt: /^\d{4}-\d{2}-\d{2}$/.test(c.verifiedAt ?? '') ? c.verifiedAt+'T00:00:00Z' : c.verifiedAt,
      factId: uuid('fact', c.factId + salt), snapshotId: uuid('snapshot', c.snapshotId), evidenceId: uuid('evidence', c.evidenceId + salt),
    };
  }
  const places = original.places.map(p => ({ ...p, id: idMap[p.id], coordinate: null, entrances: [],
    citations: p.citations.map(c => citation(c, '/place/'+p.id)),
    menus: p.menus.map(i => {
      const item = { ...i, id: idMap[i.id], citation: citation(i.citation, '/item/'+i.id) };
      for (const key of ['priceCitation', 'tagCitation']) if (i[key]) item[key] = citation(i[key], '/'+key+'/'+i.id);
      item.relationshipCitations = ['menu-item', 'branch-menu'].map(kind => {
        const sourceId = 'EVAL-REL-'+kind+'-'+i.id;
        const document = JSON.stringify({ synthetic:true, kind, originalBranchId:p.id, originalItemId:i.id, assertion:'Original fixture nesting only; no real business claim' });
        rawDocuments[sourceId] = document;
        const link = { ...item.citation, sourceId, label:'Authored CC0 synthetic fixture relationship', rawSha256:sha(document),
          factId:uuid('relationship-fact',sourceId), evidenceId:uuid('relationship-evidence',sourceId), locator:'fixture://device-eval/'+sourceId,
          // Inherited evidence state; never promote a stale/candidate row.
          status: i.citation.status,
        };
        derivedRelationships.push({ sourceId, bytes:Buffer.byteLength(document), sha256:sha(document), originalBranchId:p.id, originalItemId:i.id });
        return link;
      });
      return item;
    }),
  }));
  const cases = suite.questions.map(({ id, topic, language, query, history, untrustedContext }) => {
    if (!/^[a-z_]+-\d{2}$/.test(id) || typeof query !== 'string' || !Array.isArray(history) || typeof untrustedContext !== 'string') throw Error('Invalid input case');
    return { id, topic, language, query, history:history.map(({role,text,entityIds,itemIds,budgetPHP}) => {
      if (!['user','assistant'].includes(role) || typeof text !== 'string' || text.length > 512) throw Error('Unsupported trusted history');
      const map = ids => ids.map(id => { if (!idMap[id]) throw Error('Unknown trusted history identity'); return idMap[id]; });
      return { role, text, ...(entityIds ? {entityIds:map(entityIds)} : {}), ...(itemIds ? {itemIds:map(itemIds)} : {}), ...(budgetPHP ? {budgetPHP} : {}) };
    }), untrustedContext };
  });
  if (new Set(cases.map(c=>c.id)).size !== 120) throw Error('Duplicate IDs');
  const input = { schemaVersion:1, synthetic:true, license:'CC0-1.0', fixtureRevision:'uuid-fixture-v1',
    originalSuiteSha256:sha(suiteBytes), originalDirectorySha256:sha(directoryBytes), idMap, rawDocuments, places, cases,
    notes:['All records and lineage are isolated authored synthetic inputs. No production source approval.', 'Original query/history/context UTF-8 strings retained. IDs mapped; day timestamps expanded to UTC midnight; two menu relationships explicitly authored from original fixture nesting.', 'No expected arrays, answer key, scores, saved preferences, production coordinates, research or office fixtures.'],
  };
  const assetBytes = bytes(input);
  const retrievalBytes = fs.readFileSync(path.join(sourceRoot,'apps/mobile/src/data/retrieval.ts'));
  const retrievalText = retrievalBytes.toString('utf8');
  const pureStart = retrievalText.indexOf('function identifier(');
  const pureEnd = retrievalText.indexOf('export async function findPlaces(');
  if (pureStart < 0 || pureEnd <= pureStart) throw Error('Pure menu boundary changed; review generator');
  const menuSource = '// Generated exact pure production menu filter body; no store/SQLite imports.\n'+
    "import type { Place } from '../../contracts';\nimport type { BranchMenuItem, MenuFilters } from '../../data/retrieval';\n"+
    "import { UUID } from '../../data/parser';\nimport { approvedEvidence, lexicalAlternatives, matchesLexicalText } from '../../data/lexical';\nimport { parsePhpCentavos } from '../../domain/money';\n"+
    "import { checkedPhpBounds } from '../../domain/priceBounds';\n"+
    retrievalText.slice(pureStart,pureEnd);
  const formatted = require('node:child_process').spawnSync(process.execPath,[path.join(sourceRoot,'apps/mobile/node_modules/prettier/bin/prettier.cjs'),'--config',path.join(sourceRoot,'apps/mobile/.prettierrc.json'),'--stdin-filepath','menuFilter.ts'],{input:menuSource,encoding:'utf8'});
  if(formatted.status!==0)throw Error('Pinned menu helper formatting failed');
  const menuBytes = Buffer.from(formatted.stdout,'utf8');
  const manifest = { schemaVersion:1, actualInference:false, qualityGate:'NOT_EVALUATED',
    scopeAddendumSha256:sha(fs.readFileSync(path.join(outputRoot,'docs/evaluations/offline-ai/D4_SCOPE_ADDENDUM_PROPOSAL.md'))),
    originalSuite:{path:'tests/ai/questions.json',bytes:suiteBytes.length,sha256:sha(suiteBytes)},
    originalDirectory:{path:'tests/ai/synthetic-directory.json',bytes:directoryBytes.length,sha256:sha(directoryBytes)},
    derivative:{path:'apps/mobile/src/qa/ai-evaluation/inputs.json',bytes:assetBytes.length,sha256:sha(assetBytes)},
    menuFilter:{path:'apps/mobile/src/qa/ai-evaluation/menuFilter.ts',bytes:menuBytes.length,sha256:sha(menuBytes),sourceSha256:sha(retrievalBytes)},
    caseCount:cases.length, historyCases:cases.filter(c=>c.history.length).map(c=>c.id), untrustedContextCases:cases.filter(c=>c.untrustedContext).map(c=>c.id),
    derivedRelationships,
  };
  if (write) {
    const asset = path.join(outputRoot,manifest.derivative.path);
    fs.mkdirSync(path.dirname(asset),{recursive:true}); fs.writeFileSync(asset,assetBytes);
    fs.writeFileSync(path.join(outputRoot,manifest.menuFilter.path),menuBytes);
    const integrated=path.resolve(sourceRoot)===path.resolve(outputRoot);
    fs.writeFileSync(path.join(outputRoot,integrated?'docs/evaluations/offline-ai/D4_INPUT_MANIFEST.json':'input-manifest.json'),bytes(manifest));
    fs.writeFileSync(path.join(path.dirname(asset),'assetReceipt.json'),bytes({derivative:manifest.derivative,scopeAddendumSha256:manifest.scopeAddendumSha256}));
    if(!integrated){const originals = path.join(outputRoot,'source-inputs'); fs.mkdirSync(originals,{recursive:true});
      fs.writeFileSync(path.join(originals,'questions.json'),suiteBytes); fs.writeFileSync(path.join(originals,'synthetic-directory.json'),directoryBytes);}
  }
  return { input, manifest, assetBytes };
}
module.exports={prepare,uuid,sha};
if(require.main===module){
 const source = process.argv[2], output = process.argv[3];
 if(!source || !output) throw Error('Usage: node prepare-ai-device-evaluation.cjs SOURCE_ROOT OUTPUT_ROOT');
 const {manifest}=prepare(path.resolve(source),path.resolve(output)); console.log(JSON.stringify(manifest,null,2));
}
