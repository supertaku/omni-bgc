# Additive canonical PostgreSQL/PostGIS target

Status: **PROVISIONAL / POSTGRESQL RUNTIME NOT_RUN**. Four migration files and
rollback-only synthetic assertions are implemented. SQL/PLpgSQL parser checks and
portable runner/document tests passed; no migration has executed on a PostgreSQL
server here. Existing SQLite intake/export remains the operational bridge. This
directory does not replace accepted schemas, grant dataset rights, install a
server, load real records, or publish a pack.

Target runtime to validate: PostgreSQL 17 with PostGIS 3.5. A different supported
pair requires the same runtime tests and recorded versions. Obtain PostgreSQL and
PostGIS through their [official installation instructions](https://postgis.net/docs/manual-3.5/postgis_installation.html).
No paid hosting is required. SQL migrations create only the isolated `omni` and
`omni_meta` schemas plus the PostGIS extension in an explicitly disposable local
database. They do not install binaries or modify a running service.

From repository root, with a working local server and `psql` on PATH:

```powershell
python packages/database/canonical/migrate.py plan
python packages/database/canonical/migrate.py create-disposable --db omni_bgc_disposable_m4
python packages/database/canonical/migrate.py apply --db omni_bgc_disposable_m4
python packages/database/canonical/migrate.py test --db omni_bgc_disposable_m4
python packages/database/canonical/migrate.py apply --db omni_bgc_disposable_m4
```

The final apply must be a no-op with identical installed checksums. `--psql`,
`--port`, and `--user` permit explicit local settings; all connections target
127.0.0.1. Use libpq's password file; credentials are never embedded in commands or
reports. The runner requires `omni_bgc_disposable_*` names and a database comment
it sets when creating a fresh target. It refuses adopting existing databases,
editing applied migrations, unknown migration versions and non-prefix history.
Pending migration bytes are loaded once, hash checked and applied atomically
under an advisory transaction lock. The database marker is an accident guard,
not authentication or proof a privileged operator kept the database disposable.

Only for that marked synthetic target, an explicit reset is:

```powershell
python packages/database/canonical/migrate.py reset-disposable --db omni_bgc_disposable_m4 --confirm-reset omni_bgc_disposable_m4
```

This drops the named database; it never disconnects active clients forcibly.
There are no destructive down migrations or production reset commands. Never
point these commands at real or user data.

Portable checks need only Python. Optional PostgreSQL syntax checks use pglast:

```powershell
python -m pip install --target data/generated/m4/comprehensive/architecture/dependencies -r packages/database/canonical/requirements-syntax.txt
python -m unittest discover -s tests/data-quality/canonical -v
```

Without pglast, three syntax tests explicitly SKIP. Parsing checks grammar, not
function return types, PostGIS behavior, constraint execution or privileges;
runtime tests remain a separate gate. `runtime-tests.sql` wraps all synthetic
fixtures, helper functions and assertions in `BEGIN`/`ROLLBACK`. The migration
runner returns exit 3 with `runtime NOT_RUN` when psql is absent; no success is
inferred from a runnable script.

Backup a validated disposable target using `pg_dump -Fc` into ignored
`data/generated/`; checksum the archive. Create a different marked empty
disposable database and restore with `pg_restore --exit-on-error --no-owner
--no-privileges`; do not initialize its schemas before restore. Run checksum,
row-count, runtime assertion and manifest checks afterward. Record server,
PostGIS, pg_dump/restore versions and archive SHA256. Backup/restore has **NOT_RUN**
here; production recovery, roles, permissions and hosted operations require a
separate parent-reviewed operational plan. See
[architecture](../../../docs/architecture/M4_CANONICAL_DATABASE.md).
