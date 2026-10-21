import * as SQLite from 'expo-sqlite';
import type {
  ConversationMessage,
  AssistantPayload,
  PlaceDisplaySnapshot,
} from '../features/assistant/contracts';
import { OPEN_OPTIONS, rows, run, serialOwner } from '../data/ownership';
import { UUID } from '../data/parser';

const DATABASE = 'omni-ai-conversations.sqlite';
const MAX_MESSAGES = 200;
const MAX_BYTES = 262144;
const MAX_RECORD_BYTES = 131072;
const utf8Length = (value: string) => {
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
};
const string = (value: unknown, max = 2000): value is string =>
  typeof value === 'string' && value.length <= max;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const only = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const strings = (value: unknown, maxCount = 30, maxLength = 1000): value is string[] =>
  Array.isArray(value) &&
  value.length <= maxCount &&
  value.every((item) => string(item, maxLength));
const citation = (value: unknown): boolean =>
  record(value) &&
  only(value, [
    'sourceId',
    'label',
    'license',
    'observedAt',
    'verifiedAt',
    'status',
    'factId',
    'snapshotId',
    'rawSha256',
    'evidenceId',
    'locator',
    'verificationMethod',
  ]) &&
  string(value.sourceId, 200) &&
  string(value.label, 500) &&
  string(value.license, 300) &&
  string(value.observedAt, 100) &&
  (value.verifiedAt === null || string(value.verifiedAt, 100)) &&
  ['approved', 'candidate', 'stale'].includes(String(value.status)) &&
  ['factId', 'snapshotId', 'rawSha256', 'evidenceId', 'locator', 'verificationMethod'].every(
    (key) => value[key] === undefined || string(value[key], 2000),
  );
const menuItem = (value: unknown): boolean =>
  record(value) &&
  only(value, [
    'id',
    'name',
    'price',
    'priceValue',
    'checkedAt',
    'tags',
    'allergens',
    'citation',
    'priceCitation',
    'tagCitation',
    'relationshipCitations',
  ]) &&
  string(value.id, 200) &&
  string(value.name, 300) &&
  citation(value.citation) &&
  ['price', 'checkedAt'].every((key) => value[key] === undefined || string(value[key], 500)) &&
  (value.priceValue === undefined ||
    (record(value.priceValue) &&
      only(value.priceValue, ['amount', 'currency']) &&
      string(value.priceValue.amount, 100) &&
      string(value.priceValue.currency, 20))) &&
  ['tags', 'allergens'].every((key) => value[key] === undefined || strings(value[key], 30, 100)) &&
  ['priceCitation', 'tagCitation'].every(
    (key) => value[key] === undefined || citation(value[key]),
  ) &&
  (value.relationshipCitations === undefined ||
    (Array.isArray(value.relationshipCitations) &&
      value.relationshipCitations.length <= 20 &&
      value.relationshipCitations.every(citation)));
const hours = (value: unknown): boolean =>
  record(value) &&
  only(value, [
    'text',
    'kind',
    'evidence',
    'sourceUrl',
    'venueText',
    'venueSourceUrl',
    'weeklySchedule',
  ]) &&
  (value.text === null || string(value.text, 500)) &&
  ['restaurant', 'delivery', 'ordering', 'unknown'].includes(String(value.kind)) &&
  string(value.evidence, 500) &&
  (value.sourceUrl === null || string(value.sourceUrl, 2000)) &&
  (value.venueText === null || string(value.venueText, 500)) &&
  (value.venueSourceUrl === null || string(value.venueSourceUrl, 2000)) &&
  (value.weeklySchedule === null ||
    (Array.isArray(value.weeklySchedule) &&
      value.weeklySchedule.length <= 7 &&
      value.weeklySchedule.every(
        (entry) =>
          record(entry) &&
          only(entry, ['day', 'start', 'end']) &&
          Number.isInteger(entry.day) &&
          string(entry.start, 20) &&
          string(entry.end, 20),
      )));
