const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const python = `import sqlite3,json,sys
p=sys.argv[1]
db=sqlite3.connect(p,isolation_level=None)
db.row_factory=sqlite3.Row
for line in sys.stdin:
 try:
  r=json.loads(line)
  if r['kind']=='reopen':
   db.close();db=sqlite3.connect(p,isolation_level=None);db.row_factory=sqlite3.Row;result=[]
  elif r['kind']=='script':
   for statement in r['sql'].split(';'):
    if statement.strip():db.execute(statement)
   result=[]
  else:result=[dict(row) for row in db.execute(r['sql'],r.get('params') or [])]
  print(json.dumps({'rows':result}),flush=True)
 except Exception as e:print(json.dumps({'error':str(e)}),flush=True)
db.close()
`;
async function withSqlite(fn) {
  const base = path.resolve(__dirname, '../../.g/ai-layer/sqlite-tests');
  fs.mkdirSync(base, { recursive: true });
  const directory = fs.mkdtempSync(path.join(base, 'case-'));
  const child = spawn('python', ['-u', '-c', python, path.join(directory, 'test.sqlite')], { stdio: ['pipe', 'pipe', 'pipe'] });
  const waiting = [];
  createInterface({ input: child.stdout }).on('line', line => {
    const next = waiting.shift(), response = JSON.parse(line);
    response.error ? next.reject(Error(response.error)) : next.resolve(response.rows);
  });
  const sql = (kind, query, params) => new Promise((resolve, reject) => {
    waiting.push({ resolve, reject }); child.stdin.write(JSON.stringify({ kind, sql: query, params }) + '\n');
  });
  const db = {
    execAsync: query => sql('script', query),
    prepareAsync: async query => ({ executeAsync: async (params = []) => ({ getAllAsync: () => sql('query', query, params) }), finalizeAsync: async () => {} }),
    closeAsync: async () => {},
    withTransactionAsync: async work => {
      await sql('script', 'BEGIN IMMEDIATE');
      try { await work(); await sql('script', 'COMMIT'); }
      catch (error) { await sql('script', 'ROLLBACK'); throw error; }
    },
  };
  try { await fn(db, sql); }
  finally {
    child.stdin.end(); await new Promise(resolve => child.on('close', resolve));
    if (!path.resolve(directory).startsWith(base + path.sep)) throw Error('Unsafe cleanup target');
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
module.exports = { withSqlite };
