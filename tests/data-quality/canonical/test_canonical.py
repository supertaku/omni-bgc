"""Portable tooling contracts. SQL parser tests are NOT PostgreSQL runtime tests."""
from __future__ import annotations
import hashlib
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[3]
CANONICAL = ROOT / "packages/database/canonical"

def module(name, path):
    spec = importlib.util.spec_from_file_location(name,path)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result

runner = module("canonical_migrate",CANONICAL / "migrate.py")
documents = module("canonical_documents",CANONICAL / "documents.py")
DEPENDENCIES = ROOT / "data/generated/m4/comprehensive/architecture/dependencies"
if DEPENDENCIES.exists():
    sys.path.insert(0,str(DEPENDENCIES))
try:
    from pglast import parse_sql, parse_plpgsql
except ImportError:
    parse_sql = parse_plpgsql = None

class DisposableMigrationTests(unittest.TestCase):
    def test_refuse_non_disposable_or_sql_injection_names(self):
        for name in ['postgres','omni_bgc','production','omni_bgc_disposable_','omni_bgc_disposable_M4',"omni_bgc_disposable_x';DROP DATABASE postgres;--",'omni_bgc_disposable_x'*3]:
            with self.subTest(name=name),self.assertRaises(ValueError):
                runner.validate_database(name)
        self.assertEqual(runner.validate_database('omni_bgc_disposable_m4'),'omni_bgc_disposable_m4')

    def test_manifest_and_single_transaction(self):
        records = runner.migrations()
        self.assertEqual([r['version'] for r in records],[1,2,3,4])
        script = runner.sql_script()
        self.assertTrue(script.startswith('BEGIN;'))
        self.assertTrue(script.endswith('COMMIT;'))
        self.assertEqual(script.count('pg_advisory_xact_lock'),1)
        self.assertNotIn('DROP DATABASE',script)
        for r in records:
            self.assertIn(r['sha256'],script)

    def test_edited_bytes_rejected(self):
        temp_root = ROOT/'data/generated/m4/comprehensive/architecture/test-tmp'
        temp_root.mkdir(parents=True,exist_ok=True)
        self.assertTrue(temp_root.resolve().is_relative_to(ROOT.resolve()))
        with tempfile.TemporaryDirectory(dir=temp_root) as temp:
            target = pathlib.Path(temp)
            (target/'migrations').mkdir()
            for p in (CANONICAL/'migrations').glob('*.sql'):
                (target/'migrations'/p.name).write_bytes(p.read_bytes())
            (target/'migration-manifest.json').write_bytes((CANONICAL/'migration-manifest.json').read_bytes())
            with patch.object(runner,'ROOT',target):
                runner.migrations()
                p = target/'migrations/001_governance.sql'
                p.write_bytes(p.read_bytes()+b'\n-- changed SQL\n')
                with self.assertRaises(ValueError):
                    runner.sql_script()

    def test_embed_checked_loaded_bytes(self):
        loaded = runner.load_migrations()
        with patch.object(runner,'load_migrations',return_value=loaded):
            # No source reread between hashing and embedding SQL.
            with patch.object(pathlib.Path,'read_text',side_effect=AssertionError('unexpected reread')):
                script = runner.sql_script()
        self.assertIn(loaded[0][1],script)

    def test_missing_runtime_fails_explicitly(self):
        with patch.object(runner.shutil,'which',return_value=None),self.assertRaisesRegex(RuntimeError,'runtime NOT_RUN'):
            runner.psql('missing','omni_bgc_disposable_m4',5432,'postgres','SELECT 1;')

    def test_no_remote_connection_or_shell(self):
        completed = runner.subprocess.CompletedProcess([],0,'ok','')
        with patch.object(runner.shutil,'which',return_value='psql'),patch.object(runner.subprocess,'run',return_value=completed) as run:
            self.assertEqual(runner.psql('psql','omni_bgc_disposable_m4',5433,'postgres','SELECT 1;'),'ok')
        arguments,keywords = run.call_args
        self.assertIn('127.0.0.1',arguments[0])
        self.assertIn('-X',arguments[0])
        self.assertIn('ON_ERROR_STOP=1',arguments[0])
        self.assertNotIn('shell',keywords)

    def test_remote_libpq_defaults_cannot_override_loopback(self):
        completed = runner.subprocess.CompletedProcess([],0,'ok','')
        settings = {'PGHOSTADDR':'203.0.113.9','PGSERVICE':'remote','PGSERVICEFILE':'remote.conf','PGOPTIONS':'-c session_replication_role=replica','PGPASSWORD':'SYNTHETIC_TEST_SECRET'}
        with patch.dict(runner.os.environ,settings),patch.object(runner.shutil,'which',return_value='psql'),patch.object(runner.subprocess,'run',return_value=completed) as run:
            runner.psql('psql','omni_bgc_disposable_m4',5432,'postgres','SELECT 1;')
        environment = run.call_args.kwargs['env']
        self.assertEqual(environment['PGHOSTADDR'],'127.0.0.1')
        for key in ('PGSERVICE','PGSERVICEFILE','PGOPTIONS'):
            self.assertNotIn(key,environment)
        self.assertEqual(environment['PGPASSWORD'],'SYNTHETIC_TEST_SECRET')
        self.assertNotIn('SYNTHETIC_TEST_SECRET',str(run.call_args.args))

