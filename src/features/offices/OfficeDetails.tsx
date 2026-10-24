import { Share, View } from 'react-native';
import type { Place, SavedState } from '../../contracts';
import { Action, Body, Heading, Notice, ui } from '../../ui/components';
import { getOfficeDetails, officeDistrictLabel, officeExpired, searchOffices } from './service';
import { officeMapCoverage } from './map';
import { officePlace } from './OfficeDirectory';
import { PlaceCover } from '../explore/PlaceIdentity';
import { PreviewSources } from '../explore/PreviewSources';
import { canonicalPreviewId, INTERNAL_PREVIEW_ENABLED } from '../../preview/directory';

export function OfficeDetailsView({
  place,
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
  if (!office) return <Notice>Office details are unavailable in the current approved pack.</Notice>;
  const expired = officeExpired(office),
    coverage = officeMapCoverage(place.id);
  return (
    <View style={{ gap: 10 }}>
      <PlaceCover place={place} />
      <Heading>{office.name}</Heading>
      {place.description ? <Body>{place.description}</Body> : null}
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
      <Body>Building: {office.building ?? 'Not recorded'}</Body>
      <Body>Floor/suite: {office.floor ?? 'Not recorded'}</Body>
      <Body>{office.address}</Body>
      <Body muted>Industry: {office.industry ?? 'Not recorded'}</Body>
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
            : 'Map location is unavailable.'}{' '}
          View these recorded details without moving the map.
        </Notice>
      )}
      <View style={ui.row}>
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
      <PreviewSources id={place.id} />
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
  const additional = INTERNAL_PREVIEW_ENABLED ? places.filter(place => place.preview && place.category === 'office' && place.buildingId === canonicalPreviewId(buildingId) && !tenants.items.some(office => office.placeId === place.id)) : [];
  if (!tenants.total && !additional.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Heading>{INTERNAL_PREVIEW_ENABLED ? 'Company offices in this building' : 'Reviewed company offices in this building'}</Heading>
      {additional.map(place => <View key={place.id} style={ui.card}><Body>{place.name}</Body>{onChoose ? <Action label={`View ${place.name} office`} onPress={() => onChoose(place)} /> : null}</View>)}
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
