"""Presentation-only height/family interpretation of retained OSM tags.

No canonical facts are edited. Source values stay historical, unverified evidence;
level conversions and family defaults are explicitly separate display estimates.
"""
import re

FAMILIES = {
    'glass-office': ('#72B6C9', 30), 'residential': ('#D5C8AA', 24),
    'commercial': ('#C4B9A1', 18), 'midrise-office': ('#88B4C4', 24),
    'mall': ('#DFC197', 20), 'lowrise-retail': ('#DAA988', 9),
    'hotel': ('#B7ABC8', 24), 'civic': ('#D4CBAA', 12),
    'mixed-use': ('#A5C6BC', 24), 'unknown': ('#BECCC6', 12),
}

def meters(value):
    if not isinstance(value, str): return None
    value = value.strip()
    metric = re.fullmatch(r'(\d+(?:\.\d+)?)(?: m)?', value)
    imperial = re.fullmatch(r'(\d+)\'(\d+(?:\.\d+)?)"', value)
    if metric: result = float(metric[1])
    elif imperial and float(imperial[2]) < 12: result = int(imperial[1]) * .3048 + float(imperial[2]) * .0254
    else: return None
    return round(result, 4) if 0 <= result <= 1000 else None

def levels(value):
    return int(value) if isinstance(value, str) and re.fullmatch(r'[1-9]\d*', value) and int(value) <= 200 else None

def building_presentation(tags):
    height = meters(tags.get('height'))
    if height == 0: height = None
    count = levels(tags.get('building:levels'))
    building = tags.get('building', tags.get('building:part', 'yes'))
    family = 'unknown'
    if tags.get('shop') == 'mall': family = 'mall'
    elif building in ('apartments', 'residential'): family = 'residential'
    elif building == 'hotel' or tags.get('tourism') == 'hotel': family = 'hotel'
    elif building in ('civic', 'public', 'school', 'hospital', 'university'): family = 'civic'
    elif building in ('retail', 'shop'): family = 'lowrise-retail'
    elif building == 'commercial': family = 'commercial'
    elif building in ('mixed_use', 'mixed-use'): family = 'mixed-use'
    elif building == 'office':
        family = 'glass-office' if tags.get('building:material') == 'glass' or (height or (count or 0)*3) >= 50 else 'midrise-office'
    display = height if height is not None else count*3 if count else FAMILIES[family][1]
    basis = 'osm-height-unverified' if height is not None else 'osm-levels-estimate-3m' if count else 'illustrative-family-default'
    base = meters(tags.get('min_height'))
    base_basis = 'osm-min-height-unverified' if base is not None else 'ground-default'
    if base is None and levels(tags.get('building:min_level')):
        base = levels(tags['building:min_level'])*3; base_basis = 'osm-min-level-estimate-3m'
    base = base or 0
    invalid_base = base >= display
    if invalid_base: base = 0; base_basis = 'invalid-source-base-ground-fallback'
    props = {'visual_family': family, 'visual_height': display, 'visual_base': base,
             'height_basis': basis, 'base_basis': base_basis,
             'facade_pattern': 'facade-'+family, 'roof_color': FAMILIES[family][0],
             'building_part': 'building:part' in tags, 'render_extrusion': True}
    if height is not None: props['source_height_m'] = height
    if count is not None: props['source_levels'] = count
    if height is None: props['estimated_visual_height_m'] = display
    return props
