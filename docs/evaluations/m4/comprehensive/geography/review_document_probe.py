"""Independent executable regression for nested citation spans; TEST ONLY text."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('independent_docs', ROOT / 'packages/database/canonical/documents.py')
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
IDENT = '55555555-5555-4555-8555-555555555555'

class NestedDocumentProbe(unittest.TestCase):
    def test_parent_intro_child_and_outro_preserved_once(self):
        intro, child, outro = 'TEST ONLY parent introduction. ', 'TEST ONLY child section. '*10, ' TEST ONLY parent conclusion.'
        text = intro + child + outro
        sections = [module.Section('root', 'Root', 0, len(text)), module.Section('child', 'Child', len(intro), len(intro)+len(child), 'root')]
        result = module.passages(IDENT, text, sections, 80)
        self.assertEqual(''.join(p.body for p in result), text)
        self.assertEqual(result[0].start, 0); self.assertEqual(result[-1].end, len(text))
        self.assertTrue(all(a.end == b.start for a,b in zip(result,result[1:])))
        self.assertTrue(any(p.section_key == 'root' for p in result)); self.assertTrue(any(p.section_key == 'child' for p in result))
        self.assertEqual(result, module.passages(IDENT, text, list(reversed(sections)), 80))
        for p in result:
            self.assertEqual(p.body, text[p.start:p.end])
            self.assertEqual(p.content_sha256, hashlib.sha256(p.body.encode()).hexdigest())

    def test_unicode_offsets_are_codepoints(self):
        text = 'TEST ONLY 🇵🇭 café 東京 ' * 10
        result = module.passages(IDENT, text, [module.Section('root','Root',0,len(text))], 80)
        self.assertEqual(''.join(p.body for p in result), text)
        self.assertTrue(all(len(p.body) == p.end-p.start for p in result))

    def test_overlapping_siblings_denied(self):
        text = 'TEST ONLY ' * 20
        with self.assertRaises(ValueError):
            module.passages(IDENT, text, [module.Section('root','Root',0,len(text)), module.Section('a','A',0,100,'root'), module.Section('b','B',50,150,'root')])

    def test_changed_source_text_changes_citation(self):
        left, right = 'TEST ONLY A' * 15, 'TEST ONLY B' * 15
        sections = [module.Section('root','Root',0,len(left))]
        self.assertNotEqual(module.passages(IDENT,left,sections)[0].id, module.passages(IDENT,right,sections)[0].id)

if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(NestedDocumentProbe)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    (HERE / 'independent-document-probe.json').write_text(json.dumps({'tests_run':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'passed':result.wasSuccessful(),'canonical_SQL_runtime':'NOT_RUN','fixture':'SYNTHETIC_ONLY','documents_py_sha256':hashlib.sha256((ROOT/'packages/database/canonical/documents.py').read_bytes()).hexdigest()},indent=2)+'\n',encoding='utf-8')
    raise SystemExit(0 if result.wasSuccessful() else 1)
