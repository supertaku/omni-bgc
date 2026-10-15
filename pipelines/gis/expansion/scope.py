"""GEX candidate-only geographic predicates. No active-map or routing integration."""
import math
import os

os.environ['PROJ_NETWORK'] = 'OFF'
from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform

FORWARD = Transformer.from_crs('EPSG:4326', 'EPSG:32651', always_xy=True)
INVERSE = Transformer.from_crs('EPSG:32651', 'EPSG:4326', always_xy=True)


def position(value):
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        raise ValueError('2D longitude/latitude required')
    lon, lat = value
    if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in value):
        raise ValueError('finite numeric coordinates required')
    if not -180 <= lon <= 180 or not -90 <= lat <= 90:
        raise ValueError('coordinate out of WGS84 range')
    return value


def polygon(value, regional=True):
    if not isinstance(value, dict) or value.get('type') not in ('Polygon', 'MultiPolygon'):
        raise ValueError('Polygon or MultiPolygon required')
    coords = value.get('coordinates')
    if not isinstance(coords, (list, tuple)) or not coords:
        raise ValueError('nonempty coordinates required')
    parts = [coords] if value['type'] == 'Polygon' else coords
    for rings in parts:
        if not isinstance(rings, (list, tuple)) or not rings:
            raise ValueError('nonempty polygon required')
        for ring in rings:
            if not isinstance(ring, (list, tuple)) or len(ring) < 4:
                raise ValueError('ring needs at least four positions')
            for p in ring:
                lon, lat = position(p)
                if regional and not (121.03 <= lon <= 121.07 and 14.53 <= lat <= 14.57):
                    raise ValueError('outside BGC research region or axis order wrong')
            if tuple(ring[0]) != tuple(ring[-1]):
                raise ValueError('unclosed ring; implicit repair forbidden')
    result = shape(value)
    if result.is_empty or not result.is_valid or result.area <= 0:
        raise ValueError('invalid/empty/zero-area polygon; repair forbidden')
    return result


def metric_buffer(geometry, metres):
    if isinstance(metres, bool) or not isinstance(metres, (int, float)) or not math.isfinite(metres) or not 0 < metres <= 1000:
        raise ValueError('bounded positive metre buffer required')
    return transform(INVERSE.transform, transform(FORWARD.transform, geometry).buffer(metres, quad_segs=16))


def classify_point(coordinate, service, context, excluded):
    if service.intersection(excluded).area > 0 or service.intersection(context).area > 0:
        raise ValueError('coverage masks overlap service interior; exclusions must be scope holes')
    p = Point(position(coordinate))
    # Scope is boundary inclusive. Outside-service context never grants detail.
    if service.covers(p):
        return 'FULL_DETAIL_CANDIDATE'
    if context.covers(p):
        return 'LIMITED_CONTEXT'
    if excluded.covers(p):
        return 'EXCLUDED_DETAIL'
    return 'UNSUPPORTED'


def feature_membership(geometry, service):
    return {'intersects': service.intersects(geometry), 'fully_covered': service.covers(geometry),
            'crosses_boundary': service.intersects(geometry) and not service.covers(geometry)}
