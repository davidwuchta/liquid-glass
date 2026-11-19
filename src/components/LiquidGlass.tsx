"use client";

import React, { useEffect, useId, useRef, useState } from "react";

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

function parseHexColor(hex: string): [number, number, number] {
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

const GLASS_CONFIG = {
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

interface PresetOverride {
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

const GLASS_PRESETS: Record<
  GlassTheme,
  Record<GlassVariant, PresetOverride>
> = {
  dark: {
    clear: {
      // #1A1A1A (26/255)
      innerShadowLight: { peak: 0.08 },
      dropShadow: {
        sidesSub: 0.092, // #D0D0D0
        allSub: 0.1, // #CCCCCC
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)", // #000000 4%
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
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)", // #000000 4%
      },
      // Ordered bottom-to-top (reverse of Figma's top-to-bottom Fill panel)
      fills: [
        { color: "rgba(26, 26, 26, 0.7)", blendMode: "luminosity" }, // 3rd: #1A1A1A 70%
        { color: "rgba(26, 26, 26, 0.9)", blendMode: "luminosity" }, // 2nd: #1A1A1A 90%
        { color: "rgba(26, 26, 26, 1)", blendMode: "lighten" }, // 1st: #1A1A1A 100%
      ],
    },
    tinted: {
      frost: 6,
      backingColor: "#FFFFFF",
      innerShadowLight: { peak: 0.08 },
      dropShadow: {
        sidesSub: 0.092, // Light Clear (#D0D0D0)
        allSub: 0, // Disabled
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.04)", // Dark Clear (#000000 4%)
      },
      fills: [],
    },
  },
  light: {
    clear: {
      // #282828 (40/255) -> 0.08 * (40 / 26)
      innerShadowLight: { peak: 0.123 },
      dropShadow: {
        sidesSub: 0.092, // #D0D0D0
        allSub: 0.045, // #E8E8E8
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.02)", // #000000 2%
      },
      // Ordered bottom-to-top (reverse of Figma's top-to-bottom Fill panel)
      fills: [
        { color: "rgba(0, 0, 0, 0.25)", blendMode: "normal" }, // 4th: #000000 25%
        { color: "rgba(255, 255, 255, 0.25)", blendMode: "normal" }, // 3rd: #FFFFFF 25%
        { color: "rgba(68, 68, 68, 0.6)", blendMode: "plus-lighter" }, // 2nd: #444444 60%
        { color: "rgba(248, 248, 248, 0.2)", blendMode: "luminosity" }, // 1st: #F8F8F8 20%
      ],
    },
    opaque: {
      frost: 16,
      innerShadowLight: { peak: 0.123 },
      innerShadowDark: { peak: 0 },
      dropShadow: {
        sidesSub: 0.092, // #D0D0D0
        allSub: 0.045, // #E8E8E8
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.02)", // #000000 2%
      },
      // Ordered bottom-to-top (reverse of Figma's top-to-bottom Fill panel)
      fills: [
        { color: "rgba(255, 255, 255, 0.7)", blendMode: "lighten" }, // 2nd: #FFFFFF 70%
        { color: "rgba(191, 191, 191, 0.1)", blendMode: "darken" }, // 1st: #BFBFBF 10%
      ],
    },
    tinted: {
      frost: 6,
      backingColor: "#FFFFFF",
      innerShadowLight: { peak: 0.123 },
      dropShadow: {
        sidesSub: 0.092, // Light Clear (#D0D0D0)
        allSub: 0, // Disabled
        ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.02)", // Light Clear (#000000 2%)
      },
      fills: [],
    },
  },
};

