"""Explicit M1 migration. Refuses repeat migration or overwrite of historical backup."""
import json
from pathlib import Path
from governance import migrate_v1

source = Path('docs/data-source-register/source-register.csv')
backup = Path('docs/data-source-register/source-register-v1.header.csv')
if backup.exists():
    raise SystemExit('Backup exists; refuse repeated migration')
original = source.read_bytes()
migrated, report = migrate_v1(original)
backup.write_bytes(original)
source.write_bytes(migrated)
Path('docs/evaluations/m1/governance/register-migration.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report))
