import { useState } from 'react';
import { TextInput, View } from 'react-native';
import type { Place } from '../../contracts';
import { Action, Body, Heading, Notice, palette, ui } from '../../ui/components';
import { PlaceRow } from '../explore/PlaceIdentity';
import {
  getOfficeDetails,
  officeDirectoryStatus,
  officeDistrictLabel,
  searchOffices,
  getOfficeLocationReference,
  officeText,
} from './service';
import { internalOfficeResearchEnabled, officeResearch } from './research';
import type { OfficeDetails } from './contracts';

export function officePlace(office: OfficeDetails): Place {
  return {
    id: office.placeId,
    name: office.name,
    category: 'office',
    coordinate: null,
    building: office.building ?? undefined,
    floor: office.floor ?? undefined,
    aliases: office.aliases,
    entrances: [],
    menus: [],
    citations: office.citations,
    status: office.state === 'operating' ? 'approved' : 'stale',
  };
}
export function OfficeDirectory({
  places,
  onChoose,
}: {
  places: readonly Place[];
  onChoose: (place: Place) => void;
}) {
  const [query, setQuery] = useState('');
  const [research, setResearch] = useState(false);
  const [includeNonOperating, setIncludeNonOperating] = useState(false);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const status = officeDirectoryStatus();
  const approved = searchOffices({ query, offset, limit: 30, includeNonOperating });
  const candidates = officeResearch.search(query, offset);
  const total = research ? candidates.total : approved.total;
  const search = (value: string) => {
    setQuery(value);
    setOffset(0);
    setExpanded(null);
  };
  return (
    <View style={{ gap: 12 }}>
      <Body muted>
        {research
          ? 'Internal research candidates · not verified or approved'
          : 'Reviewed operating offices · available offline'}
      </Body>
      <TextInput
        value={query}
        onChangeText={search}
        accessibilityLabel="Search companies, office buildings, industries or districts"
        placeholder="Company, building, industry or district"
        placeholderTextColor={palette.muted}
        style={ui.input}
        returnKeyType="search"
      />
      {!research ? (
        <Action
          label={
            includeNonOperating
              ? 'Show operating offices only'
              : 'Include registered and historical offices'
          }
          selected={includeNonOperating}
          onPress={() => {
            setIncludeNonOperating((value) => !value);
            setOffset(0);
          }}
        />
      ) : null}
      {internalOfficeResearchEnabled ? (
        <Action
          label={research ? 'Return to approved offices' : 'View internal research candidates'}
          onPress={() => {
            setResearch((value) => !value);
            setOffset(0);
            setExpanded(null);
          }}
        />
      ) : null}
      {research ? (
        <Notice>
          These are research claims. Dates and strength labels do not verify occupancy or grant
          reuse rights. Candidates have no map points, saved-place IDs or Assistant answers.
        </Notice>
      ) : !status.available ? (
        <Notice>
          An approved office content pack is not available. Existing maps and saved records remain
          available.
        </Notice>
      ) : !status.operating ? (
        <Notice>
          No approved operating offices yet. Source, identity and location reviews are still
          required.
        </Notice>
      ) : null}
      <Body muted>
        {total} {research ? 'candidate office rows' : 'reviewed office locations'}
        {total ? ` · ${Math.min(offset + 1, total)}–${Math.min(offset + 30, total)}` : ''}
      </Body>
      {research
        ? candidates.items.map((candidate) => (
            <View key={candidate.candidateId} style={ui.card}>
              <Heading>{candidate.name}</Heading>
              <Body muted>
                {[candidate.building, candidate.floor, candidate.district]
                  .filter(Boolean)
                  .join(' · ') || 'Exact office location unknown'}
              </Body>
              <Body muted>
                Research only · {candidate.evidenceStrength ?? 'Evidence strength unknown'}
              </Body>
              <Action
                label={
                  expanded === candidate.candidateId
                    ? 'Hide research details'
                    : 'Inspect research details'
                }
                onPress={() =>
                  setExpanded(expanded === candidate.candidateId ? null : candidate.candidateId)
                }
              />
              {expanded === candidate.candidateId ? (
                <>
                  <Body>{candidate.address ?? 'Address not recorded'}</Body>
                  <Body muted>Floor/suite: {candidate.floor ?? 'Not recorded'}</Body>
                  <Body muted>Claimed presence: {candidate.presenceClaim ?? 'Unknown'}</Body>
                  <Body muted>Industry claim: {candidate.industry ?? 'Unknown'}</Body>
                  <Body muted>
                    Research date: {candidate.researchDate ?? 'Not recorded'} · Presence
                    verification: pending
                  </Body>
                  <Body muted>Source: {candidate.sourceUrl ?? 'Missing source URL'}</Body>
                  <Body muted>
                    Review issues:{' '}
                    {candidate.issues.map((issue) => issue.replace(/_/g, ' ')).join('; ')}
                  </Body>
                  <Body muted>Map coverage and entrances have not been verified.</Body>
                </>
              ) : null}
            </View>
          ))
      : <>
          {approved.items.map((office) => {
            const place = places.find((entry) => entry.id === office.placeId) ?? officePlace(office);
            return (
              <View key={office.placeId}>
                <PlaceRow place={place} onPress={() => onChoose(place)} />
                <Body muted>
                  {officeDistrictLabel(office.district)} ·{' '}
                  {getOfficeDetails(office.placeId)?.presence.replace(/_/g, ' ')}
                </Body>
              </View>
            );
          })}
          {places.filter((place) => {
            const reference = getOfficeLocationReference(place.id);
            const needle = officeText(query);
            const corpus = reference ? officeText([reference.name, reference.building, reference.address].join(' ')) : '';
            return !!reference && (!needle || needle.split(' ').every((token) => corpus.includes(token)));
          }).map((place) => {
            const reference = getOfficeLocationReference(place.id)!;
            return (
              <View key={place.id}>
                <PlaceRow place={place} onPress={() => onChoose(place)} />
                <Body muted>{reference.notice}</Body>
              </View>
            );
          })}
        </>}
      {!total && query ? (
        <Notice>No matching offices. Try a company alias, building or district.</Notice>
      ) : null}
      <View style={ui.row}>
        {offset > 0 ? (
          <Action label="Previous offices" onPress={() => setOffset(Math.max(0, offset - 30))} />
        ) : null}
        {offset + 30 < total ? (
          <Action label="More offices" onPress={() => setOffset(offset + 30)} />
        ) : null}
      </View>
    </View>
  );
}
