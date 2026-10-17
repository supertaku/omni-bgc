import { UUID } from '../data/parser';
import { parsePhpCentavos } from '../domain/money';

export const TOOL_CONTRACT_REVISION = 'omni-local-tools-v2';
export const MAX_PROPOSAL_BYTES = 8192;
export const TOOL_NAMES = [
  'find_places',
  'get_place_details',
  'get_verified_entrances',
  'find_menu_items',
  'search_food_research',
  'get_food_research_details',
  'find_approved_offices',
  'get_office_details',
  'get_itinerary_preview',
  'focus_map_place',
  'preview_itinerary_change',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export type ToolArguments = {
  find_places: { query?: string; category?: string; limit?: number };
  get_place_details: { placeId: string };
  get_verified_entrances: { placeId: string };
  find_menu_items: {
    query?: string;
    maxPricePhp?: string;
    branchId?: string;
    limit?: number;
    requiredTags?: string[];
  };
  search_food_research: {
    query?: string;
    category?: string;
    restaurantId?: string;
    maxPhp?: string;
    limit?: number;
  };
  get_food_research_details: { restaurantId: string; offset?: number; limit?: number };
  find_approved_offices: { query?: string; district?: string; buildingId?: string; limit?: number };
  get_office_details: { placeId: string };
  get_itinerary_preview: Record<string, never>;
  focus_map_place: { placeId: string };
  preview_itinerary_change: {
    stops: { placeId: string; durationMinutes: number }[];
    operation?: 'replace' | 'append' | 'remove' | 'reorder';
  };
};
export type ToolProposal = {
  [N in ToolName]: { version: 1; callId: string; name: N; arguments: ToolArguments[N] };
}[ToolName];
export class ToolValidationError extends Error {
  readonly code = 'TOOL_PROTOCOL_INVALID';
}
const invalid = (message: string): never => {
  throw new ToolValidationError(message);
};

/** Reject malformed UTF-16 and count real UTF-8 bytes without depending on TextEncoder in Hermes. */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes++;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) invalid('Malformed Unicode');
      bytes += 4;
    } else if (c >= 0xdc00 && c <= 0xdfff) invalid('Malformed Unicode');
    else bytes += 3;
  }
  return bytes;
}
function boundedTree(value: unknown, depth = 0, budget = { items: 0, bytes: 0 }): void {
  if (depth > 5 || ++budget.items > 160 || budget.bytes > MAX_PROPOSAL_BYTES)
    invalid('Proposal depth/item/byte limit');
  if (typeof value === 'string') {
    budget.bytes += utf8Bytes(value);
    if (budget.bytes > MAX_PROPOSAL_BYTES) invalid('Proposal byte limit');
  } else if (Array.isArray(value)) {
    if (value.length > 20) invalid('Array limit');
    value.forEach((v) => boundedTree(v, depth + 1, budget));
  } else if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && Object.getPrototypeOf(proto) !== null) invalid('Object prototype');
    const keys = Object.keys(value);
    if (keys.length > 12) invalid('Object key limit');
    for (const key of keys) {
      if (
        ['__proto__', 'prototype', 'constructor'].includes(key) ||
        !Object.getOwnPropertyDescriptor(value, key)?.hasOwnProperty('value')
      )
        invalid('Unsafe object key');
      budget.bytes += utf8Bytes(key);
      boundedTree((value as Record<string, unknown>)[key], depth + 1, budget);
    }
  } else if (value !== null && !['number', 'boolean'].includes(typeof value))
    invalid('Invalid JSON value');
}
function rejectDuplicateJsonKeys(raw: string): void {
  const tokens =
    raw.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ??
    [];
  const stack: (Set<string> | null)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '{') stack.push(new Set());
    else if (token === '[') stack.push(null);
    else if (token === '}' || token === ']') stack.pop();
    else if (token.startsWith('"') && tokens[i + 1] === ':') {
      const seen = stack[stack.length - 1];
      const key = JSON.parse(token) as string;
      if (seen?.has(key)) invalid('Duplicate JSON key');
      seen?.add(key);
    }
  }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid('Expected object');
  return value as Record<string, unknown>;
}
const keys = (o: Record<string, unknown>, allowed: string[], required: string[] = []) => {
  if (Object.keys(o).some((k) => !allowed.includes(k)) || required.some((k) => !(k in o)))
    invalid('Unknown/missing key');
};
const text = (v: unknown, max = 256) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max || /[\u0000-\u001f]/.test(v))
    invalid('Invalid bounded text');
};
const uuid = (v: unknown) => {
  if (typeof v !== 'string' || !UUID.test(v)) invalid('Invalid immutable UUID');
};
const integer = (v: unknown, min: number, max: number) => {
  if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max)
    invalid('Integer outside bounds');
};

