import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Citation, Place, SavedState } from '../../contracts';
import { AppDialog } from '../../ui/AppDialog';
import {
  Action,
  Body,
  CategoryArtwork,
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
  const [menuOpen, setMenuOpen] = useState(false);
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
  const restaurantLike = /restaurant|food|caf[eé]|coffee|dining/i.test(place.category);
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
        {place.status === 'stale' ? <Body muted>Information may have changed.</Body> : null}
        {research ? (
          <>
            <Body muted>{research.zone}</Body>
            {research.locationOriginal && !research.floor ? (
              <Body muted>Listed location: {research.locationOriginal}</Body>
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
            <Body muted>Internal research · rights review pending.</Body>
            <Action label="Menu" icon="menu" onPress={() => setMenuOpen(true)} />
          </DetailSection>
        </>
      ) : null}
      {menus.length ? (
        <DetailSection title="Menu or products" icon="menu" summary={String(menus.length)}>
          <Body muted>Source and availability may vary by venue and date.</Body>
          <Action label="Menu" icon="menu" onPress={() => setMenuOpen(true)} />
        </DetailSection>
      ) : null}
      {!research && !menus.length && restaurantLike ? (
        <DetailSection title="Menu" icon="menu" summary="0">
          <Body muted>Menu information is not yet available.</Body>
          <Action label="Menu" icon="menu" onPress={() => setMenuOpen(true)} />
        </DetailSection>
      ) : null}
      {demo?.services.length ? (
        <DetailSection title="Amenities and services" icon="shop">
          {demo.services.map((service) => (
            <Body key={service}>{service}</Body>
          ))}
        </DetailSection>
      ) : null}
      {research || menus.length || restaurantLike ? (
        <AppDialog
          visible={menuOpen}
          title={`${place.name} menu`}
          description={
            research
              ? 'Internal research · rights review pending. Some menu items may be missing. Prices and branch availability may differ; check with the restaurant.'
              : 'Menu records and prices may change. Confirm details and dietary needs with the venue.'
          }
          actions={[{ label: 'Close', onPress: () => setMenuOpen(false) }]}
          onDismiss={() => setMenuOpen(false)}
        >
          {research ? (
            <>
              <FoodSourceDisclosure evidence={foodResearch.getFoodResearchEvidence(research.id)} />
              <ResearchMenu key={research.id} restaurantId={research.id} />
            </>
          ) : menus.length ? (
            menus.map((item) => (
              <View key={item.id} style={styles.menuItem}>
                <View style={styles.imagePlaceholder}>
                  <Icon name="image" size={20} color={palette.muted} />
                  <Text style={styles.imagePlaceholderText}>Menu image unavailable</Text>
                </View>
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
              </View>
            ))
          ) : (
            <Body>Menu information is not yet available.</Body>
          )}
        </AppDialog>
      ) : null}
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
  identity: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  metadata: { flex: 1, minWidth: 0 },
  metadataText: { fontFamily: 'OmniBody', fontSize: 13, lineHeight: 19, color: palette.muted },
  menuItem: { paddingVertical: 8, gap: 3, borderBottomWidth: 1, borderColor: palette.divider },
  imagePlaceholder: {
    minHeight: 68,
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.soft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  imagePlaceholderText: { fontFamily: 'OmniBody', fontSize: 13, color: palette.muted },
  itemName: { fontFamily: 'OmniBodySemiBold', fontSize: 16, lineHeight: 23, color: palette.ink },
  citation: { gap: 3, paddingVertical: 6 },
});
