import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, StyleSheet, Text, View } from 'react-native';

// One bundled glyph family: no network images, emoji or platform-dependent symbols.
const glyphs = {
  map:'map-outline', assistant:'chatbubbles-outline', search:'search-outline',
  filters:'options-outline', locate:'locate-outline', food:'restaurant-outline',
  coffee:'cafe-outline', shop:'bag-handle-outline', more:'ellipsis-horizontal',
  back:'chevron-back', close:'close', bookmark:'bookmark-outline', saved:'bookmark',
  route:'navigate-outline', park:'leaf-outline', transit:'bus-outline',
  building:'business-outline', hotel:'bed-outline', parking:'car-outline',
  send:'send', settings:'settings-outline', chevron:'chevron-forward',
  down:'chevron-down', up:'chevron-up', clock:'time-outline', menu:'list-outline',
  info:'information-circle-outline', warning:'alert-circle-outline',
  location:'location-outline', layers:'layers-outline', check:'checkmark',
  plus:'add', remove:'trash-outline', image:'image-outline', walk:'walk-outline',
  accessibility:'accessibility-outline', compass:'compass-outline',
} as const;
export type IconName = keyof typeof glyphs;
export function Icon({name,size=22,color='#10243A'}:{name:IconName;size?:number;color?:string}) {
  return <Ionicons name={glyphs[name]} size={size} color={color} accessible={false} allowFontScaling={false} />;
}

// Shared original architectural mark for the launcher, splash and assistant.
export function BrandMark({size=36,wordmark=false}:{size?:number;wordmark?:boolean}) {
  return <View style={styles.brand} accessible={false}>
    <View style={{width:size,height:size,overflow:'hidden'}}>
      <Image source={require('../../assets/brand/icon.png')} resizeMode="stretch"
        style={{width:size,height:size,borderRadius:size*.22}} />
    </View>
    {wordmark?<Text style={styles.wordmark}>The Fort</Text>:null}
  </View>;
}
export function categoryIcon(category:string):IconName {
  const value=category.toLowerCase();
  if(/coffee|café|cafe/.test(value))return 'coffee';
  if(/food|restaurant|dining/.test(value))return 'food';
  if(/shop|mall|retail/.test(value))return 'shop';
  if(/parking/.test(value))return 'parking';
  if(/park|garden/.test(value))return 'park';
  if(/hotel/.test(value))return 'hotel';
  if(/transit|bus/.test(value))return 'transit';
  return 'building';
}
const categoryColors = {
  food:['#FFF0E4','#A4441B'],coffee:['#F4E9DD','#795236'],shop:['#E5EEFD','#1756C0'],
  park:['#E8F1DF','#3E6F33'],hotel:['#EBE8FA','#5A499A'],transit:['#E5EEFD','#1756C0'],
  parking:['#E8EEF1','#40586A'],building:['#E4ECEF','#3E6476'],
} as const;
/** Symbolic category art, never a photograph or depiction of a real property. */
export function CategoryArtwork({category,size=64}:{category:string;size?:number}) {
  const name=categoryIcon(category), colors=categoryColors[name as keyof typeof categoryColors]??categoryColors.building;
  return <View accessible={false} style={{width:size,height:size,borderRadius:size*.27,backgroundColor:colors[0],alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
    <View style={{position:'absolute',height:size*.8,width:size*.8,borderRadius:size/2,backgroundColor:'#FFFFFF',opacity:.55,left:-size*.22,bottom:-size*.28}}/>
    <View style={{position:'absolute',height:size*.16,width:size*.16,borderRadius:size/2,backgroundColor:colors[1],opacity:.12,right:size*.12,top:size*.12}}/>
    <Icon name={name} size={size*.44} color={colors[1]}/>
  </View>;
}
const styles=StyleSheet.create({brand:{flexDirection:'row',alignItems:'center',gap:10},wordmark:{fontFamily:'OmniHeading',fontSize:26,color:'#10243A',flexShrink:1}});
