import { GLASS_CONFIG, type ResolvedPreset } from "./presets";

interface ShadingLayers {
  darkenUrl: string;
  brightenUrl: string;
  rimUrl: string;
}

export interface CachedLayers extends ShadingLayers {
  displacementUrl: string;
}

export interface LayerState extends CachedLayers {
  w: number;
  h: number;
  radius: number;
  svgBackdrop: boolean;
  cssPlusDarker: boolean;
}

export interface LayerShadingConfig {
  hasSolidBacking: boolean;
  bevel: ResolvedPreset["bevel"];
  innerShadowLight: ResolvedPreset["innerShadowLight"];
  innerShadowDark: ResolvedPreset["innerShadowDark"];
  rim: Pick<ResolvedPreset["rim"], "primaryScale" | "bounceScale" | "exp">;
}

const dispCache = new Map<string, string>();
const shadingCache = new Map<string, ShadingLayers>();

function lruGet<T>(cache: Map<string, T>, key: string): T | undefined {
  const value = cache.get(key);
  if (value !== undefined) {
    cache.delete(key);
    cache.set(key, value);
  }
  return value;
}

function lruSet<T>(cache: Map<string, T>, key: string, value: T): void {
  if (cache.size >= GLASS_CONFIG.cache.maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, value);
}

let cachedSvgBackdropSupport: boolean | null = null;
let cachedCssPlusDarkerSupport: boolean | null = null;

export function detectSvgBackdropSupport(): boolean {
  if (cachedSvgBackdropSupport !== null) return cachedSvgBackdropSupport;
  if (typeof navigator === "undefined" || typeof CSS === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  const isIOS = /iP(ad|hone|od)/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
  const isFirefox = /Firefox|FxiOS/.test(ua);
  if (isIOS || isSafari || isFirefox) {
    cachedSvgBackdropSupport = false;
    return false;
  }

  cachedSvgBackdropSupport =
    CSS.supports("backdrop-filter", "url(#a)") ||
    CSS.supports("-webkit-backdrop-filter", "url(#a)");
  return cachedSvgBackdropSupport;
}

export function detectCssPlusDarkerSupport(): boolean {
  if (cachedCssPlusDarkerSupport !== null) return cachedCssPlusDarkerSupport;
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return false;
  }
  cachedCssPlusDarkerSupport = CSS.supports("mix-blend-mode", "plus-darker");
  return cachedCssPlusDarkerSupport;
}

