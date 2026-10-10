import { File } from 'expo-file-system';
import { getActivePackPath } from './index';

type Style = {version?:unknown;glyphs?:unknown;sprite?:unknown;sources?:unknown;layers?:unknown;imports?:unknown;metadata?:unknown;[key:string]:unknown};
type Resources={fontStacks:string[];glyphRanges:string[];sprites:string[];tileArchives:string[]};
export function safeRelativePath(value:unknown):value is string {
  return typeof value==='string' && value.normalize('NFC')===value && value.length>0 && value.length<=512 && !value.startsWith('/') && !/[\\:%?#{}\u0000-\u001f\u007f]/.test(value) && value.split('/').every(p=>p!=='.'&&p!=='..'&&!!p.trim()&&p===p.trim()) && /^[\p{L}\p{N} _.,/@-]+$/u.test(value);
}
function list(value:unknown):string[]{if(!Array.isArray(value)||value.some(v=>typeof v!=='string')||new Set(value).size!==value.length)throw new Error('Invalid offline resource declaration');return value;}
export function validateOfflineStyle(input:unknown,files:readonly string[]):Style {
  if(!input||typeof input!=='object')throw new Error('Style object missing');
  const style=input as Style;
  if(style.version!==8 || style.imports!==undefined || !style.sources || typeof style.sources!=='object' || Array.isArray(style.sources) || !Array.isArray(style.layers))throw new Error('Unsupported offline style');
  if(files.some(p=>!safeRelativePath(p)))throw new Error('Unsafe declared resource path');
  const declared=new Set(files);const need=(p:string)=>{if(!safeRelativePath(p)||!declared.has(p))throw new Error('Missing or unsafe offline resource: '+p);};
  const metadata=style.metadata as {omniOfflineResources?:Resources}|undefined;
  const resources=metadata?.omniOfflineResources;if(!resources)throw new Error('Complete offline resource declaration missing');
  const fonts=list(resources.fontStacks),ranges=list(resources.glyphRanges),sprites=list(resources.sprites),archives=list(resources.tileArchives);
  if(!archives.length || ranges.some(r=>!/^\d+-\d+$/.test(r)||Number(r.split('-')[0])%256!==0||Number(r.split('-')[1])!==Number(r.split('-')[0])+255||Number(r.split('-')[1])>65535))throw new Error('Invalid glyph ranges or missing tile archives');
  if(style.glyphs!==undefined){
    if(typeof style.glyphs!=='string'||!fonts.length||!ranges.includes('0-255')||style.glyphs.split('{fontstack}').length!==2||style.glyphs.split('{range}').length!==2)throw new Error('Relative glyph template missing');
    for(const font of fonts)for(const range of ranges)need(style.glyphs.replace('{fontstack}',font).replace('{range}',range));
  }else if(fonts.length||ranges.length)throw new Error('Glyph declaration has no template');
  if(style.sprite!==undefined){if(typeof style.sprite!=='string'||!safeRelativePath(style.sprite)||sprites.length!==1||sprites[0]!==style.sprite)throw new Error('Relative sprite atlas missing');for(const suffix of ['.json','.png','@2x.json','@2x.png'])need(style.sprite+suffix);}
  else if(sprites.length)throw new Error('Sprite declaration has no atlas');
  const usedArchives:string[]=[];
  for(const source of Object.values(style.sources as Record<string,unknown>)){
    if(!source||typeof source!=='object')throw new Error('Invalid style source');const s=source as Record<string,unknown>;
    if(s.type==='vector'){if(typeof s.url!=='string'||!s.url.endsWith('.pmtiles')||s.tiles!==undefined)throw new Error('Vector source requires relative PMTiles archive');need(s.url);usedArchives.push(s.url);}
    else if(s.type==='geojson'){if(typeof s.data==='string')need(s.data);else if(!s.data||typeof s.data!=='object')throw new Error('GeoJSON source must be retained local data');if(s.url!==undefined||s.tiles!==undefined)throw new Error('Unexpected GeoJSON resource URL');}
    else throw new Error('Unsupported offline source type');
  }
  if(new Set(usedArchives).size!==archives.length||archives.some(a=>!usedArchives.includes(a)))throw new Error('Tile archive declaration mismatch');
  for(const raw of style.layers){if(!raw||typeof raw!=='object')throw new Error('Invalid style layer');const layer=raw as {layout?:Record<string,unknown>};const layout=layer.layout;
    if(layout?.['text-field']!==undefined){const textFonts=layout['text-font'];if(!Array.isArray(textFonts)||!textFonts.length||textFonts.some(v=>typeof v!=='string')||!fonts.includes(textFonts.join(','))||style.glyphs===undefined)throw new Error('Text font stack lacks declared glyph coverage');}
    if(layout?.['icon-image']!==undefined && style.sprite===undefined)throw new Error('Icon layer lacks retained sprite atlas');
  }
  // Attribution/license HTTPS text is intentionally untouched; only known resource fields request bytes.
  return style;
}
function localURI(directory:string,path:string):string {
  if(!directory.startsWith('file:///')||directory.includes('..')||!safeRelativePath(path))throw new Error('Resource directory must be local and contained');
  return directory.replace(/\/+$/,'')+'/'+path.split('/').map(segment=>encodeURIComponent(segment)).join('/');
}
export function resolveOfflineStyle(input:unknown,files:readonly string[],directory:string):string {
  const style=JSON.parse(JSON.stringify(validateOfflineStyle(input,files))) as Style;
  if(typeof style.glyphs==='string'){
    const path=style.glyphs;if(!safeRelativePath(path.replace('{fontstack}','Font').replace('{range}','0-255')))throw new Error('Unsafe glyph template');
    style.glyphs=directory.replace(/\/+$/,'')+'/'+path.split('/').map(segment=>encodeURIComponent(segment)).join('/').replace('%7Bfontstack%7D','{fontstack}').replace('%7Brange%7D','{range}');
  }
  if(typeof style.sprite==='string')style.sprite=localURI(directory,style.sprite);
  for(const source of Object.values(style.sources as Record<string,Record<string,unknown>>)){
    if(source.type==='vector')source.url='pmtiles://'+localURI(directory,source.url as string);
    if(source.type==='geojson'&&typeof source.data==='string')source.data=localURI(directory,source.data);
  }
  return JSON.stringify(style);
}
export async function loadActiveStyle():Promise<string|null>{
  const directory=await getActivePackPath('stylepack');if(!directory)return null;
  const style=await new File(directory,'style.json').json() as Style;
  // Active verification already hashed every manifest-declared resource. Derive exact paths
  // from the verified complete declaration instead of allowing a separate untrusted manifest.
  const r=(style.metadata as {omniOfflineResources:Resources}).omniOfflineResources;
  const files=['style.json',...r.tileArchives,...r.sprites.flatMap(base=>['.json','.png','@2x.json','@2x.png'].map(ext=>base+ext)),...r.fontStacks.flatMap(font=>r.glyphRanges.map(range=>(style.glyphs as string).replace('{fontstack}',font).replace('{range}',range)))];
  for(const source of Object.values(style.sources as Record<string,Record<string,unknown>>))if(source.type==='geojson'&&typeof source.data==='string')files.push(source.data);
  return resolveOfflineStyle(style,files,directory);
}
