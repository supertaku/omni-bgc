import { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

export const OPEN_OPTIONS = { finalizeUnusedStatementsBeforeClosing: false, useNewConnection: true };
export async function rows<T>(db: SQLiteDatabase, sql: string, params: SQLiteBindValue[] = []): Promise<T[]> {
  const statement = await db.prepareAsync(sql);
  try { return await (await statement.executeAsync<T>(params)).getAllAsync(); }
  finally { await statement.finalizeAsync(); }
}
export async function run(db: SQLiteDatabase, sql: string, params: SQLiteBindValue[] = []): Promise<void> {
  const statement = await db.prepareAsync(sql);
  try { await (await statement.executeAsync(params)).getAllAsync(); }
  finally { await statement.finalizeAsync(); }
}
export function serialOwner() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(work);
    tail = result.catch(() => undefined); // caller still receives the failure; queue remains drainable.
    return result;
  };
}
