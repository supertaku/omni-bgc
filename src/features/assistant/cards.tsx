import { Pressable, Text, View } from 'react-native';
import type { Citation, Place } from '../../contracts';
import type { AssistantActions, AssistantPayload, PlaceDisplaySnapshot } from './contracts';
import { assistantStyles as s } from './styles';
import { isDemoPlace } from '../explore/demoDirectory';
import { WALKING_DIRECTIONS_DEFERRED, VISIT_PLANNING_DEFERRED } from './directory';
import { formatFoodPrice } from '../food/service';
import { CitationList } from '../../ui/components';

/** Only the name is interactive; opening still goes through the conversation's fresh-ID guard. */
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
      <Text style={[s.body, s.resultLink]}>{label}</Text>
    </Pressable>
  ) : (
    <Text style={s.body}>{label}</Text>
  );
}

const supportedFact = (sample: boolean, citation?: Citation) =>
  citation?.status === 'approved' ||
  (sample &&
    citation?.verificationMethod === 'synthetic-preview' &&
    citation.sourceId === 'OMNI-UX-V2-FICTIONAL-PREVIEW');

/** Kept as the existing entry point; result presentation is now an ordinary text row. */
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
  const stale = (display?.status ?? place?.status) === 'stale';
  return (
    <View style={s.resultRow}>
      <ResultName name={name} index={index} place={place} onOpenPlace={onOpenPlace} />
      <Text style={s.resultMeta}>
        {[category.replace(/[_-]/g, ' '), building, floor ? `Floor ${floor}` : null]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {sample ? <Text style={s.resultMeta}>Fictional example</Text> : null}
      {stale ? <Text style={s.resultMeta}>These details may have changed.</Text> : null}
    </View>
  );
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
  const resolve = (id: string) => places.find((place) => place.id === id);
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
          {payload.text}
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
          <Text style={s.body}>
            {matches.length
              ? matches.length === 1
                ? 'Here’s one to check out.'
                : `Here are ${matches.length} places to check out.`
              : 'Those places aren’t available anymore. Try another search.'}
          </Text>
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
        <PlaceCard place={place} display={display} onOpenPlace={actions.onOpenPlace} />
      ) : (
        <Text style={s.body}>That place isn’t available anymore. Try its name again.</Text>
      );
    }
    case 'food-menus':
      return (
        <View style={s.collection}>
          <Text style={s.body}>Here are a few menu picks.</Text>
          <Text style={s.caption}>Prices and branch availability may differ.</Text>
          {payload.items.map(({ placeId, restaurantName, item }, index) => (
            <View key={`${placeId}:${item.id}`} style={s.resultRow}>
              <ResultName
                name={item.name}
                index={index}
                place={resolve(placeId)}
                onOpenPlace={actions.onOpenPlace}
              />
              <Text style={s.body}>
                {restaurantName} · {formatFoodPrice(item)}
              </Text>
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
          <Text style={s.body}>Here’s what I found on the menus.</Text>
          {payload.items.map(({ placeId, item }, index) => {
            const place = resolve(placeId);
            const display = resolveDisplay(placeId);
            const sample = display?.fictionalSample ?? (!!place && isDemoPlace(place));
            return (
              <View key={`${placeId}:${item.id}`} style={s.resultRow}>
                <ResultName
                  name={item.name}
                  index={index}
                  place={place}
                  onOpenPlace={actions.onOpenPlace}
                />
                {display || place ? (
                  <Text style={s.resultMeta}>{display?.name ?? place?.name}</Text>
                ) : null}
                <Text style={s.body}>
                  {supportedFact(sample, item.priceCitation) && (item.price || item.priceValue)
                    ? (item.price ?? `${item.priceValue?.currency} ${item.priceValue?.amount}`)
                    : 'Price not recorded'}
                </Text>
                {sample ? <Text style={s.resultMeta}>Fictional example menu</Text> : null}
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
          <Text style={s.body}>
            {hours.text ?? 'I don’t have recorded hours for this restaurant yet.'}
          </Text>
          {hours.text ? (
            <Text style={s.caption}>
              {hours.kind === 'delivery'
                ? 'These are delivery hours; dine-in hours may differ.'
                : hours.kind === 'ordering'
                  ? 'These are ordering hours; dine-in hours may differ.'
                  : hours.kind === 'unknown'
                    ? 'The schedule context isn’t confirmed.'
                    : 'These are recorded restaurant hours.'}
            </Text>
          ) : null}
          {hours.venueText ? (
            <Text style={s.caption}>
              Venue hours: {hours.venueText}. These don’t establish the restaurant’s hours.
            </Text>
          ) : null}
          <Text style={s.caption}>
            Check for holiday changes. These records can’t confirm what’s open right now.
          </Text>
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
      return <CitationList citations={payload.citations} />;
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
