# R1 coding standards

Strict TypeScript remains enabled. Prefer named functions, discriminated payloads and small explicit contracts. Components use PascalCase; hooks use `use` + responsibility; domain functions use verbs; booleans describe conditions; immutable shared constants use existing project conventions. Type-only imports clarify boundaries. Comments explain temporal/source/ownership/lifecycle invariants rather than restating code.

ESLint 10.12.0, typescript-eslint 8.71.2 and React Hooks plugin 7.1.1 are exact development dependencies. Gates cover unused bindings, explicit any, duplicate imports, unreachable code, hook ordering, floating promises and misused promises. Exhaustive-dependency warnings remain advisory during behavior-preserving native work: changing camera triggers or cleanup reads requires separate behavioral evidence. Every new warning is reviewed and recorded; there are no blanket rule-disabling comments. Prefer `void` with a handled rejection for deliberate background work.

Prettier 3.9.10: single quotes, trailing commas, 100-column target, LF. `format-authored.cjs` explicitly enrolls R1-authored/reviewed source; it never formats generated assets, reviewed snapshots, SQL migrations, manifests or historical evidence. New reviewed modules should be enrolled deliberately. Existing unenrolled source keeps its existing style. Formatting is restricted to affected modules; no formatting-only commit is combined with a refactor (R1 currently has no commits). Git attributes remain intact.

Ruff 0.17.0 is pinned in `requirements-quality.txt`; `pyproject.toml` selects only the maintained map builder/intake/exporter/retrieval and new quality runner. Current gates catch unused imports and undefined bindings. Broad historical formatting/import reorder is deliberately deferred; selected modules already pass these checks. No shared source/license/date rule is consolidated merely because similar syntax appears elsewhere.

## Commands

- `npm run typecheck --prefix apps/mobile`
- `npm run lint --prefix apps/mobile`
- `npm run format:check --prefix apps/mobile` (`format` writes only the enrolled files)
- `npm run check:dependencies --prefix apps/mobile`
- `npm run test:unit --prefix apps/mobile`
- `python -m ruff check .`
- `python apps/mobile/scripts/quality.py --output .g/r1/quality` (install CI's pinned Python prerequisites first)

`quality.py` preserves each command's cwd, exit status, elapsed time and verbatim log in a caller-selected directory; it reports all groups even after failure and exits nonzero when any fail. Timings are host command wall times, not application performance. Existing CI suites remain alongside additive R1/AI gates.

Compatibility checked against installed peer metadata and primary documentation: [typescript-eslint version support](https://typescript-eslint.io/users/dependency-versions/), [ESLint flat configuration](https://eslint.org/docs/latest/use/configure/configuration-files), [Prettier exclusion rules](https://prettier.io/docs/ignore). Typescript-eslint's verified peer supports TS 6.0.3. npm initially warned ESLint 9 was unsupported; replaced the newly added tool with supported 10.12.0. Application/runtime dependency versions were independently compared with the baseline and are unchanged.
