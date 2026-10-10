"""Adversarial source interpretation contract; no external inputs required."""
from building_metadata import meters, levels, building_presentation, FAMILIES

assert meters('30.5') == 30.5
assert meters('41.1 m') == 41.1
assert meters('7\'4"') == 2.2352
for value in ('NaN','-3','1,5','30;45','6 ft','7\'15"','1001','Infinity',None): assert meters(value) is None, value
for value in ('1.5','0','-1','4;5','201',None): assert levels(value) is None, value
assert levels('42') == 42
explicit = building_presentation({'height':'30.5','building:levels':'8','building':'commercial'})
assert explicit['visual_height'] == explicit['source_height_m'] == 30.5
assert 'estimated_visual_height_m' not in explicit
estimated = building_presentation({'building:levels':'42','building':'office'})
assert estimated['visual_height'] == 126 and 'source_height_m' not in estimated
assert estimated['height_basis']=='osm-levels-estimate-3m'
unknown = building_presentation({'building':'yes'})
assert unknown['visual_height']==12 and 'source_levels' not in unknown and 'source_height_m' not in unknown
assert unknown['height_basis']=='illustrative-family-default'
assert building_presentation({'height':'9','min_height':'12'})['visual_base']==0
assert building_presentation({'height':'25.9','min_height':'5.2'})['visual_base']==5.2
assert building_presentation({'height':'31.1','building:part':'yes'})['building_part']
for family in FAMILIES:
    assert FAMILIES[family][1]>0
print('PASS height units, invalid source rejection, source/display separation, valid levels, safe bases and building parts')
