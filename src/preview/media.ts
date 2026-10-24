import type { ImageSourcePropType } from 'react-native';

/** Generic generated illustrations; never official venue photographs or trademarks. */
const images: Record<string, ImageSourcePropType> = {
  'cover-restaurant': require('../../assets/generated/preview-media/cover-restaurant.webp'),
  'cover-cafe': require('../../assets/generated/preview-media/cover-cafe.webp'),
  'cover-office': require('../../assets/generated/preview-media/cover-office.webp'),
  'cover-shop': require('../../assets/generated/preview-media/cover-shop.webp'),
  'cover-park': require('../../assets/generated/preview-media/cover-park.webp'),
  'cover-hotel': require('../../assets/generated/preview-media/cover-hotel.webp'),
  'cover-building': require('../../assets/generated/preview-media/cover-building.webp'),
  'cover-bakery': require('../../assets/generated/preview-media/cover-bakery.webp'),
  'dish-rice': require('../../assets/generated/preview-media/dish-rice.webp'),
  'dish-noodles': require('../../assets/generated/preview-media/dish-noodles.webp'),
  'dish-ramen': require('../../assets/generated/preview-media/dish-ramen.webp'),
  'dish-sushi': require('../../assets/generated/preview-media/dish-sushi.webp'),
  'dish-chicken': require('../../assets/generated/preview-media/dish-chicken.webp'),
  'dish-burger': require('../../assets/generated/preview-media/dish-burger.webp'),
  'dish-pizza': require('../../assets/generated/preview-media/dish-pizza.webp'),
  'dish-steak': require('../../assets/generated/preview-media/dish-steak.webp'),
  'dish-seafood': require('../../assets/generated/preview-media/dish-seafood.webp'),
  'dish-salad': require('../../assets/generated/preview-media/dish-salad.webp'),
  'dish-pastry': require('../../assets/generated/preview-media/dish-pastry.webp'),
  'dish-dessert': require('../../assets/generated/preview-media/dish-dessert.webp'),
  'dish-coffee': require('../../assets/generated/preview-media/dish-coffee.webp'),
  'dish-drink': require('../../assets/generated/preview-media/dish-drink.webp'),
  'mark-dining': require('../../assets/generated/preview-media/mark-dining.webp'),
  'mark-city': require('../../assets/generated/preview-media/mark-city.webp'),
};

export function previewImage(key: string | undefined): ImageSourcePropType {
  return images[key ?? ''] ?? images['cover-building']!;
}

export function placeImageKey(category: string): string {
  const text = category.toLowerCase();
  if (/bakery|bakehouse/.test(text)) return 'cover-bakery';
  if (/coffee|caf[eé]/.test(text)) return 'cover-cafe';
  if (/food|restaurant|dining|bar|eatery/.test(text)) return 'cover-restaurant';
  if (/office|company|business/.test(text)) return 'cover-office';
  if (/shop|mall|retail|store|market/.test(text)) return 'cover-shop';
  if (/park|garden|plaza/.test(text)) return 'cover-park';
  if (/hotel|lodging/.test(text)) return 'cover-hotel';
  return 'cover-building';
}

export function foodImageKey(value: string): string {
  const text = value.toLowerCase();
  if (/ramen/.test(text)) return 'dish-ramen';
  if (/sushi|maki|sashimi|nigiri/.test(text)) return 'dish-sushi';
  if (/noodle|pasta|spaghetti|pancit|udon|soba|pad thai|ramyun/.test(text)) return 'dish-noodles';
  if (/pizza|flatbread/.test(text)) return 'dish-pizza';
  if (/burger|sandwich/.test(text)) return 'dish-burger';
  if (/steak|ribeye|sirloin|beef|wagyu/.test(text)) return 'dish-steak';
  if (/fish|seafood|shrimp|prawn|salmon|tuna|lobster|squid/.test(text)) return 'dish-seafood';
  if (/salad|greens|vegetable|grain|tofu/.test(text)) return 'dish-salad';
  if (/chicken|wing|poultry/.test(text)) return 'dish-chicken';
  if (/cake|dessert|ice cream|sundae|halo.halo|brownie|pudding/.test(text)) return 'dish-dessert';
  if (/pastry|croissant|bread|bun|bakery|cookie|muffin|waffle/.test(text)) return 'dish-pastry';
  if (/coffee|latte|cappuccino|espresso|americano|mocha/.test(text)) return 'dish-coffee';
  if (/drink|tea|juice|cooler|lemonade|shake|smoothie|soda|water/.test(text)) return 'dish-drink';
  return 'dish-rice';
}