const foodItem = (value: unknown): boolean =>
  record(value) &&
  only(value, [
    'id',
    'restaurantId',
    'origin',
    'name',
    'section',
    'category',
    'tags',
    'description',
    'amount',
    'currency',
    'priceEvidence',
    'priceSourceUrl',
    'estimationBasis',
    'menuSourceUrl',
    'branch',
    'researchStatus',
    'researchDate',
  ]) &&
  string(value.id, 200) &&
  string(value.restaurantId, 200) &&
  value.origin === 'research' &&
  string(value.name, 300) &&
  (value.section === null || string(value.section, 200)) &&
  (value.category === null || string(value.category, 200)) &&
  strings(value.tags, 30, 100) &&
  (value.description === null || string(value.description, 1000)) &&
  string(value.amount, 100) &&
  value.currency === 'PHP' &&
  ['estimated', 'published-menu', 'published-starting', 'published-research'].includes(
    String(value.priceEvidence),
  ) &&
  (value.priceSourceUrl === null || string(value.priceSourceUrl, 2000)) &&
  (value.estimationBasis === null || string(value.estimationBasis, 500)) &&
  (value.menuSourceUrl === null || string(value.menuSourceUrl, 2000)) &&
  (value.branch === null || string(value.branch, 300)) &&
  string(value.researchStatus, 500) &&
  string(value.researchDate, 100);
const foodEvidence = (value: unknown): boolean =>
  value === null ||
  (record(value) &&
    only(value, [
      'origin',
      'entityId',
      'researchDate',
      'urls',
      'status',
      'priceEvidence',
      'estimationBasis',
      'branch',
      'hours',
      'rightsReview',
    ]) &&
    value.origin === 'research' &&
    string(value.entityId, 200) &&
    (value.researchDate === null || string(value.researchDate, 100)) &&
    strings(value.urls, 20, 2000) &&
    string(value.status, 500) &&
    (value.priceEvidence === undefined ||
      ['estimated', 'published-menu', 'published-starting', 'published-research'].includes(
        String(value.priceEvidence),
      )) &&
    (value.estimationBasis === undefined ||
      value.estimationBasis === null ||
      string(value.estimationBasis, 500)) &&
    (value.branch === undefined || value.branch === null || string(value.branch, 300)) &&
    (value.hours === undefined || hours(value.hours)) &&
    value.rightsReview === 'pending');
const placeSnapshot = (value: unknown): value is PlaceDisplaySnapshot =>
  record(value) &&
  only(value, ['id', 'name', 'category', 'building', 'floor', 'status', 'fictionalSample']) &&
  string(value.id, 200) &&
  string(value.name, 300) &&
  string(value.category, 100) &&
  (value.building === undefined || string(value.building, 200)) &&
  (value.floor === undefined || string(value.floor, 100)) &&
  ['approved', 'candidate', 'stale'].includes(String(value.status)) &&
  typeof value.fictionalSample === 'boolean';
