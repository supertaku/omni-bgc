import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../../ui/icons';
import { palette } from '../../ui/components';
const categoryIcons: Record<string, IconName> = { All: 'map', Food: 'food', Coffee: 'coffee', Shops: 'shop' };
const categoryColors: Record<string, string> = { All: palette.blue, Food: '#BD531C', Coffee: '#79502F', Shops: palette.blue };

export function MapChrome({category,onCategory,onSearch,onFilters,onOrigin,onReset,onFlat,flat,onMore,onAssistant}: {
  category:string;onCategory:(value:string)=>void;onSearch:()=>void;onFilters:()=>void;
  onOrigin:()=>void;onReset:()=>void;onFlat:()=>void;flat:boolean;onMore:()=>void;onAssistant:()=>void;
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
        <Pressable onPress={onMore} accessibilityRole="button" accessibilityLabel="More categories, saved places and settings" style={styles.chipTarget}><View style={styles.chip}><Icon name="more" size={19}/><Text style={styles.chipText}>More</Text></View></Pressable>
      </ScrollView>
    </View>
    <View style={styles.tools}>
      <Pressable onPress={onAssistant} accessibilityRole="button" accessibilityLabel="Open Assistant" accessibilityHint="Search the local directory and return to the map" style={styles.tool}><Icon name="assistant" size={22} color={palette.blue}/></Pressable>
      <Pressable onPress={onFlat} accessibilityRole="button" accessibilityLabel={flat?'Show 2.5D map':'Show flat map'} accessibilityState={{selected:flat}} style={styles.tool}><Icon name="layers" size={21}/><Text style={styles.toolText}>{flat?'2.5D':'Flat'}</Text></Pressable>
      <Pressable onPress={onReset} accessibilityRole="button" accessibilityLabel="Reset map orientation" style={styles.tool}><Icon name="compass" size={23}/></Pressable>
      <Pressable onPress={onOrigin} accessibilityRole="button" accessibilityLabel="Choose your location or a manual origin" style={[styles.tool,styles.lastTool]}><Icon name="locate" size={24}/></Pressable>
    </View>
  </>;
}

const styles=StyleSheet.create({
  top:{position:'absolute',top:10,left:12,right:12,gap:2},
  search:{flexDirection:'row',alignItems:'center',backgroundColor:palette.canvas,borderRadius:24,minHeight:48,shadowColor:palette.ink,shadowOpacity:0.10,shadowRadius:6,elevation:3},
  searchLaunch:{flex:1,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,paddingVertical:10,minHeight:48},searchText:{flex:1,fontFamily:'OmniBody',fontSize:14,lineHeight:20,color:palette.muted},searchFilter:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},
  categories:{gap:6},chipTarget:{minHeight:48,justifyContent:'center'},chip:{minHeight:34,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:11,paddingVertical:5,backgroundColor:palette.canvas,borderRadius:18,borderWidth:1,borderColor:'#D4D9D7'},chipSelected:{backgroundColor:palette.selected,borderColor:palette.blue},chipText:{fontFamily:'OmniBodySemiBold',fontSize:13,lineHeight:20,color:palette.ink},pressed:{opacity:0.75},
  tools:{position:'absolute',right:12,bottom:24,width:48,backgroundColor:palette.canvas,borderRadius:24,overflow:'hidden',shadowColor:palette.ink,shadowOpacity:0.10,shadowRadius:6,elevation:3},tool:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',borderBottomWidth:1,borderColor:palette.divider,paddingVertical:5},lastTool:{borderBottomWidth:0},toolText:{fontSize:10,lineHeight:14,fontFamily:'OmniBodySemiBold',color:palette.ink},
});
