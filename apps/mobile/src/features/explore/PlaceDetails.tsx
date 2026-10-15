import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Citation, Place, SavedState } from '../../contracts';
import {
  Body,
  CategoryArtwork,
  CitationList,
  Icon,
  Notice,
  palette,
  type IconName,
} from '../../ui/components';
import { demoDetails, isDemoPlace } from './demoDirectory';
import { foodResearch } from '../food/directory';
import { OfficeDetailsView, OfficeTenantList } from '../offices/OfficeDetails';
import { FoodHoursView, FoodSourceDisclosure, ResearchMenu } from '../food/ResearchDetails';

function DetailSection({
  title,
  icon,
  children,
  summary,
}: {
  title: string;
  icon: IconName;
  children: ReactNode;
  summary?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${title}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.disclosure}
      >
        <Icon name={icon} size={20} />
        <Text style={styles.title}>{title}</Text>
        {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        <Icon name={open ? 'up' : 'down'} size={18} />
      </Pressable>
      {open ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

export function PlacePeek({ place }: { place: Place }) {
  return (
    <View style={styles.identity}>
      <CategoryArtwork category={place.category} size={36} />
      <View style={styles.metadata}>
        <Text style={styles.metadataText}>
          {[place.category, place.building, place.floor ? `Floor ${place.floor}` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {isDemoPlace(place) ? (
          <Text style={styles.metadataText}>Fictional sample · no map location</Text>
        ) : null}
      </View>
    </View>
  );
}

/** Canonical projection has no real hours/services/description fields. Render only
 * supported fields and explicitly fictional demo metadata; never infer missing facts. */
export function PlaceDetails({
  place,
  places = [],
  onChoose,
  saved,
  onSave,
}: {
  place: Place;
  places?: readonly Place[];
  onChoose?: (place: Place) => void;
  saved?: SavedState;
  onSave?: (place: Place) => void;
}) {
  if (place.category === 'office')
    return (
      <OfficeDetailsView
        place={place}
        places={places}
        onChoose={onChoose}
        saved={saved}
        onSave={onSave}
      />
    );
  const demo = demoDetails(place),
    sample = isDemoPlace(place);
  const research = foodResearch.getFoodEstablishmentDetails(place.id);
  const supported = (citation: Citation | undefined) =>
    citation?.status === 'approved' ||
    !!(
      sample &&
      citation?.verificationMethod === 'synthetic-preview' &&
      citation.sourceId === 'OMNI-UX-V2-FICTIONAL-PREVIEW'
    );
  const menus = place.menus.filter(
    (item) => item.citation.status !== 'candidate' || supported(item.citation),
  );
  const sourceCount = new Set(place.citations.map((citation) => citation.sourceId)).size;
  return (
    <View style={styles.details}>
      {place.category === 'Building' ? (
        <OfficeTenantList buildingId={place.id} places={places} onChoose={onChoose} />
      ) : null}
      <DetailSection title="Overview" icon="info">
        <Body>{place.name}</Body>
        <Body muted>
          {[place.category, place.building, place.floor ? `Floor ${place.floor}` : null]
            .filter(Boolean)
            .join(' · ')}
        </Body>
        <Text style={styles.status}>
          {research
            ? 'Research record · evidence varies'
            : sample
              ? 'Fictional sample'
              : place.status === 'candidate'
                ? 'Candidate · not verified'
                : place.status === 'stale'
                  ? 'Stale · information may have changed'
                  : 'Approved record'}
        </Text>
        {research ? (
          <>
            <Body muted>{research.zone}</Body>
            {research.locationOriginal && !research.floor ? (
              <Body muted>Location unresolved: {research.locationOriginal}</Body>
            ) : null}
          </>
        ) : null}
        {demo ? (
          <>
            <Notice>{demo.notice}</Notice>
            <Body muted>{demo.locationNotice}</Body>
          </>
        ) : null}
      </DetailSection>
      {demo?.hours ? (
        <DetailSection title="Operating hours" icon="clock">
          <Body>{demo.hours}</Body>
        </DetailSection>
      ) : null}
      {research ? (
        <>
          <DetailSection title="Operating hours" icon="clock">
            <FoodHoursView hours={research.hours} />
          </DetailSection>
          <DetailSection title="Menu" icon="menu" summary={String(research.menuItemCount)}>
            <ResearchMenu key={research.id} restaurantId={research.id} />
          </DetailSection>
        </>
      ) : null}
      {menus.length ? (
        <DetailSection title="Menu or products" icon="menu" summary={String(menus.length)}>
          {menus.map((item) => (
            <View key={item.id} style={styles.menuItem}>
              <Text style={styles.itemName}>{item.name}</Text>
              {supported(item.priceCitation) && (item.price || item.priceValue) ? (
                <Body>
                  {item.price ?? `${item.priceValue?.currency} ${item.priceValue?.amount}`}
                </Body>
              ) : (
                <Body muted>Price not recorded</Body>
              )}
              {supported(item.tagCitation) && item.tags?.length ? (
                <Body muted>{item.tags.join(' · ')} · confirm dietary needs with the venue</Body>
              ) : null}
              {item.tagCitation?.status === 'approved' && item.allergens?.length ? (
                <Body muted>
                  Reported allergens: {item.allergens.join(', ')}. Confirm with the venue.
                </Body>
              ) : null}
              {item.citation.status === 'stale' ? (
                <Body muted>Price and availability may have changed.</Body>
              ) : null}
              <CitationList
                citations={[
                  item.citation,
                  ...[item.priceCitation, item.tagCitation].filter(
                    (citation): citation is NonNullable<typeof citation> => !!citation,
                  ),
                  ...(item.relationshipCitations ?? []),
                ]}
              />
            </View>
          ))}
        </DetailSection>
      ) : null}
      {demo?.services.length ? (
        <DetailSection title="Amenities and services" icon="shop">
          {demo.services.map((service) => (
            <Body key={service}>{service}</Body>
          ))}
        </DetailSection>
      ) : null}
      <DetailSection
        title="Sources"
        icon="info"
        summary={`${place.status} · ${sourceCount} source${sourceCount === 1 ? '' : 's'}`}
      >
        {research ? (
          <FoodSourceDisclosure evidence={foodResearch.getFoodResearchEvidence(research.id)} />
        ) : place.citations.length ? (
          place.citations.map((citation, index) => (
            <View key={`${citation.sourceId}:${index}`} style={styles.citation}>
              <Body>{citation.label}</Body>
              <Body muted>
                {citation.status} · {citation.sourceId}
              </Body>
              <Body muted>License: {citation.license}</Body>
              <Body muted>Observed: {citation.observedAt}</Body>
              <Body muted>Verified: {citation.verifiedAt ?? 'Not verified'}</Body>
              {citation.locator ? <Body muted>Evidence: {citation.locator}</Body> : null}
              {citation.factId ? <Body muted>Fact: {citation.factId}</Body> : null}
              {citation.snapshotId ? <Body muted>Snapshot: {citation.snapshotId}</Body> : null}
              {citation.evidenceId ? <Body muted>Evidence ID: {citation.evidenceId}</Body> : null}
              {citation.rawSha256 ? <Body muted>Raw SHA256: {citation.rawSha256}</Body> : null}
              {citation.verificationMethod ? (
                <Body muted>Verification method: {citation.verificationMethod}</Body>
              ) : null}
            </View>
          ))
        ) : (
          <Body muted>Source information is unavailable for this record.</Body>
        )}
      </DetailSection>
    </View>
  );
}
const styles = StyleSheet.create({
  details: { gap: 2 },
  section: { borderTopWidth: 1, borderColor: palette.divider },
  disclosure: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  title: { fontFamily: 'OmniBodySemiBold', fontSize: 16, color: palette.ink, flex: 1 },
  summary: { fontFamily: 'OmniBody', fontSize: 12, color: palette.muted, flexShrink: 1 },
  content: { paddingLeft: 30, paddingBottom: 12, gap: 8 },
  status: { fontFamily: 'OmniBodySemiBold', fontSize: 13, color: palette.muted },
  identity: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  metadata: { flex: 1, minWidth: 0 },
  metadataText: { fontFamily: 'OmniBody', fontSize: 13, lineHeight: 19, color: palette.muted },
  menuItem: { paddingVertical: 8, gap: 3, borderBottomWidth: 1, borderColor: palette.divider },
  itemName: { fontFamily: 'OmniBodySemiBold', fontSize: 16, lineHeight: 23, color: palette.ink },
  citation: { gap: 3, paddingVertical: 6 },
});
