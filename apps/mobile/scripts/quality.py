"""Reproduce portable repository quality checks without writing historical evidence."""

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]


def commands():
    yield "prerequisites", [sys.executable, "-c", "import ruff, shapely, pyproj, pglast, yaml"]
    yield "project-skills", [sys.executable, "scripts/check-project-skills.py"]
    yield "ai-native-source", [sys.executable, "scripts/check-offline-ai-source.py"]
    yield "typecheck", ["node", "apps/mobile/node_modules/typescript/bin/tsc", "--noEmit", "-p", "apps/mobile"]
    yield "lint", ["node", "node_modules/eslint/bin/eslint.js", "App.tsx", "index.ts", "src", "modules/omni-local-ai/index.ts"]
    yield "format", ["node", "apps/mobile/scripts/format-authored.cjs"]
    yield "dependencies", ["node", "apps/mobile/scripts/dependency-audit.cjs", "--check"]
    yield "python-lint", [sys.executable, "-m", "ruff", "check", "."]
    yield "offices-lint", [sys.executable, "-m", "ruff", "check", "--isolated", "--select", "F401,F821,F822,F823", "pipelines/etl/offices", "pipelines/etl/review-dashboard/dashboard.py", "pipelines/etl/review-dashboard/offices_view.py", "tests/data-quality/offices"]
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
        ("offices-python", "tests/data-quality/offices"),
        ("gex-python", "tests/data-quality/gex"),
        ("ui-python", "tests/data-quality/ui"),
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
        "offices-js": sorted(str(p.relative_to(ROOT)) for p in (ROOT / "tests/data-quality/offices").glob("*.test.cjs")),
    }
    for name, files in groups.items():
        yield name, ["node", "--test", "--test-reporter=tap", *files]
    for name in ["contracts", "resume"]:
        yield "pack-" + name, ["node", f"tests/data-quality/mobile/{name}.mjs"]
    yield "shared-typecheck", ["node", "apps/mobile/node_modules/typescript/bin/tsc", "--strict", "--noEmit", "--skipLibCheck", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler", "packages/domain/index.ts", "packages/geo/index.ts", "packages/routing/index.ts", "packages/routing/progress.ts"]
    yield "ai-coverage", ["node", "tests/ai/evaluate.cjs"]


def execute(name, command, output, timeout, root=ROOT):
    """Never let an empty discovery, unexpected skip or missing executable pass."""
    started = time.monotonic()
    directory = root / "apps/mobile" if name == "lint" else root
    log = output / f"{name}.log"
    record = {"name": name, "lane": "portable", "command": command,
              "cwd": str(directory.relative_to(root)) or ".", "exitCode": None,
              "status": "FAIL", "evidence": str(log.resolve())}
    text = ""
    try:
        if "--test" in command:
            files = [arg for arg in command[command.index("--test") + 1:] if not arg.startswith("--")]
            if not files or any(not (root / file).is_file() for file in files):
                raise ValueError("Required Node suite is empty or missing")
        if "discover" in command:
            pattern = command[command.index("-p") + 1] if "-p" in command else "test*.py"
            folder = root / command[command.index("-s") + 1]
            if not any(folder.rglob(pattern)):
                raise ValueError("Required Python suite is empty or missing")
        result = subprocess.run(command, cwd=directory, capture_output=True, text=True,
                                encoding="utf-8", errors="replace", check=False, timeout=timeout)
        text = result.stdout + result.stderr
        record["exitCode"] = result.returncode
        if result.returncode:
            raise ValueError("Command returned nonzero")
        if "--test" in command:
            counts = {key: int(value) for key, value in re.findall(r"^# (tests|pass|skipped) (\d+)\s*$", text, re.M)}
            if not counts.get("tests"):
                raise ValueError("Node ran zero tests or produced no test summary")
            record["tests"] = counts["tests"]
            record["skipped"] = counts.get("skipped", 0)
            if record["skipped"]:
                if name != "historical-routing" or record["skipped"] != 1 or "local historical data/generated/m3/run-a/candidate-graph.json unavailable" not in text:
                    raise ValueError("Unexpected skipped tests")
                record["status"] = "SKIP"
                record["reason"] = "Optional private historical graph unavailable"
            elif not counts.get("pass"):
                raise ValueError("No Node test passed")
        elif "discover" in command:
            count = re.search(r"Ran (\d+) tests? in", text)
            if not count or not int(count[1]):
                raise ValueError("Python ran zero tests or produced no test summary")
            record["tests"] = int(count[1])
            skipped = re.search(r"\bskipped=(\d+)", text)
            if skipped:
                record["skipped"] = int(skipped[1])
                expected = "test_exact_retained_historical_intake (test_gate.GateTests.test_exact_retained_historical_intake) ... skipped 'Opt-in exact historical raw integration; not portable CI'"
                if name != "gis" or record["skipped"] != 1 or expected not in text:
                    raise ValueError("Unexpected skipped tests; install required dependencies")
                record["optionalSkipped"] = ["Exact historical raw integration is an explicit opt-in; portable GIS tests ran"]
        if record["status"] != "SKIP":
            record["status"] = "PASS"
    except subprocess.TimeoutExpired as error:
        record["status"] = "TIMEOUT"
        record["reason"] = f"Exceeded {timeout} seconds"
        for stream in (error.stdout, error.stderr):
            text += stream.decode("utf-8", errors="replace") if isinstance(stream, bytes) else stream or ""
    except (OSError, ValueError) as error:
        record["reason"] = str(error)
    log.write_text(text + ("\nQUALITY: " + record["reason"] if "reason" in record else ""), encoding="utf-8")
    record["seconds"] = round(time.monotonic() - started, 3)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--list", action="store_true", help="List the same portable registry used by CI")
    parser.add_argument("--only", action="append", help="Run named groups; report remains explicitly partial")
    parser.add_argument("--timeout", type=int, default=300, help="Per-command deadline in seconds")
    args = parser.parse_args()
    registry = dict(commands())
    if args.list:
        print(json.dumps(registry, indent=2))
        return 0
    if not args.output or args.timeout < 1:
        parser.error("--output and a positive --timeout are required")
    if args.only and any(name not in registry for name in args.only):
        parser.error("Unknown --only group")
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    for name, command in registry.items():
        if args.only and name not in args.only:
            continue
        record = execute(name, command, args.output, args.timeout)
        results.append(record)
        print(f"{name}: {record['status']}", flush=True)
        (args.output / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    (args.output / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    failed = any(row["status"] not in {"PASS", "SKIP"} for row in results)
    (args.output / "summary.json").write_text(json.dumps({"scope": "selected" if args.only else "full-portable", "status": "FAIL" if failed else "PASS", "groups": len(results), "skipped": [{"name": r["name"], "count": r.get("skipped", 0), "reason": r.get("optionalSkipped", r.get("reason"))} for r in results if r.get("skipped")], "androidRelease": "NOT_RUN", "device": "NOT_RUN"}, indent=2) + "\n", encoding="utf-8")
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
