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
  /** Any valid CSS color: hex (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`), `rgb(...)`, `rgba(...)`, etc. */
  color: string;
  /** Optional opacity multiplier (`0`–`1`), useful with hex or `rgb(...)` colors. */
  opacity?: number;
  blendMode?: React.CSSProperties["mixBlendMode"];
}

export interface GlassGradientStop {
  /** Stop color (hex, `rgb(...)`, or `rgba(...)`). */
  color: string;
  /** Optional opacity multiplier (`0`–`1`). */
  opacity?: number;
  /** Stop position as a percentage number (e.g. `0`, `75`) or CSS length/percentage (e.g. `"40%"`, `"120px"`). */
  position?: number | string;
}

export type GradientOverride =
  | false
  | {
      enabled?: boolean;
      /** Start color (hex, `rgb(...)`, or `rgba(...)`). @default "rgba(255, 255, 255, 0.1)" */
      color?: string;
      /** Optional opacity multiplier (`0`–`1`) applied to `color`. */
      opacity?: number;
      /** End color (hex, `rgb(...)`, or `rgba(...)`). Defaults to `color` at `0` opacity for a clean fade. */
      endColor?: string;
      /** Optional opacity multiplier (`0`–`1`) applied to `endColor`. */
      endOpacity?: number;
      /** Gradient direction in degrees (`180` = top to bottom). @default 180 */
      angle?: number;
      /** Where the gradient begins (percentage number or CSS length/percentage). @default 0 */
      start?: number | string;
      /** Where the gradient ends (percentage number or CSS length/percentage). @default 75 */
      end?: number | string;
      /** CSS `mix-blend-mode` for the gradient layer. @default "normal" */
      blendMode?: React.CSSProperties["mixBlendMode"];
      /** Optional custom multi-stop array. When provided, overrides `color`, `endColor`, `start`, and `end`. */
      stops?: GlassGradientStop[];
    };

/** Parses hex (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`) or `rgb()`/`rgba()` into `[r, g, b, a]`. Returns `null` for other CSS color formats. */
export function parseColor(
  color: string,
): [number, number, number, number] | null {
  const trimmed = color.trim();

  if (trimmed.startsWith("#")) {
    const clean = trimmed.slice(1);
    let r: number;
    let g: number;
    let b: number;
    let a = 1;

    if (clean.length === 3 || clean.length === 4) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
      if (clean.length === 4) a = parseInt(clean[3] + clean[3], 16) / 255;
    } else if (clean.length === 6 || clean.length === 8) {
      r = parseInt(clean.slice(0, 2), 16);
      g = parseInt(clean.slice(2, 4), 16);
      b = parseInt(clean.slice(4, 6), 16);
      if (clean.length === 8) a = parseInt(clean.slice(6, 8), 16) / 255;
    } else {
      return null;
    }

    if (
      Number.isNaN(r) ||
      Number.isNaN(g) ||
      Number.isNaN(b) ||
      Number.isNaN(a)
    ) {
      return null;
    }
    return [r, g, b, a];
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, Math.round(Number(rgbMatch[1]))));
    const g = Math.min(255, Math.max(0, Math.round(Number(rgbMatch[2]))));
    const b = Math.min(255, Math.max(0, Math.round(Number(rgbMatch[3]))));
    const a =
      rgbMatch[4] !== undefined
        ? Math.min(1, Math.max(0, Number(rgbMatch[4])))
        : 1;
    return [r, g, b, a];
  }

  return null;
}

/** Resolves hex or `rgb()`/`rgba()` colors with an optional `0`–`1` opacity multiplier into a CSS color string. */
export function resolveColor(color: string, opacity?: number): string {
  if (opacity === undefined) return color;
  const clamped = Math.min(1, Math.max(0, opacity));
  const parsed = parseColor(color);
  if (parsed) {
    const [r, g, b, baseAlpha] = parsed;
    return `rgba(${r}, ${g}, ${b}, ${Number((baseAlpha * clamped).toFixed(4))})`;
  }
  return `color-mix(in srgb, ${color.trim()} ${Number((clamped * 100).toFixed(2))}%, transparent)`;
}