class DocumentSpanTests(unittest.TestCase):
    ID = '20000000-0000-4000-8000-000000000001'

    def test_nested_intro_and_outro_preserved_without_duplicates(self):
        text = 'Parent introduction.\n\nChild content.\n\nParent conclusion.'
        start,end = text.index('Child'),text.index('\n\nParent conclusion')
        sections = [documents.Section('root','Document',0,len(text)),documents.Section('child','Child',start,end,'root')]
        result = documents.passages(self.ID,text,sections)
        self.assertEqual(''.join(p.body for p in result),text)
        self.assertEqual([p.section_key for p in result],['root','child','root'])
        self.assertEqual([(p.start,p.end) for p in result],[(0,start),(start,end),(end,len(text))])

    def test_unicode_offsets_and_exact_sha256(self):
        text = 'BGC 🚶 café 日本語'
        result = documents.passages(self.ID,text,[documents.Section('s','Unicode',0,len(text))])
        self.assertEqual(result[0].body,text)
        self.assertEqual(result[0].end,len(text))
        self.assertEqual(result[0].content_sha256,hashlib.sha256(text.encode('utf-8')).hexdigest())
        self.assertEqual(len({p.citation_id for p in result}),len(result))

    def test_deterministic_identifiers_and_text_revision_changes(self):
        a = documents.passages(self.ID,'Synthetic passage',[documents.Section('s','Title',0,17)])
        b = documents.passages(self.ID,'Synthetic passage',[documents.Section('s','Title',0,17)])
        c = documents.passages(self.ID,'Different passage',[documents.Section('s','Title',0,17)])
        self.assertEqual(a,b)
        self.assertNotEqual(a[0].id,c[0].id)

    def test_oversized_section_split_retains_exact_text(self):
        text = ('Synthetic sentence.\n\n' * 30).strip()
        result = documents.passages(self.ID,text,[documents.Section('s','Title',0,len(text))],max_chars=100)
        self.assertEqual(''.join(p.body for p in result),text)
        self.assertTrue(all(len(p.body)<=100 for p in result))
        self.assertEqual(result[-1].end,len(text))

    def test_invalid_bounds_duplicate_cycle_overlap_denied(self):
        cases = [
            [documents.Section('s','Title',0,99)],
            [documents.Section('s','Title',0,10),documents.Section('s','Again',10,20)],
            [documents.Section('s','Title',0,10,'s')],
            [documents.Section('s','Title',0,10,'missing')],
            [documents.Section('a','A',0,10),documents.Section('b','B',5,15)],
            [documents.Section('a','A',0,10),documents.Section('b','B',0,15,'a')]
        ]
        for sections in cases:
            with self.subTest(sections=sections),self.assertRaises(ValueError):
                documents.passages(self.ID,'x'*20,sections)

@unittest.skipUnless(parse_sql,'pglast optional parser unavailable; PostgreSQL runtime also NOT_RUN')
class PostgreSQLSyntaxTests(unittest.TestCase):
    def test_migration_outer_sql_and_plpgsql_parse(self):
        for p in sorted((CANONICAL/'migrations').glob('*.sql')):
            with self.subTest(migration=p.name):
                self.assertGreater(len(parse_sql(p.read_text(encoding='utf-8'))),0)
                self.assertGreater(len(parse_plpgsql(p.read_text(encoding='utf-8'))),0)

    def test_sql_function_bodies_parse(self):
        count = 0
        for p in (CANONICAL/'migrations').glob('*.sql'):
            for statement in parse_sql(p.read_text(encoding='utf-8')):
                ast = statement.stmt
                if type(ast).__name__!='CreateFunctionStmt':
                    continue
                opts = {o.defname:o.arg for o in ast.options}
                if opts.get('language') and opts['language'].sval=='sql':
                    self.assertGreater(len(parse_sql(opts['as'][0].sval)),0)
                    count += 1
        self.assertEqual(count,6)

    def test_runtime_fixture_syntax_and_rollback(self):
        script = (CANONICAL/'runtime-tests.sql').read_text(encoding='utf-8')
        self.assertGreater(len(parse_sql(script)),50)
        self.assertGreater(len(parse_plpgsql(script)),0)
        self.assertTrue(script.rstrip().endswith('ROLLBACK;'))
        self.assertIn('SYNTHETIC ONLY',script)

if __name__=='__main__':
    unittest.main()
