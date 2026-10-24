import { FoodHoursView } from '../food/ResearchDetails';
import { Image, Pressable, Text, View } from 'react-native';
import type { Citation, Place } from '../../contracts';
import type { AssistantActions, AssistantPayload, PlaceDisplaySnapshot, PlaceDetailFocus } from './contracts';
import { assistantStyles as s } from './styles';
import { isDemoPlace } from '../explore/demoDirectory';
import { WALKING_DIRECTIONS_DEFERRED, VISIT_PLANNING_DEFERRED } from './directory';
import { displayFoodPrice } from '../food/service';
import { CategoryArtwork, Icon } from '../../ui/components';
import { highlightSegments } from './inlineHighlights';
import { INTERNAL_PREVIEW_ENABLED, canonicalPreviewId, resolvePreviewPlace } from '../../preview/directory';
import { previewImage, placeImageKey, foodImageKey } from '../../preview/media';
import { isRetiredChatNotice, locationPrecisionLabel } from './detailPresentation';

/** Menu rows still open through the conversation's fresh-ID guard. */
function ResultName({
  name,
  index,
  place,
  onOpenPlace,
}: {
  name: string;
  index: number;
  place?: Place;
  onOpenPlace: AssistantActions['onOpenPlace'];
}) {
  const label = `${index + 1}. ${name}`;
  return place ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${name}`}
      accessibilityHint="Opens this place's details"
      onPress={() => onOpenPlace(place)}
      style={s.resultNameButton}
    >
      <Text style={s.resultOrdinal}>{index + 1}</Text>
      <Text style={[s.body, s.resultLink, s.resultNameText]}>{name}</Text>
      <Icon name="chevron" size={16} color="#245EA6" />
    </Pressable>
  ) : (
    <Text style={[s.body, s.inlinePlace]}>{label}</Text>
  );
}

function AnswerHeading({ title, count }: { title: string; count?: number }) {
  return (
    <View style={s.answerHeading}>
      <Text accessibilityRole="header" style={s.answerTitle}>
        {title}
      </Text>
      {count !== undefined ? (
        <Text style={s.answerCount}>
          {count} {count === 1 ? 'result' : 'results'}
        </Text>
      ) : null}
    </View>
  );
}

const supportedFact = (sample: boolean, citation?: Citation) =>
  citation?.status === 'approved' ||
  (sample &&
    citation?.verificationMethod === 'synthetic-preview' &&
    citation.sourceId === 'OMNI-UX-V2-FICTIONAL-PREVIEW');

/** Shared recorded-result row; interaction still uses fresh record resolution. */
export function PlaceCard({
  place,
  display,
  onOpenPlace,
  index = 0,
}: {
  place?: Place;
  display?: PlaceDisplaySnapshot;
  onOpenPlace: AssistantActions['onOpenPlace'];
  distanceM?: number;
  index?: number;
}) {
  const name = display?.name ?? place?.name ?? 'Place unavailable';
  const category = display?.category ?? place?.category ?? '';
  const building = display ? display.building : place?.building;
  const floor = display ? display.floor : place?.floor;
  const sample = display?.fictionalSample ?? (!!place && isDemoPlace(place));
  const status = display?.status ?? place?.status;
  const locationLabel = sample ? null : locationPrecisionLabel(place);
  const content = (
    <>
      <View style={s.placeCardTop}>
        <View style={s.placeArtFrame}>
          {INTERNAL_PREVIEW_ENABLED ? <Image source={previewImage(place?.imageKey ?? placeImageKey(category))} style={{width:52,height:52,borderRadius:12}} accessibilityLabel={`${category} illustration`} /> : <CategoryArtwork category={category} size={52} />}
          <Text accessible={false} style={s.placeOrdinal}>
            {index + 1}
          </Text>
        </View>
        <View style={s.placeCardBody}>
          <Text style={s.placeCardName}>{name}</Text>
          {category ? (
            <View style={s.placePills}>
              <Text style={s.categoryPill}>{category.replace(/[_-]/g, ' ')}</Text>
            </View>
          ) : null}
        </View>
        {place ? <Icon name="chevron" size={18} color="#245EA6" /> : null}
      </View>
      {building || floor ? (
        <View style={s.placeLocation}>
          <Icon name="location" size={15} color="#405B79" />
          <Text style={s.placeLocationText}>
            {[building, floor ? `Floor ${floor}` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : null}
      <View style={s.placePills}>
        {locationLabel ? <Text style={s.resultStatus}>{locationLabel}</Text> : null}
        {sample ? <Text style={s.resultStatus}>Fictional example</Text> : null}
        {!INTERNAL_PREVIEW_ENABLED && !sample && status === 'candidate' ? (
          <Text style={s.resultStatus}>Recorded candidate</Text>
        ) : null}
        {!INTERNAL_PREVIEW_ENABLED && !sample && status === 'approved' ? (
          <Text style={s.approvedPill}>Approved record</Text>
        ) : null}
        {status === 'stale' ? <Text style={s.resultStatus}>Details may have changed</Text> : null}
      </View>
    </>
  );
  return place ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        `Result ${index + 1}: ${name}`,
        category,
        building,
        floor ? `Floor ${floor}` : null,
        locationLabel,
        sample
          ? 'Fictional example'
          : !INTERNAL_PREVIEW_ENABLED && status === 'candidate'
            ? 'Recorded candidate'
            : !INTERNAL_PREVIEW_ENABLED && status === 'approved'
              ? 'Approved record'
              : null,
        status === 'stale' ? 'Details may have changed' : null,
      ]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint="Opens this place's current details"
      onPress={() => onOpenPlace(place)}
      style={({ pressed }) => [s.placeResultCard, pressed && s.placeCardPressed]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={s.placeResultCard}>{content}</View>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <View style={s.detailField}>
    <Text style={s.detailLabel}>{label}</Text>
    <Text selectable style={s.detailValue}>{value}</Text>
  </View>;
}

/** Field selection comes from the question; every displayed value comes from a source record. */
function PlaceDetailAnswer({ place, display, focus = 'overview', address, onOpenPlace }: {
  place?: Place;
  display?: PlaceDisplaySnapshot;
  focus?: PlaceDetailFocus;
  address?: string;
  onOpenPlace: AssistantActions['onOpenPlace'];
}) {
  const record = display ?? place;
  if (!record) return null;
  const description = record.description;
  const labels: Record<PlaceDetailFocus, string> = {
    overview: 'Place details', location: 'Location', floor: 'Floor', description: 'About this place', category: 'Place type',
  };
  return <View style={s.detailCard}>
    <View style={s.detailRibbon}>
      <Icon name={focus === 'floor' || focus === 'location' ? 'location' : 'info'} size={16} color="#FFFFFF" />
      <Text style={s.detailRibbonText}>{labels[focus]}</Text>
    </View>
    <View style={s.detailHero}>
      {INTERNAL_PREVIEW_ENABLED
        ? <Image source={previewImage(placeImageKey(record.category))} style={s.detailThumb} accessibilityLabel={`${record.category} illustration`} />
        : <CategoryArtwork category={record.category} size={80} />}
      <View style={s.placeCardBody}>
        <Text accessibilityRole="header" style={s.detailName}>{record.name}</Text>
        <View style={s.placePills}><Text style={s.categoryPill}>{record.category.replace(/[_-]/g, ' ')}</Text></View>
      </View>
    </View>
    {focus === 'floor' ? <DetailField label="FLOOR" value={record.floor || 'The floor is not recorded for this place.'} /> : null}
    {focus === 'location' || focus === 'overview' ? <DetailField label={address ? 'ADDRESS' : 'LOCATION'} value={address || [record.building, record.floor ? `Floor ${record.floor}` : null].filter(Boolean).join(' · ') || 'A street address or building is not recorded.'} /> : null}
    {(focus === 'location' || focus === 'overview') && locationPrecisionLabel(place) ? <Text style={s.resultMeta}>{locationPrecisionLabel(place)}</Text> : null}
    {focus === 'category' ? <DetailField label="PLACE TYPE" value={record.category.replace(/[_-]/g, ' ')} /> : null}
    {focus === 'description' || focus === 'overview' ? <View style={s.detailDescription}>
      <Text style={s.detailLabel}>ABOUT</Text>
      <Text selectable style={s.body}>{description || 'A description isn’t available in this reply.'}</Text>
    </View> : null}
    {place ? <Pressable accessibilityRole="button" accessibilityLabel={`Open full details for ${record.name}`} onPress={() => onOpenPlace(place)} style={s.detailOpen}>
      <Text style={s.detailOpenText}>Open place</Text><Icon name="chevron" size={17} color="#245EA6" />
    </Pressable> : null}
  </View>;
}

export function MessageContent({
  payload,
  places,
  displayPlaces = [],
  actions,
}: {
  payload: AssistantPayload;
  places: Place[];
  displayPlaces?: PlaceDisplaySnapshot[];
  actions: AssistantActions;
}) {
  if (isRetiredChatNotice(payload)) return null;
  const resolve = (id: string) => places.find((place) => place.id === canonicalPreviewId(id)) ?? resolvePreviewPlace(id) ?? undefined;
  const resolveDisplay = (id: string) => displayPlaces.find((place) => place.id === id);
  switch (payload.kind) {
    case 'user':
      return (
        <View style={s.userRow}>
          <Text accessibilityLabel={`You: ${payload.text}`} style={[s.userBubble, s.userText]}>
            {payload.text}
          </Text>
        </View>
      );
    case 'text':
      return (
        <Text accessibilityLabel={`Assistant: ${payload.text}`} style={s.body}>
          {highlightSegments(payload.text, [
            ...displayPlaces.map((place) => place.name),
            ...places.map((place) => place.name),
          ]).map((segment, index) => (
            <Text
              key={index}
              style={
                segment.kind === 'place'
                  ? s.inlinePlace
                  : segment.kind === 'category'
                    ? s.inlineCategory
                    : undefined
              }
            >
              {segment.text}
            </Text>
          ))}
          {payload.partial ? '…' : ''}
        </Text>
      );
    case 'places': {
      const matches = payload.placeIds.flatMap((id) => {
        const place = resolve(id);
        const display = resolveDisplay(id);
        return place || display ? [{ place, display }] : [];
      });
      return (
        <View style={s.collection}>
          <AnswerHeading title={payload.title} count={matches.length} />
          {!matches.length ? (
            <Text style={s.body}>Those places aren’t available anymore. Try another search.</Text>
          ) : null}
          {matches.map(({ place, display }, index) => (
            <PlaceCard
              key={place?.id ?? display?.id}
              place={place}
              display={display}
              index={index}
              onOpenPlace={actions.onOpenPlace}
            />
          ))}
          {payload.total > payload.placeIds.length ? (
            <Text style={s.caption}>There are more matches. Try a name to narrow it down.</Text>
          ) : null}
        </View>
      );
    }
    case 'place': {
      const place = resolve(payload.placeId);
      const display = resolveDisplay(payload.placeId);
      return place || display ? (
        <PlaceDetailAnswer place={place} display={display} focus={payload.detailFocus} address={payload.detailAddress} onOpenPlace={actions.onOpenPlace} />
      ) : (
        <Text style={s.body}>That place isn’t available anymore. Try its name again.</Text>
      );
    }
    case 'food-menus':
      return (
        <View style={s.collection}>
          <AnswerHeading title={payload.title} count={payload.items.length} />
          {payload.items.some(({ item }) => !displayFoodPrice(item)) ? (
            <Text style={s.caption}>Item prices unavailable.</Text>
          ) : null}
          {payload.items.map(({ placeId, restaurantName, item }, index) => (
            <View key={`${placeId}:${item.id}`} style={s.resultRow}>
              <View style={s.detailHero}>
                {INTERNAL_PREVIEW_ENABLED ? <Image source={previewImage(item.imageKey ?? foodImageKey(item.name))} style={s.detailThumb} accessibilityLabel={`Illustrative photograph of ${item.name}`} /> : null}
                <View style={s.placeCardBody}>
                  <ResultName name={item.name} index={index} place={resolve(placeId)} onOpenPlace={actions.onOpenPlace} />
                  <Text style={s.resultMeta}>{restaurantName}</Text>
                  {displayFoodPrice(item) ? <Text style={s.detailPrice}>{displayFoodPrice(item)}</Text> : null}
                </View>
              </View>
              {item.description ? <Text style={s.body}>{item.description}</Text> : null}
            </View>
          ))}
          {payload.total > payload.items.length ? (
            <Text style={s.caption}>
              There are more matches. Try a restaurant or dish name to narrow it down.
            </Text>
          ) : null}
        </View>
      );
    case 'menus':
      return (
        <View style={s.collection}>
          <AnswerHeading title={payload.title} count={payload.items.length} />
          {payload.items.map(({ placeId, item }, index) => {
            const place = resolve(placeId);
            const display = resolveDisplay(placeId);
            const sample = display?.fictionalSample ?? (!!place && isDemoPlace(place));
            return (
              <View key={`${placeId}:${item.id}`} style={s.resultRow}>
                {INTERNAL_PREVIEW_ENABLED ? <Image source={previewImage(foodImageKey(item.name))} style={{width:76,height:76,borderRadius:10}} accessibilityLabel={`Illustrative photograph of ${item.name}`} /> : null}
                <ResultName
                  name={item.name}
                  index={index}
                  place={place}
                  onOpenPlace={actions.onOpenPlace}
                />
                {display || place ? (
                  <Text style={[s.resultMeta, s.inlinePlace]}>{display?.name ?? place?.name}</Text>
                ) : null}
                <Text style={s.body}>
                  {supportedFact(sample, item.priceCitation) && (item.price || item.priceValue) ? (
                    <Text style={s.resultPrice}>
                      {item.price ?? `${item.priceValue?.currency} ${item.priceValue?.amount}`}
                    </Text>
                  ) : (
                    'Price not recorded'
                  )}
                </Text>
                {sample ? <Text style={s.resultStatus}>Fictional example menu</Text> : null}
                {item.citation.status === 'stale' ? (
                  <Text style={s.resultMeta}>Price and availability may have changed.</Text>
                ) : null}
                {supportedFact(sample, item.tagCitation) && item.tags?.length ? (
                  <Text style={s.resultMeta}>{item.tags.join(' · ')}</Text>
                ) : null}
                {item.tagCitation?.status === 'approved' && item.allergens?.length ? (
                  <Text style={s.resultMeta}>Recorded allergens: {item.allergens.join(', ')}</Text>
                ) : null}
              </View>
            );
          })}
          {payload.total > payload.items.length ? (
            <Text style={s.caption}>
              There are more matches. Try a place or dish name to narrow it down.
            </Text>
          ) : null}
        </View>
      );
    case 'food-hours': {
      const hours = payload.hours;
      return (
        <View style={s.collection}>
          <ResultName
            name={payload.restaurantName}
            index={0}
            place={resolve(payload.placeId)}
            onOpenPlace={actions.onOpenPlace}
          />
          <View style={s.detailField}><Text style={s.detailLabel}>HOURS</Text><FoodHoursView hours={hours} /></View>
        </View>
      );
    }
    case 'itinerary-preview':
      return (
        <View style={s.collection}>
          <Text style={s.body}>Here’s your temporary visit list.</Text>
          {payload.preview.stops.map((stop, index) => (
            <View key={`${stop.placeId}:${index}`} style={s.resultRow}>
              <ResultName
                name={stop.name}
                index={index}
                place={resolve(stop.placeId)}
                onOpenPlace={actions.onOpenPlace}
              />
              <Text style={s.resultMeta}>{stop.durationMinutes} minutes for your visit</Text>
            </View>
          ))}
          <Text style={s.body}>That’s {payload.preview.totalVisitMinutes} minutes of visits.</Text>
          <Text style={s.caption}>
            For this session only. Not saved. Travel time and route directions aren’t included.
          </Text>
        </View>
      );
    case 'route':
      return <Text style={s.body}>{WALKING_DIRECTIONS_DEFERRED}</Text>;
    case 'itinerary':
      return <Text style={s.body}>{VISIT_PLANNING_DEFERRED}</Text>;
    case 'evidence':
      return null;
    case 'status':
      return (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.body, payload.severity === 'error' && s.errorText]}
        >
          {payload.text}
        </Text>
      );
    case 'capability':
      return (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {payload.text}
        </Text>
      );
  }
}
