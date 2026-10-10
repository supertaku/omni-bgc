/** Deterministic services over the same current, reviewed offline store used by the UI. */
import { MenuItem, Place } from '../contracts';
import { loadPlaces, searchPlaces } from './store';
import { UUID, lexicalQuery } from './parser';

export type PlaceFilters = { category?: string; query?: string };
export type MenuFilters = { branchId?: string; query?: string; maxPricePhp?: string; requiredTags?: readonly string[] };
export type BranchMenuItem = { branchId: string; branchName: string; item: MenuItem };
function identifier(id:string):void { if(!UUID.test(id))throw new Error('Invalid immutable entity ID'); }
function phpCentavos(value:string):bigint {
  if(typeof value!=='string'||!/^\d{1,12}(?:\.\d{1,2})?$/.test(value))throw new Error('Expected nonnegative PHP decimal amount');
  const [whole,fraction='']=value.split('.');return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}
export function filterMenuItems(places:readonly Place[],filters:MenuFilters={}):BranchMenuItem[]{
  if(filters.branchId!==undefined)identifier(filters.branchId);
  lexicalQuery(filters.query??'');
  const terms=(filters.query??'').normalize('NFC').match(/[\p{L}\p{N}]+/gu)?.slice(0,8).map(t=>t.slice(0,48).toLocaleLowerCase())??[];
  const budget=filters.maxPricePhp===undefined?null:phpCentavos(filters.maxPricePhp);
  if(filters.requiredTags?.some(t=>typeof t!=='string'||!t.trim()||t.length>80))throw new Error('Invalid explicit tag filter');
  const results:BranchMenuItem[]=[];
  for(const place of places){
    if(place.status!=='approved'||(filters.branchId!==undefined&&place.id!==filters.branchId))continue;
    for(const item of place.menus){
      const words=item.name.normalize('NFC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
      if(!terms.every(t=>words.some(w=>w.startsWith(t))))continue;
      if(filters.requiredTags?.length&&!filters.requiredTags.every(t=>item.tags?.includes(t)))continue;
      if(budget!==null){
        if(!item.priceValue||item.priceValue.currency!=='PHP')continue;
        let amount:bigint;try{amount=phpCentavos(item.priceValue.amount);}catch{continue;}
        if(amount>budget)continue;
      }
      results.push({branchId:place.id,branchName:place.name,item});
    }
  }
  return results.sort((a,b)=>a.branchId.localeCompare(b.branchId)||a.item.name.localeCompare(b.item.name)||a.item.id.localeCompare(b.item.id));
}
export function findPlaces(filters:PlaceFilters={}):Promise<Place[]>{return searchPlaces(filters.query??'',filters.category);}
export async function getPlaceDetails(placeId:string):Promise<Place|null>{identifier(placeId);return (await loadPlaces()).find(p=>p.id===placeId)??null;}
export async function getRestaurantMenu(branchId:string):Promise<MenuItem[]>{return (await getPlaceDetails(branchId))?.menus??[];}
export async function findMenuItems(filters:MenuFilters={}):Promise<BranchMenuItem[]>{return filterMenuItems(await loadPlaces(),filters);}
export async function getVerifiedEntrances(placeId:string):Promise<Place['entrances']>{return (await getPlaceDetails(placeId))?.entrances??[];}
