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
  version: number;
  w: number;
  h: number;
  radius: number;
  svgBackdrop: boolean;
  cssPlusDarker: boolean;
}

export interface LayerShadingConfig {
  needsDisplacement: boolean;
  bevel: ResolvedPreset["bevel"];
  innerShadow: ResolvedPreset["innerShadow"];
  rim: Pick<ResolvedPreset["rim"], "primaryScale" | "bounceScale" | "exp">;
}

const EMPTY_SHADING: ShadingLayers = {
  darkenUrl: "",
  brightenUrl: "",
  rimUrl: "",
};

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

function createCanvas2D(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  return { canvas, ctx, img, data: img.data };
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
    needsDisplacement,
    bevel: bevelCfg,
    innerShadow: { light: isLightCfg, dark: isDarkCfg },
    rim: rimCfg,
  } = config;

  const rx = w / 2;
  const ry = h / 2;
  const r = Math.min(radius, rx, ry);

  const l = Math.max(0, lightOpacity) / 100;
  const primaryRimMax = Math.min(1, l * rimCfg.primaryScale);
  const bounceRimMax = Math.min(1, l * rimCfg.bounceScale);
  const topDarkenMax = Math.min(1, l * bevelCfg.topDarkenScale);
  const bottomBrightenMax = Math.min(1, l * bevelCfg.bottomBrightenScale);

  const needsDarken = topDarkenMax > 0 || isDarkCfg.intensity > 0;
  const needsBrighten = bottomBrightenMax > 0 || isLightCfg.intensity > 0;
  const needsRim = primaryRimMax > 0 || bounceRimMax > 0;
  const needsAnyShading = needsDarken || needsBrighten || needsRim;

  const needsDisp = svgBackdrop && needsDisplacement;
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
    isLightCfg.intensity,
    isLightCfg.falloff,
    isLightCfg.dirExp,
    isDarkCfg.depth,
    isDarkCfg.intensity,
    isDarkCfg.falloff,
    isDarkCfg.dirExp,
    rimCfg.primaryScale,
    rimCfg.bounceScale,
    rimCfg.exp,
    svgBackdrop ? 1 : 0,
  ].join("-");

  const cachedDisp = needsDisp ? lruGet(dispCache, dispKey) : "";
  const cachedShading = needsAnyShading
    ? lruGet(shadingCache, shadingKey)
    : EMPTY_SHADING;

  const computeDisp = needsDisp && cachedDisp === undefined;
  const computeShading = needsAnyShading && cachedShading === undefined;

  if (!computeDisp && cachedShading !== undefined) {
    return {
      displacementUrl: cachedDisp ?? "",
      ...cachedShading,
    };
  }

  // 1. Displacement Map Canvas (Chromium with active refraction/dispersion only)
  const dispSurface = computeDisp ? createCanvas2D(w, h) : null;
  const dispData = dispSurface?.data ?? null;

  // 2 & 3. Shading & Rim Canvases (allocate only active layers)
  let darkSurface: ReturnType<typeof createCanvas2D> = null;
  let brightSurface: ReturnType<typeof createCanvas2D> = null;
  let rimSurface: ReturnType<typeof createCanvas2D> = null;

  if (computeShading) {
    darkSurface = needsDarken ? createCanvas2D(w, h) : null;
    brightSurface = needsBrighten ? createCanvas2D(w, h) : null;
    rimSurface = needsRim ? createCanvas2D(w, h) : null;
    if (
      (needsDarken && !darkSurface) ||
      (needsBrighten && !brightSurface) ||
      (needsRim && !rimSurface)
    ) {
      return {
        displacementUrl: cachedDisp ?? "",
        ...EMPTY_SHADING,
      };
    }
    if (darkSurface && svgBackdrop) darkSurface.data.fill(255);
  }

  if (computeDisp && !dispSurface) {
    return {
      displacementUrl: "",
      ...(cachedShading ?? EMPTY_SHADING),
    };
  }

  const darkData = darkSurface?.data ?? null;
  const brightData = brightSurface?.data ?? null;
  const rimData = rimSurface?.data ?? null;

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

  const maxShadeDist = Math.max(
    topDarkenMax > 0 || bottomBrightenMax > 0 ? shadeDepth : 0,
    isLightCfg.intensity > 0 ? isLightCfg.depth : 0,
    isDarkCfg.intensity > 0 ? isDarkCfg.depth : 0,
  );
  const maxComputeDist = Math.max(
    dispData ? bevel : 0,
    darkData || brightData ? maxShadeDist : 0,
    rimData ? 3 : 0,
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

      if (!darkData && !brightData && !rimData) continue;

      // --- B. Fixed-Distance Bevel Shading + Inner Shadows 1, 2 & 3 ---
      if (
        (darkData || brightData) &&
        distFromEdge >= 0 &&
        distFromEdge < maxShadeDist
      ) {
        let darkSub = 0;
        let addAlpha = 0;

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

          if (darkData && topDarkenMax > 0 && shadeDot > 0) {
            const topProfile = Math.pow(s, bevelCfg.topProfileExp);
            const dir = Math.pow(shadeDot, bevelCfg.topDirExp);
            darkSub += topDarkenMax * topProfile * dir;
          } else if (brightData && bottomBrightenMax > 0 && shadeDot < 0) {
            const bottomProfile = Math.pow(s, bevelCfg.bottomProfileExp);
            const dir = Math.pow(-shadeDot, bevelCfg.bottomDirExp);
            addAlpha += bottomBrightenMax * bottomProfile * dir;
          }
        }

        // Inner Shadows 1 & 2 (Top + Bottom, Plus lighter)
        if (
          brightData &&
          isLightCfg.intensity > 0 &&
          distFromEdge < isLightCfg.depth
        ) {
          const verticalDot = Math.abs(sNormY);
          if (verticalDot > 0) {
            const innerT = Math.max(
              0,
              1 - Math.max(0, distFromEdge - 1) / isLightCfg.depth,
            );
            const profile = Math.pow(innerT, isLightCfg.falloff);
            const dir = Math.pow(verticalDot, isLightCfg.dirExp);
            addAlpha += isLightCfg.intensity * profile * dir;
          }
        }

        // Inner Shadow 3 (Top only: #E6E6E6, Plus darker)
        if (
          darkData &&
          isDarkCfg.intensity > 0 &&
          distFromEdge < isDarkCfg.depth
        ) {
          const topVerticalDot = -sNormY;
          if (topVerticalDot > 0) {
            const innerT3 = Math.max(
              0,
              1 - Math.max(0, distFromEdge - 1) / isDarkCfg.depth,
            );
            const profile = Math.pow(innerT3, isDarkCfg.falloff);
            const dir = Math.pow(topVerticalDot, isDarkCfg.dirExp);
            darkSub += isDarkCfg.intensity * profile * dir;
          }
        }

        if (darkData && darkSub > 0) {
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

        if (brightData && addAlpha > 0) {
          const dither = ign(x + 11, y + 23) - 0.5;
          brightData[idx] = 255;
          brightData[idx + 1] = 255;
          brightData[idx + 2] = 255;
          brightData[idx + 3] = Math.round(
            Math.min(255, Math.max(0, Math.min(1, addAlpha) * 255 + dither)),
          );
        }
      }

      // --- C. 1px Surface-Normal Specular Rim ---
      if (rimData && distFromEdge >= -1 && distFromEdge <= 2.5) {
        const dot = normX * lx + normY * ly;
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
  if (dispSurface) {
    dispSurface.ctx.putImageData(dispSurface.img, 0, 0);
    displacementUrl = dispSurface.canvas.toDataURL();
    lruSet(dispCache, dispKey, displacementUrl);
  }

  let shading: ShadingLayers;
  if (computeShading) {
    if (darkSurface) darkSurface.ctx.putImageData(darkSurface.img, 0, 0);
    if (brightSurface) brightSurface.ctx.putImageData(brightSurface.img, 0, 0);
    if (rimSurface) rimSurface.ctx.putImageData(rimSurface.img, 0, 0);
    shading = {
      darkenUrl: darkSurface ? darkSurface.canvas.toDataURL() : "",
      brightenUrl: brightSurface ? brightSurface.canvas.toDataURL() : "",
      rimUrl: rimSurface ? rimSurface.canvas.toDataURL() : "",
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
