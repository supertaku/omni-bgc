import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, palette } from '../../ui/components';
import type { FoodEvidence, FoodHours, FoodMenuItem } from './contracts';
import { formatFoodPrice } from './service';
import { foodResearch } from './directory';

export function FoodSourceDisclosure({ evidence }: { evidence: FoodEvidence | null }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Hide' : 'Show'} research sources`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <Text style={{ color: palette.muted, fontFamily: 'OmniBody' }}>
          Research sources {open ? '−' : '+'}
        </Text>
      </Pressable>
      {open && evidence ? (
        <View>
          <Body muted>{evidence.status}</Body>
          {evidence.priceEvidence ? (
            <Body muted>Price evidence: {evidence.priceEvidence.replace(/-/g, ' ')}</Body>
          ) : null}
          <Body muted>Research date: {evidence.researchDate ?? 'Not recorded'}</Body>
          {evidence.branch ? (
            <Body muted>Menu reference: {evidence.branch} · branch availability may differ</Body>
          ) : null}
          {evidence.estimationBasis ? (
            <Body muted>Estimate basis: {evidence.estimationBasis}</Body>
          ) : null}
          {evidence.urls.map((url) => (
            <Text
              selectable
              key={url}
              style={{ color: palette.muted, fontFamily: 'OmniBody', fontSize: 13 }}
            >
              {url}
            </Text>
          ))}
          <Body muted>Rights review pending · internal research</Body>
        </View>
      ) : null}
    </View>
  );
}

export function FoodHoursView({ hours }: { hours: FoodHours }) {
  return (
    <View style={{ gap: 6 }}>
      <Body>{hours.text ?? 'Restaurant hours not recorded.'}</Body>
      {hours.text ? (
        <Body muted>
          {hours.kind === 'delivery'
            ? 'Delivery listing hours; dine-in hours may differ.'
            : hours.kind === 'ordering'
              ? 'Ordering hours; dine-in hours may differ.'
              : hours.kind === 'unknown'
                ? 'Schedule context is unconfirmed.'
                : 'Recorded restaurant schedule.'}
        </Body>
      ) : null}
      {hours.venueText ? (
        <>
          <Body muted>Venue reference hours: {hours.venueText}</Body>
          <Body muted>Venue hours do not establish restaurant hours.</Body>
        </>
      ) : null}
      <Body muted>Check with the restaurant for today's hours and holiday changes.</Body>
    </View>
  );
}

export function FoodMenuRow({ item }: { item: FoodMenuItem; evidence: FoodEvidence | null }) {
  return (
    <View
      style={{ paddingVertical: 10, gap: 4, borderBottomWidth: 1, borderColor: palette.divider }}
    >
      <Text style={{ fontFamily: 'OmniBodySemiBold', color: palette.ink, fontSize: 16 }}>
        {item.name}
      </Text>
      <Body>{formatFoodPrice(item)}</Body>
      {item.description ? <Body>{item.description}</Body> : null}
      <Body muted>
        {[item.section, item.category, ...item.tags]
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(' · ')}
      </Body>
      {item.branch ? (
        <Body muted>Listed for {item.branch} · availability here may differ</Body>
      ) : null}
    </View>
  );
}

export function ResearchMenu({ restaurantId }: { restaurantId: string }) {
  const [visible, setVisible] = useState(20);
  const r = foodResearch.restaurants.find((r) => r.id === restaurantId);
  if (!r) return null;
  return (
    <View>
      {r.items.length ? (
        <Body muted>
          Some menu items may be missing. Prices and branch availability may differ.
        </Body>
      ) : null}
      {!r.items.length ? (
        <Body>Menu information is not yet available.</Body>
      ) : (
        r.items.slice(0, visible).map((item, index) => (
          <View key={item.id}>
            {index === 0 ||
            (item.section ?? item.category) !==
              (r.items[index - 1].section ?? r.items[index - 1].category) ? (
              <Body>{item.section ?? item.category ?? 'Other recorded items'}</Body>
            ) : null}
            <FoodMenuRow item={item} evidence={foodResearch.getFoodResearchEvidence(item.id)} />
          </View>
        ))
      )}
      {visible < r.items.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show more recorded menu items"
          onPress={() => setVisible((v) => v + 20)}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Body>Show more ({r.items.length - visible} remaining)</Body>
        </Pressable>
      ) : null}
    </View>
  );
}
