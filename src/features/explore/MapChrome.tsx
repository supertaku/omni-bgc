import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../../ui/icons';
import { palette } from '../../ui/components';
const categoryIcons: Record<string, IconName> = { All: 'map', Food: 'food', Coffee: 'coffee', Shops: 'shop' };
const categoryColors: Record<string, string> = { All: palette.blue, Food: '#BD531C', Coffee: '#79502F', Shops: palette.blue };

export function MapChrome({category,onCategory,onSearch,onFilters,onFlat,flat,onMore}: {
  category:string;onCategory:(value:string)=>void;onSearch:()=>void;onFilters:()=>void;
  onFlat:()=>void;flat:boolean;onMore:()=>void;
}) {
  return <>
    <View style={styles.top} pointerEvents="box-none">
      <View style={styles.search}>
        <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel="Search places or dishes" style={({pressed})=>[styles.searchLaunch,pressed&&styles.pressed]}>
          <Icon name="search" size={20}/><Text style={styles.searchText}>Search places or dishes</Text>
        </Pressable>
        <Pressable onPress={onFilters} accessibilityRole="button" accessibilityLabel="Search filters" style={styles.searchFilter}><Icon name="filters" size={20}/></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {['All','Food','Coffee','Shops'].map(value=><Pressable key={value} onPress={()=>onCategory(value)} accessibilityRole="button" accessibilityLabel={`${value} places`} accessibilityState={{selected:category===value}} style={({pressed})=>[styles.chipTarget,pressed&&styles.pressed]}>
          <View style={[styles.chip,category===value&&styles.chipSelected]}><Icon name={categoryIcons[value]} size={17} color={categoryColors[value]}/><Text style={[styles.chipText,category===value&&{color:palette.blue}]}>{value}</Text></View>
        </Pressable>)}
      </ScrollView>
      <Pressable onPress={onMore} accessibilityRole="button" accessibilityLabel="More categories" style={({pressed})=>[styles.moreTarget,pressed&&styles.pressed]}>
        <View style={styles.chip}><Icon name="more" size={19}/><Text style={styles.chipText}>More</Text></View>
      </Pressable>
    </View>
    <View style={styles.tools}>
      <Pressable onPress={onFlat} accessibilityRole="button" accessibilityLabel={flat?'Show 2.5D map':'Show flat map'} accessibilityState={{selected:flat}} style={styles.tool}><Icon name="layers" size={21}/><Text style={styles.toolText}>{flat?'2.5D':'Flat'}</Text></Pressable>
    </View>
  </>;
}

/** Parent places exactly one Chat control above the measured sheet/camera inset. */
export function FloatingChatButton({onPress,bottom=24,right=12}:{onPress:()=>void;bottom?:number;right?:number}) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open Assistant"
    accessibilityHint="Your map and selected place stay open" style={({pressed})=>[styles.chat,{bottom,right},pressed&&styles.pressed]}>
    <Icon name="assistant" size={24} color={palette.ink}/>
  </Pressable>;
}

const styles=StyleSheet.create({
  top:{position:'absolute',top:10,left:12,right:12,gap:2},
  search:{flexDirection:'row',alignItems:'center',backgroundColor:palette.canvas,borderRadius:24,minHeight:48,shadowColor:palette.ink,shadowOpacity:0.10,shadowRadius:6,elevation:3},
  searchLaunch:{flex:1,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,paddingVertical:10,minHeight:48},searchText:{flex:1,fontFamily:'OmniBody',fontSize:14,lineHeight:20,color:palette.muted},searchFilter:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},
  categories:{gap:6,paddingRight:86},chipTarget:{minHeight:48,justifyContent:'center'},moreTarget:{position:'absolute',right:0,top:50,minHeight:48,justifyContent:'center',backgroundColor:palette.canvas,borderRadius:18},chip:{minHeight:34,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:11,paddingVertical:5,backgroundColor:palette.canvas,borderRadius:18,borderWidth:1,borderColor:'#D4D9D7'},chipSelected:{backgroundColor:palette.selected,borderColor:palette.blue},chipText:{fontFamily:'OmniBodySemiBold',fontSize:13,lineHeight:20,color:palette.ink},pressed:{opacity:0.75},
  tools:{position:'absolute',right:12,bottom:84,width:48,backgroundColor:palette.canvas,borderRadius:24,overflow:'hidden',shadowColor:palette.ink,shadowOpacity:0.10,shadowRadius:6,elevation:3},tool:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',paddingVertical:5},toolText:{fontSize:10,lineHeight:14,fontFamily:'OmniBodySemiBold',color:palette.ink},
  chat:{position:'absolute',width:48,height:48,borderRadius:24,backgroundColor:palette.surface,alignItems:'center',justifyContent:'center',shadowColor:palette.ink,shadowOpacity:.14,shadowRadius:6,elevation:5},
});
