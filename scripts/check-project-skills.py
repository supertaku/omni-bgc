"""Verify pinned project skill bytes and portable Codex skill metadata; no network."""
import hashlib
import json
from pathlib import Path
import re
import yaml

ROOT = Path(__file__).resolve().parents[1]


def audit(root=ROOT):
    provenance = json.loads((root / "docs/quality/PONYTAIL_PROVENANCE.json").read_text())
    if not re.fullmatch(r"[a-f0-9]{40}", provenance["commit"]):
        raise ValueError("Expected pinned upstream commit")
    expected = {f".agents/skills/{name}/SKILL.md" for name in ("ponytail", "ponytail-audit", "ponytail-review")}
    expected.add(".agents/skills/PONYTAIL-LICENSE")
    if set(provenance["files"]) != expected:
        raise ValueError("Unexpected instruction-only skill inventory")
    for name, checksum in provenance["files"].items():
        file = root / name
        if file.is_symlink() or hashlib.sha256(file.read_bytes()).hexdigest() != checksum:
            raise ValueError("Project skill checksum mismatch: " + name)
        if not name.endswith("SKILL.md"):
            continue
        header = re.match(r"---\n(.*?)\n---", file.read_text(encoding="utf-8"), re.S)
        metadata = yaml.safe_load(header[1]) if header else None
        if not isinstance(metadata, dict) or metadata.get("name") != file.parent.name or not isinstance(metadata.get("description"), str) or not metadata["description"].strip():
            raise ValueError("Invalid skill metadata: " + name)
        if set(metadata) - {"name", "description", "license", "allowed-tools", "metadata"}:
            raise ValueError("Unsupported skill frontmatter: " + name)
    print(json.dumps({"status": "PROJECT_SKILLS_PASS", "commit": provenance["commit"], "skills": 3, "hooksInstalled": False}))


if __name__ == "__main__":
    audit()
