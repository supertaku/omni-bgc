import { useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Citation, Place, SavedState } from '../../contracts';
import { AppDialog } from '../../ui/AppDialog';
import {
  Action,
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
import { getOfficeDetails, getOfficeLocationReference } from '../offices/service';
import { OfficeDetailsView, OfficeTenantList } from '../offices/OfficeDetails';
import { FoodHoursView, FoodSourceDisclosure, ResearchMenu } from '../food/ResearchDetails';
import { PlaceCover } from './PlaceIdentity';
import { PreviewSources } from './PreviewSources';
import { INTERNAL_PREVIEW_ENABLED, previewDetails } from '../../preview/directory';
import { previewImage, foodImageKey } from '../../preview/media';

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

/** Preview enrichment is presentation only; canonical approvals and entrance gates stay intact. */
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
  const reference = getOfficeLocationReference(place.id);
  if (place.category === 'office' && !reference && (!place.preview || getOfficeDetails(place.id)))
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
  const officePreview = previewDetails(place.id)?.office;
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
      <PlaceCover place={place} />
      <View style={styles.identityCard}>
        {INTERNAL_PREVIEW_ENABLED ? <Image source={previewImage(restaurantLike ? 'mark-dining' : 'mark-city')} style={{width:56,height:56,borderRadius:12}} accessibilityLabel={restaurantLike ? 'Original dining graphic' : 'Original city graphic'} /> : <CategoryArtwork category={place.category} size={56} />}
        <View style={styles.metadata}>
          <Text style={styles.placeName}>{place.name}</Text>
          {sample || !INTERNAL_PREVIEW_ENABLED || place.status === 'stale' ? <Text style={styles.metadataText}>{sample ? 'Fictional sample' : place.status === 'candidate' ? 'Recorded candidate' : place.status === 'stale' ? 'Record needs review' : 'Reviewed record'}</Text> : null}
        </View>
      </View>
      {place.category === 'Building' ? (
        <OfficeTenantList buildingId={place.id} places={places} onChoose={onChoose} />
      ) : null}
      <View style={styles.overview}>
        {place.description ? <Body>{place.description}</Body> : null}
        {officePreview?.address ? <Body>{officePreview.address}</Body> : null}
        {officePreview?.industry ? <Body muted>{officePreview.industry}</Body> : null}
        <Body muted>{[place.category === 'office' ? 'Company' : place.category, place.building,
          place.floor ? `Floor ${place.floor}` : null].filter(Boolean).join(' · ')}</Body>
        {place.status === 'stale' ? <Body muted>Information may have changed.</Body> : null}
        {place.locationKind === 'building-anchor' ? <Body muted>Approximate building location; not a pedestrian entrance.</Body> : null}
        {!place.coordinate && !sample ? <Body muted>Map location is unavailable.</Body> : null}
        {reference ? <><Body>{reference.address}</Body><Body muted>{reference.notice}</Body><CitationList citations={reference.citations} /></> : null}
        {demo ? <><Notice>{demo.notice}</Notice><Body muted>{demo.locationNotice}</Body></> : null}
      </View>
      {demo?.hours ? (
        <DetailSection title="Operating hours" icon="clock">
          <Body>{demo.hours}</Body>
        </DetailSection>
      ) : null}
      {!demo?.hours && !research && restaurantLike ? <DetailSection title="Operating hours" icon="clock"><Body muted>Hours not available.</Body></DetailSection> : null}
      {research ? (
        <>
          <DetailSection title="Operating hours" icon="clock">
            <FoodHoursView hours={research.hours} />
          </DetailSection>
          <DetailSection title="Menu" icon="menu" summary={String(research.menuItemCount)}>
            <Action label="Menu" icon="menu" onPress={() => setMenuOpen(true)} />
          </DetailSection>
          <FoodSourceDisclosure evidence={foodResearch.getFoodResearchEvidence(research.id)} />
        </>
      ) : null}
      {menus.length ? (
        <DetailSection title="Menu or products" icon="menu" summary={String(menus.length)}>
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
      {!research && !reference ? <CitationList citations={place.citations} /> : null}
      <PreviewSources id={place.id} />
      {research || menus.length || restaurantLike ? (
        <AppDialog
          visible={menuOpen}
          title={`${place.name} menu`}
          description={
            research
              ? 'Menu'
              : sample ? 'Fictional example menu' : 'Recorded menu'
          }
          actions={[{ label: 'Close', onPress: () => setMenuOpen(false) }]}
          onDismiss={() => setMenuOpen(false)}
        >
          {research ? (
            <>
              <ResearchMenu key={research.id} restaurantId={research.id} />
              <FoodSourceDisclosure evidence={foodResearch.getFoodResearchEvidence(research.id)} />
            </>
          ) : menus.length ? (
            menus.map((item) => (
              <View key={item.id} style={styles.menuItem}>
                {INTERNAL_PREVIEW_ENABLED ? <Image source={previewImage(foodImageKey(item.name))} style={{width:'100%',height:145,borderRadius:10}} accessibilityLabel={`Illustrative photograph of ${item.name}`} /> : null}
                <Text style={styles.itemName}>{item.name}</Text>
                {supported(item.priceCitation) && (item.price || item.priceValue) ? (
                  <Body>
                    {item.price ?? `${item.priceValue?.currency} ${item.priceValue?.amount}`}
                  </Body>
) : null}
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
  details: { gap: 8 },
  identityCard: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: '#ECF1E7', marginBottom: 4 },
  placeName: { fontFamily: 'OmniHeading', fontSize: 20, lineHeight: 27, color: palette.ink },
  overview: { paddingBottom: 8, gap: 4 },
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
  itemName: { fontFamily: 'OmniBodySemiBold', fontSize: 16, lineHeight: 23, color: palette.ink },
  citation: { gap: 3, paddingVertical: 6 },
});
