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

function hexToLuma(hex: string): number {
  const [r, g, b] = parseHexColor(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// Calibrated to Figma's 1px integer Plus-Darker drop shadow rings (#CCCCCC -> 0.1, #D0D0D0 -> 0.092, #E8E8E8 -> 0.045)
export function hexToDropShadowSub(hex: string): number {
  return Number(((1 - hexToLuma(hex)) / 2).toFixed(4));
}

// Calibrated to Figma's Plus-Lighter inner shadows (#1A1A1A -> 0.08, #282828 -> 0.123)
export function hexToInnerShadowLightPeak(hex: string): number {
  return Number((hexToLuma(hex) * (0.08 / (26 / 255))).toFixed(4));
}

// Calibrated to Figma's Plus-Darker top inner shadow (#E6E6E6 -> 0.025)
export function hexToInnerShadowDarkPeak(hex: string): number {
  return Number(((1 - hexToLuma(hex)) * (0.025 / (25 / 255))).toFixed(4));
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
    sides: {
      widthPx: 1,
      sub: 0.092,
    },
    // DS 3: x: 0, y: 0, blur: 0, spread: 0.5 (#CCCCCC, Plus darker)
    all: {
      widthPx: 1,
      sub: 0.1,
    },
    // DS 4: x: 0, y: 8, blur: 15, spread: 0 (#000000 4%, Normal)
    ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)",
  },
  fills: [
    // Default (Dark Clear): #999999 17%, Luminosity
    { color: "rgba(153, 153, 153, 0.17)", blendMode: "luminosity" },
  ] as GlassFill[],
};

export type BevelOverride =
  | false
  | (Partial<typeof GLASS_CONFIG.bevel> & { enabled?: boolean });

export type InnerShadowLightOverride =
  | false
  | (Partial<typeof GLASS_CONFIG.innerShadowLight> & {
      enabled?: boolean;
      /** Figma hex color (Plus lighter), e.g. "#1A1A1A" or "#282828". Ignored if `peak` is also set. */
      color?: string;
    });

export type InnerShadowDarkOverride =
  | false
  | (Partial<typeof GLASS_CONFIG.innerShadowDark> & {
      enabled?: boolean;
      /** Figma hex color (Plus darker), e.g. "#E6E6E6". Ignored if `peak` is also set. */
      color?: string;
    });

export type RimOverride =
  | false
  | (Partial<typeof GLASS_CONFIG.rim> & { enabled?: boolean });

export type DropShadowRingOverride =
  | false
  | {
      enabled?: boolean;
      widthPx?: number;
      sub?: number;
      /** Figma hex color (Plus darker), e.g. "#D0D0D0" or "#E8E8E8". Ignored if `sub` is also set. */
      color?: string;
    };

export type DropShadowOverride =
  | false
  | {
      enabled?: boolean;
      sides?: DropShadowRingOverride;
      all?: DropShadowRingOverride;
      /** CSS box-shadow string, or `false` to disable. */
      ambient?: string | false;
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
  bevel?: BevelOverride;
  innerShadowLight?: InnerShadowLightOverride;
  innerShadowDark?: InnerShadowDarkOverride;
  rim?: RimOverride;
  dropShadow?: DropShadowOverride;
  fills?: GlassFill[] | false;
}

export const GLASS_PRESETS: Record<
  GlassTheme,
  Record<GlassVariant, PresetOverride>
> = {
  dark: {
    clear: {
      innerShadowLight: { peak: 0.08 },
      dropShadow: {
        sides: { sub: 0.092 }, // #D0D0D0
        all: { sub: 0.1 }, // #CCCCCC
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)",
      },
      fills: [
        { color: "rgba(153, 153, 153, 0.17)", blendMode: "luminosity" }, // #999999 17%
      ],
    },
    opaque: {
      frost: 16,
      innerShadowLight: { peak: 0.08 },
      innerShadowDark: false,
      dropShadow: {
        sides: { sub: 0.092 }, // #D0D0D0
        all: { sub: 0.1 }, // #CCCCCC
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
        sides: { sub: 0.092 }, // #D0D0D0
        all: false,
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)",
      },
      fills: [],
    },
  },
  light: {
    clear: {
      innerShadowLight: { peak: 0.123 },
      dropShadow: {
        sides: { sub: 0.092 }, // #D0D0D0
        all: { sub: 0.045 }, // #E8E8E8
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
      innerShadowDark: false,
      dropShadow: {
        sides: { sub: 0.092 }, // #D0D0D0
        all: { sub: 0.045 }, // #E8E8E8
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
        sides: { sub: 0.092 }, // #D0D0D0
        all: false,
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.02)",
      },
      fills: [],
    },
  },
};

