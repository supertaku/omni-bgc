# Native SQLite ownership contract — proposed M1

One owner opens each connection, enables foreign keys before migrations and serializes writes and close. No prepared statement escapes its connection lifetime. Every explicit prepare must use try/finally and await finalizeAsync(), including exceptions/cancellation, and every async result/cursor must be consumed or reset before finalization. The owner tracks live operations/statements, prevents new work once closing, drains outstanding work, finalizes all app-owned statements exactly once and then awaits closeAsync(). Failed cleanup is surfaced; no success marker precedes completed closure. Avoid finalizing SQLite-owned FTS internals or sharing untracked handles. Update installation uses a separate candidate database and only swaps after integrity/version/rights checks and completed resource closure; keep the prior valid pack for rollback.

M0 Expo SQLite57.0.4 exposes a typed @hidden open option `finalizeUnusedStatementsBeforeClosing:false`, used only to bypass the wrapper sweep that finalized SQLite-owned FTS statements. It does not waive explicit app-owned statement finalization or awaited connection close. The existing spike passed two completed physical Android closes/reopen on one device; this workaround is not a production or iOS approval. Database/mobile owners must re-audit native ownership and the option on every upgrade and before M7 production search. Validate positive/negative FTS, exceptional prepare/execute paths, drained operations, integrity, persisted reopen and both closes, then monitor the process for delayed crashes. Native tests and signed offline release readiness remain deferred. Python sqlite3 migration tests prove only desktop SQL behavior.

Prepared-statement pseudocode:
```ts
const statement = await db.prepareAsync(sql);
try { return await consume(await statement.executeAsync(params)); }
finally { await statement.finalizeAsync(); }
// owner drains every tracked operation, then await db.closeAsync()
```