/** Normalize SDK structured calls, then discard its ID and mint host-authoritative trace ID. */
export function decodeToolProposal(raw: unknown, hostCallId: string): ToolProposal {
  if (typeof raw === 'string') {
    if (raw.length > MAX_PROPOSAL_BYTES || utf8Bytes(raw) > MAX_PROPOSAL_BYTES)
      invalid('Proposal byte limit');
    try {
      rejectDuplicateJsonKeys(raw);
      raw = JSON.parse(raw);
    } catch {
      return invalid('Malformed tool JSON');
    }
  }
  boundedTree(raw);
  const p = object(raw);
  keys(p, ['version', 'callId', 'name', 'arguments'], ['name', 'arguments']);
  if (p.version !== undefined && p.version !== 1) invalid('Unsupported protocol version');
  if (p.callId !== undefined) text(p.callId, 128);
  if (typeof p.name !== 'string' || !(TOOL_NAMES as readonly string[]).includes(p.name))
    invalid('Tool not allowlisted');
  const name = p.name as ToolName,
    a = object(p.arguments);
  const schemas: Record<ToolName, [string[], string[]]> = {
    find_places: [['query', 'category', 'limit'], []],
    get_place_details: [['placeId'], ['placeId']],
    get_verified_entrances: [['placeId'], ['placeId']],
    find_menu_items: [['query', 'maxPricePhp', 'branchId', 'limit', 'requiredTags'], []],
    search_food_research: [['query', 'category', 'restaurantId', 'maxPhp', 'limit'], []],
    get_food_research_details: [['restaurantId', 'offset', 'limit'], ['restaurantId']],
    find_approved_offices: [['query', 'district', 'buildingId', 'limit'], []],
    get_office_details: [['placeId'], ['placeId']],
    get_itinerary_preview: [[], []],
    focus_map_place: [['placeId'], ['placeId']],
    preview_itinerary_change: [['stops', 'operation'], ['stops']],
  };
  keys(a, ...schemas[name]);
  for (const k of ['query', 'category', 'district'])
    if (k in a) text(a[k], k === 'query' ? 256 : 80);
  for (const k of ['placeId', 'branchId', 'restaurantId', 'buildingId']) if (k in a) uuid(a[k]);
  for (const k of ['maxPricePhp', 'maxPhp'])
    if (k in a && (typeof a[k] !== 'string' || parsePhpCentavos(a[k] as string) === null))
      invalid('Exact PHP decimal required');
  if ('limit' in a)
    integer(a.limit, 1, ['find_places', 'find_approved_offices'].includes(name) ? 12 : 20);
  if ('offset' in a) integer(a.offset, 0, 1000);
  if ('requiredTags' in a) {
    if (!Array.isArray(a.requiredTags) || a.requiredTags.length > 8) invalid('Invalid tags');
    (a.requiredTags as unknown[]).forEach((t) => text(t, 80));
  }
  if (
    'operation' in a &&
    !['replace', 'append', 'remove', 'reorder'].includes(a.operation as string)
  )
    invalid('Invalid preview operation');
  if ('stops' in a) {
    if (!Array.isArray(a.stops) || a.stops.length > 20) invalid('Invalid stops');
    const seen = new Set<string>();
    for (const rawStop of a.stops as unknown[]) {
      const stop = object(rawStop);
      keys(stop, ['placeId', 'durationMinutes'], ['placeId', 'durationMinutes']);
      uuid(stop.placeId);
      integer(stop.durationMinutes, 0, 1440);
      if (a.operation !== 'reorder' && a.operation !== 'remove' && seen.has(stop.placeId as string))
        invalid('Duplicate stop');
      seen.add(stop.placeId as string);
    }
  }
  // Clone before dispatch so model/native callers cannot mutate validated arguments.
  return {
    version: 1,
    callId: hostCallId,
    name,
    arguments: JSON.parse(JSON.stringify(a)),
  } as ToolProposal;
}