function resolvePreset(theme: GlassTheme, variant: GlassVariant) {
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

type ResolvedPreset = ReturnType<typeof resolvePreset>;

interface CachedLayers {
  displacementUrl: string;
  darkenUrl: string;
  brightenUrl: string;
  rimUrl: string;
}

interface LayerState extends CachedLayers {
  w: number;
  h: number;
  svgBackdrop: boolean;
  cssPlusDarker: boolean;
}

const layerCache = new Map<string, CachedLayers>();

function detectSvgBackdropSupport(): boolean {
  if (typeof navigator === "undefined" || typeof CSS === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  const isIOS = /iP(ad|hone|od)/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
  const isFirefox = /Firefox|FxiOS/.test(ua);
  if (isIOS || isSafari || isFirefox) return false;

  return (
    CSS.supports("backdrop-filter", "url(#a)") ||
    CSS.supports("-webkit-backdrop-filter", "url(#a)")
  );
}

function detectCssPlusDarkerSupport(): boolean {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return false;
  }
  return CSS.supports("mix-blend-mode", "plus-darker");
}

function getOrGenerateLayers(
  w: number,
  h: number,
  radius: number,
  depth: number,
  splay: number,
  lightAngle: number,
  lightOpacity: number,
  theme: GlassTheme,
  variant: GlassVariant,
  preset: ResolvedPreset,
  svgBackdrop: boolean,
): CachedLayers {
  const key = `${theme}-${variant}-${w}x${h}-${radius}-${depth}-${splay}-${lightAngle}-${lightOpacity}-${svgBackdrop ? 1 : 0}`;
  const cached = layerCache.get(key);
  if (cached) {
    layerCache.delete(key);
    layerCache.set(key, cached);
    return cached;
  }

  const refCfg = GLASS_CONFIG.refraction;
  const {
    bevel: bevelCfg,
    innerShadowLight: isLightCfg,
    innerShadowDark: isDarkCfg,
    rim: rimCfg,
  } = preset;

  // 1. Displacement Map Canvas (Chromium only)
  let dispCanvas: HTMLCanvasElement | null = null;
  let dispCtx: CanvasRenderingContext2D | null = null;
  let dispImg: ImageData | null = null;
  let dispData: Uint8ClampedArray | null = null;
  if (svgBackdrop) {
    dispCanvas = document.createElement("canvas");
    dispCanvas.width = w;
    dispCanvas.height = h;
    dispCtx = dispCanvas.getContext("2d")!;
    dispImg = dispCtx.createImageData(w, h);
    dispData = dispImg.data;
  }

  // 2A. Darkening Canvas:
  // - Chromium SVG feComposite: opaque white (255) neutral, (1 - darkSub) darkened
  // - Safari/Firefox DOM overlay: transparent neutral, rgba(0, 0, 0, darkSub) darkened
  const darkCanvas = document.createElement("canvas");
  darkCanvas.width = w;
  darkCanvas.height = h;
  const darkCtx = darkCanvas.getContext("2d")!;
  const darkImg = darkCtx.createImageData(w, h);
  const darkData = darkImg.data;
  if (svgBackdrop) darkData.fill(255);

  // 2B. Additive Brightening Canvas (Bottom Glass Bevel + Inner Shadows 1 & 2 via plus-lighter)
  const brightCanvas = document.createElement("canvas");
  brightCanvas.width = w;
  brightCanvas.height = h;
  const brightCtx = brightCanvas.getContext("2d")!;
  const brightImg = brightCtx.createImageData(w, h);
  const brightData = brightImg.data;

  // 3. 1px Surface-Normal Specular Rim Canvas
  const rimCanvas = document.createElement("canvas");
  rimCanvas.width = w;
  rimCanvas.height = h;
  const rimCtx = rimCanvas.getContext("2d")!;
  const rimImg = rimCtx.createImageData(w, h);
  const rimData = rimImg.data;

  const rx = w / 2;
  const ry = h / 2;
  const r = Math.min(radius, rx, ry);
  const bevel = Math.max(1, depth);

  const rShade = Math.min(
    Math.max(r, bevel * bevelCfg.shadeRadiusFactor),
    rx,
    ry,
  );
  const splayExp = 1.85 + ((100 - splay) / 100) * 0.75;
  const shadeDepth = Math.max(
    bevelCfg.shadeDepthMin,
    depth * bevelCfg.shadeDepthFactor,
  );

  const rad = ((lightAngle - 90) * Math.PI) / 180;
  const lx = Math.cos(rad);
  const ly = Math.sin(rad);

  const l = lightOpacity / 100;
  const primaryRimMax = Math.min(1, l * rimCfg.primaryScale);
  const bounceRimMax = Math.min(1, l * rimCfg.bounceScale);
  const topDarkenMax = Math.min(1, l * bevelCfg.topDarkenScale);
  const bottomBrightenMax = Math.min(1, l * bevelCfg.bottomBrightenScale);

  const shoulderT = refCfg.shoulderThreshold;
  const shoulderSpan = 1 - shoulderT;
  const shoulderNorm = shoulderT + shoulderSpan * 0.5;

  // Deterministic Interleaved Gradient Noise in [0, 1) to eliminate 8-bit quantization banding
  const ign = (x: number, y: number) => {
    const n = 52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1);
    return n - Math.floor(n);
  };

  const sdRoundedBox = (px: number, py: number, cornerR: number) => {
    const qx = Math.abs(px) - (rx - cornerR);
    const qy = Math.abs(py) - (ry - cornerR);
    return (
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
      Math.min(Math.max(qx, qy), 0) -
      cornerR
    );
  };

  const maxShadeDist = Math.max(shadeDepth, isLightCfg.depth, isDarkCfg.depth);
  const maxComputeDist = Math.max(svgBackdrop ? bevel : 0, maxShadeDist, 3);

  for (let y = 0; y < h; y++) {
    const py = y - ry;
    for (let x = 0; x < w; x++) {
      const px = x - rx;
      const d = sdRoundedBox(px, py, r);
      const distFromEdge = -d;

      const idx = (y * w + x) * 4;

      if (distFromEdge >= maxComputeDist) {
        if (dispData) {
          dispData[idx] = 128;
          dispData[idx + 1] = 128;
          dispData[idx + 2] = 128;
          dispData[idx + 3] = 255;
        }
        continue;
      }

      const eps = refCfg.normalEps;
      const gx = sdRoundedBox(px + eps, py, r) - sdRoundedBox(px - eps, py, r);
      const gy = sdRoundedBox(px, py + eps, r) - sdRoundedBox(px, py - eps, r);
      const len = Math.hypot(gx, gy) || 1;
      const normX = gx / len;
      const normY = gy / len;

      const dot = normX * lx + normY * ly;

      // --- A. Displacement Map (C1 shoulder prevents corner UV fold-over) ---
      if (dispData) {
        if (distFromEdge < bevel) {
          const clampedDist = Math.max(0, distFromEdge);
          const t = 1 - clampedDist / bevel;
          let tSoft: number;
          if (t < shoulderT) {
            tSoft = t / shoulderNorm;
          } else {
            const u = (t - shoulderT) / shoulderSpan;
            tSoft =
              (shoulderT + shoulderSpan * (u - 0.5 * u * u)) / shoulderNorm;
          }
          const mag = Math.pow(tSoft, splayExp);
          const nx = -normX * mag;
          const ny = -normY * mag;
          dispData[idx] = Math.round(
            Math.min(255, Math.max(0, 128 + nx * 127)),
          );
          dispData[idx + 1] = Math.round(
            Math.min(255, Math.max(0, 128 + ny * 127)),
          );
        } else {
          dispData[idx] = 128;
          dispData[idx + 1] = 128;
        }
        dispData[idx + 2] = 128;
        dispData[idx + 3] = 255;
      }

      // --- B. Fixed-Distance Bevel Shading + Inner Shadows 1, 2 & 3 ---
      let darkSub = 0;
      let addAlpha = 0;

      if (distFromEdge >= 0 && distFromEdge < maxShadeDist) {
        const sgx =
          sdRoundedBox(px + 1, py, rShade) - sdRoundedBox(px - 1, py, rShade);
        const sgy =
          sdRoundedBox(px, py + 1, rShade) - sdRoundedBox(px, py - 1, rShade);
        const slen = Math.hypot(sgx, sgy) || 1;
        const shadeDot = (sgx / slen) * lx + (sgy / slen) * ly;

        if (distFromEdge < shadeDepth) {
          const s = 1 - distFromEdge / shadeDepth;

          if (shadeDot > 0) {
            const topProfile = Math.pow(s, bevelCfg.topProfileExp);
            const dir = Math.pow(shadeDot, bevelCfg.topDirExp);
            darkSub += topDarkenMax * topProfile * dir;
          } else if (shadeDot < 0) {
            const bottomProfile = Math.pow(s, bevelCfg.bottomProfileExp);
            const dir = Math.pow(-shadeDot, bevelCfg.bottomDirExp);
            addAlpha += bottomBrightenMax * bottomProfile * dir;
          }
        }

        // Inner Shadows 1 & 2 (Top + Bottom, Plus lighter)
        const verticalDot = Math.abs(sgy / slen);
        if (verticalDot > 0 && distFromEdge < isLightCfg.depth) {
          const innerT = Math.max(
            0,
            1 - Math.max(0, distFromEdge - 1) / isLightCfg.depth,
          );
          const profile = Math.pow(innerT, isLightCfg.falloff);
          const dir = Math.pow(verticalDot, isLightCfg.dirExp);
          addAlpha += isLightCfg.peak * profile * dir;
        }

        // Inner Shadow 3 (Top only: #E6E6E6, Plus darker)
        const topVerticalDot = -(sgy / slen);
        if (
          isDarkCfg.peak > 0 &&
          topVerticalDot > 0 &&
          distFromEdge < isDarkCfg.depth
        ) {
          const innerT3 = Math.max(
            0,
            1 - Math.max(0, distFromEdge - 1) / isDarkCfg.depth,
          );
          const profile = Math.pow(innerT3, isDarkCfg.falloff);
          const dir = Math.pow(topVerticalDot, isDarkCfg.dirExp);
          darkSub += isDarkCfg.peak * profile * dir;
        }
      }

      if (darkSub > 0) {
        const dither = ign(x, y) - 0.5;
        if (svgBackdrop) {
          const val = Math.round(
            Math.min(255, Math.max(0, (1 - darkSub) * 255 + dither)),
          );
          darkData[idx] = val;
          darkData[idx + 1] = val;
          darkData[idx + 2] = val;
          darkData[idx + 3] = 255;
        } else {
          darkData[idx] = 0;
          darkData[idx + 1] = 0;
          darkData[idx + 2] = 0;
          darkData[idx + 3] = Math.round(
            Math.min(255, Math.max(0, Math.min(1, darkSub) * 255 + dither)),
          );
        }
      }

      if (addAlpha > 0) {
        const dither = ign(x + 11, y + 23) - 0.5;
        brightData[idx] = 255;
        brightData[idx + 1] = 255;
        brightData[idx + 2] = 255;
        brightData[idx + 3] = Math.round(
          Math.min(255, Math.max(0, Math.min(1, addAlpha) * 255 + dither)),
        );
      }

      // --- C. 1px Surface-Normal Specular Rim ---
      if (distFromEdge >= -1 && distFromEdge <= 2.5) {
        const primary = Math.pow(Math.max(0, dot), rimCfg.exp) * primaryRimMax;
        const bounce = Math.pow(Math.max(0, -dot), rimCfg.exp) * bounceRimMax;
        const rimAlpha = Math.min(1, primary + bounce);

        rimData[idx] = 255;
        rimData[idx + 1] = 255;
        rimData[idx + 2] = 255;
        rimData[idx + 3] = Math.round(rimAlpha * 255);
      }
    }
  }

  let displacementUrl = "";
  if (dispCanvas && dispCtx && dispImg) {
    dispCtx.putImageData(dispImg, 0, 0);
    displacementUrl = dispCanvas.toDataURL();
  }
  darkCtx.putImageData(darkImg, 0, 0);
  brightCtx.putImageData(brightImg, 0, 0);
  rimCtx.putImageData(rimImg, 0, 0);

  const result: CachedLayers = {
    displacementUrl,
    darkenUrl: darkCanvas.toDataURL(),
    brightenUrl: brightCanvas.toDataURL(),
    rimUrl: rimCanvas.toDataURL(),
  };

  if (layerCache.size >= GLASS_CONFIG.cache.maxEntries) {
    const oldestKey = layerCache.keys().next().value;
    if (oldestKey !== undefined) {
      layerCache.delete(oldestKey);
    }
  }
  layerCache.set(key, result);
  return result;
}

interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  theme?: GlassTheme;
  variant?: GlassVariant;
  tint?: GlassTintColor | (string & {});
  refraction?: number;
  depth?: number;
  dispersion?: number;
  frost?: number;
  splay?: number;
  lightAngle?: number;
  lightOpacity?: number;
  radius?: number;
  contentClassName?: string;
}

export function LiquidGlass({
  theme = GLASS_CONFIG.defaults.theme,
  variant = GLASS_CONFIG.defaults.variant,
  tint = GLASS_CONFIG.defaults.tint,
  refraction,
  depth,
  dispersion,
  frost,
  splay,
  lightAngle,
  lightOpacity,
  radius,
  className = "",
  contentClassName = "",
  children,
  style,
  ...props
}: LiquidGlassProps) {
  const preset = resolvePreset(theme, variant);
  const resolvedRefraction = refraction ?? preset.refraction;
  const resolvedDepth = depth ?? preset.depth;
  const resolvedDispersion = dispersion ?? preset.dispersion;
  const resolvedFrost = frost ?? preset.frost;
  const resolvedSplay = splay ?? preset.splay;
  const resolvedLightAngle = lightAngle ?? preset.lightAngle;
  const resolvedLightOpacity = lightOpacity ?? preset.lightOpacity;

  const isTinted = variant === "tinted";
  const tintHex = isTinted
    ? (GLASS_TINT_PRESETS[tint as GlassTintColor] ?? tint)
    : null;
  const [tintR, tintG, tintB] = tintHex ? parseHexColor(tintHex) : [0, 0, 0];
  const tintSubR = (1 - tintR / 255).toFixed(4);
  const tintSubG = (1 - tintG / 255).toFixed(4);
  const tintSubB = (1 - tintB / 255).toFixed(4);

  const rawId = useId();
  const cleanId = rawId.replace(/:/g, "");
  const dsSidesFilterId = `lg-ds-sides-${cleanId}-${theme}-${variant}`;
  const dsAllFilterId = `lg-ds-all-${cleanId}-${theme}-${variant}`;
  const tintFilterId = tintHex
    ? `lg-tint-${cleanId}-${tintHex.replace(/[^a-zA-Z0-9]/g, "")}`
    : "";

  const containerRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<LayerState | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const svgBackdrop = detectSvgBackdropSupport();
    const cssPlusDarker = detectCssPlusDarkerSupport();
    const activePreset = resolvePreset(theme, variant);

    let lastW = 0;
    let lastH = 0;
    let lastR = -1;
    let rafId = 0;

    const observer = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const computedRadius =
        radius ??
        (parseFloat(getComputedStyle(container).borderTopLeftRadius) ||
          GLASS_CONFIG.defaults.radius);

      if (
        w <= 0 ||
        h <= 0 ||
        (w === lastW && h === lastH && computedRadius === lastR)
      ) {
        return;
      }
      lastW = w;
      lastH = h;
      lastR = computedRadius;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const generated = getOrGenerateLayers(
          w,
          h,
          computedRadius,
          resolvedDepth,
          resolvedSplay,
          resolvedLightAngle,
          resolvedLightOpacity,
          theme,
          variant,
          activePreset,
          svgBackdrop,
        );
        setLayers({ w, h, svgBackdrop, cssPlusDarker, ...generated });
      });
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [
    theme,
    variant,
    radius,
    resolvedDepth,
    resolvedSplay,
    resolvedLightAngle,
    resolvedLightOpacity,
  ]);

  const refCfg = GLASS_CONFIG.refraction;
  const { dropShadow: dsCfg, rim: rimCfg, fills } = preset;

  const useSvg = layers?.svgBackdrop ?? false;
  const fallbackDarkBlend: React.CSSProperties["mixBlendMode"] =
    layers?.cssPlusDarker ? "plus-darker" : "normal";

  const activeFilterId = `lg-${cleanId}-${theme}-${variant}-${layers?.w ?? 0}x${layers?.h ?? 0}-${radius ?? "css"}-${resolvedDepth}-${resolvedSplay}-${resolvedLightAngle}-${resolvedLightOpacity}`;
  const glassBackdrop = useSvg
    ? `url(#${activeFilterId})`
    : `blur(${resolvedFrost * refCfg.fallbackBlurFactor}px)`;

  const baseScale = (resolvedRefraction / 100) * refCfg.baseScaleFactor;
  const chromaOffset = (resolvedDispersion / 100) * refCfg.chromaOffsetFactor;
  const scaleR = (baseScale - chromaOffset).toFixed(2);
  const scaleG = baseScale.toFixed(2);
  const scaleB = (baseScale + chromaOffset).toFixed(2);
  const stdDev = (resolvedFrost * refCfg.frostStdDevFactor).toFixed(2);

  return (
    <div
      ref={containerRef}
      style={{
        ...style,
        ...(radius !== undefined ? { borderRadius: `${radius}px` } : {}),
        boxShadow: style?.boxShadow
          ? `${dsCfg.ambient}, ${style.boxShadow}`
          : dsCfg.ambient,
      }}
      className={`relative ${radius === undefined ? "rounded-[23px]" : ""} ${className}`}
      {...props}
    >
      {useSvg && layers && (
        <svg
          width="0"
          height="0"
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          aria-hidden="true"
        >
          <defs>
            {/* Main Glass Refraction + Chromatic Dispersion + Interior Plus-Darker Filter */}
            <filter
              id={activeFilterId}
              x="0"
              y="0"
              width={layers.w}
              height={layers.h}
              filterUnits="userSpaceOnUse"
              primitiveUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation={stdDev}
                edgeMode="duplicate"
                result="blurred"
              />
              <feImage
                x="0"
                y="0"
                width={layers.w}
                height={layers.h}
                href={layers.displacementUrl}
                preserveAspectRatio="none"
                result="dispMapRaw"
              />
              <feGaussianBlur
                in="dispMapRaw"
                stdDeviation={refCfg.dispMapBlurStdDev}
                edgeMode="duplicate"
                result="dispMap"
              />
              <feDisplacementMap
                in="blurred"
                in2="dispMap"
                scale={scaleR}
                xChannelSelector="R"
                yChannelSelector="G"
                result="dispR"
              />
              <feColorMatrix
                in="dispR"
                type="matrix"
                values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
                result="r"
              />
              <feDisplacementMap
                in="blurred"
                in2="dispMap"
                scale={scaleG}
                xChannelSelector="R"
                yChannelSelector="G"
                result="dispG"
              />
              <feColorMatrix
                in="dispG"
                type="matrix"
                values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
                result="g"
              />
              <feDisplacementMap
                in="blurred"
                in2="dispMap"
                scale={scaleB}
                xChannelSelector="R"
                yChannelSelector="G"
                result="dispB"
              />
              <feColorMatrix
                in="dispB"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
                result="b"
              />
              <feBlend in="r" in2="g" mode="screen" result="rg" />
              <feBlend in="rg" in2="b" mode="screen" result="rgb" />

              <feImage
                x="0"
                y="0"
                width={layers.w}
                height={layers.h}
                href={layers.darkenUrl}
                preserveAspectRatio="none"
                result="darkMap"
              />
              <feComposite
                in="rgb"
                in2="darkMap"
                operator="arithmetic"
                k1="0"
                k2="1"
                k3="1"
                k4="-1"
                result="darkened"
              />
            </filter>

            {/* Drop Shadow 3: True Plus-Darker */}
            {dsCfg.allSub > 0 && (
              <filter id={dsAllFilterId} colorInterpolationFilters="sRGB">
                <feComponentTransfer>
                  <feFuncR type="linear" slope="1" intercept={-dsCfg.allSub} />
                  <feFuncG type="linear" slope="1" intercept={-dsCfg.allSub} />
                  <feFuncB type="linear" slope="1" intercept={-dsCfg.allSub} />
                </feComponentTransfer>
              </filter>
            )}

            {/* Drop Shadows 1 & 2: True Plus-Darker */}
            <filter id={dsSidesFilterId} colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="linear" slope="1" intercept={-dsCfg.sidesSub} />
                <feFuncG type="linear" slope="1" intercept={-dsCfg.sidesSub} />
                <feFuncB type="linear" slope="1" intercept={-dsCfg.sidesSub} />
              </feComponentTransfer>
            </filter>

            {/* Tinted Variant: True Plus-Darker 100% Tint Fill */}
            {tintHex && (
              <filter id={tintFilterId} colorInterpolationFilters="sRGB">
                <feComponentTransfer>
                  <feFuncR
                    type="linear"
                    slope="1"
                    intercept={-Number(tintSubR)}
                  />
                  <feFuncG
                    type="linear"
                    slope="1"
                    intercept={-Number(tintSubG)}
                  />
                  <feFuncB
                    type="linear"
                    slope="1"
                    intercept={-Number(tintSubB)}
                  />
                </feComponentTransfer>
              </filter>
            )}
          </defs>
        </svg>
      )}

      {/* 0A. Drop Shadow 3 (All-around outer ring) */}
      {layers && dsCfg.allSub > 0 && (
        <div
          className="pointer-events-none absolute rounded-[inherit]"
          style={{
            inset: `-${dsCfg.allWidthPx}px`,
            padding: `${dsCfg.allWidthPx}px`,
            ...(radius !== undefined
              ? { borderRadius: `${radius + dsCfg.allWidthPx}px` }
              : {}),
            ...(useSvg
              ? {
                  backdropFilter: `url(#${dsAllFilterId})`,
                  WebkitBackdropFilter: `url(#${dsAllFilterId})`,
                }
              : {
                  backgroundColor: `rgba(0, 0, 0, ${dsCfg.allSub})`,
                  mixBlendMode: fallbackDarkBlend,
                }),
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
      )}

      {/* 0B. Drop Shadows 1 & 2 (Left & Right outer rings) */}
      {layers && (
        <div
          className="pointer-events-none absolute rounded-[inherit]"
          style={{
            top: 0,
            bottom: 0,
            left: `-${dsCfg.sidesWidthPx}px`,
            right: `-${dsCfg.sidesWidthPx}px`,
            padding: `0px ${dsCfg.sidesWidthPx}px`,
            ...(radius !== undefined
              ? { borderRadius: `${radius + dsCfg.sidesWidthPx}px` }
              : {}),
            ...(useSvg
              ? {
                  backdropFilter: `url(#${dsSidesFilterId})`,
                  WebkitBackdropFilter: `url(#${dsSidesFilterId})`,
                }
              : {
                  backgroundColor: `rgba(0, 0, 0, ${dsCfg.sidesSub})`,
                  mixBlendMode: fallbackDarkBlend,
                }),
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
      )}

      {/* 0C. Solid Backing (Tinted variant: 100% white behind the glass) */}
      {preset.backingColor && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ backgroundColor: preset.backingColor }}
        />
      )}

      {/* 1. Glass Backdrop (+ True GPU Plus-Darker Pass in Chromium) */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        style={{
          backdropFilter: glassBackdrop,
          WebkitBackdropFilter: glassBackdrop,
        }}
      />

      {/* 1A. Non-Chromium Top Darkening + Inner Shadow 3 Fallback */}
      {!useSvg && layers && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-cover bg-center"
          style={{
            backgroundImage: `url(${layers.darkenUrl})`,
            mixBlendMode: fallbackDarkBlend,
          }}
        />
      )}

      {/* 1B. Tinted Variant Fill (100% Tint Color, Plus Darker) */}
      {tintHex && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={
            useSvg
              ? {
                  backdropFilter: `url(#${tintFilterId})`,
                  WebkitBackdropFilter: `url(#${tintFilterId})`,
                }
              : {
                  backgroundColor: tintHex,
                  mixBlendMode: layers?.cssPlusDarker
                    ? "plus-darker"
                    : "multiply",
                }
          }
        />
      )}

      {/* 1C. Glass Body Fills (rendered bottom-to-top) */}
      {fills.map((fill, index) => (
        <div
          key={index}
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            backgroundColor: fill.color,
            mixBlendMode: fill.blendMode ?? "normal",
          }}
        />
      ))}

      {/* 2. Additive Brightening + Inner Shadows 1 & 2 (mixBlendMode: "plus-lighter") */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-cover bg-center"
        style={{
          mixBlendMode: "plus-lighter",
          backgroundImage: layers ? `url(${layers.brightenUrl})` : undefined,
        }}
      />

      {/* 3. Surface-Normal Specular Rim */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-cover bg-center"
        style={{
          padding: `${rimCfg.widthPx}px`,
          backgroundImage: layers ? `url(${layers.rimUrl})` : undefined,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* Content Slot */}
      <div className={`relative z-10 h-full w-full ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
