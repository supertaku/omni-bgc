# Mobile routing tests

Required portable suite (no historical/generated inputs):

```sh
node --test tests/routing/mobile/engine.test.cjs tests/routing/mobile/loader.test.cjs
```

`fixtures/candidate-export.json` is project-authored synthetic data in the rejected M3 candidate export shape, with no real OSM records or geographic claims. The engine suite also uses a valid synthetic GraphPack with only candidate status changed, proving review rejection independently of malformed export structure. Both cases must reject installation, clear a previously usable graph and prevent navigation. The installed-loader suite additionally rejects candidates within a synthetic reviewed receipt.

Optional historical integration:

```sh
node --test tests/routing/mobile/integration/historical-candidate.test.cjs
```

Uses local `data/generated/m3/run-a/candidate-graph.json` without modifying or redistributing it. If absent, emits an explicit `NOT RUN` skip reason. This preserves the original historical assertion separately from required portable tests. Do not copy unreviewed historical datasets into CI fixtures.
