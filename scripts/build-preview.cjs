/** Bundled presentation enrichment only. Never rewrites raw sources, packs or approval records. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const ROOT = path.resolve(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const norm = value => (value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function uuid(value) {
  const b = crypto.createHash('sha1').update('omni-bgc:offline-preview-v1:' + value).digest().subarray(0, 16);
  b[6] = (b[6] & 15) | 0x50; b[8] = (b[8] & 63) | 0x80;
  const h = b.toString('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
const decode = value => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attrs = value => Object.fromEntries([...value.matchAll(/([\w:]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])]));
const tags = body => Object.fromEntries([...body.matchAll(/<tag\b([^>]*?)\/?\s*>/g)].map(m => attrs(m[1])).map(a => [a.k, a.v]));
function ringContains(ring, point) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i], [xx, yy] = ring[j];
    if ((y > point[1]) !== (yy > point[1]) && point[0] < ((xx-x)*(point[1]-y))/(yy-y)+x) inside = !inside;
  }
  return inside;
}
const containsPoint = (rings, point) => ringContains(rings[0], point) && rings.slice(1).every(r => !ringContains(r, point));
/** Scanline interval midpoint is inside concave polygons and avoids holes; never an entrance. */
function interiorPoint(rings) {
  const ys = [...new Set(rings.flatMap(r => r.map(c => c[1])))].sort((a,b) => a-b);
  let best = null, width = 0;
  for (let k = 1; k < ys.length; k++) {
    const y = (ys[k-1] + ys[k])/2, xs = [];
    for (const ring of rings) for (let i = 1; i < ring.length; i++) {
      const [x1,y1] = ring[i-1], [x2,y2] = ring[i];
      if ((y1 > y) !== (y2 > y)) xs.push(x1+(y-y1)*(x2-x1)/(y2-y1));
    }
    xs.sort((a,b) => a-b);
    for (let i = 1; i < xs.length; i++) {
      const point = [(xs[i-1]+xs[i])/2, y], w = xs[i]-xs[i-1];
      if (w > width && containsPoint(rings, point)) { best = point; width = w; }
    }
  }
  if (!best) throw new Error('No safe polygon interior point');
  return best;
}
function loadBuildings(inputFiles) {
  const nodes = new Map(), ways = new Map(), relations = new Map();
  const sourceDir = 'assets/generated/context/source';
  for (const file of fs.readdirSync(path.join(ROOT, sourceDir)).sort()) {
    const relative = `${sourceDir}/${file}`, buffer = fs.readFileSync(path.join(ROOT, relative));
    inputFiles[relative] = digest(buffer);
    const xml = zlib.gunzipSync(buffer).toString('utf8');
    for (const m of xml.matchAll(/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g)) {
      const a = attrs(m[1]); nodes.set(a.id, [Number(a.lon),Number(a.lat)]);
    }
    for (const m of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
      const a = attrs(m[1]); ways.set(a.id, {id:a.id, tags:tags(m[2]), refs:[...m[2].matchAll(/<nd\b([^>]*?)\/?\s*>/g)].map(n=>attrs(n[1]).ref),file:relative,sha256:digest(buffer)});
    }
    for (const m of xml.matchAll(/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g)) {
      const a = attrs(m[1]); relations.set(a.id, {id:a.id,tags:tags(m[2]),members:[...m[2].matchAll(/<member\b([^>]*?)\/?\s*>/g)].map(n=>attrs(n[1])),file:relative,sha256:digest(buffer)});
    }
  }
  const buildings = [];
  function add(row, kind, refs) {
    if (!row.tags.name || !refs.length || refs.some(ref=>!nodes.has(ref))) return;
    const ring = refs.map(ref=>nodes.get(ref));
    if (ring.length < 4 || refs[0] !== refs.at(-1)) return;
    try { buildings.push({name:row.tags.name,aliases:[row.tags.alt_name,row.tags.short_name].filter(Boolean),sourceId:`osm:${kind}:${row.id}`,sourceFile:row.file,sourceSha256:row.sha256,coordinate:interiorPoint([ring]),polygon:[ring],geometryKind:row.tags.building?'building':'site'}); }
    catch { /* An unusable polygon cannot become a location anchor. */ }
  }
  for (const row of ways.values()) if ((row.tags.building && row.tags.building !== 'no') || row.tags.shop === 'mall' || row.tags.name === 'Serendra') add(row, 'way', row.refs);
  for (const row of relations.values()) {
    if (!(row.tags.building || row.tags.shop === 'mall') || row.members.some(m=>m.role==='inner')) continue;
    const segments = row.members.filter(m=>m.type==='way' && (!m.role || m.role==='outer')).map(m=>ways.get(m.ref)?.refs).filter(Boolean).map(s=>[...s]);
    while (segments.length) {
      const ring = segments.shift();
      while (ring[0] !== ring.at(-1)) {
        const i = segments.findIndex(s=>s[0]===ring.at(-1)||s.at(-1)===ring.at(-1));
        if (i < 0) break;
        let next=segments.splice(i,1)[0]; if(next[0]!==ring.at(-1)) next.reverse(); ring.push(...next.slice(1));
      }
      add(row,'relation',ring);
    }
  }
  return buildings.sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
}
const templates = {
  mexican:[['Chicken tacos',285,'Soft tortillas filled with seasoned chicken.'],['Beef tacos',315,'Tortillas filled with seasoned beef.'],['Chicken burrito',345,'A filled tortilla wrap with chicken and rice.'],['Beef burrito',375,'A tortilla wrap with seasoned beef and rice.'],['Cheese quesadilla',265,'A toasted tortilla with melted cheese.'],['Nachos',295,'Corn chips with savory toppings.'],['Mexican-style rice',135,'Rice cooked with tomato and savory seasoning.'],['Lime cooler',125,'A refreshing chilled lime-flavored drink.']],
  curry:[['Pork katsu curry',345,'Crisp pork cutlet with Japanese-style curry and rice.'],['Chicken katsu curry',335,'Crisp chicken cutlet served with curry and rice.'],['Beef curry rice',365,'Beef in a rich curry sauce with steamed rice.'],['Vegetable curry rice',295,'Vegetables in curry sauce with steamed rice.'],['Shrimp curry rice',375,'Shrimp served with curry sauce and rice.'],['Cheese curry rice',315,'Curry rice topped with melted cheese.'],['Chicken karaage',245,'Bite-sized seasoned chicken fried until crisp.'],['Iced green tea',95,'Green tea served chilled.']],
  hotpot:[['Beef hotpot set',495,'Sliced beef, vegetables and broth for a hotpot-style meal.'],['Pork hotpot set',445,'Pork slices and vegetables served with a warming broth.'],['Chicken hotpot set',425,'Chicken and vegetables in a hotpot-style serving.'],['Seafood hotpot set',545,'Mixed seafood with vegetables and a savory broth.'],['Mushroom hotpot set',395,'Mushrooms and vegetables in a warming broth.'],['Noodle side',95,'A side portion of noodles.'],['Steamed rice',65,'A side serving of steamed rice.'],['Iced tea',95,'Tea served chilled over ice.']],
  thai:[['Pad Thai',345,'Stir-fried rice noodles in a tangy savory sauce.'],['Chicken green curry',365,'Chicken in a green curry-style sauce.'],['Beef red curry',395,'Beef in a warming red curry-style sauce.'],['Pineapple fried rice',325,'Seasoned fried rice with pineapple.'],['Tom yum seafood soup',385,'A tangy soup with seafood and aromatic seasoning.'],['Crisp spring rolls',225,'Crisp filled rolls served as a starter.'],['Mango sticky rice',245,'Sweet sticky rice with mango.'],['Thai iced tea',145,'Chilled tea blended with milk.']],
  mediterranean:[['Chicken shawarma wrap',255,'Seasoned chicken wrapped in flatbread.'],['Beef kebab rice',345,'Grilled seasoned beef served with rice.'],['Chicken kebab rice',315,'Grilled chicken served with rice.'],['Falafel wrap',245,'Crisp chickpea-style bites wrapped in flatbread.'],['Hummus and flatbread',225,'A smooth chickpea dip with flatbread.'],['Greek-style salad',275,'A fresh vegetable salad with a savory dressing.'],['Grilled fish plate',385,'A seasoned fish main served with rice.'],['Lemon cooler',125,'A chilled lemon-flavored drink.']],
  korean:[['Beef bulgogi rice',365,'Thin beef slices in a sweet-savory sauce over rice.'],['Grilled pork belly plate',395,'Grilled pork belly served as a main course.'],['Spicy chicken rice',325,'Seasoned chicken with rice and chili-style sauce.'],['Bibimbap bowl',345,'Rice with mixed toppings and savory sauce.'],['Kimchi fried rice',295,'Rice stir-fried with kimchi-style seasoning.'],['Japchae',325,'Glass noodles tossed in a savory sauce.'],['Pork dumplings',225,'Dumplings with a savory pork filling.'],['Iced barley tea',95,'A chilled barley-flavored tea.']],
  coffee:[['Espresso',100,'A concentrated coffee served in a small cup.'],['Americano',130,'Espresso lengthened with hot water.'],['Café latte',165,'Espresso with steamed milk.'],['Cappuccino',165,'Espresso topped with textured milk foam.'],['Iced latte',175,'Coffee and milk served over ice.'],['Mocha',185,'Coffee with chocolate and milk.'],['Cold brew',170,'Slow-steeped coffee served chilled.'],['Butter croissant',125,'A flaky baked pastry with a buttery finish.']],
  pastry:[['Butter croissant',125,'A flaky pastry with a buttery finish.'],['Chocolate croissant',145,'A layered pastry filled with chocolate.'],['Cinnamon roll',135,'A soft spiral bun with cinnamon filling.'],['Cheese bread',85,'A soft baked roll with cheese.'],['Sourdough loaf',240,'A crusty bread loaf with a tangy crumb.'],['Ham and cheese sandwich',195,'A filled bread sandwich with ham and cheese.'],['Banana loaf slice',110,'A slice of moist banana bread.'],['Brewed coffee',120,'A cup of freshly brewed coffee.']],
  burger:[['Classic beef burger',265,'A beef patty in a bun with a savory sauce.'],['Cheeseburger',295,'A beef burger topped with melted cheese.'],['Double beef burger',385,'Two beef patties stacked in a toasted bun.'],['Crispy chicken burger',265,'A crisp chicken fillet served in a bun.'],['Bacon cheeseburger',345,'A beef burger with cheese and bacon.'],['French fries',125,'Golden potato fries with a lightly salted finish.'],['Onion rings',145,'Crisp battered onion rings.'],['Chocolate shake',175,'A chilled chocolate milkshake.']],
  ramen:[['Tonkotsu ramen',395,'Noodles in a rich pork-style broth.'],['Shoyu ramen',365,'Noodles in a soy-seasoned broth.'],['Miso ramen',385,'Noodles in a savory miso-seasoned broth.'],['Spicy ramen',415,'A warming noodle bowl with chili seasoning.'],['Chicken ramen',375,'A noodle bowl with chicken and broth.'],['Gyoza',195,'Pan-seared dumplings with a savory filling.'],['Chashu rice',245,'A rice bowl with sliced braised pork.'],['Iced green tea',95,'Green tea served chilled.']],
  sushi:[['Salmon maki',295,'Sushi rolls with salmon and seasoned rice.'],['California maki',255,'A rice roll with mixed savory fillings.'],['Tuna maki',275,'Sushi rolls with tuna and seasoned rice.'],['Ebi tempura',325,'Battered prawns fried until crisp.'],['Chicken teriyaki bowl',295,'Rice with chicken in a sweet-savory sauce.'],['Katsu curry',345,'A crisp cutlet with curry sauce and rice.'],['Miso soup',95,'A warm savory soup seasoned with miso.'],['Iced green tea',95,'Green tea served chilled.']],
  noodles:[['Stir-fried noodles',245,'Noodles tossed with a savory sauce and vegetables.'],['Beef noodle soup',295,'A warming noodle soup with beef.'],['Pork dumplings',195,'Steamed dumplings with a savory pork filling.'],['Shrimp fried rice',285,'Rice stir-fried with shrimp and seasoning.'],['Sweet and sour pork',325,'Pork pieces coated in a tangy sauce.'],['Steamed buns',155,'Soft buns with a savory filling.'],['Spring rolls',175,'Crisp rolls with a mixed savory filling.'],['House iced tea',95,'A chilled tea drink.']],
  chicken:[['Crispy chicken meal',215,'Crisp chicken served with rice.'],['Soy garlic chicken',255,'Chicken coated in a savory soy and garlic glaze.'],['Spicy chicken meal',235,'A chicken meal with a chili-seasoned coating.'],['Chicken wings',295,'A serving of sauced chicken wings.'],['Chicken sandwich',195,'Chicken served in a toasted bun.'],['Chicken rice bowl',225,'Seasoned chicken over steamed rice.'],['French fries',105,'A portion of crisp potato fries.'],['Iced tea',85,'Tea served chilled over ice.']],
  pizza:[['Margherita pizza',425,'A pizza with tomato sauce and cheese.'],['Pepperoni pizza',495,'A pizza topped with pepperoni and cheese.'],['Four cheese pizza',525,'A pizza with a blend of cheeses.'],['Mushroom pizza',465,'A pizza topped with mushrooms and cheese.'],['Spaghetti bolognese',345,'Pasta with a rich meat and tomato sauce.'],['Creamy carbonara',365,'Pasta in a creamy savory sauce.'],['Garlic bread',155,'Toasted bread with garlic seasoning.'],['Tiramisu',225,'A layered coffee-flavored dessert.']],
  steak:[['Grilled ribeye',1850,'A grilled beef ribeye served as a main course.'],['Sirloin steak',1350,'A grilled sirloin steak with a savory finish.'],['Steak rice plate',625,'Sliced grilled beef served with rice.'],['Roast chicken',595,'Roasted chicken with a seasoned finish.'],['Grilled fish',695,'A grilled fish main course.'],['Mashed potatoes',225,'Smooth potatoes served as a side.'],['Garden salad',295,'Fresh vegetables with a savory dressing.'],['Chocolate cake',295,'A rich slice of chocolate cake.']],
  seafood:[['Grilled fish plate',395,'A grilled fish main served with rice.'],['Garlic shrimp',425,'Shrimp sautéed with garlic seasoning.'],['Fish and chips',365,'Crisp battered fish with potato chips.'],['Seafood rice',345,'Seasoned rice with mixed seafood.'],['Crispy calamari',325,'Battered squid rings fried until crisp.'],['Fish sandwich',285,'A fish fillet served in a bun.'],['Seafood noodles',365,'Noodles tossed with mixed seafood.'],['Calamansi cooler',115,'A chilled citrus-flavored drink.']],
  salad:[['Chicken salad bowl',295,'Fresh vegetables with seasoned chicken.'],['Roasted vegetable bowl',275,'Rice and roasted vegetables in a hearty bowl.'],['Tofu rice bowl',265,'Seasoned tofu served over rice.'],['Grain salad',285,'A mixed grain salad with vegetables.'],['Chicken wrap',275,'A soft wrap filled with chicken and vegetables.'],['Mushroom bowl',285,'Seasoned mushrooms over grains.'],['Fruit cup',145,'A serving of mixed fruit.'],['Citrus drink',115,'A refreshing chilled citrus drink.']],
  dessert:[['Chocolate cake slice',195,'A rich chocolate cake slice.'],['Cheesecake slice',215,'A creamy cheesecake with a crumb base.'],['Vanilla ice cream',125,'A portion of vanilla-flavored ice cream.'],['Chocolate sundae',155,'Ice cream topped with chocolate sauce.'],['Mango dessert cup',175,'A layered dessert with mango flavor.'],['Brownie',105,'A dense chocolate baked treat.'],['Caramel custard',145,'A smooth custard with caramel topping.'],['Iced chocolate',155,'A chilled chocolate and milk drink.']],
  drink:[['Classic milk tea',125,'Tea blended with milk and served chilled.'],['Brown sugar milk tea',145,'Milk tea with a brown sugar flavor.'],['Matcha latte',165,'Matcha tea blended with milk.'],['Mango fruit tea',135,'A chilled tea with mango flavor.'],['Lemon iced tea',105,'Tea with a refreshing lemon flavor.'],['Fresh calamansi drink',105,'A chilled citrus drink with calamansi flavor.'],['Chocolate drink',145,'A smooth chilled chocolate drink.'],['Cold brewed tea',115,'Tea steeped cold and served over ice.']],
  rice:[['Chicken adobo rice plate',265,'Chicken in a savory adobo-style sauce, served with rice.'],['Pork rice plate',285,'Seasoned pork served with steamed rice.'],['Grilled chicken plate',275,'Grilled chicken with rice and a savory sauce.'],['Beef rice bowl',325,'Seasoned beef served over steamed rice.'],['Vegetable stir-fry',235,'Mixed vegetables cooked in a savory sauce.'],['Garlic fried rice',95,'Rice stir-fried with garlic.'],['Soup of the day',145,'A warming savory soup serving.'],['Calamansi iced tea',105,'Tea with a refreshing citrus flavor.']]
};
function foodFamily(text) {
  text=norm(text);
  for (const [family, pattern] of [
    ['hotpot',/shabu|hotpot/], ['curry',/ichibanya|curry/], ['thai',/thai|mango tree|easy tiger|basil/], ['mediterranean',/mediterranean|doner|kebab|shawarma|turkish|greek/], ['korean',/korean|giwon|samgyup|romantic baboy|yakiniku|jinjoo|sariwon/], ['mexican',/mexican|agave|taco|burrito|army navy|silantro/],
    ['ramen',/ramen|ippudo|nagi|kokoro|ton ichi|udon|menya|tsuta/], ['sushi',/sushi|ooma|nikkei|watami|botejyu|gatsu|yakiniku|shabu|katsu|teppan/],
    ['pizza',/pizza|italian|italianni|cibo|amici|a mano|pasta|sbarro/], ['burger',/burger|shake shack|wendy|mcdonald|8 cuts/],
    ['steak',/steak|raging bull|wolfgang|steakhouse/], ['salad',/salad|heybo|wooshi|poke|healthy/], ['seafood',/seafood|fish|lobster|shrimp/],
    ['chicken',/chicken|bonchon|kfc|jollibee|goobne|andok|wings|mang inasal/], ['noodles',/chinese|din tai|tim ho wan|dumpling|canton|paradise dynasty|chowking|panda|mala|noodle|pancit|mamak|thai|mango tree|basil/],
    ['drink',/milk tea|gong cha|coco fresh|happy lemon|fruit|jamba|juice|tea house|chatime|serenitea|koi the|moonleaf|twg tea/],
    ['dessert',/ice cream|gelato|dairy queen|cold stone|dessert|candy|cookie|cinnabon/],
    ['pastry',/bakery|baker|bread|doughnut|donut|dunkin|krispy|pretzel|anne|egg tart|red ribbon|pan de|j co/], ['coffee',/coffee|cafe|café|arabica|starbucks|matcha|elephant grounds|deuces|chocolate|fat seed|tim hortons|angkan|brood/]
  ]) if(pattern.test(text)) return family;
  return 'rice';
}
function dishKey(item) {
  const text=norm(item.name);
  const groups=[['coffee',/espresso|latte|cappuccino|mocha|coffee|cold brew|americano/],['drink',/\b(?:tea|juice|cooler|shake|drink|soda|water|lemonade|smoothie)\b/],['ramen',/ramen/],['sushi',/sushi|maki|sashimi|nigiri/],['pizza',/pizza/],['burger',/burger/],['dessert',/cake|ice cream|dessert|brownie|custard|sundae|tiramisu|cookie|pudding/],['pastry',/bread|croissant|bun|roll|sandwich|toast|pretzel|loaf/],['salad',/salad|vegetable|fruit cup|grain/],['noodles',/noodle|pancit|pasta|spaghetti|carbonara/],['seafood',/fish|shrimp|prawn|calamari|squid|lobster/],['chicken',/chicken|wings/],['steak',/steak|ribeye|sirloin/],['rice',/rice|adobo|bowl/]];
  const family=foodFamily([item.name,item.category,item.section].filter(Boolean).join(' '));
  return `dish-${groups.find(([,pattern])=>pattern.test(text))?.[0]??({curry:'rice',hotpot:'noodles',thai:'noodles',mediterranean:'salad',korean:'rice',mexican:'rice'}[family]??family)}`;
}
function floorLabel(value) {
  if(!value) return undefined;
  const compact=value.trim().normalize('NFKC').toLowerCase().replace(/[\s./-]+/g,'');
  return /^(?:gf|ground(?:floor|level)?|lgf?|lowerground(?:floor|level)?|ugf?|upperground(?:floor|level)?|[1-9]\d{0,2}(?:f|(?:st|nd|rd|th)?floor)|(?:floor|level)[1-9]\d{0,2}|b[1-9]\d?|basement(?:[1-9]\d?)?|lobby|streetlevel)$/.test(compact)?value.trim():undefined;
}
function coverKey(category, name) {
  const t=norm(`${category} ${name}`);
  return `cover-${/office/.test(t)?'office':/\b(?:park|garden)\b/.test(t)?'park':/hotel/.test(t)?'hotel':/shop|mall|retail/.test(t)?'shop':/bakery|baker/.test(t)?'bakery':/coffee|cafe|café/.test(t)?'cafe':/restaurant|food|dining|grill/.test(t)?'restaurant':'building'}`;
}
function buildPreview() {
  const paths={directory:'assets/generated/directory/places.json',food:'assets/generated/food-research/directory.json',offices:'assets/generated/offices/research.json',settings:'config/preview/settings.json',crosswalk:'config/preview/crosswalk.json',research:'config/preview/research.json'};
  const inputs=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,read(p)]));
  const inputFiles=Object.fromEntries(Object.values(paths).map(p=>[p,digest(fs.readFileSync(path.join(ROOT,p)))]));
  inputFiles['scripts/build-preview.cjs']=digest(fs.readFileSync(__filename));
  const buildings=loadBuildings(inputFiles), date=inputs.settings.observedAt;
  const aliases={}, byId=new Map(), details={}, itemEvidence={}, exceptions=[];
  const field=(id,key,classification,sourceIds,urls,basis,observedAt=date)=>({classification,sourceIds,urls,observedAt:classification==='generated'?null:observedAt,basis,replacementKey:`${id}:${key}`});
  const locationFor=(label,sourceIds=[])=>{
    if(!label) return null;
    const resolved=inputs.crosswalk.buildingAliases[label]??label;
    const exact=buildings.filter(b=>norm(b.name)===norm(resolved));
    const matches=exact.length?exact:buildings.filter(b=>b.aliases.some(n=>norm(n)===norm(resolved)));
    const unique=[...new Map(matches.map(b=>[b.sourceId,b])).values()];
    if(unique.length!==1) return null;
    const b=unique[0];
    return {kind:'building-anchor',coordinate:b.coordinate,sourceIds:[...sourceIds,b.sourceId],sourceFile:b.sourceFile,sourceSha256:b.sourceSha256,derivation:`Deterministic interior point of retained OSM ${b.geometryKind} polygon`,precision:b.geometryKind,entrance:false,building:label,anchorName:b.name};
  };
  function addPlace(p, sourceIds, description, location, fields={}) {
    const existing=byId.get(p.id);
    const previousDetails=details[p.id];
    if(existing?.coordinate) fields={...fields,coordinate:previousDetails.fields.coordinate};
    else if(p.coordinate) fields={...fields,coordinate:field(p.id,'coordinate','sourced',p.citations.map(c=>c.sourceId),p.citations.map(c=>c.locator).filter(url=>typeof url==='string'&&/^https?:/.test(url)),'Unchanged retained directory source point; no building-anchor substitution',p.citations[0]?.observedAt??null)};
    const imageKey=p.imageKey??coverKey(p.category,p.name);
    const coordinate=existing?.coordinate??p.coordinate??location?.coordinate??null;
    const entry={...p,...existing,coordinate,aliases:[...new Set([...(existing?.aliases??[]),...p.aliases,...sourceIds])],description:fields.description?.classification==='sourced'?description:existing?.description??description,imageKey:existing?.imageKey??imageKey,sourceIds:[...new Set([...(existing?.sourceIds??[]),...sourceIds])],locationKind:existing?.locationKind??(p.coordinate?'recorded-point':location?'building-anchor':'unknown'),preview:true};
    for(const key of ['floor','building']) if(fields[key]?.classification==='sourced' && p[key]!==undefined) entry[key]=p[key];
    byId.set(p.id,entry); aliases[p.id]=p.id; sourceIds.forEach(id=>aliases[id]=p.id);
    const metadata=previousDetails;
    details[p.id]={description:entry.description,imageKey:entry.imageKey,sourceIds:entry.sourceIds,location:metadata?.location??location??{kind:p.coordinate?'recorded-point':'unknown',sourceIds,precision:p.coordinate?'recorded point':'unknown',entrance:false},fields:{...(metadata?.fields??{}),description:field(p.id,'description','generated',sourceIds,[],'Concise category-based internal-preview description; not an observed venue service claim'),imageKey:field(p.id,'imageKey','generated',sourceIds,[],'Shared illustrative category image; not a photograph of this establishment'),...fields}};
    if(!coordinate) exceptions.push({kind:'unlocated',id:p.id,name:p.name,building:p.building??null,reason:'No unambiguous retained building geometry or recorded point; no coordinates invented'});
  }
  for(const p of inputs.directory) addPlace({...p,entrances:[],menus:[...p.menus]},[p.id],`${p.name} is listed in the local ${p.category.toLowerCase()} directory${p.building?` at ${p.building}`:''}.`,p.coordinate?{kind:'recorded-point',sourceIds:p.citations.map(c=>c.sourceId),coordinate:p.coordinate,derivation:'Unchanged coordinate from retained directory source',precision:'recorded point',entrance:false}:null);
  const crosswalk=new Map();
  for(const row of inputs.crosswalk.merges) {
    if(!byId.has(row.canonicalId)||!inputs.food.restaurants.some(r=>r.id===row.sourceId)||!row.basis||!row.sourceIds.length||crosswalk.has(row.sourceId)) throw new Error('Invalid explicit identity crosswalk');
    crosswalk.set(row.sourceId,row.canonicalId); aliases[row.sourceId]=row.canonicalId;
  }
  const food=[], directoryOnlyRestaurants=[];
  const representedIds=new Set(inputs.food.restaurants.map(r=>crosswalk.get(r.id)??r.id));
  for(const p of inputs.directory) if(/food|coffee|restaurant|caf[eé]|bakery|dining/i.test(p.category)&&!representedIds.has(p.id)) directoryOnlyRestaurants.push({id:p.id,externalId:`directory:${p.id}`,origin:'research',name:p.name,type:/coffee|caf[eé]/i.test(p.category)?'Cafe':'Restaurant',zone:null,building:p.building??null,floor:p.floor??null,locationOriginal:p.building??null,locationSpecificity:'Retained directory coordinate',hours:{text:null,kind:'unknown',evidence:'Not recorded',sourceUrl:null,venueText:null,venueSourceUrl:null,weeklySchedule:null},menuStatus:'generated-internal-preview',menuBranch:null,locationSourceUrl:null,notes:null,researchDate:date,items:[],previewCuisine:p.cuisines?.join(' ')??''});
  for(const raw of [...inputs.food.restaurants,...directoryOnlyRestaurants]) {
    const {rawOverview,rawRestaurantDetails,...source}=raw;
    const r={...source,items:raw.items.map(({raw:unneeded,...item})=>({...item}))};
    const sourced=inputs.research.restaurants.find(row=>norm(row.nameMatch)===norm(raw.name)||norm(raw.name).startsWith(norm(row.nameMatch)+' '));
    const researchSource=sourced?inputs.research.sources.find(s=>s.id===sourced.sourceId):null;
    if(sourced?.floor) r.floor=sourced.floor;
    if(sourced?.building) r.building=sourced.building;
    if(sourced?.hours) r.hours={...r.hours,...sourced.hours,evidence:'Official restaurant branch page retrieved for internal preview',sourceUrl:researchSource.url};
    const family=foodFamily(`${r.name} ${raw.previewCuisine??''} ${r.type}`);
    const description=sourced?.description??`${r.name} is a ${family==='coffee'?'coffee and café':family==='pastry'?'bakery':family==='rice'?'dining':family} listing${r.building?` at ${r.building}`:''}. Browse its menu and PHP prices.`;
    r.description=description; r.imageKey=coverKey(r.type,r.name); r.preview=true;
    for(const item of r.items) {
      const noDescription=!item.description;
      item.description??=`${item.name}, listed in ${item.section??item.category??'the restaurant menu'}. Serving details depend on the restaurant.`;
      item.imageKey=dishKey(item); item.preview=true;
      itemEvidence[item.id]={name:field(item.id,'name','sourced',[item.id],item.menuSourceUrl?[item.menuSourceUrl]:[],'Retained menu item name',item.researchDate??null),description:field(item.id,'description',noDescription?'generated':'sourced',[item.id],item.menuSourceUrl?[item.menuSourceUrl]:[],noDescription?'Preview description derived from retained item name and section':'Retained item description',item.researchDate??null),amount:field(item.id,'amount',item.priceEvidence==='estimated'?'generated':'sourced',[item.id],item.priceSourceUrl?[item.priceSourceUrl]:[],item.estimationBasis??'Retained published amount and evidence class',item.researchDate??null),imageKey:field(item.id,'imageKey','generated',[item.id],[],'Illustrative shared dish family image')};
    }
    const used=new Set(r.items.map(i=>norm(i.name)));
    let index=0;
    while(r.items.length<8) {
      const [name,amount,description]=templates[family][index++%templates[family].length];
      if(used.has(norm(name))) continue;
      used.add(norm(name));
      const id=uuid(`${r.id}:menu:${norm(name)}`);
      r.items.push({id,restaurantId:r.id,origin:'research',name,section:family==='coffee'||family==='drink'?'Drinks and light bites':'Menu',category:family,tags:[],description,amount:`${amount}.00`,currency:'PHP',priceEvidence:'estimated',priceSourceUrl:null,estimationBasis:`Internal-preview ${family} menu template calibrated to retained PHP research prices; not a quoted branch price`,menuSourceUrl:null,branch:r.name,researchStatus:'generated-internal-preview',researchDate:date,imageKey:dishKey({name,category:family}),preview:true});
      itemEvidence[id]=Object.fromEntries(['name','description','amount','imageKey'].map(key=>[key,field(id,key,'generated',[r.id],[],`Internal-preview ${family} template; replace with researched branch menu`)]));
    }
    const id=crosswalk.get(r.id)??r.id, location=locationFor(r.building,[r.id]);
    const fields={};
    if(sourced) for(const key of ['description','floor','building','hours']) if(sourced[key]) fields[key]=field(id,key,'sourced',[researchSource.id],[researchSource.url],'Official source retrieved 2026-10-24; not an approval');
    if(location) fields.coordinate=field(id,'coordinate','derived',location.sourceIds,r.locationSourceUrl?[r.locationSourceUrl]:[],'Retained restaurant-to-building claim plus retained OSM footprint; building-level only');
    addPlace({id,name:r.name,category:r.type,coordinate:null,building:r.building??undefined,floor:floorLabel(r.floor),aliases:[r.name,r.externalId,...[r.zone,r.locationOriginal].filter(Boolean)],entrances:[],menus:[],citations:[],status:'candidate',imageKey:r.imageKey},[r.id,r.externalId],description,location,fields);
    for(const i of r.items) aliases[i.id]=id;
    food.push(r);
    if(!r.items.some(i=>i.priceEvidence==='published-menu')) exceptions.push({kind:'menu-source-gap',id,name:r.name,reason:'No itemized published-menu evidence; preview estimates are usable only in internal preview'});
    if(!sourced) exceptions.push({kind:'research-not-refreshed',id,name:r.name,urls:[r.locationSourceUrl,r.hours.sourceUrl].filter(Boolean),reason:'Retained imported research; branch details not individually re-researched this pass'});
  }
  for(const raw of inputs.offices.candidates) {
    const id=uuid(raw.candidateId), location=locationFor(raw.building,[raw.candidateId]);
    const description=`${raw.name} is a ${raw.industry??'business'} directory listing${raw.building?` with an address at ${raw.building}`:''}${raw.district?` in ${raw.district}`:''}.`;
    const citations=[{sourceId:raw.candidateId,label:'Retained office research source',license:'Rights review pending; internal preview only',observedAt:`${raw.researchDate??date}T00:00:00Z`,verifiedAt:null,status:'candidate',locator:raw.sourceUrl??undefined}];
    const fields={office:field(id,'office','sourced',[raw.candidateId],raw.sourceUrl?[raw.sourceUrl]:[],'Retained unverified office research; does not establish current occupancy',raw.researchDate??null)};
    if(location) fields.coordinate=field(id,'coordinate','derived',location.sourceIds,raw.sourceUrl?[raw.sourceUrl]:[],'Retained office address claim plus retained OSM footprint; building-level only');
    addPlace({id,name:raw.name,category:'office',coordinate:null,building:raw.building??undefined,floor:raw.floor??undefined,aliases:[raw.name,...[raw.industry,raw.address,raw.district].filter(Boolean)],entrances:[],menus:[],citations,status:'candidate'},[raw.candidateId],description,location,fields);
    details[id].office={...raw,placeId:id};
    exceptions.push({kind:'office-evidence-gap',id,sourceId:raw.candidateId,name:raw.name,issues:raw.issues,sourceUrl:raw.sourceUrl,reason:'Source identity/current-presence/rights issues retained; anchor does not verify tenant occupancy'});
  }
  // Explicit source IDs only: a plausible matching name is never a merge instruction.
  const nameGroups=new Map();
  for(const p of byId.values()) { const key=norm(p.name); const group=nameGroups.get(key)??[];group.push(p);nameGroups.set(key,group); }
  for(const group of nameGroups.values()) if(group.length>1) exceptions.push({kind:'identity-ambiguity',ids:group.map(p=>p.id),name:group[0].name,buildings:group.map(p=>p.building??null),reason:'Distinct records retained; no approved explicit same-branch crosswalk'});
  for(const s of inputs.research.sources) if(s.status==='inaccessible'||s.status==='conflicting') exceptions.push({kind:s.status==='inaccessible'?'inaccessible-source':'conflicting-source',...s});
  for(const raw of inputs.food.restaurants) if(!byId.has(aliases[raw.id])) throw new Error('Dangling food place');
  const places=[...byId.values()].sort((a,b)=>a.id.localeCompare(b.id));
  const itemCount=food.reduce((n,r)=>n+r.items.length,0);
  const coverage={sourceDirectoryPlaces:inputs.directory.length,sourceRestaurants:inputs.food.restaurants.length,directoryOnlyRestaurants:directoryOnlyRestaurants.length,restaurants:food.length,sourceOffices:inputs.offices.candidates.length,sourceMenuItems:inputs.food.restaurants.reduce((n,r)=>n+r.items.length,0),canonicalPlaces:places.length,explicitIdentityMerges:crosswalk.size,menuItems:itemCount,generatedMenuItems:itemCount-inputs.food.restaurants.reduce((n,r)=>n+r.items.length,0),restaurantsWithEightItems:food.filter(r=>r.items.length>=8).length,placesWithDescriptions:places.filter(p=>p.description).length,placesWithImages:places.filter(p=>p.imageKey).length,recordedPoints:places.filter(p=>p.locationKind==='recorded-point').length,buildingAnchors:places.filter(p=>p.locationKind==='building-anchor').length,unlocated:places.filter(p=>!p.coordinate).length,refreshedOfficialRestaurantSources:inputs.research.sources.filter(s=>s.status==='retrieved').length};
  const fingerprint=digest(JSON.stringify({inputFiles,version:inputs.settings.version}));
  return {inputs,overlay:{version:inputs.settings.version,fingerprint,inputs:inputFiles,places,aliases,details,itemEvidence,coverage,legal:{internalPreviewOnly:true,publicationAuthorized:false,osmAttribution:'© OpenStreetMap contributors · ODbL-1.0',sourceRights:'Source rights and approval metadata remain unchanged. Generated descriptions/menus/images are illustrative internal-preview content.'}},food:{version:'food-research-v1',restaurants:food},exceptions,buildings};
}
if(require.main===module) {
  const result=buildPreview();
  if(process.argv.includes('--anchors')) { console.log(result.buildings.map(b=>[b.sourceId,b.name])); process.exit(0); }
  const dest=path.join(ROOT,'assets/generated/preview'); fs.mkdirSync(dest,{recursive:true});
  for(const [file,value] of [['overlay.json',result.overlay],['food.json',result.food],['exceptions.json',result.exceptions]]) fs.writeFileSync(path.join(dest,file),JSON.stringify(value)+'\n');
  const c=result.overlay.coverage;
  const report=`# Offline preview coverage\n\nGenerated deterministically from retained repository sources and explicit enrichment inputs.\n\n| Measure | Count |\n|---|---:|\n${Object.entries(c).map(([key,value])=>`| ${key} | ${value} |`).join('\n')}\n\n## Limits\n\n- Preview menus and estimates are generated where branch sources are missing; no approval status was upgraded.\n- Building anchors represent retained address claims, not surveyed points, entrances or verified occupancy.\n- Installed approved SQLite packs were not available for this source audit; runtime approved identities retain precedence.\n- Source rights remain pending where imported evidence says so; no publication authorization is granted.\n- Individual unresolved records and research-refresh gaps are in exceptions.json.\n- Fictional demo merchants remain outside this real-establishment overlay and remain unlocated.\n\nInput fingerprint: ${result.overlay.fingerprint}\n`;
  fs.writeFileSync(path.join(dest,'COVERAGE.md'),report);
  console.log(JSON.stringify(c));
}
module.exports={buildPreview,uuid,interiorPoint,containsPoint,dishKey,coverKey};
