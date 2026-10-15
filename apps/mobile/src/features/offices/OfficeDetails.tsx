import { Share, View } from 'react-native';
import type { Place, SavedState } from '../../contracts';
import { Action, Body, CitationList, Heading, Notice, ui } from '../../ui/components';
import {
  getOfficeDetails,
  officeDistrictLabel,
  officeExpired,
  operatingOffice,
  searchOffices,
} from './service';
import { officeMapCoverage } from './map';
import { officePlace } from './OfficeDirectory';

export function OfficeDetailsView({
  place,
  saved,
  onSave,
  onChoose,
  places,
}: {
  place: Place;
  saved?: SavedState;
  onSave?: (place: Place) => void;
  onChoose?: (place: Place) => void;
  places?: readonly Place[];
}) {
  const office = getOfficeDetails(place.id);
  if (!office)
    return (
      <Notice>
        Office details are unavailable in the current approved pack. Existing saved IDs are
        retained.
      </Notice>
    );
  const expired = officeExpired(office),
    coverage = officeMapCoverage(place.id);
  return (
    <View style={{ gap: 10 }}>
      <Heading>{office.name}</Heading>
      <Body>{office.organizationName}</Body>
      <Body muted>
        {office.presence.replace(/_/g, ' ')} · {officeDistrictLabel(office.district)}
      </Body>
      {expired ? (
        <Notice>
          Stale office record. The retained address is historical context; current presence needs
          review.
        </Notice>
      ) : office.state !== 'operating' ? (
        <Notice>
          This office is recorded as {office.state}. It is excluded from operating-office results.
        </Notice>
      ) : null}
      <Body>Building: {office.building ?? 'Not verified'}</Body>
      <Body>Floor/suite: {office.floor ?? 'Not recorded'}</Body>
      <Body>{office.address}</Body>
      <Body muted>Industry: {office.industry ?? 'Not recorded'}</Body>
      <Body muted>
        Presence reviewed: {office.verifiedAt.slice(0, 10)} · Review valid until{' '}
        {office.validUntil.slice(0, 10)}
      </Body>
      <Body muted>
        Verification method: {office.verificationMethod?.replace(/_/g, ' ') ?? 'Not recorded'}
      </Body>
      <Body muted>Evidence basis: {office.confidenceReason ?? 'Not recorded'}</Body>
      {coverage === 'mapped' ? (
        <Notice>
          {office.locationKind === 'building_polygon_anchor'
            ? 'Approximate building location. It is not an office door or public entrance.'
            : 'Reviewed site point. Public access and office entrances have not been established.'}{' '}
          Walking directions are unavailable.
        </Notice>
      ) : (
        <Notice>
          {coverage === 'outside' || coverage === 'unavailable'
            ? 'Not available in the current offline map area.'
            : 'Company known; map location is not verified.'}{' '}
          View these recorded details without moving the map.
        </Notice>
      )}
      <View style={ui.row}>
        {onSave && operatingOffice(office) ? (
          <Action
            icon="bookmark"
            label={saved?.placeIds.includes(place.id) ? 'Remove saved office' : 'Save office'}
            onPress={() => onSave(place)}
          />
        ) : null}
        {!expired ? (
          <Action
            label="Share office details"
            onPress={() =>
              void Share.share({
                title: office.name,
                message: [
                  office.name,
                  `Recorded state: ${office.state}`,
                  office.presence.replace(/_/g, ' '),
                  office.building,
                  office.floor ? `Floor/suite ${office.floor}` : 'Floor/suite not recorded',
                  office.address,
                  officeDistrictLabel(office.district),
                  `Presence reviewed ${office.verifiedAt.slice(0, 10)}`,
                  'Approximate locations are not public entrances.',
                  ...office.citations.map(
                    (citation) => `${citation.label}: ${citation.locator ?? citation.sourceId}`,
                  ),
                ]
                  .filter(Boolean)
                  .join('\n'),
              }).catch(() => {})
            }
          />
        ) : null}
      </View>
      {office.buildingId ? (
        <OfficeTenantList
          buildingId={office.buildingId}
          places={places ?? []}
          onChoose={onChoose}
        />
      ) : null}
      <Heading>Sources and freshness</Heading>
      <CitationList citations={office.citations} />
    </View>
  );
}
export function OfficeTenantList({
  buildingId,
  places,
  onChoose,
}: {
  buildingId: string;
  places: readonly Place[];
  onChoose?: (place: Place) => void;
}) {
  const tenants = searchOffices({ buildingId, limit: 100 });
  if (!tenants.total) return null;
  return (
    <View style={{ gap: 8 }}>
      <Heading>Reviewed company offices in this building</Heading>
      {tenants.items.map((office) => (
        <View key={office.placeId} style={ui.card}>
          <Body>{office.name}</Body>
          <Body muted>
            {office.floor ? `Floor/suite ${office.floor}` : 'Floor/suite not recorded'}
          </Body>
          {onChoose ? (
            <Action
              label={`View ${office.name} office`}
              onPress={() =>
                onChoose(places.find((place) => place.id === office.placeId) ?? officePlace(office))
              }
            />
          ) : null}
        </View>
      ))}
      {tenants.total > 100 ? (
        <Body muted>Search Offices to see all {tenants.total} tenants.</Body>
      ) : null}
    </View>
  );
}
