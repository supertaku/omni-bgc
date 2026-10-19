import asset from '../../../assets/generated/offices/research.json';
import type { OfficeCandidate } from './contracts';
import { officeText, officeInitialism, officeLiteralPhrase } from './service';

export const internalOfficeResearchEnabled = typeof __DEV__ !== 'undefined' && __DEV__;
type Research = {
  version: string;
  origin: string;
  publicationAuthorized: false;
  mapPoints: 0;
  candidates: OfficeCandidate[];
};
export function validateOfficeResearch(input: unknown): input is Research {
  if (!input || typeof input !== 'object') return false;
  const data = input as Partial<Research>;
  if (
    data.version !== 'office-research-mobile-v1' ||
    data.origin !== 'internal_research' ||
    data.publicationAuthorized !== false ||
    data.mapPoints !== 0 ||
    !Array.isArray(data.candidates) ||
    data.candidates.length > 20000
  )
    return false;
  const ids = new Set<string>();
  return data.candidates.every((row) => {
    if (
      !row ||
      typeof row.candidateId !== 'string' ||
      !row.candidateId.startsWith('research:offices:sha256:') ||
      ids.has(row.candidateId) ||
      typeof row.name !== 'string' ||
      !Array.isArray(row.issues) ||
      !row.issues.every((issue) => typeof issue === 'string')
    )
      return false;
    ids.add(row.candidateId);
    if (
      Object.keys(row).some(
        (key) =>
          ![
            'candidateId',
            'name',
            'industry',
            'district',
            'building',
            'floor',
            'address',
            'presenceClaim',
            'researchDate',
            'evidenceStrength',
            'sourceUrl',
            'issues',
          ].includes(key),
      )
    )
      return false;
    return [
      row.industry,
      row.district,
      row.building,
      row.floor,
      row.address,
      row.presenceClaim,
      row.researchDate,
      row.evidenceStrength,
      row.sourceUrl,
    ].every((value) => value === null || typeof value === 'string');
  });
}
export function createOfficeResearch(input: unknown) {
  const candidates = validateOfficeResearch(input) ? input.candidates : [];
  return {
    count: candidates.length,
    search(query = '', offset = 0) {
      const tokens = officeText(query.slice(0, 2048)).split(' ').filter(Boolean).slice(0, 12);
      const matches = candidates.filter(
        (row) =>
          (!officeInitialism(tokens) || officeLiteralPhrase(row.name, tokens)) &&
          tokens.every((token) =>
            officeText(
              [row.name, row.industry, row.district, row.building, row.floor, row.address]
                .filter(Boolean)
                .join(' '),
            )
              .split(' ')
              .some((word) => word.startsWith(token)),
          ),
      );
      return {
        total: matches.length,
        items: matches.slice(Math.max(0, offset), Math.max(0, offset) + 30),
      };
    },
  };
}
export const officeResearch = createOfficeResearch(internalOfficeResearchEnabled ? asset : null);