export function getOrGenerateLayers(
  w: number,
  h: number,
  radius: number,
  depth: number,
  splay: number,
  lightAngle: number,
  lightOpacity: number,
  config: LayerShadingConfig,
  svgBackdrop: boolean,
): CachedLayers {
  const refCfg = GLASS_CONFIG.refraction;
  const {
    hasSolidBacking,
    bevel: bevelCfg,
    innerShadowLight: isLightCfg,
    innerShadowDark: isDarkCfg,
    rim: rimCfg,
  } = config;

  const rx = w / 2;
  const ry = h / 2;
  const r = Math.min(radius, rx, ry);

  const needsDisp = svgBackdrop && !hasSolidBacking;
  const dispKey = `${w}x${h}-${r}-${depth}-${splay}`;
  const shadingKey = [
    `${w}x${h}`,
    r,
    depth,
    lightAngle,
    lightOpacity,
    bevelCfg.shadeRadiusFactor,
    bevelCfg.shadeDepthMin,
    bevelCfg.shadeDepthFactor,
    bevelCfg.topDarkenScale,
    bevelCfg.topProfileExp,
    bevelCfg.topDirExp,
    bevelCfg.bottomBrightenScale,
    bevelCfg.bottomProfileExp,
    bevelCfg.bottomDirExp,
    isLightCfg.depth,
    isLightCfg.peak,
    isLightCfg.falloff,
    isLightCfg.dirExp,
    isDarkCfg.depth,
    isDarkCfg.peak,
    isDarkCfg.falloff,
    isDarkCfg.dirExp,
    rimCfg.primaryScale,
    rimCfg.bounceScale,
    rimCfg.exp,
    svgBackdrop ? 1 : 0,
  ].join("-");

  const cachedDisp = needsDisp ? lruGet(dispCache, dispKey) : "";
  const cachedShading = lruGet(shadingCache, shadingKey);

  const computeDisp = needsDisp && cachedDisp === undefined;
  const computeShading = cachedShading === undefined;

  if (!computeDisp && !computeShading) {
    return {
      displacementUrl: cachedDisp ?? "",
      ...cachedShading,
    };
  }

  // 1. Displacement Map Canvas (Chromium without solid backing only)
  let dispCanvas: HTMLCanvasElement | null = null;
  let dispCtx: CanvasRenderingContext2D | null = null;
  let dispImg: ImageData | null = null;
  let dispData: Uint8ClampedArray | null = null;
  if (computeDisp) {
    dispCanvas = document.createElement("canvas");
    dispCanvas.width = w;
    dispCanvas.height = h;
    dispCtx = dispCanvas.getContext("2d")!;
    dispImg = dispCtx.createImageData(w, h);
    dispData = dispImg.data;
  }

  // 2 & 3. Shading & Rim Canvases
  let darkCanvas: HTMLCanvasElement | null = null;
  let darkCtx: CanvasRenderingContext2D | null = null;
  let darkImg: ImageData | null = null;
  let darkData: Uint8ClampedArray | null = null;

  let brightCanvas: HTMLCanvasElement | null = null;
  let brightCtx: CanvasRenderingContext2D | null = null;
  let brightImg: ImageData | null = null;
  let brightData: Uint8ClampedArray | null = null;

  let rimCanvas: HTMLCanvasElement | null = null;
  let rimCtx: CanvasRenderingContext2D | null = null;
  let rimImg: ImageData | null = null;
  let rimData: Uint8ClampedArray | null = null;

  if (computeShading) {
    darkCanvas = document.createElement("canvas");
    darkCanvas.width = w;
    darkCanvas.height = h;
    darkCtx = darkCanvas.getContext("2d")!;
    darkImg = darkCtx.createImageData(w, h);
    darkData = darkImg.data;
    if (svgBackdrop) darkData.fill(255);

    brightCanvas = document.createElement("canvas");
    brightCanvas.width = w;
    brightCanvas.height = h;
    brightCtx = brightCanvas.getContext("2d")!;
    brightImg = brightCtx.createImageData(w, h);
    brightData = brightImg.data;

    rimCanvas = document.createElement("canvas");
    rimCanvas.width = w;
    rimCanvas.height = h;
    rimCtx = rimCanvas.getContext("2d")!;
    rimImg = rimCtx.createImageData(w, h);
    rimData = rimImg.data;
  }

  const bevel = Math.max(1, depth);
  const rShade = Math.min(
    Math.max(r, bevel * bevelCfg.shadeRadiusFactor),
    rx,
    ry,
  );
  const sameShadeRadius = rShade === r;
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
  const maxComputeDist = Math.max(
    computeDisp ? bevel : 0,
    computeShading ? Math.max(maxShadeDist, 3) : 0,
  );

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

      if (!darkData || !brightData || !rimData) continue;

      const dot = normX * lx + normY * ly;

      // --- B. Fixed-Distance Bevel Shading + Inner Shadows 1, 2 & 3 ---
      let darkSub = 0;
      let addAlpha = 0;

      if (distFromEdge >= 0 && distFromEdge < maxShadeDist) {
        let sNormX = normX;
        let sNormY = normY;
        if (!sameShadeRadius) {
          const sgx =
            sdRoundedBox(px + 1, py, rShade) - sdRoundedBox(px - 1, py, rShade);
          const sgy =
            sdRoundedBox(px, py + 1, rShade) - sdRoundedBox(px, py - 1, rShade);
          const slen = Math.hypot(sgx, sgy) || 1;
          sNormX = sgx / slen;
          sNormY = sgy / slen;
        }
        const shadeDot = sNormX * lx + sNormY * ly;

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
        const verticalDot = Math.abs(sNormY);
        if (
          isLightCfg.peak > 0 &&
          verticalDot > 0 &&
          distFromEdge < isLightCfg.depth
        ) {
          const innerT = Math.max(
            0,
            1 - Math.max(0, distFromEdge - 1) / isLightCfg.depth,
          );
          const profile = Math.pow(innerT, isLightCfg.falloff);
          const dir = Math.pow(verticalDot, isLightCfg.dirExp);
          addAlpha += isLightCfg.peak * profile * dir;
        }

        // Inner Shadow 3 (Top only: #E6E6E6, Plus darker)
        const topVerticalDot = -sNormY;
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

  let displacementUrl = cachedDisp ?? "";
  if (computeDisp && dispCanvas && dispCtx && dispImg) {
    dispCtx.putImageData(dispImg, 0, 0);
    displacementUrl = dispCanvas.toDataURL();
    lruSet(dispCache, dispKey, displacementUrl);
  }

  let shading: ShadingLayers;
  if (
    computeShading &&
    darkCanvas &&
    darkCtx &&
    darkImg &&
    brightCanvas &&
    brightCtx &&
    brightImg &&
    rimCanvas &&
    rimCtx &&
    rimImg
  ) {
    darkCtx.putImageData(darkImg, 0, 0);
    brightCtx.putImageData(brightImg, 0, 0);
    rimCtx.putImageData(rimImg, 0, 0);
    shading = {
      darkenUrl: darkCanvas.toDataURL(),
      brightenUrl: brightCanvas.toDataURL(),
      rimUrl: rimCanvas.toDataURL(),
    };
    lruSet(shadingCache, shadingKey, shading);
  } else {
    shading = cachedShading!;
  }

  return {
    displacementUrl,
    ...shading,
  };
}
