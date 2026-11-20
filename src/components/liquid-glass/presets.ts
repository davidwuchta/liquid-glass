import type React from "react";

export type GlassTheme = "dark" | "light";
export type GlassVariant = "clear" | "opaque" | "tinted";
export type GlassTintColor =
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple";

export const GLASS_TINT_PRESETS: Record<GlassTintColor, string> = {
  blue: "#0088FF",
  green: "#34C759",
  yellow: "#FFCC00",
  orange: "#FF8D28",
  red: "#FF383C",
  purple: "#CB30E0",
};

export interface GlassFill {
  color: string;
  blendMode?: React.CSSProperties["mixBlendMode"];
}

export function parseHexColor(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [0, 136, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export const GLASS_CONFIG = {
  cache: {
    maxEntries: 24,
  },
  defaults: {
    theme: "dark" as GlassTheme,
    variant: "clear" as GlassVariant,
    tint: "blue" as GlassTintColor,
    refraction: 70,
    depth: 30,
    dispersion: 20,
    frost: 6,
    splay: 20,
    lightAngle: 0,
    lightOpacity: 25,
    radius: 23,
  },
  refraction: {
    baseScaleFactor: 68,
    chromaOffsetFactor: 14,
    frostStdDevFactor: 0.35,
    fallbackBlurFactor: 0.5,
    dispMapBlurStdDev: 1.5,
    normalEps: 0.25,
    shoulderThreshold: 0.8,
  },
  bevel: {
    shadeRadiusFactor: 1.25,
    shadeDepthMin: 24,
    shadeDepthFactor: 1.35,
    topDarkenScale: 0.12,
    topProfileExp: 2.0,
    topDirExp: 1.5,
    bottomBrightenScale: 0.045,
    bottomProfileExp: 1.95,
    bottomDirExp: 2.0,
  },
  innerShadowLight: {
    // Inner Shadows 1 & 2 (Top + Bottom, Plus lighter)
    depth: 8,
    peak: 0.08, // Dark Clear (#1A1A1A)
    falloff: 2.2,
    dirExp: 1.8,
  },
  innerShadowDark: {
    // Inner Shadow 3 (Top only: #E6E6E6, Plus darker)
    depth: 28,
    peak: 0.025,
    falloff: 1.9,
    dirExp: 1.8,
  },
  rim: {
    primaryScale: 0.7,
    bounceScale: 0.42,
    exp: 2.2,
    widthPx: 1,
  },
  dropShadow: {
    // DS 1 & 2: x: ±1.25, y: 0, blur: 0, spread: -0.75 (#D0D0D0, Plus darker)
    sidesWidthPx: 1,
    sidesSub: 0.092,
    // DS 3: x: 0, y: 0, blur: 0, spread: 0.5 (#CCCCCC, Plus darker)
    allWidthPx: 1,
    allSub: 0.1,
    // DS 4: x: 0, y: 8, blur: 15, spread: 0 (#000000 4%, Normal)
    ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)",
  },
  fills: [
    // Default (Dark Clear): #999999 17%, Luminosity
    { color: "rgba(153, 153, 153, 0.17)", blendMode: "luminosity" },
  ] as GlassFill[],
};

export interface PresetOverride {
  refraction?: number;
  depth?: number;
  dispersion?: number;
  frost?: number;
  splay?: number;
  lightAngle?: number;
  lightOpacity?: number;
  backingColor?: string;
  bevel?: Partial<typeof GLASS_CONFIG.bevel>;
  innerShadowLight?: Partial<typeof GLASS_CONFIG.innerShadowLight>;
  innerShadowDark?: Partial<typeof GLASS_CONFIG.innerShadowDark>;
  rim?: Partial<typeof GLASS_CONFIG.rim>;
  dropShadow?: Partial<typeof GLASS_CONFIG.dropShadow>;
  fills?: GlassFill[];
}

export const GLASS_PRESETS: Record<
  GlassTheme,
  Record<GlassVariant, PresetOverride>
> = {
  dark: {
    clear: {
      innerShadowLight: { peak: 0.08 },
      dropShadow: {
        sidesSub: 0.092, // #D0D0D0
        allSub: 0.1, // #CCCCCC
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)",
      },
      fills: [
        { color: "rgba(153, 153, 153, 0.17)", blendMode: "luminosity" }, // #999999 17%
      ],
    },
    opaque: {
      frost: 16,
      innerShadowLight: { peak: 0.08 },
      innerShadowDark: { peak: 0 },
      dropShadow: {
        sidesSub: 0.092, // #D0D0D0
        allSub: 0.1, // #CCCCCC
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)",
      },
      // Ordered bottom-to-top (reverse of Figma's top-to-bottom Fill panel)
      fills: [
        { color: "rgba(26, 26, 26, 0.7)", blendMode: "luminosity" }, // 3: #1A1A1A 70%
        { color: "rgba(26, 26, 26, 0.9)", blendMode: "luminosity" }, // 2: #1A1A1A 90%
        { color: "rgba(26, 26, 26, 1)", blendMode: "lighten" }, // 1: #1A1A1A 100%
      ],
    },
    tinted: {
      frost: 6,
      backingColor: "#FFFFFF",
      innerShadowLight: { peak: 0.08 },
      dropShadow: {
        sidesSub: 0.092, // #D0D0D0
        allSub: 0, // Disabled
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)",
      },
      fills: [],
    },
  },
  light: {
    clear: {
      innerShadowLight: { peak: 0.123 },
      dropShadow: {
        sidesSub: 0.092, // #D0D0D0
        allSub: 0.045, // #E8E8E8
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.02)",
      },
      // Ordered bottom-to-top (reverse of Figma's top-to-bottom Fill panel)
      fills: [
        { color: "rgba(0, 0, 0, 0.25)", blendMode: "normal" }, // 4: #000000 25%
        { color: "rgba(255, 255, 255, 0.25)", blendMode: "normal" }, // 3: #FFFFFF 25%
        { color: "rgba(68, 68, 68, 0.6)", blendMode: "plus-lighter" }, // 2: #444444 60%
        { color: "rgba(248, 248, 248, 0.2)", blendMode: "luminosity" }, // 1: #F8F8F8 20%
      ],
    },
    opaque: {
      frost: 16,
      innerShadowLight: { peak: 0.123 },
      innerShadowDark: { peak: 0 },
      dropShadow: {
        sidesSub: 0.092, // #D0D0D0
        allSub: 0.045, // #E8E8E8
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.02)",
      },
      // Ordered bottom-to-top (reverse of Figma's top-to-bottom Fill panel)
      fills: [
        { color: "rgba(255, 255, 255, 0.7)", blendMode: "lighten" }, // 2: #FFFFFF 70%
        { color: "rgba(191, 191, 191, 0.1)", blendMode: "darken" }, // 1: #BFBFBF 10%
      ],
    },
    tinted: {
      frost: 6,
      backingColor: "#FFFFFF",
      innerShadowLight: { peak: 0.123 },
      dropShadow: {
        sidesSub: 0.092, // #D0D0D0
        allSub: 0, // Disabled
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.02)",
      },
      fills: [],
    },
  },
};

