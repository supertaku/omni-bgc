import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place } from '../../contracts';
import { Icon, type IconName } from '../../ui/icons';
import { palette } from '../../ui/components';
import { previewImage, placeImageKey } from '../../preview/media';
import { INTERNAL_PREVIEW_ENABLED } from '../../preview/directory';

export function placeIcon(category:string):IconName {
  const value=category.toLowerCase();
  return /food|restaurant/.test(value)?'food':/coffee|cafe/.test(value)?'coffee':/shop|mall/.test(value)?'shop':/park|garden/.test(value)?'park':/hotel/.test(value)?'hotel':/parking/.test(value)?'parking':'building';
}

export function PlaceRow({place,onPress}:{place:Place;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${place.name}, ${place.category}. Open details`} onPress={onPress} style={({pressed})=>[styles.row,pressed&&{backgroundColor:palette.selected}]}>
    <View style={styles.art}>{INTERNAL_PREVIEW_ENABLED ? <Image source={previewImage(place.imageKey ?? placeImageKey(place.category))} style={{width:40,height:40,borderRadius:12}} accessibilityLabel={`${place.category} illustration`}/> : <Icon name={placeIcon(place.category)} size={21} color={palette.blue}/>}</View>
    <View style={styles.text}><Text style={styles.name}>{place.name}</Text><Text style={styles.caption}>{[place.category,place.building,place.floor?`Floor ${place.floor}`:null].filter(Boolean).join(' · ')}</Text></View>
    <Icon name="chevron" size={20} color={palette.muted}/>
  </Pressable>;
}

export function PlaceCover({place}:{place:Place}) {
  if (INTERNAL_PREVIEW_ENABLED) return <Image source={previewImage(place.imageKey ?? placeImageKey(place.category))} style={{width:'100%',height:150,borderRadius:14}} accessibilityLabel={`Illustrative ${place.category} cover for ${place.name}`} />;
  return <View style={styles.cover} accessible accessibilityLabel={`${place.category} at ${place.name}`}>
    <View style={styles.circle}><Icon name={placeIcon(place.category)} size={29} color={palette.blue}/></View>
    <View style={styles.text}><Text style={styles.coverLabel}>{place.category}</Text><Text style={styles.caption}>{place.building??'Bonifacio Global City'}{place.floor?` · Floor ${place.floor}`:''}</Text>{place.cuisines?.length?<Text style={styles.caption}>{place.cuisines.map(value=>value.replace(/_/g,' ')).join(' · ')}</Text>:null}</View>
  </View>;
}

const styles=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10,minHeight:64,borderBottomWidth:1,borderBottomColor:'#E6E8E4'},art:{width:40,height:40,borderRadius:12,backgroundColor:palette.selected,alignItems:'center',justifyContent:'center'},text:{flex:1,gap:4},name:{fontFamily:'OmniBodySemiBold',fontSize:15,lineHeight:22,color:palette.ink},caption:{fontFamily:'OmniBody',fontSize:13,lineHeight:20,color:palette.muted},cover:{backgroundColor:'#EDF2E5',borderRadius:14,padding:12,flexDirection:'row',alignItems:'center',gap:12,minHeight:76},circle:{width:48,height:48,borderRadius:24,backgroundColor:palette.canvas,alignItems:'center',justifyContent:'center'},coverLabel:{fontFamily:'OmniHeading',fontSize:17,lineHeight:24,color:palette.ink}});
