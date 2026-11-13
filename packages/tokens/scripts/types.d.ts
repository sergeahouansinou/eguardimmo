export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface RoleColor {
  path: string[];
  value: Rgba;
}

export type ScaleNode = number | string | { [key: string]: ScaleNode };

export interface Source {
  palette: Json;
  light: Json;
  dark: Json;
  scale: Json;
}

export interface Model {
  roles: { light: RoleColor[]; dark: RoleColor[] };
  scale: Record<string, ScaleNode>;
}

export interface RawToken {
  path: string[];
  type: string | undefined;
  value: Json;
}
