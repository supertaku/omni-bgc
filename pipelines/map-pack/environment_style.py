"""Native-supported urban surface presentation over unchanged source alignments."""

def refine(style):
    layers=style['layers']; by_id={layer['id']:layer for layer in layers}
    def width(casing=0):
        return ['interpolate',['linear'],['zoom'],14,['+',casing,['*',['get','display_width_m'],0.10]],18,['+',casing,['*',['get','display_width_m'],1.65]],20,['+',casing,['*',['get','display_width_m'],6.6]]]
    by_id['canvas']['paint']['background-color']='#F3F0E7'
    by_id['gardens']['paint']['fill-color']='#98BB86'
    by_id['garden-texture']['paint']['fill-opacity']=0.30
    by_id['garden-texture']['minzoom']=17
    by_id['plazas']['paint']={'fill-color':'#DED8CB','fill-outline-color':'#BEB8AC'}
    by_id['plaza-paving']['minzoom']=18
    by_id['plaza-paving']['paint']['fill-opacity']=0.45
    by_id['street-edge']['paint']={'line-color':'#B9B8AF','line-width':width(2)}
    by_id['street']['paint']={'line-color':['match',['get','highway'],'service','#737A7E','residential','#687279','#56626C'],'line-width':width()}
    by_id['path-edge']['paint']={'line-color':['match',['get','footway'],'sidewalk','#BABCB4','#C1B9A8'],'line-width':width(1.3)}
    by_id['walkways']['paint']={'line-color':['match',['get','surface'],'asphalt','#8A9090','concrete','#E0DED4','paving_stones','#D8CCB9','tiles','#D8CCB9','#E1D8C6'],'line-width':width()}
    pattern={'id':'source-pavement-pattern','type':'line','source':'geography','source-layer':'geometry','minzoom':18,'filter':['all',['==',['get','kind'],'path'],['in',['get','surface'],['literal',['concrete','paving_stones','tiles']]],['!=',['get','footway'],'crossing']],'layout':{'line-cap':'round','line-join':'round'},'paint':{'line-pattern':['match',['get','surface'],'concrete','concrete','paving'],'line-width':width(),'line-opacity':0.5}}
    layers.insert(layers.index(by_id['walkways'])+1,pattern)
    by_id['building-footprints']['paint']={'fill-color':'#BAC2C3','fill-outline-color':'#919D9F'}
    by_id['building-edges']['paint']['line-color']='#929FA2'
    by_id['source-trees']['minzoom']=17
    by_id['source-trees']['layout']['icon-size']=['interpolate',['linear'],['zoom'],17,0.40,19,0.65]
    by_id['road-labels']['minzoom']=17
    by_id['road-labels']['layout'].update({'text-size':11,'text-padding':12,'symbol-spacing':280})
    by_id['road-labels']['paint'].update({'text-color':'#30414A','text-halo-color':'#F3F0E7','text-halo-width':1.7})
    # Ground decoration must precede every extrusion layer. Native's 3D/opaque
    # depth cutoff follows style layer order (maplibre-native #2259/#2956).
    # Symbols after extrusions behave as overlays and can appear on roofs even
    # with source-correct ground positions. Keep upright art and collision rules.
    layers.insert(next(index for index,entry in enumerate(layers) if entry['type']=='fill-extrusion'),{'id':'illustrative-pedestrians','type':'symbol','source':'geography','source-layer':'geometry','minzoom':18,'filter':['==',['get','kind'],'pedestrian-decoration'],'layout':{'icon-image':['get','sprite'],'icon-anchor':'bottom','icon-size':['interpolate',['linear'],['zoom'],18,0.24,20,0.40],'icon-padding':6,'icon-allow-overlap':False,'icon-ignore-placement':False,'icon-pitch-alignment':'viewport','icon-rotation-alignment':'viewport'},'paint':{'icon-opacity':0.90}})
    style['light'].update({'color':'#F7FAFA','intensity':0.42,'position':[1.15,210,35]})
    style['metadata'].update({'version':'ux-city-v2.1','roads':'Source highways/surfaces/sidewalk classification retained; display widths use source width or explicit illustrative class fallback. No invented lane lines or sidewalk connections.','pedestrians':'Original static illustrations seeded on source named outdoor pedestrian paths, excluded near roads/buildings; no actual-person or navigation authority.','lod':{'overview':'14–16: source roads, footprints, shaded massing; no pedestrians','neighborhood':'17–18: source sidewalk distinction, varied facade motifs, trees','street':'18–20: source pavement patterns, six zebra ways, collision-managed illustrative people; sparse business names'}})
    return style
