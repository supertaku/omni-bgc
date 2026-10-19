import type { SQLiteDatabase } from 'expo-sqlite';
import type { PackManifest } from '../updates/contracts';
import { rows } from './ownership';

/** Used before pack activation and on every optional office database read. */
export async function validateOfficeProjection(db: SQLiteDatabase, manifest: PackManifest) {
  if (manifest.kind !== 'places' || manifest.schemaVersion !== 3)
    throw new Error('Office companion requires a version 3 places pack');
  const versions = await rows<{ version: number }>(
    db,
    'SELECT version FROM schema_migration ORDER BY version',
  );
  if (
    versions.map((version) => version.version).join(',') !== '1,3' ||
    (await rows<{ integrity_check: string }>(db, 'PRAGMA integrity_check'))[0]?.integrity_check !==
      'ok' ||
    (await rows(db, 'PRAGMA foreign_key_check')).length
  )
    throw new Error('Office projection integrity/schema rejected');
  const metadata = await rows<{ key: string; value: string }>(
    db,
    'SELECT key,value FROM pack_metadata',
  );
  if (
    metadata.find((row) => row.key === 'synthetic_test_only')?.value !== 'false' ||
    metadata.find((row) => row.key === 'build_contract')?.value !== 'm4-local-content-v1'
  )
    throw new Error('Unreviewed/synthetic office export rejected');
  const sources = await rows<{
    id: string;
    raw_sha256: string;
    license: string;
    attribution: string;
  }>(db, 'SELECT id,raw_sha256,license,attribution FROM source_snapshot');
  if (
    !sources.length ||
    sources.some(
      (source) =>
        !manifest.snapshots.some(
          (snapshot) =>
            snapshot.id === source.id &&
            snapshot.rawSha256 === source.raw_sha256 &&
            snapshot.license === source.license &&
            snapshot.attribution === source.attribution,
        ),
    )
  )
    throw new Error('Office snapshot is not bound to reviewed places manifest');
}
