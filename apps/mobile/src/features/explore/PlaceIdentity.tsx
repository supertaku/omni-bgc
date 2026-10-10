import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place } from '../../contracts';
import { Icon, type IconName } from '../../ui/icons';
import { palette } from '../../ui/components';

export function placeIcon(category:string):IconName {
  const value=category.toLowerCase();
  return /food|restaurant/.test(value)?'food':/coffee|cafe/.test(value)?'coffee':/shop|mall/.test(value)?'shop':/park|garden/.test(value)?'park':/hotel/.test(value)?'hotel':/parking/.test(value)?'parking':'building';
}
export function PlaceRow({place,onPress}:{place:Place;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${place.name}, ${place.category}. Open details`} onPress={onPress} style={({pressed})=>[styles.row,pressed&&{backgroundColor:palette.selected}]}>
    <View style={styles.art}><Icon name={placeIcon(place.category)} size={24} color={palette.blue}/></View>
    <View style={styles.text}><Text style={styles.name}>{place.name}</Text><Text style={styles.caption}>{[place.category,place.building,place.floor?`Floor ${place.floor}`:null].filter(Boolean).join(' · ')}</Text></View>
    <Icon name="chevron" size={20} color={palette.muted}/>
  </Pressable>;
}
export function PlaceCover({place}:{place:Place}) {
  return <View style={styles.cover} accessible accessibilityLabel={`${place.category} at ${place.name}`}>
    <View style={styles.circle}><Icon name={placeIcon(place.category)} size={40} color={palette.blue}/></View>
    <View style={styles.text}><Text style={styles.coverLabel}>{place.category}</Text><Text style={styles.caption}>{place.building??'Bonifacio Global City'}{place.floor?` · Floor ${place.floor}`:''}</Text>{place.cuisines?.length?<Text style={styles.caption}>{place.cuisines.map(value=>value.replace(/_/g,' ')).join(' · ')}</Text>:null}</View>
  </View>;
}
const styles=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,minHeight:76,borderBottomWidth:1,borderBottomColor:'#E6E8E4'},art:{width:48,height:48,borderRadius:16,backgroundColor:palette.selected,alignItems:'center',justifyContent:'center'},text:{flex:1,gap:4},name:{fontFamily:'OmniBodySemiBold',fontSize:16,lineHeight:24,color:palette.ink},caption:{fontFamily:'OmniBody',fontSize:14,lineHeight:21,color:palette.muted},cover:{backgroundColor:'#EDF2E5',borderRadius:20,padding:20,flexDirection:'row',alignItems:'center',gap:18,minHeight:112},circle:{width:72,height:72,borderRadius:36,backgroundColor:palette.canvas,alignItems:'center',justifyContent:'center'},coverLabel:{fontFamily:'OmniHeading',fontSize:20,lineHeight:28,color:palette.ink}});
