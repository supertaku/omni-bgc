import type { Place, SavedState } from '../../contracts';
import type { AssistantPayload } from './contracts';
import { isDemoPlace } from '../explore/demoDirectory';

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const fillers = new Set(['a','an','and','any','are','at','bgc','by','can','could','find','for','give','i','in','is','me','my','of','on','please','show','some','the','to','want','what','where','with','you','your','places','place','search','browse','get','looking']);
const categoryWords: Record<string,string[]> = { coffee: ['coffee','cafe','café'], food: ['food','restaurant','restaurants','dining','eat'], shop: ['shop','shops','shopping','retail','mall'], park: ['park','parks','garden'], facility: ['facility','facilities','restroom','toilet','public'], hotel: ['hotel','hotels','accommodation'], transit: ['transit','bus','transport'] };
const category = (word: string) => Object.entries(categoryWords).find(([,words]) => words.includes(word))?.[0];
export function placeMatchesCategory(place: Place, requested: string): boolean {
  const value = normalize(place.category);
  return (categoryWords[requested] ?? [requested]).some(word => value.includes(normalize(word)));
}
const searchable = (place: Place) => normalize([place.name,place.category,place.building,place.floor,...place.aliases,...(place.cuisines??[]),...place.menus.map(item=>item.name)].filter(Boolean).join(' '));
const collection = (title: string, places: Place[]): AssistantPayload => ({kind:'places',title,placeIds:places.slice(0,12).map(place=>place.id),total:places.length});
const sampleEvidence=(place:Place,citation:Place['citations'][number]|undefined)=>isDemoPlace(place)&&citation?.sourceId==='OMNI-UX-V2-FICTIONAL-PREVIEW'&&citation.verificationMethod==='synthetic-preview';
const missing = (text: string): AssistantPayload[] => [{kind:'text',text}];
function centavos(value:string):bigint|null {
  if(!/^\d{1,12}(?:\.\d{1,2})?$/.test(value))return null;
  const [whole,fraction='']=value.split('.');return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}

/** Literal local search only. No model, inferred cuisine, distances, hours or itinerary planning. */
export function answerDirectoryQuery(query: string, places: readonly Place[], saved: SavedState): AssistantPayload[] {
  const text = normalize(query);
  if (/\b(itinerary|stops|plan|trip)\b/.test(text)) {
    if (/\b(make|create|generate|suggest|plan)\b/.test(text) && !/\b(my|saved|open|show)\b/.test(text)) return [{kind:'capability',state:'model-unavailable',text:'AI planning is not connected. You can build an itinerary by adding places on the map.'},{kind:'itinerary',saved}];
    return [{kind:'itinerary',saved}];
  }
  if (/\b(saved|bookmarks|favorites|favourites)\b/.test(text)) {
    const matches = saved.placeIds.flatMap(id=>{const place=places.find(p=>p.id===id);return place?[place]:[];});
    return matches.length ? [collection('Your saved places',matches)] : missing('Your saved list is empty. Open a place on the map and tap Save to keep it on this device.');
  }
  if (/\b(hours|open now|rating|ratings|review|reviews|parking availability|weather|busy|reservation)\b/.test(text)) return [{kind:'capability',state:'unsupported-query',text:'The local directory has no live availability, opening hours or reviews. Open a place to check its recorded details and sources.'}];
  const isRoute = /\b(route|directions|walk|navigate|get there|how to get)\b/.test(text);
  const isMenu = /\b(menu|menus|dish|dishes|under|budget|price|prices|allergen|allergens|vegan|vegetarian|gluten)\b/.test(text);
  const budgetMatch = query.match(/(?:under|below|budget(?:\s+of)?|less than)\s*(?:₱|PHP)?\s*(\d+(?:\.\d{1,2})?)(?![\d.])/i);
  const budget = budgetMatch ? centavos(budgetMatch[1]) : null;
  if(budgetMatch&&budget===null)return missing('Use a PHP budget with up to two decimal places.');
  const words = text.split(' ').filter(word=>!fillers.has(word));
  const ignored = new Set(['menu','menus','dish','dishes','under','below','budget','price','prices','php','route','directions','walk','navigate','how','there','than','less','allergen','allergens']);
  const terms = words.filter(word=>!ignored.has(word)&&!(budgetMatch&&/^\d+$/.test(word)));
  const requestedCategories = [...new Set(terms.map(category).filter((value): value is string=>!!value))];
  const literals = terms.filter(word=>!category(word));
  const named = places.filter(place=>[place.name,...place.aliases].some(name=>normalize(name)===terms.join(' ')));
  const matches = named.length?named:places.filter(place=>requestedCategories.every(value=>placeMatchesCategory(place,value)) && literals.every(word=>searchable(place).includes(word)));
  if (isRoute) {
    if(!terms.length)return missing('Choose a destination first. Try “Directions to” followed by a place or building name.');
    if (!matches.length) return missing('I couldn’t match that destination in the local directory. Try its place or building name.');
    if(isDemoPlace(matches[0])&&matches[0].coordinate===null)return [{kind:'route',placeId:matches[0].id,originLabel:'Fictional sample · No map location',result:{available:false,reason:'This fictional sample has no geographic location or walking entrance. Open a real mapped place for directions.'}}];
    return [{kind:'route',placeId:matches[0].id,originLabel:'Choose on Map',result:{available:false,reason:'Choose and confirm an origin on the map to calculate a walking route.'}},...(matches.length>1?[collection('Other matching destinations',matches.slice(1))]:[])];
  }
  if (isMenu) {
    // Item, price and dietary evidence remain attached to the original branch record.
    const items = places.flatMap(place=>place.menus.filter(item=> {
      if(item.citation.status==='candidate'&&!sampleEvidence(place,item.citation))return false;
      const branchText = searchable({...place,menus:[]});
      const itemText=normalize([item.name,...(item.tagCitation?.status==='approved'||sampleEvidence(place,item.tagCitation)?item.tags??[]:[])].join(' '));
      if(named.length){if(!named.some(match=>match.id===place.id))return false;}
      else if(!requestedCategories.every(value=>placeMatchesCategory(place,value)) || !literals.every(word=>branchText.includes(word)||itemText.includes(word)))return false;
      if(budget!==null){if(!item.priceValue||item.priceValue.currency!=='PHP'||!item.priceCitation||(item.priceCitation.status!=='approved'&&!sampleEvidence(place,item.priceCitation)))return false;const amount=centavos(item.priceValue.amount);if(amount===null||amount>budget)return false;}
      return true;
    }).map(item=>({placeId:place.id,item})));
    const hasSample=items.some(item=>isDemoPlace(item.placeId));
    return items.length ? [{kind:'text',text:hasSample?'Sample menu entries are fictional examples. Prices and recipes do not describe real BGC businesses.':budget===null?'These are the menu items recorded in the local directory.':'These recorded items have a supported PHP price within your budget.'},{kind:'menus',title:budget===null?'From the menu':`Within ₱${budgetMatch![1]}`,items:items.slice(0,12),total:items.length}] : missing('No matching menu items are recorded. Try a place name, or open its details to check available sources.');
  }
  if (!terms.length && !text) return missing('Try a place, building or dish name.');
  if (!matches.length) return missing('No matching places in the local directory. Try a shorter name or a category like coffee, food or parks.');
  return [{kind:'text',text:matches.length===1?'Here’s the matching place in your local directory.':`Found ${matches.length} matching places in your local directory.`},collection('Places to explore',matches)];
}
