import { Pressable, ScrollView, StyleSheet, Text, View, Platform, StatusBar } from 'react-native';
import { Icon, type IconName } from '../../ui/icons';
import { palette } from '../../ui/components';

const categoryIcons: Record<string, IconName> = { All: 'map', Food: 'food', Coffee: 'coffee', Shops: 'shop' };
const categoryColors: Record<string, string> = { All: palette.blue, Food: '#BD531C', Coffee: '#79502F', Shops: palette.blue };
export function MapChrome({category,onCategory,onSearch,onFilters,onOrigin,onReset,onFlat,flat,onMore}: {
  category:string;onCategory:(value:string)=>void;onSearch:()=>void;onFilters:()=>void;
  onOrigin:()=>void;onReset:()=>void;onFlat:()=>void;flat:boolean;onMore:()=>void;
}) {
  return <>
    <View style={styles.top} pointerEvents="box-none">
      <View style={styles.search}>
        <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel="Search places or dishes" style={({pressed})=>[styles.searchLaunch,pressed&&styles.pressed]}>
          <Icon name="search" size={24}/><Text style={styles.searchText}>Search places or dishes</Text>
        </Pressable>
        <Pressable onPress={onFilters} accessibilityRole="button" accessibilityLabel="Search filters" style={styles.searchFilter}><Icon name="filters" size={24}/></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {['All','Food','Coffee','Shops'].map(value=><Pressable key={value} onPress={()=>onCategory(value)} accessibilityRole="button" accessibilityLabel={`${value} places`} accessibilityState={{selected:category===value}} style={({pressed})=>[styles.chip,category===value&&styles.chipSelected,pressed&&styles.pressed]}>
          <Icon name={categoryIcons[value]} size={20} color={categoryColors[value]}/><Text style={[styles.chipText,category===value&&{color:palette.blue}]}>{value}</Text>
        </Pressable>)}
        <Pressable onPress={onMore} accessibilityRole="button" accessibilityLabel="More categories, saved places and settings" style={styles.chip}><Icon name="more" size={22}/><Text style={styles.chipText}>More</Text></Pressable>
      </ScrollView>
    </View>
    <View style={styles.tools}>
      <Pressable onPress={onFlat} accessibilityRole="button" accessibilityLabel={flat?'Show 2.5D map':'Show flat map'} accessibilityState={{selected:flat}} style={styles.smallTool}><Icon name="layers" size={22}/><Text style={styles.toolText}>{flat?'2.5D':'Flat'}</Text></Pressable>
      <Pressable onPress={onReset} accessibilityRole="button" accessibilityLabel="Reset map orientation" style={styles.tool}><Icon name="map" size={23}/></Pressable>
      <Pressable onPress={onOrigin} accessibilityRole="button" accessibilityLabel="Choose your location or a manual origin" style={styles.tool}><Icon name="locate" size={27}/></Pressable>
    </View>
  </>;
}

export function BottomTabs({tab,onChange}:{tab:'Map'|'Assistant';onChange:(tab:'Map'|'Assistant')=>void}) {
  return <View style={styles.tabs} accessibilityRole="tablist">{(['Map','Assistant'] as const).map(value=><Pressable key={value} onPress={()=>onChange(value)} accessibilityRole="tab" accessibilityLabel={value} accessibilityState={{selected:tab===value}} style={styles.tab}>
    <Icon name={value==='Map'?'map':'assistant'} size={25} color={tab===value?palette.blue:palette.ink}/>
    <Text style={[styles.tabText,tab===value&&{color:palette.blue}]}>{value}</Text>
    <View style={[styles.tabUnderline,tab===value&&{backgroundColor:palette.blue}]}/>
  </Pressable>)}</View>;
}
const styles=StyleSheet.create({
  top:{position:'absolute',top:12,left:16,right:16,gap:10},
  search:{flexDirection:'row',alignItems:'center',backgroundColor:palette.canvas,borderRadius:28,minHeight:56,shadowColor:palette.ink,shadowOpacity:0.12,shadowRadius:10,elevation:5},
  searchLaunch:{flex:1,flexDirection:'row',alignItems:'center',gap:12,padding:16,minHeight:56},searchText:{flex:1,fontFamily:'OmniBody',fontSize:16,lineHeight:23,color:palette.muted},searchFilter:{minWidth:52,minHeight:56,alignItems:'center',justifyContent:'center',paddingRight:8},
  categories:{gap:8,paddingBottom:6},chip:{minHeight:48,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:15,paddingVertical:10,backgroundColor:palette.canvas,borderRadius:24,shadowColor:palette.ink,shadowOpacity:0.08,shadowRadius:6,elevation:2,borderWidth:1,borderColor:'#E3E3DC'},chipSelected:{backgroundColor:palette.selected,borderColor:palette.blue},chipText:{fontFamily:'OmniBodySemiBold',fontSize:14,lineHeight:21,color:palette.ink},pressed:{opacity:0.75},
  tools:{position:'absolute',right:16,bottom:20,gap:10,alignItems:'flex-end'},tool:{width:56,minHeight:56,borderRadius:28,backgroundColor:palette.canvas,alignItems:'center',justifyContent:'center',shadowColor:palette.ink,shadowOpacity:0.12,shadowRadius:8,elevation:4},smallTool:{minWidth:56,minHeight:48,flexDirection:'row',gap:6,paddingHorizontal:12,borderRadius:24,backgroundColor:palette.canvas,alignItems:'center',justifyContent:'center',elevation:2},toolText:{fontSize:14,fontFamily:'OmniBodySemiBold',color:palette.ink},
  tabs:{flexDirection:'row',backgroundColor:palette.canvas,borderTopLeftRadius:26,borderTopRightRadius:26,paddingHorizontal:24,paddingTop:10,paddingBottom:Platform.OS==='android'?16:6,shadowColor:palette.ink,shadowOpacity:0.06,shadowRadius:12,elevation:8},tab:{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:6,gap:4,minHeight:64},tabText:{fontFamily:'OmniBodySemiBold',fontSize:14,lineHeight:20,color:palette.ink},tabUnderline:{height:3,width:48,borderRadius:2,backgroundColor:'transparent',marginTop:3},
});