function colorToLuma(color: string): number {
  const [r, g, b] = parseColor(color) ?? [0, 136, 255];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// Calibrated to Figma's 1px integer Plus-Darker drop shadow rings (#CCCCCC -> 0.1, #D0D0D0 -> 0.092, #E8E8E8 -> 0.045)
export function hexToDropShadowIntensity(color: string): number {
  return Number(((1 - colorToLuma(color)) / 2).toFixed(4));
}

// Calibrated to Figma's Plus-Lighter inner shadows (#1A1A1A -> 0.08, #282828 -> 0.123)
export function hexToInnerShadowLightIntensity(color: string): number {
  return Number((colorToLuma(color) * (0.08 / (26 / 255))).toFixed(4));
}

// Calibrated to Figma's Plus-Darker top inner shadow (#E6E6E6 -> 0.025)
export function hexToInnerShadowDarkIntensity(color: string): number {
  return Number(((1 - colorToLuma(color)) * (0.025 / (25 / 255))).toFixed(4));
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
  innerShadow: {
    // Inner Shadows 1 & 2 (Top + Bottom, Plus lighter)
    light: {
      depth: 8,
      intensity: 0.08, // Dark Clear (#1A1A1A)
      falloff: 2.2,
      dirExp: 1.8,
    },
    // Inner Shadow 3 (Top only: #E6E6E6, Plus darker)
    dark: {
      depth: 28,
      intensity: 0.025,
      falloff: 1.9,
      dirExp: 1.8,
    },
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
      intensity: 0.092,
    },
    // DS 3: x: 0, y: 0, blur: 0, spread: 0.5 (#CCCCCC, Plus darker)
    all: {
      widthPx: 1,
      intensity: 0.1,
    },
    // DS 4: x: 0, y: 8, blur: 15, spread: 0 (#000000 4%, Normal)
    ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)",
  },
  gradient: {
    color: "rgba(255, 255, 255, 0.1)",
    angle: 180,
    start: 0 as number | string,
    end: 75 as number | string,
    blendMode: "normal" as React.CSSProperties["mixBlendMode"],
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
  | (Partial<typeof GLASS_CONFIG.innerShadow.light> & {
      enabled?: boolean;
      /** Hex or `rgb()`/`rgba()` color (Plus lighter), e.g. `"#1A1A1A"` or `"rgb(26, 26, 26)"`. Ignored if `intensity` is also set. */
      color?: string;
    });

export type InnerShadowDarkOverride =
  | false
  | (Partial<typeof GLASS_CONFIG.innerShadow.dark> & {
      enabled?: boolean;
      /** Hex or `rgb()`/`rgba()` color (Plus darker), e.g. `"#E6E6E6"` or `"rgb(230, 230, 230)"`. Ignored if `intensity` is also set. */
      color?: string;
    });

export type InnerShadowOverride =
  | false
  | {
      enabled?: boolean;
      light?: InnerShadowLightOverride;
      dark?: InnerShadowDarkOverride;
    };

export type RimOverride =
  | false
  | (Partial<typeof GLASS_CONFIG.rim> & { enabled?: boolean });

export type DropShadowRingOverride =
  | false
  | {
      enabled?: boolean;
      widthPx?: number;
      intensity?: number;
      /** Hex or `rgb()`/`rgba()` color (Plus darker), e.g. `"#D0D0D0"` or `"rgb(208, 208, 208)"`. Ignored if `intensity` is also set. */
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

export interface LiquidGlassConfig {
  /** Strength of the edge lens displacement (0-100). @default 70 */
  refraction?: number;
  /** Width of the refracting glass bevel in pixels. @default 30 */
  depth?: number;
  /** RGB chromatic aberration spread at the edges (0 disables multi-channel dispersion). @default 20 */
  dispersion?: number;
  /** Backdrop blur intensity. @default 6 (16 on "opaque") */
  frost?: number;
  /** Curve sharpness of the bevel falloff (0-100). @default 20 */
  splay?: number;
  /** Specular rim and bevel lighting direction in degrees. @default 0 */
  lightAngle?: number;
  /** Master brightness of the specular rim and bevel shading (0-100). @default 25 */
  lightOpacity?: number;
  /** Solid backing color rendered behind the glass, or `false` to disable. */
  backingColor?: string | false;
  /** Bevel shading overrides, or `false` to disable. */
  bevel?: BevelOverride;
  /** Inner shadow overrides (`light` and `dark`), deep-merged with the active preset, or `false` to disable all. */
  innerShadow?: InnerShadowOverride;
  /** Specular rim highlight overrides, or `false` to disable. */
  rim?: RimOverride;
  /** Drop shadow overrides (`sides`, `all`, and `ambient`), deep-merged with the active preset, or `false` to disable all. */
  dropShadow?: DropShadowOverride;
  /** Container gradient overlay (e.g. subtle top sheen), or `false` to disable. */
  gradient?: GradientOverride;
  /** Glass body fills rendered bottom-to-top (replaces preset fills), or `false` to remove all fills. Supports hex, `rgb()`, and `rgba()` with optional `opacity`. */
  fills?: GlassFill[] | false;
}

export const GLASS_PRESETS: Record<
  GlassTheme,
  Record<GlassVariant, LiquidGlassConfig>
> = {
  dark: {
    clear: {
      innerShadow: {
        light: { intensity: 0.08 },
      },
      dropShadow: {
        sides: { intensity: 0.092 }, // #D0D0D0
        all: { intensity: 0.1 }, // #CCCCCC
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)",
      },
      fills: [
        { color: "rgba(153, 153, 153, 0.17)", blendMode: "luminosity" }, // #999999 17%
      ],
    },
    opaque: {
      frost: 16,
      innerShadow: {
        light: { intensity: 0.08 },
        dark: false,
      },
      dropShadow: {
        sides: { intensity: 0.092 }, // #D0D0D0
        all: { intensity: 0.1 }, // #CCCCCC
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
      innerShadow: {
        light: { intensity: 0.08 },
      },
      dropShadow: {
        sides: { intensity: 0.092 }, // #D0D0D0
        all: false,
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)",
      },
      fills: [],
    },
  },
  light: {
    clear: {
      innerShadow: {
        light: { intensity: 0.123 },
      },
      dropShadow: {
        sides: { intensity: 0.092 }, // #D0D0D0
        all: { intensity: 0.045 }, // #E8E8E8
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
      innerShadow: {
        light: { intensity: 0.123 },
        dark: false,
      },
      dropShadow: {
        sides: { intensity: 0.092 }, // #D0D0D0
        all: { intensity: 0.045 }, // #E8E8E8
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
      innerShadow: {
        light: { intensity: 0.123 },
      },
      dropShadow: {
        sides: { intensity: 0.092 }, // #D0D0D0
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

function isGradientEnabled(
  base: GradientOverride | undefined,
  override: GradientOverride | undefined,
): boolean {
  if (override === false) return false;
  if (override !== undefined) return override.enabled ?? true;
  if (base === false || base === undefined) return false;
  return base.enabled ?? true;
}

function formatStopPosition(position: number | string): string {
  return typeof position === "number" ? `${position}%` : position;
}

function resolveGradient(base?: GradientOverride, override?: GradientOverride) {
  if (!isGradientEnabled(base, override)) {
    return {
      enabled: false,
      backgroundImage: undefined as string | undefined,
      blendMode: GLASS_CONFIG.gradient.blendMode,
    };
  }

  const baseObj = base || undefined;
  const overrideObj = override || undefined;

  const angle =
    overrideObj?.angle ?? baseObj?.angle ?? GLASS_CONFIG.gradient.angle;
  const blendMode =
    overrideObj?.blendMode ??
    baseObj?.blendMode ??
    GLASS_CONFIG.gradient.blendMode;
  const stops = overrideObj?.stops ?? baseObj?.stops;

  if (stops && stops.length > 0) {
    const formattedStops = stops
      .map((stop) => {
        const resolved = resolveColor(stop.color, stop.opacity);
        return stop.position !== undefined
          ? `${resolved} ${formatStopPosition(stop.position)}`
          : resolved;
      })
      .join(", ");

    return {
      enabled: true,
      backgroundImage: `linear-gradient(${angle}deg, ${formattedStops})`,
      blendMode,
    };
  }

  const rawStartColor =
    overrideObj?.color ?? baseObj?.color ?? GLASS_CONFIG.gradient.color;
  const startOpacity = overrideObj?.opacity ?? baseObj?.opacity;
  const startColor = resolveColor(rawStartColor, startOpacity);

  const rawEndColor = overrideObj?.endColor ?? baseObj?.endColor;
  const endOpacity = overrideObj?.endOpacity ?? baseObj?.endOpacity;
  const endColor =
    rawEndColor !== undefined
      ? resolveColor(rawEndColor, endOpacity)
      : resolveColor(rawStartColor, 0);

  const startPos = formatStopPosition(
    overrideObj?.start ?? baseObj?.start ?? GLASS_CONFIG.gradient.start,
  );
  const endPos = formatStopPosition(
    overrideObj?.end ?? baseObj?.end ?? GLASS_CONFIG.gradient.end,
  );

  return {
    enabled: true,
    backgroundImage: `linear-gradient(${angle}deg, ${startColor} ${startPos}, ${endColor} ${endPos})`,
    blendMode,
  };
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
    ...GLASS_CONFIG.innerShadow.light,
    ...baseObj,
    ...overrideObj,
  };
  let intensity = merged.intensity;
  if (
    overrideObj?.intensity === undefined &&
    overrideObj?.color !== undefined
  ) {
    intensity = hexToInnerShadowLightIntensity(overrideObj.color);
  } else if (
    overrideObj?.intensity === undefined &&
    baseObj?.intensity === undefined &&
    baseObj?.color !== undefined
  ) {
    intensity = hexToInnerShadowLightIntensity(baseObj.color);
  }
  return {
    depth: merged.depth,
    intensity: enabled ? intensity : 0,
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
    ...GLASS_CONFIG.innerShadow.dark,
    ...baseObj,
    ...overrideObj,
  };
  let intensity = merged.intensity;
  if (
    overrideObj?.intensity === undefined &&
    overrideObj?.color !== undefined
  ) {
    intensity = hexToInnerShadowDarkIntensity(overrideObj.color);
  } else if (
    overrideObj?.intensity === undefined &&
    baseObj?.intensity === undefined &&
    baseObj?.color !== undefined
  ) {
    intensity = hexToInnerShadowDarkIntensity(baseObj.color);
  }
  return {
    depth: merged.depth,
    intensity: enabled ? intensity : 0,
    falloff: merged.falloff,
    dirExp: merged.dirExp,
  };
}

function resolveInnerShadow(
  base?: InnerShadowOverride,
  override?: InnerShadowOverride,
) {
  if (!isLayerEnabled(base, override)) {
    return {
      light: { ...GLASS_CONFIG.innerShadow.light, intensity: 0 },
      dark: { ...GLASS_CONFIG.innerShadow.dark, intensity: 0 },
    };
  }
  const baseObj = base || undefined;
  const overrideObj = override || undefined;
  return {
    light: resolveInnerShadowLight(baseObj?.light, overrideObj?.light),
    dark: resolveInnerShadowDark(baseObj?.dark, overrideObj?.dark),
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
  defaults: { widthPx: number; intensity: number },
  base?: DropShadowRingOverride,
  override?: DropShadowRingOverride,
) {
  const enabled = isLayerEnabled(base, override);
  const baseObj = base || undefined;
  const overrideObj = override || undefined;

  const widthPx = overrideObj?.widthPx ?? baseObj?.widthPx ?? defaults.widthPx;
  let intensity =
    overrideObj?.intensity ?? baseObj?.intensity ?? defaults.intensity;
  if (
    overrideObj?.intensity === undefined &&
    overrideObj?.color !== undefined
  ) {
    intensity = hexToDropShadowIntensity(overrideObj.color);
  } else if (
    overrideObj?.intensity === undefined &&
    baseObj?.intensity === undefined &&
    baseObj?.color !== undefined
  ) {
    intensity = hexToDropShadowIntensity(baseObj.color);
  }

  return {
    enabled: enabled && intensity > 0 && widthPx > 0,
    widthPx: enabled ? widthPx : 0,
    intensity: enabled ? intensity : 0,
  };
}

function resolveDropShadow(
  base?: DropShadowOverride,
  override?: DropShadowOverride,
) {
  if (!isLayerEnabled(base, override)) {
    return {
      sides: { enabled: false, widthPx: 0, intensity: 0 },
      all: { enabled: false, widthPx: 0, intensity: 0 },
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
  overrides?: LiquidGlassConfig,
) {
  const base = GLASS_PRESETS[theme][variant];
  const rawFills =
    overrides?.fills === false
      ? []
      : (overrides?.fills ??
        (base.fills === false ? [] : base.fills) ??
        GLASS_CONFIG.fills);

  const fills = rawFills.map((fill) => ({
    color: resolveColor(fill.color, fill.opacity),
    blendMode: fill.blendMode,
  }));

  const backingColor =
    overrides?.backingColor === false
      ? undefined
      : overrides?.backingColor !== undefined
        ? overrides.backingColor || undefined
        : base.backingColor === false
          ? undefined
          : base.backingColor;

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
    backingColor,
    bevel: resolveBevel(base.bevel, overrides?.bevel),
    innerShadow: resolveInnerShadow(base.innerShadow, overrides?.innerShadow),
    rim: resolveRim(base.rim, overrides?.rim),
    dropShadow: resolveDropShadow(base.dropShadow, overrides?.dropShadow),
    gradient: resolveGradient(base.gradient, overrides?.gradient),
    fills,
  };
}

export type ResolvedPreset = ReturnType<typeof resolvePreset>;