const str = { type: 'string', minLength: 1, maxLength: 256 };
const id = { type: 'string', pattern: UUID.source };
const limit = { type: 'integer', minimum: 1, maximum: 20 };
const specs: Record<
  ToolName,
  { description: string; properties: Record<string, unknown>; required?: string[] }
> = {
  find_places: {
    description: 'Current approved canonical places only. Empty means no verified matches.',
    properties: { query: str, category: str, limit: { ...limit, maximum: 12 } },
  },
  get_place_details: {
    description: 'Current approved exact canonical UUID, with sources.',
    properties: { placeId: id },
    required: ['placeId'],
  },
  get_verified_entrances: {
    description:
      'Read current approved eligible entrance IDs/labels from canonical source records. Exact place UUID only; never model coordinates or walking directions.',
    properties: { placeId: id },
    required: ['placeId'],
  },
  find_menu_items: {
    description:
      'Approved branch-bound menu. PHP budget is exact decimal string. No unknown-price or unknown-tag match.',
    properties: {
      query: str,
      maxPricePhp: { type: 'string', pattern: '^\\d{1,12}(?:\\.\\d{1,2})?$' },
      branchId: id,
      limit,
      requiredTags: { type: 'array', maxItems: 8, items: str },
    },
  },
  search_food_research: {
    description:
      'Only for explicitly requested RESEARCH listings. Candidate/estimated data, rights pending, no verified locations.',
    properties: { query: str, category: str, restaurantId: id, maxPhp: str, limit },
  },
  get_food_research_details: {
    description: 'Explicit research details, recorded hours not open now. Pagination max 20.',
    properties: { restaurantId: id, offset: { type: 'integer', minimum: 0, maximum: 1000 }, limit },
    required: ['restaurantId'],
  },
  find_approved_offices: {
    description: 'Approved current operating offices only; excludes all research candidates.',
    properties: { query: str, district: str, buildingId: id, limit: { ...limit, maximum: 12 } },
  },
  get_office_details: {
    description: 'Approved current operating office with citations.',
    properties: { placeId: id },
    required: ['placeId'],
  },
  get_itinerary_preview: {
    description:
      'Read only the current temporary visit-list draft in session memory. It contains planned visit durations, never favorites, persisted stops or travel times.',
    properties: {},
  },
  focus_map_place: {
    description: 'Reversible UI focus on a retrieved approved canonical UUID; no raw coordinates.',
    properties: { placeId: id },
    required: ['placeId'],
  },
  preview_itinerary_change: {
    description:
      'Temporary visit-list preview in memory only. operation replace (default) replaces the draft; append adds stops; remove removes one occurrence of each exact current draft ID/duration tuple; reorder preserves its exact ID/duration multiset. Read get_itinerary_preview first for edits. No favorites, saving, confirmation, walking routes or travel times. All displayed stops require current approved source records.',
    properties: {
      operation: { type: 'string', enum: ['replace', 'append', 'remove', 'reorder'] },
      stops: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            placeId: id,
            durationMinutes: { type: 'integer', minimum: 0, maximum: 1440 },
          },
          required: ['placeId', 'durationMinutes'],
        },
      },
    },
    required: ['stops'],
  },
};
export function toolDefinitions(allowed: readonly ToolName[] = TOOL_NAMES) {
  return allowed.map((name) => ({
    name,
    description: specs[name].description,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: specs[name].properties,
      required: specs[name].required ?? [],
    },
  }));
}
