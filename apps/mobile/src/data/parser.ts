import { Citation, Coordinate, Place, SavedState, TransitRoute } from '../contracts';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function lexicalQuery(query: string): string | null {
  if (typeof query !== 'string' || query.length > 2048) throw new Error('Search query exceeds limit');
  const tokens = query.normalize('NFC').match(/[\p{L}\p{N}]+/gu)?.slice(0, 8).map(t => t.slice(0, 48)) ?? [];
  return tokens.length ? tokens.map(t => `"${t.replace(/"/g, '""')}"*`).join(' AND ') : null;
}
export function validateSaved(value: SavedState): SavedState {
  if (!value || Object.keys(value).sort().join(',') !== 'itinerary,placeIds,startTime' || !Array.isArray(value.placeIds) || !Array.isArray(value.itinerary) || value.placeIds.length > 500 || value.itinerary.length > 100) throw new Error('Invalid saved state');
  if (value.placeIds.some(id => typeof id !== 'string' || !UUID.test(id)) || new Set(value.placeIds).size !== value.placeIds.length) throw new Error('Invalid/duplicate saved UUID');
  for (const stop of value.itinerary) if (!stop || Object.keys(stop).sort().join(',') !== 'durationMinutes,placeId' || !UUID.test(stop.placeId) || !Number.isInteger(stop.durationMinutes) || stop.durationMinutes < 0 || stop.durationMinutes > 1440) throw new Error('Invalid itinerary stop');
  if (value.startTime !== null && (typeof value.startTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.startTime))) throw new Error('Invalid local start time');
  return { placeIds: [...value.placeIds], itinerary: value.itinerary.map(s => ({ ...s })), startTime: value.startTime };
}
export type FactRow = { fact_valid_until?:string; evidence_valid_until?:string; snapshot_valid_until?:string; fact_id?:string; snapshot_id?:string; raw_sha256?:string; evidence_id?:string; entity_id: string; kind: string; parent_id: string | null; property: string; value_json: string | null; knowledge: string; source_id: string; license: string; attribution: string; observed_at: string; verified_at: string; locator: string; verification_method?:string; confidence_reason?:string; };
function sourceCitation(r:FactRow):Citation {return {sourceId:r.source_id,label:r.attribution,license:r.license,observedAt:r.observed_at,verifiedAt:r.verified_at,status:'approved',factId:r.fact_id,snapshotId:r.snapshot_id,rawSha256:r.raw_sha256,evidenceId:r.evidence_id,locator:r.locator,verificationMethod:r.verification_method};}
export type EntranceLink={place_id:string;entrance_id:string;access_fact_id:string};
export type TransitLink={route_id:string;shape_fact_id:string;calendar_fact_id:string;sequence:number;stop_id:string;sequence_fact_id:string};
function coordinate(value: unknown): Coordinate | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as {longitude: unknown; latitude: unknown; crs: unknown};
  return typeof c.longitude === 'number' && Number.isFinite(c.longitude) && Math.abs(c.longitude) <= 180 && typeof c.latitude === 'number' && Number.isFinite(c.latitude) && Math.abs(c.latitude) <= 90 && c.crs === 'EPSG:4326' ? [c.longitude,c.latitude] : null;
}
export function parsePlaces(input: FactRow[], links:EntranceLink[]=[]): Place[] {
  const values=new Map<string,Set<string>>();
  for(const f of input){if(f.property==='alias')continue;const key=f.entity_id+':'+f.property;const set=values.get(key)??new Set<string>();set.add(f.knowledge+':'+f.value_json);values.set(key,set);}
  const entities = new Map<string, {kind: string; parent: string | null; facts: Map<string, {value: unknown; citation: Citation}>}>();
  for (const r of input) {
    if (!UUID.test(r.entity_id) || r.knowledge !== 'asserted' || r.value_json === null || (values.get(r.entity_id+':'+r.property)?.size??0)>1) continue;
    let value: unknown; try { value=JSON.parse(r.value_json); } catch { continue; }
    let e=entities.get(r.entity_id);
    if (!e) { e={kind:r.kind,parent:r.parent_id,facts:new Map()}; entities.set(r.entity_id,e); }
    // SQL excludes property conflicts; aliases intentionally have multiple supported values.
    const key=r.property === 'alias' ? `alias:${r.value_json}` : r.property;
    if (!e.facts.has(key)) e.facts.set(key,{value,citation:sourceCitation(r)});
  }
  const result: Place[]=[];
  for (const [id,e] of entities) {
    if (e.kind !== 'place') continue;
    const name=e.facts.get('name')?.value; if (typeof name !== 'string' || !name.trim()) continue;
    const parent=e.parent ? entities.get(e.parent) : undefined;
    const building=parent?.kind==='building' && e.facts.get('building')?.value===e.parent ? parent.facts.get('name')?.value : undefined;
    const place: Place={id,name,category:typeof e.facts.get('category')?.value === 'string' ? e.facts.get('category')!.value as string : 'unknown',coordinate:coordinate(e.facts.get('coordinate')?.value),aliases:[...e.facts.entries()].filter(([k,v])=>k.startsWith('alias:') && typeof v.value==='string').map(([,v])=>v.value as string),entrances:[],citations:[...e.facts.values()].map(f=>f.citation),status:'approved',menus:[]};
    if (typeof building==='string') place.building=building;
    const floor=e.facts.get('floor')?.value; if (typeof floor==='string') place.floor=floor;
    for(const link of links.filter(l=>l.place_id===id)){
      const access=input.find(f=>f.fact_id===link.access_fact_id&&f.entity_id===id&&f.property==='entrance_access'&&f.knowledge==='asserted');
      const point=input.find(f=>f.entity_id===link.entrance_id&&f.kind==='entrance'&&f.property==='coordinate'&&f.knowledge==='asserted'&&f.verification_method==='field_survey');
      const entrance=entities.get(link.entrance_id);let value:unknown;try{value=access?.value_json?JSON.parse(access.value_json):null;}catch{continue;}
      const claim=value as {entrance_id?:string;eligible?:boolean;access?:string}|null;
      const c=point?coordinate(JSON.parse(point.value_json!)):null;
      if(!claim||claim.entrance_id!==link.entrance_id||claim.eligible!==true||claim.access!=='public'||!c||!entrance)continue;
      place.entrances.push({id:link.entrance_id,label:typeof entrance.facts.get('name')?.value==='string'?entrance.facts.get('name')!.value as string:'Verified entrance',coordinate:c,eligible:true,floor:typeof entrance.facts.get('floor')?.value==='string'?entrance.facts.get('floor')!.value as string:undefined});
      place.citations.push(...[...entrance.facts.values()].map(f=>f.citation));
    }
    for (const [itemId,item] of entities) {
      if (item.kind !== 'menu_item' || !item.parent) continue;
      const parentMenu=entities.get(item.parent);
      const menuName=parentMenu?.facts.get('name')?.value;
      if (parentMenu?.kind!=='menu' || parentMenu.parent!==id || typeof menuName!=='string' || !menuName.trim()
        || parentMenu.facts.get('place')?.value!==id || item.facts.get('menu')?.value!==item.parent) continue;
      const n=item.facts.get('name'); if (!n || typeof n.value!=='string') continue;
      const menu: Place['menus'][number]={id:itemId,name:n.value,citation:n.citation,relationshipCitations:[parentMenu.facts.get('place')!.citation,item.facts.get('menu')!.citation]};
      const price=item.facts.get('price');
      if (price && typeof price.value==='object' && price.value!==null) {
        const p=price.value as {amount?:unknown;currency?:unknown};
        const amount=typeof p.amount==='string'||typeof p.amount==='number'?String(p.amount):'';
        if (/^\d{1,12}(?:\.\d{1,2})?$/.test(amount)&&typeof p.currency==='string'&&/^[A-Z]{3}$/.test(p.currency)) {
          menu.price=`${p.currency} ${amount}`; menu.priceValue={amount,currency:p.currency}; menu.checkedAt=price.citation.verifiedAt ?? undefined;menu.priceCitation=price.citation;
        }
      }
      const tag=item.facts.get('tag')?.value;
      if(typeof tag==='string')menu.tags=[tag];else if(Array.isArray(tag)&&tag.every(t=>typeof t==='string'))menu.tags=[...tag];
      if(menu.tags)menu.tagCitation=item.facts.get('tag')!.citation;
      place.menus.push(menu);
      place.citations.push(n.citation);if(price)place.citations.push(price.citation);
    }
    result.push(place);
  }
  return result.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
export function parseTransit(facts:FactRow[],links:TransitLink[]):TransitRoute[]{
  const asserted=(id:string)=>facts.find(f=>f.fact_id===id&&f.knowledge==='asserted');
  const get=(subject:string,prop:string)=>facts.find(f=>f.entity_id===subject&&f.property===prop&&f.knowledge==='asserted');
  const value=(f:FactRow|undefined):unknown=>{try{return f?.value_json?JSON.parse(f.value_json):null;}catch{return null;}};
  const citation=sourceCitation;
  const result:TransitRoute[]=[];
  for(const routeId of new Set(links.map(l=>l.route_id))){
    const routeLinks=links.filter(l=>l.route_id===routeId).sort((a,b)=>a.sequence-b.sequence);
    if(routeLinks.length<2||routeLinks.some((l,i)=>l.sequence!==i))continue;
    const shape=asserted(routeLinks[0].shape_fact_id),calendar=asserted(routeLinks[0].calendar_fact_id),name=get(routeId,'name');
    if(!shape||shape.entity_id!==routeId||shape.property!=='route_shape'||!calendar||calendar.entity_id!==routeId||calendar.property!=='calendar'||typeof value(name)!=='string')continue;
    const geometry=value(shape) as {crs?:string;coordinates?:unknown[]}|null;const schedule=value(calendar) as {description?:unknown}|null;
    if(!geometry||geometry.crs!=='EPSG:4326'||!Array.isArray(geometry.coordinates)||geometry.coordinates.length<2||typeof schedule?.description!=='string')continue;
    const path=geometry.coordinates.map(p=>Array.isArray(p)&&p.length===2?coordinate({longitude:p[0],latitude:p[1],crs:'EPSG:4326'}):null);if(path.some(c=>!c))continue;
    const stops:TransitRoute['stops']=[];const citations=[citation(shape),citation(calendar),citation(name!)];
    for(const link of routeLinks){const sequence=asserted(link.sequence_fact_id),stopName=get(link.stop_id,'name'),stopPoint=get(link.stop_id,'coordinate');const sequenceValue=value(sequence);const c=coordinate(value(stopPoint));
      if(!sequence||sequence.entity_id!==routeId||sequence.property!=='route_stop_sequence'||!Array.isArray(sequenceValue)||!sequenceValue.some(v=>v&&v.stop_id===link.stop_id&&v.sequence===link.sequence)||typeof value(stopName)!=='string'||!stopPoint||!c)break;
      const stop={id:link.stop_id,name:value(stopName) as string,coordinate:c,citation:citation(stopPoint),citations:[citation(stopName!),citation(stopPoint),citation(sequence)]};stops.push(stop);citations.push(...stop.citations);
    }
    if(stops.length!==routeLinks.length)continue;
    const route:TransitRoute & {citations:Citation[]}={id:routeId,name:value(name) as string,stops,shape:path as Coordinate[],operatingTimes:schedule.description,citation:citation(shape),citations};result.push(route);
  }return result;
}
