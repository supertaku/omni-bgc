import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, palette } from '../../ui/components';
import type { FoodEvidence, FoodHours, FoodMenuItem } from './contracts';
import { displayFoodPrice } from './service';
import { foodResearch } from './directory';
import { restaurantHoursLines } from './presentation';

export function FoodSourceDisclosure({ evidence }: { evidence: FoodEvidence | null }) {
  const [open, setOpen] = useState(false);
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${open ? 'Hide' : 'Show'} sources and details`}
      accessibilityState={{ expanded: open }} onPress={() => setOpen(v => !v)}
      style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={{ color: palette.muted, fontFamily: 'OmniBodySemiBold', fontSize: 14 }}>Sources & details {open ? '−' : '+'}</Text>
    </Pressable>
    {open && evidence ? <View style={{ gap: 4 }}>
      <Body muted>{evidence.status}</Body>
      <Body muted>Research date: {evidence.researchDate ?? 'Not recorded'}</Body>
      {evidence.branch ? <Body muted>Menu reference: {evidence.branch}</Body> : null}
      {evidence.priceEvidence ? <Body muted>Price evidence: {evidence.priceEvidence.replace(/-/g, ' ')}</Body> : null}
      {evidence.estimationBasis ? <Body muted>Recorded estimate basis: {evidence.estimationBasis}</Body> : null}
      {evidence.hours?.venueText ? <Body muted>Venue reference hours: {evidence.hours.venueText}. These do not establish restaurant hours.</Body> : null}
      {evidence.hours?.text && evidence.hours.kind !== 'restaurant' ? <Body muted>{evidence.hours.kind} schedule: {evidence.hours.text}</Body> : null}
      {evidence.urls.map(url => <Text selectable key={url} style={{ color: palette.muted, fontFamily: 'OmniBody', fontSize: 13 }}>{url}</Text>)}
      <Body muted>Internal research · rights review pending. Recorded menus may be incomplete; branch availability and holiday schedules may change.</Body>
    </View> : null}
  </View>;
}
export function FoodHoursView({ hours }: { hours: FoodHours }) {
  return <View style={{ gap: 4 }}>{restaurantHoursLines(hours).map(line => <Body key={line}>{line}</Body>)}</View>;
}
export function FoodMenuRow({ item }: { item: FoodMenuItem; evidence: FoodEvidence | null }) {
  const price = displayFoodPrice(item);
  const tags = [...new Set([item.category, ...item.tags].filter(Boolean))].join(' · ');
  return <View style={{ paddingVertical: 12, gap: 4, borderBottomWidth: 1, borderColor: palette.divider }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <Text style={{ flex: 1, fontFamily: 'OmniBodySemiBold', color: palette.ink, fontSize: 16 }}>{item.name}</Text>
      {price ? <Body>{price}</Body> : null}
    </View>
    {item.description ? <Body>{item.description}</Body> : null}
    {tags ? <Body muted>{tags}</Body> : null}
  </View>;
}
export function ResearchMenu({ restaurantId }: { restaurantId: string }) {
  const [visible, setVisible] = useState(20);
  const r = foodResearch.restaurants.find(row => row.id === restaurantId);
  if (!r) return null;
  return <View>
    {r.items.some(item => displayFoodPrice(item) === null) ? <Body muted>Item prices unavailable{r.items.some(item => displayFoodPrice(item) !== null) ? ' for some items' : ''}.</Body> : null}
    {!r.items.length ? <Body>Menu information is not yet available.</Body> : r.items.slice(0, visible).map((item, index) => <View key={item.id}>
      {index === 0 || (item.section ?? item.category) !== (r.items[index - 1].section ?? r.items[index - 1].category)
        ? <Text accessibilityRole="header" style={{ fontFamily: 'OmniBodySemiBold', color: palette.ink, fontSize: 16, marginTop: 12 }}>{item.section ?? item.category ?? 'Other recorded items'}</Text> : null}
      <FoodMenuRow item={item} evidence={foodResearch.getFoodResearchEvidence(item.id)} />
    </View>)}
    {visible < r.items.length ? <Pressable accessibilityRole="button" accessibilityLabel="Show more recorded menu items" onPress={() => setVisible(v => v + 20)} style={{ minHeight: 48, justifyContent: 'center' }}><Body>Show more ({r.items.length - visible} remaining)</Body></Pressable> : null}
  </View>;
}
