/** @format */

declare module "react-simple-maps" {
  import type { ComponentType, ReactNode, SVGProps } from "react";

  type GeographyRenderArgs = {
    geographies: Array<Record<string, unknown>>;
    projection?: unknown;
    path?: unknown;
  };

  export const ComposableMap: ComponentType<
    SVGProps<SVGSVGElement> & {
      projection?: string | unknown;
      projectionConfig?: Record<string, unknown>;
      width?: number;
      height?: number;
      children?: ReactNode;
    }
  >;

  export const Geographies: ComponentType<{
    geography: string | Record<string, unknown>;
    children: (args: GeographyRenderArgs) => ReactNode;
  }>;

  export const Geography: ComponentType<
    SVGProps<SVGPathElement> & {
      geography: Record<string, unknown>;
      style?: Record<string, unknown>;
    }
  >;

  export const Marker: ComponentType<
    SVGProps<SVGGElement> & {
      coordinates: [number, number];
      children?: ReactNode;
    }
  >;

  export const Line: ComponentType<
    SVGProps<SVGPathElement> & {
      from: [number, number];
      to: [number, number];
    }
  >;

  export const Graticule: ComponentType<SVGProps<SVGPathElement>>;
}