export function resolvePreset(theme: GlassTheme, variant: GlassVariant) {
  const override = GLASS_PRESETS[theme][variant];
  return {
    refraction: override.refraction ?? GLASS_CONFIG.defaults.refraction,
    depth: override.depth ?? GLASS_CONFIG.defaults.depth,
    dispersion: override.dispersion ?? GLASS_CONFIG.defaults.dispersion,
    frost: override.frost ?? GLASS_CONFIG.defaults.frost,
    splay: override.splay ?? GLASS_CONFIG.defaults.splay,
    lightAngle: override.lightAngle ?? GLASS_CONFIG.defaults.lightAngle,
    lightOpacity: override.lightOpacity ?? GLASS_CONFIG.defaults.lightOpacity,
    backingColor: override.backingColor,
    bevel: { ...GLASS_CONFIG.bevel, ...override.bevel },
    innerShadowLight: {
      ...GLASS_CONFIG.innerShadowLight,
      ...override.innerShadowLight,
    },
    innerShadowDark: {
      ...GLASS_CONFIG.innerShadowDark,
      ...override.innerShadowDark,
    },
    rim: { ...GLASS_CONFIG.rim, ...override.rim },
    dropShadow: { ...GLASS_CONFIG.dropShadow, ...override.dropShadow },
    fills: override.fills ?? GLASS_CONFIG.fills,
  };
}

export type ResolvedPreset = ReturnType<typeof resolvePreset>;
