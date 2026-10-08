/**
 * Visual and wording theme per commodity. Chosen from the admin panel; the
 * game, project page and coin all re-skin from this table.
 */
export interface CommodityTheme {
  id: string;
  label: string;
  unit: string;
  unitShort: string;
  verb: string;
  /** RGB triplets for Tailwind's rgb(var(--x) / alpha) pattern. */
  brand: string;
  brandSoft: string;
  brandDeep: string;
  coin: { light: string; mid: string; dark: string; rim: string; text: string };
  glyph: string;
}

export const COMMODITIES: Record<string, CommodityTheme> = {
  GOLD: {
    id: "GOLD", label: "Gold", unit: "ounces", unitShort: "oz", verb: "MINE",
    brand: "245 184 52", brandSoft: "255 221 128", brandDeep: "158 108 12",
    coin: { light: "#ffe98a", mid: "#f2b734", dark: "#9c6a0c", rim: "#5e3d05", text: "#5e3d05" },
    glyph: "Au",
  },
  OIL: {
    id: "OIL", label: "Oil", unit: "barrels", unitShort: "bbl", verb: "DRILL",
    brand: "72 206 170", brandSoft: "150 240 214", brandDeep: "18 110 86",
    coin: { light: "#4d6572", mid: "#1d2a33", dark: "#0b1116", rim: "#48ceaa", text: "#9af0d6" },
    glyph: "Oil",
  },
  SILVER: {
    id: "SILVER", label: "Silver", unit: "ounces", unitShort: "oz", verb: "MINE",
    brand: "196 210 226", brandSoft: "236 242 250", brandDeep: "104 122 146",
    coin: { light: "#f6f9ff", mid: "#c3cfdd", dark: "#6e7f95", rim: "#3f4b5c", text: "#2d3542" },
    glyph: "Ag",
  },
  COPPER: {
    id: "COPPER", label: "Copper", unit: "tonnes", unitShort: "t", verb: "MINE",
    brand: "232 126 70", brandSoft: "255 184 140", brandDeep: "140 62 24",
    coin: { light: "#ffc9a3", mid: "#d97a3f", dark: "#7a3a15", rim: "#4a2109", text: "#4a2109" },
    glyph: "Cu",
  },
  LITHIUM: {
    id: "LITHIUM", label: "Lithium", unit: "tonnes", unitShort: "t", verb: "EXTRACT",
    brand: "160 140 255", brandSoft: "208 196 255", brandDeep: "80 60 170",
    coin: { light: "#e4dcff", mid: "#a08cff", dark: "#4b3aa6", rim: "#2a2060", text: "#2a2060" },
    glyph: "Li",
  },
};

export const COMMODITY_IDS = Object.keys(COMMODITIES);

export function themeFor(commodity: string): CommodityTheme {
  return COMMODITIES[commodity] ?? COMMODITIES.GOLD;
}