function isLayerEnabled(
  base: { enabled?: boolean } | false | undefined,
  override: { enabled?: boolean } | false | undefined,
): boolean {
  if (override === false) return false;
  if (override !== undefined) return override.enabled ?? true;
  if (base === false) return false;
  return base?.enabled ?? true;
}

function resolveBevel(base?: BevelOverride, override?: BevelOverride) {
  const enabled = isLayerEnabled(base, override);
  const merged = {
    ...GLASS_CONFIG.bevel,
    ...(base || undefined),
    ...(override || undefined),
  };
  return {
    shadeRadiusFactor: merged.shadeRadiusFactor,
    shadeDepthMin: merged.shadeDepthMin,
    shadeDepthFactor: merged.shadeDepthFactor,
    topDarkenScale: enabled ? merged.topDarkenScale : 0,
    topProfileExp: merged.topProfileExp,
    topDirExp: merged.topDirExp,
    bottomBrightenScale: enabled ? merged.bottomBrightenScale : 0,
    bottomProfileExp: merged.bottomProfileExp,
    bottomDirExp: merged.bottomDirExp,
  };
}

function resolveInnerShadowLight(
  base?: InnerShadowLightOverride,
  override?: InnerShadowLightOverride,
) {
  const enabled = isLayerEnabled(base, override);
  const baseObj = base || undefined;
  const overrideObj = override || undefined;
  const merged = {
    ...GLASS_CONFIG.innerShadowLight,
    ...baseObj,
    ...overrideObj,
  };
  let peak = merged.peak;
  if (overrideObj?.peak === undefined && overrideObj?.color !== undefined) {
    peak = hexToInnerShadowLightPeak(overrideObj.color);
  } else if (
    overrideObj?.peak === undefined &&
    baseObj?.peak === undefined &&
    baseObj?.color !== undefined
  ) {
    peak = hexToInnerShadowLightPeak(baseObj.color);
  }
  return {
    depth: merged.depth,
    peak: enabled ? peak : 0,
    falloff: merged.falloff,
    dirExp: merged.dirExp,
  };
}

function resolveInnerShadowDark(
  base?: InnerShadowDarkOverride,
  override?: InnerShadowDarkOverride,
) {
  const enabled = isLayerEnabled(base, override);
  const baseObj = base || undefined;
  const overrideObj = override || undefined;
  const merged = {
    ...GLASS_CONFIG.innerShadowDark,
    ...baseObj,
    ...overrideObj,
  };
  let peak = merged.peak;
  if (overrideObj?.peak === undefined && overrideObj?.color !== undefined) {
    peak = hexToInnerShadowDarkPeak(overrideObj.color);
  } else if (
    overrideObj?.peak === undefined &&
    baseObj?.peak === undefined &&
    baseObj?.color !== undefined
  ) {
    peak = hexToInnerShadowDarkPeak(baseObj.color);
  }
  return {
    depth: merged.depth,
    peak: enabled ? peak : 0,
    falloff: merged.falloff,
    dirExp: merged.dirExp,
  };
}

function resolveRim(base?: RimOverride, override?: RimOverride) {
  const enabled = isLayerEnabled(base, override);
  const merged = {
    ...GLASS_CONFIG.rim,
    ...(base || undefined),
    ...(override || undefined),
  };
  return {
    enabled,
    primaryScale: enabled ? merged.primaryScale : 0,
    bounceScale: enabled ? merged.bounceScale : 0,
    exp: merged.exp,
    widthPx: enabled ? merged.widthPx : 0,
  };
}

