declare module "world-atlas/countries-50m.json" {
  const value: unknown;
  export default value;
}

declare module "world-atlas/countries-110m.json" {
  const value: unknown;
  export default value;
}

declare module "topojson-client" {
  export function feature(topology: unknown, object: unknown): unknown;
}

declare module "d3-geo" {
  export function geoMercator(): {
    fitExtent(extent: [[number, number], [number, number]], object: unknown): {
      (coords: [number, number]): [number, number] | null;
    };
    (coords: [number, number]): [number, number] | null;
  };
  export function geoPath(projection?: unknown): (object: unknown) => string | null;
}
