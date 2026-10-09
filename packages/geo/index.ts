export type Wgs84 = Readonly<{ crs: 'EPSG:4326'; longitude: number; latitude: number }>;
export type Metres = number & { readonly __metres: unique symbol };
export function wgs84(longitude: number, latitude: number): Wgs84 {
 if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) throw new Error('Invalid WGS84 position');
 return { crs: 'EPSG:4326', longitude, latitude };
}
export function metres(value: number): Metres {
 if (!Number.isFinite(value) || value < 0) throw new Error('Invalid metric length');
 return value as Metres;
}
export interface MetricLineage { method: 'geodesic' | 'projected'; crs: string; implementation: string; sourceGeometryFactId: string; }
