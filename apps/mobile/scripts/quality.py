"""Reproduce portable repository quality checks without writing historical evidence."""

import argparse
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]


def commands():
    yield "ai-native-source", [sys.executable, "scripts/check-offline-ai-source.py"]
    yield "typecheck", ["node", "apps/mobile/node_modules/typescript/bin/tsc", "--noEmit", "-p", "apps/mobile"]
    yield "lint", ["node", "node_modules/eslint/bin/eslint.js", "App.tsx", "index.ts", "src"]
    yield "format", ["node", "apps/mobile/scripts/format-authored.cjs"]
    yield "dependencies", ["node", "apps/mobile/scripts/dependency-audit.cjs", "--check"]
    yield "python-lint", [sys.executable, "-m", "ruff", "check", "."]
    yield "refactoring-python", [sys.executable, "-m", "unittest", "discover", "-v", "-s", "tests/refactoring", "-p", "test_*.py"]
    yield "ai-host-build-python", [sys.executable, "-m", "unittest", "discover", "-v", "-s", "tests/ai", "-p", "test_*.py"]
    for name, directory in [
        ("governance", "pipelines/sources"),
        ("contracts", "tests/data-quality/m1"),
        ("gis", "tests/data-quality/m3"),
        ("topology", "tests/routing/m3"),
        ("intake", "tests/data-quality/m4"),
        ("research", "tests/data-quality/research"),
        ("research-gis", "tests/data-quality/research-gis"),
        ("retrieval-python", "tests/data-quality/retrieval"),
        ("canonical", "tests/data-quality/canonical"),
        ("projection", "tests/data-quality/mobile"),
    ]:
        command = [sys.executable, "-m", "unittest", "discover", "-v", "-s", directory]
        if name == "governance":
            command += ["-p", "test_governance.py"]
        yield name, command
    groups = {
        "map": ["tests/map/mobile/layer-compatibility.test.cjs"],
        "startup": ["tests/data-quality/mobile/startup.test.cjs", "tests/data-quality/mobile/demo-directory.test.cjs"],
        "ui": ["tests/ui/screen-navigation.test.cjs", "tests/ui/mobile-interactions.test.cjs", "tests/ui/app-refinement.test.cjs"],
        "directory": ["apps/mobile/src/features/assistant/ui-v2.test.cjs", "apps/mobile/src/features/assistant/directory.test.cjs", "apps/mobile/src/features/explore/directory.test.cjs"],
        "retrieval-js": ["tests/data-quality/mobile/retrieval.mjs"],
        "routing": ["tests/routing/mobile/engine.test.cjs", "tests/routing/mobile/loader.test.cjs"],
        "shared-ui": sorted(str(p.relative_to(ROOT)) for p in (ROOT / "packages/ui/test").glob("*.test.mjs")),
        "itinerary": ["docs/evaluations/mobile-ui/test-itinerary.cjs"],
        "historical-routing": ["tests/routing/mobile/integration/historical-candidate.test.cjs"],
        "ai-contracts": ["tests/ai/evaluate.test.cjs"],
        "ai-layer": sorted(str(p.relative_to(ROOT)) for p in (ROOT / "tests/ai").glob("*.test.cjs") if p.name != "evaluate.test.cjs"),
        "refactoring-js": sorted(str(p.relative_to(ROOT)) for p in (ROOT / "tests/refactoring").glob("*.test.cjs")),
    }
    for name, files in groups.items():
        yield name, ["node", "--test", *files]
    for name in ["contracts", "resume"]:
        yield "pack-" + name, ["node", f"tests/data-quality/mobile/{name}.mjs"]
    yield "shared-typecheck", ["node", "apps/mobile/node_modules/typescript/bin/tsc", "--strict", "--noEmit", "--skipLibCheck", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler", "packages/domain/index.ts", "packages/geo/index.ts", "packages/routing/index.ts", "packages/routing/progress.ts"]
    yield "ai-coverage", ["node", "tests/ai/evaluate.cjs"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    for name, command in commands():
        started = time.monotonic()
        directory = ROOT / "apps/mobile" if name == "lint" else ROOT
        result = subprocess.run(command, cwd=directory, capture_output=True, text=True, encoding="utf-8", errors="replace", check=False)
        (args.output / f"{name}.log").write_text(result.stdout + result.stderr, encoding="utf-8")
        results.append({"name": name, "command": command, "cwd": str(directory.relative_to(ROOT)) or ".", "exitCode": result.returncode, "seconds": round(time.monotonic() - started, 3)})
        print(f"{name}: {'PASS' if result.returncode == 0 else 'FAIL'}", flush=True)
    (args.output / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    return int(any(row["exitCode"] for row in results))


if __name__ == "__main__":
    sys.exit(main())