function resolveDropShadowRing(
  defaults: { widthPx: number; sub: number },
  base?: DropShadowRingOverride,
  override?: DropShadowRingOverride,
) {
  const enabled = isLayerEnabled(base, override);
  const baseObj = base || undefined;
  const overrideObj = override || undefined;

  const widthPx = overrideObj?.widthPx ?? baseObj?.widthPx ?? defaults.widthPx;
  let sub = overrideObj?.sub ?? baseObj?.sub ?? defaults.sub;
  if (overrideObj?.sub === undefined && overrideObj?.color !== undefined) {
    sub = hexToDropShadowSub(overrideObj.color);
  } else if (
    overrideObj?.sub === undefined &&
    baseObj?.sub === undefined &&
    baseObj?.color !== undefined
  ) {
    sub = hexToDropShadowSub(baseObj.color);
  }

  return {
    enabled: enabled && sub > 0 && widthPx > 0,
    widthPx: enabled ? widthPx : 0,
    sub: enabled ? sub : 0,
  };
}

function resolveDropShadow(
  base?: DropShadowOverride,
  override?: DropShadowOverride,
) {
  if (!isLayerEnabled(base, override)) {
    return {
      sides: { enabled: false, widthPx: 0, sub: 0 },
      all: { enabled: false, widthPx: 0, sub: 0 },
      ambient: undefined as string | undefined,
    };
  }

  const baseObj = base || undefined;
  const overrideObj = override || undefined;

  let ambient: string | undefined;
  if (overrideObj?.ambient === false) {
    ambient = undefined;
  } else if (overrideObj?.ambient !== undefined) {
    ambient = overrideObj.ambient || undefined;
  } else if (baseObj?.ambient === false) {
    ambient = undefined;
  } else {
    ambient = baseObj?.ambient ?? GLASS_CONFIG.dropShadow.ambient;
  }

  return {
    sides: resolveDropShadowRing(
      GLASS_CONFIG.dropShadow.sides,
      baseObj?.sides,
      overrideObj?.sides,
    ),
    all: resolveDropShadowRing(
      GLASS_CONFIG.dropShadow.all,
      baseObj?.all,
      overrideObj?.all,
    ),
    ambient,
  };
}

export function resolvePreset(
  theme: GlassTheme,
  variant: GlassVariant,
  overrides?: PresetOverride,
) {
  const base = GLASS_PRESETS[theme][variant];
  const fills =
    overrides?.fills === false
      ? []
      : (overrides?.fills ??
        (base.fills === false ? [] : base.fills) ??
        GLASS_CONFIG.fills);

  return {
    refraction:
      overrides?.refraction ??
      base.refraction ??
      GLASS_CONFIG.defaults.refraction,
    depth: overrides?.depth ?? base.depth ?? GLASS_CONFIG.defaults.depth,
    dispersion:
      overrides?.dispersion ??
      base.dispersion ??
      GLASS_CONFIG.defaults.dispersion,
    frost: overrides?.frost ?? base.frost ?? GLASS_CONFIG.defaults.frost,
    splay: overrides?.splay ?? base.splay ?? GLASS_CONFIG.defaults.splay,
    lightAngle:
      overrides?.lightAngle ??
      base.lightAngle ??
      GLASS_CONFIG.defaults.lightAngle,
    lightOpacity:
      overrides?.lightOpacity ??
      base.lightOpacity ??
      GLASS_CONFIG.defaults.lightOpacity,
    backingColor:
      overrides?.backingColor !== undefined
        ? overrides.backingColor || undefined
        : base.backingColor,
    bevel: resolveBevel(base.bevel, overrides?.bevel),
    innerShadowLight: resolveInnerShadowLight(
      base.innerShadowLight,
      overrides?.innerShadowLight,
    ),
    innerShadowDark: resolveInnerShadowDark(
      base.innerShadowDark,
      overrides?.innerShadowDark,
    ),
    rim: resolveRim(base.rim, overrides?.rim),
    dropShadow: resolveDropShadow(base.dropShadow, overrides?.dropShadow),
    fills,
  };
}

export type ResolvedPreset = ReturnType<typeof resolvePreset>;
