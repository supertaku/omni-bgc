"""Skill provenance rejects changed bytes without modifying installed skills."""
from contextlib import redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("project_skills", ROOT / "scripts/check-project-skills.py")
skills = importlib.util.module_from_spec(spec)
spec.loader.exec_module(skills)


class ProjectSkillsTests(unittest.TestCase):
    def test_valid_pinned_copy_and_tampered_copy(self):
        base = ROOT / ".g/quality-r2/skill-tests"
        base.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=base) as folder:
            root = Path(folder)
            manifest = Path("docs/quality/PONYTAIL_PROVENANCE.json")
            provenance = json.loads((ROOT / manifest).read_text())
            for relative in [manifest, *provenance["files"]]:
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / relative, target)
            with redirect_stdout(io.StringIO()):
                skills.audit(root)
            skill = root / ".agents/skills/ponytail/SKILL.md"
            skill.write_bytes(skill.read_bytes() + b"\nUnreviewed change\n")
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                skills.audit(root)


if __name__ == "__main__":
    unittest.main()
