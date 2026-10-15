import type { Place } from '../../contracts';
import type { AssistantPayload } from '../assistant/contracts';
import { searchOffices, getOfficeDetails, operatingOffice, officeDistrictLabel } from './service';

/** Same fresh approved office records as the UI. No research/model/network facts. */
export function answerOfficeQuery(
  query: string,
  places: readonly Place[],
): AssistantPayload[] | null {
  if (/\b(menu|dish|restaurant|coffee|recipe|food|price|budget)\b/i.test(query)) return null;
  const intent =
    /\b(office|offices|company|companies|headquarters|employer|tenant|tenants)\b/i.test(query);
  const text = query
    .replace(
      /\b(where|is|are|the|a|an|in|at|of|find|show|me|please|office|offices|company|companies|headquarters|tenant|tenants)\b/gi,
      ' ',
    )
    .trim();
  const current = new Set(
    places.filter((place) => place.status === 'approved').map((place) => place.id),
  );
  const found = searchOffices({ query: text, limit: 12 });
  const matches = found.items.filter(
    (office) => current.has(office.placeId) && operatingOffice(office),
  );
  if (!intent && !matches.length) return null;
  if (!matches.length)
    return [
      {
        kind: 'text',
        text: 'No current approved offices match this search. Unverified office research is kept separate from Assistant answers.',
      },
    ];
  const result: AssistantPayload[] = [
    {
      kind: 'places',
      title: 'Reviewed company offices',
      placeIds: matches.map((office) => office.placeId),
      total: found.total,
    },
  ];
  if (matches.length === 1) {
    const office = getOfficeDetails(matches[0]!.placeId)!;
    result.push({
      kind: 'text',
      text: [
        `${office.name} · ${office.presence.replace(/_/g, ' ')}`,
        office.building ?? 'Building not recorded',
        office.floor ? `Floor/suite: ${office.floor}` : 'Floor/suite not recorded',
        office.address,
        officeDistrictLabel(office.district),
        `Presence reviewed ${office.verifiedAt.slice(0, 10)}. Approximate building locations are not office entrances.`,
      ].join('\n'),
    });
  }
  result.push({
    kind: 'evidence',
    title: 'Office claim sources',
    citations: matches.flatMap((office) => office.citations),
  });
  return result;
}
