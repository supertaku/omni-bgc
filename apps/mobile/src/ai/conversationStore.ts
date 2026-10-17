import * as SQLite from 'expo-sqlite';
import type { ConversationMessage, AssistantPayload } from '../features/assistant/contracts';
import { OPEN_OPTIONS, rows, run, serialOwner } from '../data/ownership';
import { UUID } from '../data/parser';

const DATABASE = 'omni-ai-conversations.sqlite';
const MAX_MESSAGES = 200;
const MAX_BYTES = 262144;
const retainedKinds = new Set(['user', 'text', 'status', 'capability']);
/** Store finalized display text only. Executable proposals/confirmations never survive restart. */
export function historyProjection(messages: readonly ConversationMessage[]): ConversationMessage[] {
  return messages
    .filter((message) => !(message.payload.kind === 'text' && message.payload.partial))
    .map((message): ConversationMessage => {
      const p = message.payload;
      let payload: AssistantPayload;
      if (p.kind === 'itinerary-preview')
        payload = {
          kind: 'status',
          severity: 'info',
          text: 'A temporary itinerary preview was shown. Its stops were not retained. Ask again to create a new preview.',
        };
      else if (retainedKinds.has(p.kind))
        payload = {
          ...p,
          text: ('text' in p ? p.text : '').slice(0, 4000),
        } as AssistantPayload;
      else {
        const summary =
          p.kind === 'places'
            ? `${p.placeIds.length} recorded place results`
            : p.kind === 'place'
              ? 'One recorded place result'
              : p.kind === 'menus'
                ? `${p.items.length} recorded menu results`
                : p.kind === 'food-menus'
                  ? `${p.items.length} research menu listings, with price and branch caveats`
                  : p.kind === 'food-hours'
                    ? 'Recorded research hours, without a live opening claim'
                    : p.kind === 'evidence'
                      ? `${p.citations.length} source citations`
                      : 'An unavailable navigation or visit-list response';
        payload = {
          kind: 'status',
          severity: 'info',
          text: `Historical response: ${summary}. Ask again to check current sources; earlier results may include candidate or sample records.`,
        };
      }
      return {
        id: message.id.slice(0, 120),
        payload,
        canonicalPlaceIds: [
          ...new Set(
            p.kind === 'itinerary-preview'
              ? []
              : (message.canonicalPlaceIds?.filter((id) => UUID.test(id)) ?? []),
          ),
        ].slice(0, 20),
      };
    })
    .slice(-MAX_MESSAGES);
}
function validMessage(value: unknown): value is ConversationMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as ConversationMessage;
  if (
    typeof message.id !== 'string' ||
    message.id.length > 120 ||
    !message.payload ||
    !retainedKinds.has(message.payload.kind) ||
    !('text' in message.payload) ||
    typeof message.payload.text !== 'string' ||
    message.payload.text.length > 4000
  )
    return false;
  if (message.payload.kind === 'status' && !['info', 'error'].includes(message.payload.severity))
    return false;
  return true;
}

export class ConversationStore {
  private db: SQLite.SQLiteDatabase | null = null;
  private own = serialOwner();
  private async open() {
    if (this.db) return this.db;
    const db = await SQLite.openDatabaseAsync(DATABASE, OPEN_OPTIONS);
    try {
      await db.execAsync('PRAGMA foreign_keys=ON');
      const integrity = await rows<{ integrity_check: string }>(db, 'PRAGMA integrity_check');
      if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok')
        throw new Error('AI history integrity check failed; original file retained.');
      const version = (await rows<{ user_version: number }>(db, 'PRAGMA user_version'))[0]
        ?.user_version;
      if (version !== 0 && version !== 1 && version !== 2)
        throw new Error('Unsupported AI history version');
      await db.withTransactionAsync(async () => {
        await db.execAsync(
          'CREATE TABLE IF NOT EXISTS ai_message (sequence INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS ai_message_reference (message_id TEXT NOT NULL REFERENCES ai_message(message_id) ON DELETE CASCADE, ordinal INTEGER NOT NULL, place_id TEXT NOT NULL, PRIMARY KEY(message_id,ordinal)); PRAGMA user_version=2;',
        );
      });
      this.db = db;
      return db;
    } catch (error) {
      await db.closeAsync();
      throw error;
    }
  }
  load(): Promise<ConversationMessage[]> {
    return this.own(async () => {
      const db = await this.open();
      const stored = await rows<{ message_id: string; payload: string }>(
        db,
        'SELECT message_id,payload FROM (SELECT sequence,message_id,payload FROM ai_message ORDER BY sequence DESC LIMIT ?) ORDER BY sequence',
        [MAX_MESSAGES],
      );
      const references = await rows<{ message_id: string; place_id: string }>(
        db,
        'SELECT r.message_id,r.place_id FROM ai_message_reference r JOIN ai_message m ON m.message_id=r.message_id ORDER BY m.sequence,r.ordinal',
      );
      return stored.map((record) => {
        if (record.payload.length > 18000) throw new Error('Invalid AI history record');
        const message: unknown = { id: record.message_id, payload: JSON.parse(record.payload) };
        if (!validMessage(message)) throw new Error('Invalid AI history record');
        const ids = references.filter((r) => r.message_id === message.id).map((r) => r.place_id);
        if (ids.length > 20 || ids.some((id) => !UUID.test(id)))
          throw new Error('Invalid AI history reference');
        return { ...message, canonicalPlaceIds: ids };
      });
    });
  }
  append(messages: readonly ConversationMessage[]): Promise<void> {
    const selected = historyProjection(messages);
    return this.own(async () => {
      const db = await this.open();
      await db.withTransactionAsync(async () => {
        for (const message of selected) {
          await run(
            db,
            'INSERT OR IGNORE INTO ai_message(message_id,payload,created_at) VALUES(?,?,?)',
            [message.id, JSON.stringify(message.payload), new Date().toISOString()],
          );
          for (const [ordinal, id] of (message.canonicalPlaceIds ?? []).entries())
            await run(
              db,
              'INSERT OR IGNORE INTO ai_message_reference(message_id,ordinal,place_id) VALUES(?,?,?)',
              [message.id, ordinal, id],
            );
        }
        await run(
          db,
          'DELETE FROM ai_message WHERE sequence NOT IN (SELECT sequence FROM ai_message ORDER BY sequence DESC LIMIT ?)',
          [MAX_MESSAGES],
        );
        let total = (
          await rows<{ bytes: number }>(
            db,
            'SELECT COALESCE(SUM(length(CAST(payload AS BLOB))),0) AS bytes FROM ai_message',
          )
        )[0].bytes;
        while (total > MAX_BYTES) {
          await db.execAsync(
            'DELETE FROM ai_message WHERE sequence=(SELECT MIN(sequence) FROM ai_message)',
          );
          total = (
            await rows<{ bytes: number }>(
              db,
              'SELECT COALESCE(SUM(length(CAST(payload AS BLOB))),0) AS bytes FROM ai_message',
            )
          )[0].bytes;
        }
      });
    });
  }
  clear(): Promise<void> {
    return this.own(async () => {
      await (
        await this.open()
      ).withTransactionAsync(async () => {
        await this.db!.execAsync('DELETE FROM ai_message');
      });
    });
  }
  close(): Promise<void> {
    return this.own(async () => {
      if (this.db) {
        await this.db.closeAsync();
        this.db = null;
      }
    });
  }
}
