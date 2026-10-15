import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Citation, Place } from '../../contracts';
import { CategoryArtwork, Icon, palette } from '../../ui/components';
import type { AssistantActions, AssistantPayload } from './contracts';
import { assistantStyles as s } from './styles';
import { isDemoPlace } from '../explore/demoDirectory';
import { WALKING_DIRECTIONS_DEFERRED, VISIT_PLANNING_DEFERRED } from './directory';
import { FoodHoursView, FoodMenuRow, FoodSourceDisclosure } from '../food/ResearchDetails';
import { foodResearch } from '../food/directory';

export function SourceDisclosure({
  citations,
  status,
  subject,
}: {
  citations: Citation[];
  status?: Place['status'];
  subject?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const sourceCount = new Set(citations.map((citation) => citation.sourceId)).size;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} source details${subject ? ` for ${subject}` : ''}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={s.disclosureButton}
      >
        <Icon name="info" size={15} color={palette.muted} />
        <Text style={s.disclosureText}>
          {citations.length
            ? `${status ?? 'Recorded'} · ${sourceCount} source${sourceCount === 1 ? '' : 's'}`
            : `${status ?? 'Recorded'} · No sources`}
        </Text>
        <Icon name={expanded ? 'up' : 'down'} size={14} color={palette.muted} />
      </Pressable>
      {expanded ? (
        <View style={s.evidence}>
          {status ? <Text style={s.caption}>Record status: {status}</Text> : null}
          {citations.length ? (
            citations.map((citation, index) => (
              <View key={`${citation.sourceId}:${index}`} style={s.evidenceItem}>
                <Text style={s.body}>{citation.label}</Text>
                <Text style={s.caption}>
                  {citation.status} · {citation.license}
                </Text>
                <Text style={s.caption}>
                  Observed {citation.observedAt} · Verified {citation.verifiedAt ?? 'Not recorded'}
                </Text>
                <Text style={s.caption}>Source: {citation.sourceId}</Text>
                {citation.locator ? (
                  <Text selectable style={s.caption}>
                    {citation.locator}
                  </Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={s.caption}>There is no supporting citation in this local record.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
function MapButton({
  label = 'View on Map',
  accessibilityLabel = label,
  onPress,
}: {
  label?: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [s.mapButton, pressed && { opacity: 0.7 }]}
    >
      <Text style={s.mapButtonText}>{label}</Text>
    </Pressable>
  );
}

export function PlaceCard({
  place,
  onOpenPlace,
  distanceM,
}: {
  place: Place;
  onOpenPlace: AssistantActions['onOpenPlace'];
  distanceM?: number;
}) {
  const sample = isDemoPlace(place) && place.coordinate === null;
  const mapped = place.coordinate !== null;
  const research = foodResearch.getFoodEstablishmentDetails(place.id);
  return (
    <View style={s.card}>
      <View style={s.placeRow}>
        <View
          style={s.placeArtwork}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <CategoryArtwork category={place.category} size={30} />
        </View>
        <View style={s.placeBody}>
          <Text style={s.heading}>{place.name}</Text>
          <Text style={s.caption}>
            {[
              place.category.replace(/[_-]/g, ' '),
              place.building,
              place.floor ? `Floor ${place.floor}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {sample ? (
            <Text style={s.sampleLabel}>Fictional sample · No map location</Text>
          ) : !mapped ? (
            <Text style={s.caption}>Map location unavailable</Text>
          ) : null}
          {!sample &&
          mapped &&
          distanceM !== undefined &&
          Number.isFinite(distanceM) &&
          distanceM >= 0 ? (
            <Text style={s.caption}>{Math.round(distanceM)} m</Text>
          ) : null}
        </View>
        <MapButton
          label={sample ? 'View sample' : mapped ? 'View on Map' : 'View details'}
          accessibilityLabel={
            sample
              ? `View sample ${place.name}`
              : mapped
                ? `View ${place.name} on Map`
                : `View details for ${place.name}`
          }
          onPress={() => onOpenPlace(place)}
        />
      </View>
      <View style={s.placeEvidence}>
        {research ? (
          <FoodSourceDisclosure evidence={foodResearch.getFoodResearchEvidence(place.id)} />
        ) : (
          <SourceDisclosure
            citations={place.citations}
            status={place.status}
            subject={place.name}
          />
        )}
      </View>
    </View>
  );
}

export function MessageContent({
  payload,
  places,
  actions,
}: {
  payload: AssistantPayload;
  places: Place[];
  actions: AssistantActions;
}) {
  const resolve = (id: string) => places.find((place) => place.id === id);
  switch (payload.kind) {
    case 'user':
      return (
        <View style={s.userRow}>
          <View style={s.userBubble}>
            <Text accessibilityLabel={`You: ${payload.text}`} style={s.userText}>
              {payload.text}
            </Text>
          </View>
        </View>
      );
    case 'text':
      return (
        <View style={s.assistantBubble}>
          <Text accessibilityLabel={`Assistant: ${payload.text}`} style={s.body}>
            {payload.text}
            {payload.partial ? '…' : ''}
          </Text>
        </View>
      );
    case 'places': {
      const matches = payload.placeIds.flatMap((id) => {
        const place = resolve(id);
        return place ? [place] : [];
      });
      if (!matches.length)
        return (
          <View style={s.inlineNotice}>
            <Text style={s.body}>
              These places are no longer in the local directory. Search again to see the latest
              installed records.
            </Text>
          </View>
        );
      return (
        <View style={s.collection}>
          <Text style={s.collectionTitle}>
            {payload.title} · {payload.total}
          </Text>
          {matches.map((place) => (
            <PlaceCard key={place.id} place={place} onOpenPlace={actions.onOpenPlace} />
          ))}
          {payload.total > payload.placeIds.length ? (
            <Text style={s.caption}>
              Showing the first {payload.placeIds.length}. Search a name to narrow your results.
            </Text>
          ) : null}
        </View>
      );
    }
    case 'place': {
      const place = resolve(payload.placeId);
      return place ? (
        <PlaceCard place={place} distanceM={payload.distanceM} onOpenPlace={actions.onOpenPlace} />
      ) : (
        <Text style={s.body}>This place is no longer in the local directory.</Text>
      );
    }
    case 'food-hours':
      return (
        <View style={[s.card, s.cardBody]}>
          <Text style={s.heading}>{payload.restaurantName}</Text>
          <FoodHoursView hours={payload.hours} />
          <FoodSourceDisclosure evidence={payload.evidence} />
        </View>
      );
    case 'food-menus':
      return (
        <View style={s.collection}>
          <Text style={s.collectionTitle}>
            {payload.title} · {payload.total}
          </Text>
          {payload.items.map(({ placeId, restaurantName, item, evidence }) => (
            <View key={item.id} style={[s.card, s.cardBody]}>
              <Text style={s.eyebrow}>{restaurantName}</Text>
              <FoodMenuRow item={item} evidence={evidence} />
              {resolve(placeId) ? (
                <MapButton
                  label="View details"
                  onPress={() => actions.onOpenPlace(resolve(placeId)!)}
                />
              ) : null}
            </View>
          ))}
          {payload.total > payload.items.length ? (
            <Text style={s.caption}>
              Showing the first {payload.items.length}. Add a restaurant or dish name to narrow your
              search.
            </Text>
          ) : null}
        </View>
      );
    case 'menus':
      return (
        <View style={s.collection}>
          <Text style={s.collectionTitle}>
            {payload.title} · {payload.total}
          </Text>
          {payload.items.map(({ placeId, item }) => {
            const place = resolve(placeId);
            return (
              <View key={`${placeId}:${item.id}`} style={[s.card, s.cardBody]}>
                <Text style={s.eyebrow}>{place?.name ?? 'Branch unavailable'}</Text>
                <Text style={s.heading}>{item.name}</Text>
                {place && isDemoPlace(place) ? (
                  <Text style={s.sampleLabel}>
                    Fictional sample menu · Prices and recipes are examples
                  </Text>
                ) : null}
                {(item.priceCitation?.status === 'approved' ||
                  (place &&
                    isDemoPlace(place) &&
                    item.priceCitation?.verificationMethod === 'synthetic-preview' &&
                    item.priceCitation.sourceId === 'OMNI-UX-V2-FICTIONAL-PREVIEW')) &&
                (item.price || item.priceValue) ? (
                  <Text style={s.body}>
                    {item.price ?? `${item.priceValue?.currency} ${item.priceValue?.amount}`}
                  </Text>
                ) : (
                  <Text style={s.caption}>Price not recorded</Text>
                )}
                {(item.tagCitation?.status === 'approved' ||
                  (place &&
                    isDemoPlace(place) &&
                    item.tagCitation?.verificationMethod === 'synthetic-preview' &&
                    item.tagCitation.sourceId === 'OMNI-UX-V2-FICTIONAL-PREVIEW')) &&
                item.tags?.length ? (
                  <Text style={s.caption}>{item.tags.join(' · ')}</Text>
                ) : null}
                {item.tagCitation?.status === 'approved' && item.allergens?.length ? (
                  <Text style={s.caption}>Recorded allergens: {item.allergens.join(', ')}</Text>
                ) : null}
                {item.checkedAt ? <Text style={s.caption}>Checked {item.checkedAt}</Text> : null}
                {place ? (
                  <MapButton
                    label={
                      isDemoPlace(place) && place.coordinate === null
                        ? 'View sample'
                        : place.coordinate
                          ? 'View on Map'
                          : 'View details'
                    }
                    accessibilityLabel={
                      isDemoPlace(place) && place.coordinate === null
                        ? `View sample ${place.name}`
                        : place.coordinate
                          ? `View ${place.name} on Map`
                          : `View details for ${place.name}`
                    }
                    onPress={() => actions.onOpenPlace(place)}
                  />
                ) : null}
                <SourceDisclosure
                  citations={[
                    item.citation,
                    ...(item.priceCitation ? [item.priceCitation] : []),
                    ...(item.tagCitation ? [item.tagCitation] : []),
                  ]}
                />
              </View>
            );
          })}
          {payload.total > payload.items.length ? (
            <Text style={s.caption}>
              Showing the first {payload.items.length} items. Add a place or dish name to narrow
              your search.
            </Text>
          ) : null}
        </View>
      );
    // Future payloads may still be read, but cannot reactivate deferred UI.
    case 'route':
      return (
        <View style={s.inlineNotice}>
          <Text style={s.body}>{WALKING_DIRECTIONS_DEFERRED}</Text>
        </View>
      );
    case 'itinerary':
      return (
        <View style={s.inlineNotice}>
          <Text style={s.body}>{VISIT_PLANNING_DEFERRED}</Text>
        </View>
      );
    case 'evidence':
      return (
        <View style={[s.card, s.cardBody]}>
          <Text style={s.heading}>{payload.title}</Text>
          <SourceDisclosure citations={payload.citations} />
        </View>
      );
    case 'status':
      return (
        <View style={[s.inlineNotice, payload.severity === 'error' && s.errorNotice]}>
          <Text accessibilityLiveRegion="polite" style={s.body}>
            {payload.text}
          </Text>
        </View>
      );
    case 'capability':
      return (
        <View style={s.inlineNotice}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="info" size={18} color={palette.muted} />
            <Text style={s.collectionTitle}>{capabilityLabels[payload.state]}</Text>
          </View>
          <Text accessibilityLiveRegion="polite" style={s.body}>
            {payload.text}
          </Text>
        </View>
      );
  }
}
const capabilityLabels = {
  'model-unavailable': 'AI not connected',
  'model-not-installed': 'AI not installed',
  loading: 'Checking local records',
  generating: 'Working',
  cancelled: 'Search cancelled',
  offline: 'Available offline',
  'retrieval-unavailable': 'Local directory unavailable',
  'unsupported-query': 'Information unavailable',
  'citation-missing': 'Source details unavailable',
  'structured-result': 'Local results',
  'partial-message': 'Response in progress',
};
