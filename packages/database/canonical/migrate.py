"""Opt-in local disposable PostgreSQL migration runner. No service installation.

SQL bytes are checksummed, all pending versions apply in one locked transaction,
and an edited/unknown installed migration fails closed. Passwords come from
libpq's password file or PGPASSWORD; never print environment or connection URI.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATTERN = re.compile(r"omni_bgc_disposable_[a-z0-9_]{1,40}\Z")
MARKER = "OMNI-BGC DISPOSABLE SYNTHETIC ONLY v1"

def validate_database(name: str) -> str:
    if not DB_PATTERN.fullmatch(name):
        raise ValueError("database must be omni_bgc_disposable_<lowercase label>")
    return name

def load_migrations() -> list[tuple[dict,str]]:
    expected = json.loads((ROOT / "migration-manifest.json").read_text(encoding="utf-8"))
    files = sorted((ROOT / "migrations").glob("*.sql"))
    loaded = [(p,p.read_bytes()) for p in files]
    actual = [{"version": int(p.name.split("_")[0]), "file": p.name,
               "sha256": hashlib.sha256(raw).hexdigest()} for p,raw in loaded]
    if actual != expected or [x["version"] for x in actual] != list(range(1, len(actual)+1)):
        raise ValueError("migration bytes/order differ from reviewed manifest; add a version, never edit applied SQL")
    return [(record,raw.decode('utf-8')) for record,(_,raw) in zip(actual,loaded)]

def migrations() -> list[dict]:
    return [record for record,_ in load_migrations()]

def sql_script() -> str:
    loaded = load_migrations()
    records = [record for record,_ in loaded]
    valid_versions = ",".join(str(x["version"]) for x in records)
    parts = ["BEGIN;", "SELECT pg_advisory_xact_lock(7044001);",
             "CREATE SCHEMA IF NOT EXISTS omni_meta;",
             "CREATE TABLE IF NOT EXISTS omni_meta.schema_migration(version integer PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT transaction_timestamp());",
             f"DO $$ BEGIN IF EXISTS(SELECT 1 FROM omni_meta.schema_migration WHERE version NOT IN ({valid_versions})) THEN RAISE EXCEPTION 'unknown schema version'; END IF; END $$;"]
    for m,body in loaded:
        v, digest = m["version"], m["sha256"]
        parts += [f"DO $$ BEGIN IF EXISTS(SELECT 1 FROM omni_meta.schema_migration WHERE version={v} AND sha256<>'{digest}') THEN RAISE EXCEPTION 'migration checksum changed'; END IF; END $$;",
                  f"DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM omni_meta.schema_migration WHERE version={v}) AND EXISTS(SELECT 1 FROM omni_meta.schema_migration WHERE version>{v}) THEN RAISE EXCEPTION 'migration history is not a prefix'; END IF; END $$;",
                  f"SELECT EXISTS(SELECT 1 FROM omni_meta.schema_migration WHERE version={v}) AS installed \\gset",
                  "\\if :installed", "\\else",
                  body,
                  f"INSERT INTO omni_meta.schema_migration(version,sha256) VALUES({v},'{digest}');",
                  "\\endif"]
    parts += ["COMMIT;"]
    return "\n".join(parts)

def psql(psql_path: str, database: str, port: int, username: str, script: str) -> str:
    executable = shutil.which(psql_path)
    if executable is None:
        raise RuntimeError("psql unavailable: PostgreSQL/PostGIS runtime NOT_RUN; portable tests do not replace it")
    # hostaddr overrides host in libpq, so explicitly neutralize inherited
    # remote service/host defaults. Keep credentials/passfile without logging.
    child_env = dict(os.environ)
    for key in ('PGSERVICE','PGSERVICEFILE','PGHOST','PGDATABASE','PGPORT','PGUSER','PGOPTIONS'):
        child_env.pop(key,None)
    child_env['PGHOSTADDR'] = '127.0.0.1'
    child_env['PGCLIENTENCODING'] = 'UTF8'
    result = subprocess.run([executable,"-X","-w","-h","127.0.0.1","-p",str(port),"-U",username,
                             "-d",database,"-v","ON_ERROR_STOP=1","-A","-t"],
                            input=script,text=True,encoding='utf-8',capture_output=True,timeout=60,env=child_env)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "psql failed")
    return result.stdout.strip()

def marker_sql(db: str) -> str:
    return f"SELECT coalesce(shobj_description(oid,'pg_database'),'') FROM pg_database WHERE datname='{db}';"

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command",choices=["plan","create-disposable","apply","test","reset-disposable"])
    parser.add_argument("--db",default="omni_bgc_disposable_m4")
    parser.add_argument("--psql",default="psql")
    parser.add_argument("--port",type=int,default=5432)
    parser.add_argument("--user",default="postgres")
    parser.add_argument("--confirm-reset")
    args = parser.parse_args()
    try:
        db = validate_database(args.db)
        if not 1<=args.port<=65535:
            raise ValueError("invalid port")
        if args.command=="plan":
            print(json.dumps({"target":"local-disposable-postgresql-postgis","migrations":migrations()},indent=2))
            return 0
        run = lambda target,sql: psql(args.psql,target,args.port,args.user,sql)
        if args.command=="create-disposable":
            # CREATE DATABASE refuses an existing name; never adopts old data.
            run("postgres",f'CREATE DATABASE "{db}";\nCOMMENT ON DATABASE "{db}" IS \'{MARKER}\';')
            print("created explicitly disposable database")
            return 0
        if run("postgres",marker_sql(db))!=MARKER:
            raise ValueError("refusing unmarked database; create-disposable must create a fresh target")
        if args.command=="reset-disposable":
            if args.confirm_reset!=db:
                raise ValueError("reset requires --confirm-reset with the exact marked disposable name")
            run("postgres",f'DROP DATABASE "{db}";')
            print("removed marked disposable database; create a fresh target to reset")
        elif args.command=="apply":
            print(run(db,sql_script()))
        else:
            # Test fixture rolls back itself and does not retain synthetic rows.
            print(run(db,(ROOT / "runtime-tests.sql").read_text(encoding="utf-8")))
        return 0
    except (ValueError,RuntimeError,subprocess.TimeoutExpired) as exc:
        print(str(exc))
        return 3

if __name__=="__main__":
    raise SystemExit(main())
