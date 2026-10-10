// Isolated native regression, compiled only for explicitly flagged local QA runs.
// Never inserts facts into a content pack or stores precise location.
import * as SQLite from 'expo-sqlite';
import { OPEN_OPTIONS, rows, run, serialOwner } from '../data/ownership';
import { openStore, loadSaved, loadPlaces, searchPlaces, disposeStore } from '../data';
import { getPackStatus } from '../updates';

export async function runNativeProof(): Promise<void> {
  const queue=serialOwner();
  for(let cycle=0;cycle<2;cycle++) {
    const db=await SQLite.openDatabaseAsync('omni-native-qa-only.sqlite',OPEN_OPTIONS);
    try {
      if(cycle===0) {
        await db.execAsync('CREATE VIRTUAL TABLE IF NOT EXISTS qa_fts USING fts5(label); DELETE FROM qa_fts;');
        await run(db,'INSERT INTO qa_fts(label) VALUES(?)',['SYNTHETIC NATIVE QA fixture']);
      }
      const checks=await Promise.all(Array.from({length:6},()=>queue(async()=>{
        const hits=await rows<{label:string}>(db,'SELECT label FROM qa_fts WHERE qa_fts MATCH ?',['fixture']);
        const absent=await rows(db,'SELECT label FROM qa_fts WHERE qa_fts MATCH ?',['absenttoken']);
        if(hits.length!==1 || absent.length!==0)throw new Error('Native FTS assertion failed');
        return true;
      })));
      if(checks.length!==6 || (await rows<{integrity_check:string}>(db,'PRAGMA integrity_check'))[0]?.integrity_check!=='ok')throw new Error('Native integrity failed');
      let expected=false;
      try { await rows(db,'SELECT * FROM intentionally_missing_qa_table'); } catch { expected=true; }
      if(!expected || (await rows<{label:string}>(db,'SELECT label FROM qa_fts'))[0]?.label!=='SYNTHETIC NATIVE QA fixture')throw new Error('Native exception cleanup failed');
    } finally { await queue(()=>db.closeAsync()); }
    console.log(`OMNI_NATIVE_QA FTS lifecycle ${cycle+1} closed`);
  }
  await openStore();const before=JSON.stringify(await loadSaved());
  await Promise.all([loadPlaces(),searchPlaces('absenttoken'),getPackStatus()]);
  await disposeStore();await openStore();
  if(JSON.stringify(await loadSaved())!==before)throw new Error('Local state changed across native close/reopen');
  await disposeStore();
  console.log('OMNI_NATIVE_QA PASS FTS concurrency/exception/integrity/two-closes/reopen and unchanged local state');
}