function validPayload(value: unknown): value is AssistantPayload {
  if (!record(value) || !string(value.kind, 30)) return false;
  const fields: Record<string, string[]> = {
    user: ['kind', 'text'],
    text: ['kind', 'text', 'partial'],
    status: ['kind', 'text', 'severity'],
    capability: ['kind', 'text', 'state'],
    places: ['kind', 'title', 'placeIds', 'total'],
    place: ['kind', 'placeId', 'distanceM'],
    menus: ['kind', 'title', 'items', 'total'],
    'food-menus': ['kind', 'title', 'items', 'total'],
    'food-hours': ['kind', 'placeId', 'restaurantName', 'hours', 'evidence'],
    route: ['kind', 'placeId', 'originLabel', 'result'],
    itinerary: ['kind', 'saved'],
    'itinerary-preview': ['kind', 'preview'],
    evidence: ['kind', 'title', 'citations'],
  };
  if (!fields[value.kind] || !only(value, fields[value.kind])) return false;
  switch (value.kind) {
    case 'user':
    case 'text':
    case 'status':
    case 'capability':
      return (
        string(value.text, value.kind === 'text' ? 16384 : value.kind === 'user' ? 1000 : 4000) &&
        (value.kind !== 'text' ||
          value.partial === undefined ||
          typeof value.partial === 'boolean') &&
        (value.kind !== 'status' || ['info', 'error'].includes(String(value.severity))) &&
        (value.kind !== 'capability' ||
          [
            'model-unavailable',
            'model-not-installed',
            'loading',
            'generating',
            'cancelled',
            'offline',
            'retrieval-unavailable',
            'unsupported-query',
            'citation-missing',
            'structured-result',
            'partial-message',
          ].includes(String(value.state)))
      );
    case 'places':
      return (
        string(value.title, 200) &&
        strings(value.placeIds, 20, 200) &&
        Number.isInteger(value.total) &&
        Number(value.total) >= 0
      );
    case 'place':
      return (
        string(value.placeId, 200) &&
        (value.distanceM === undefined ||
          (typeof value.distanceM === 'number' &&
            Number.isFinite(value.distanceM) &&
            value.distanceM >= 0))
      );
    case 'menus':
      return (
        string(value.title, 200) &&
        Array.isArray(value.items) &&
        value.items.length <= 20 &&
        value.items.every(
          (item) =>
            record(item) &&
            only(item, ['placeId', 'item']) &&
            string(item.placeId, 200) &&
            menuItem(item.item),
        ) &&
        Number.isInteger(value.total) &&
        Number(value.total) >= 0
      );
    case 'food-menus':
      return (
        string(value.title, 200) &&
        Array.isArray(value.items) &&
        value.items.length <= 20 &&
        value.items.every(
          (item) =>
            record(item) &&
            only(item, ['placeId', 'restaurantName', 'item', 'evidence']) &&
            string(item.placeId, 200) &&
            string(item.restaurantName, 300) &&
            foodItem(item.item) &&
            foodEvidence(item.evidence),
        ) &&
        Number.isInteger(value.total) &&
        Number(value.total) >= 0
      );
    case 'food-hours':
      return (
        string(value.placeId, 200) &&
        string(value.restaurantName, 300) &&
        hours(value.hours) &&
        foodEvidence(value.evidence)
      );
    case 'route':
      return (
        string(value.placeId, 200) &&
        string(value.originLabel, 300) &&
        record(value.result) &&
        (value.result.available === false
          ? only(value.result, ['available', 'reason']) && string(value.result.reason, 1000)
          : value.result.available === true &&
            only(value.result, [
              'available',
              'coordinates',
              'lengthM',
              'instructions',
              'graphVersion',
            ]) &&
            Array.isArray(value.result.coordinates) &&
            value.result.coordinates.length <= 500 &&
            value.result.coordinates.every(
              (point) =>
                Array.isArray(point) &&
                point.length === 2 &&
                point.every((n) => typeof n === 'number' && Number.isFinite(n)),
            ) &&
            typeof value.result.lengthM === 'number' &&
            Number.isFinite(value.result.lengthM) &&
            strings(value.result.instructions, 100, 1000) &&
            string(value.result.graphVersion, 100))
      );
    case 'itinerary':
      return (
        record(value.saved) &&
        only(value.saved, ['placeIds', 'itinerary', 'startTime']) &&
        strings(value.saved.placeIds, 20, 200) &&
        Array.isArray(value.saved.itinerary) &&
        value.saved.itinerary.length <= 20 &&
        value.saved.itinerary.every(
          (stop) =>
            record(stop) &&
            only(stop, ['placeId', 'durationMinutes']) &&
            string(stop.placeId, 200) &&
            Number.isInteger(stop.durationMinutes) &&
            Number(stop.durationMinutes) >= 0 &&
            Number(stop.durationMinutes) <= 1440,
        ) &&
        (value.saved.startTime === null || string(value.saved.startTime, 100))
      );
    case 'itinerary-preview':
      return (
        record(value.preview) &&
        only(value.preview, ['stops', 'totalVisitMinutes']) &&
        Array.isArray(value.preview.stops) &&
        value.preview.stops.length <= 20 &&
        value.preview.stops.every(
          (stop) =>
            record(stop) &&
            only(stop, ['placeId', 'name', 'durationMinutes']) &&
            string(stop.placeId, 200) &&
            string(stop.name, 300) &&
            Number.isInteger(stop.durationMinutes) &&
            Number(stop.durationMinutes) >= 0 &&
            Number(stop.durationMinutes) <= 1440,
        ) &&
        Number.isInteger(value.preview.totalVisitMinutes) &&
        Number(value.preview.totalVisitMinutes) >= 0
      );
    case 'evidence':
      return (
        string(value.title, 200) &&
        Array.isArray(value.citations) &&
        value.citations.length <= 200 &&
        value.citations.every(citation)
      );
    default:
      return false;
  }
}
/** Persist whitelisted, bounded display payloads only; place actions still resolve current source IDs. */
export function historyProjection(messages: readonly ConversationMessage[]): ConversationMessage[] {
  return messages
    .filter((message) => !(message.payload.kind === 'text' && message.payload.partial))
    .flatMap((message): ConversationMessage[] => {
      const payload =
        message.payload.kind === 'text'
          ? { ...message.payload, partial: undefined }
          : 'text' in message.payload
            ? message.payload
            : message.payload;
      if (!validPayload(payload))
        throw new Error('AI history response did not match its display schema');
      const projected: ConversationMessage = {
        id: message.id.slice(0, 120),
        payload,
        canonicalPlaceIds: [
          ...new Set(message.canonicalPlaceIds?.filter((id) => UUID.test(id)) ?? []),
        ].slice(0, 20),
        ...(message.displayPlaces?.every(placeSnapshot)
          ? { displayPlaces: message.displayPlaces.slice(0, 20) }
          : {}),
      };
      const serialized = JSON.stringify({
        version: 1,
        payload: projected.payload,
        displayPlaces: projected.displayPlaces ?? [],
      });
      if (utf8Length(serialized) > MAX_RECORD_BYTES)
        throw new Error('AI history response exceeds safe storage bounds');
      return [projected];
    })
    .slice(-MAX_MESSAGES);
}
function validMessage(value: unknown): value is ConversationMessage {
  if (
    !record(value) ||
    !only(value, ['id', 'payload', 'canonicalPlaceIds', 'displayPlaces']) ||
    !string(value.id, 120) ||
    !validPayload(value.payload)
  )
    return false;
  return (
    (value.canonicalPlaceIds === undefined ||
      (Array.isArray(value.canonicalPlaceIds) &&
        value.canonicalPlaceIds.length <= 20 &&
        value.canonicalPlaceIds.every((id) => typeof id === 'string' && UUID.test(id)))) &&
    (value.displayPlaces === undefined ||
      (Array.isArray(value.displayPlaces) &&
        value.displayPlaces.length <= 20 &&
        value.displayPlaces.every(placeSnapshot)))
  );
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
      if (
        integrity.length !== 1 ||
        integrity[0].integrity_check !== 'ok' ||
        (await rows(db, 'PRAGMA foreign_key_check')).length
      )
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
      return stored.map((row) => {
        if (utf8Length(row.payload) > MAX_RECORD_BYTES)
          throw new Error('Invalid AI history record');
        const parsed: unknown = JSON.parse(row.payload);
        const message: unknown =
          record(parsed) && parsed.version === 1
            ? {
                id: row.message_id,
                payload: parsed.payload,
                displayPlaces: parsed.displayPlaces,
              }
            : { id: row.message_id, payload: parsed };
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
            [
              message.id,
              JSON.stringify({
                version: 1,
                payload: message.payload,
                displayPlaces: message.displayPlaces ?? [],
              }),
              new Date().toISOString(),
            ],
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
