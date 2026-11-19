"use client";

import React, { useEffect, useId, useRef, useState } from "react";

const GLASS_CONFIG = {
  cache: {
    maxEntries: 24,
  },
  defaults: {
    refraction: 70,
    depth: 30,
    dispersion: 20,
    frost: 6,
    splay: 20,
    lightAngle: 0,
    lightOpacity: 40,
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
    peak: 0.08,
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
    // DS 4: x: 0, y: 8, blur: 15, spread: 0 (#000000 2%, Normal)
    ambient: "0px 8px 15px 0px rgba(0, 0, 0, 0.02)",
  },
  fill: {
    // #808080 4%, Luminosity
    color: "rgba(128, 128, 128, 0.04)",
  },
} as const;

interface CachedLayers {
  displacementUrl: string;
  darkenUrl: string;
  brightenUrl: string;
  rimUrl: string;
}

interface LayerState extends CachedLayers {
  w: number;
  h: number;
}

const layerCache = new Map<string, CachedLayers>();

function getOrGenerateLayers(
  w: number,
  h: number,
  radius: number,
  depth: number,
  splay: number,
  lightAngle: number,
  lightOpacity: number,
): CachedLayers {
  const key = `${w}x${h}-${radius}-${depth}-${splay}-${lightAngle}-${lightOpacity}`;
  const cached = layerCache.get(key);
  if (cached) {
    layerCache.delete(key);
    layerCache.set(key, cached);
    return cached;
  }

  const {
    refraction: refCfg,
    bevel: bevelCfg,
    innerShadowLight: isLightCfg,
    innerShadowDark: isDarkCfg,
    rim: rimCfg,
  } = GLASS_CONFIG;

  // 1. Displacement Map Canvas
  const dispCanvas = document.createElement("canvas");
  dispCanvas.width = w;
  dispCanvas.height = h;
  const dispCtx = dispCanvas.getContext("2d")!;
  const dispImg = dispCtx.createImageData(w, h);
  const dispData = dispImg.data;

  // 2A. True Plus-Darker Map for SVG feComposite (k2=1, k3=1, k4=-1)
  const darkCanvas = document.createElement("canvas");
  darkCanvas.width = w;
  darkCanvas.height = h;
  const darkCtx = darkCanvas.getContext("2d")!;
  const darkImg = darkCtx.createImageData(w, h);
  const darkData = darkImg.data;
  darkData.fill(255);

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
  const maxComputeDist = Math.max(bevel, maxShadeDist, 3);

  for (let y = 0; y < h; y++) {
    const py = y - ry;
    for (let x = 0; x < w; x++) {
      const px = x - rx;
      const d = sdRoundedBox(px, py, r);
      const distFromEdge = -d;

      const idx = (y * w + x) * 4;

      if (distFromEdge >= maxComputeDist) {
        dispData[idx] = 128;
        dispData[idx + 1] = 128;
        dispData[idx + 2] = 128;
        dispData[idx + 3] = 255;
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
      if (distFromEdge < bevel) {
        const clampedDist = Math.max(0, distFromEdge);
        const t = 1 - clampedDist / bevel;
        let tSoft: number;
        if (t < shoulderT) {
          tSoft = t / shoulderNorm;
        } else {
          const u = (t - shoulderT) / shoulderSpan;
          tSoft = (shoulderT + shoulderSpan * (u - 0.5 * u * u)) / shoulderNorm;
        }
        const mag = Math.pow(tSoft, splayExp);
        const nx = -normX * mag;
        const ny = -normY * mag;
        dispData[idx] = Math.round(Math.min(255, Math.max(0, 128 + nx * 127)));
        dispData[idx + 1] = Math.round(
          Math.min(255, Math.max(0, 128 + ny * 127)),
        );
      } else {
        dispData[idx] = 128;
        dispData[idx + 1] = 128;
      }
      dispData[idx + 2] = 128;
      dispData[idx + 3] = 255;

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
        if (topVerticalDot > 0 && distFromEdge < isDarkCfg.depth) {
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
        const val = Math.round(
          Math.min(255, Math.max(0, (1 - darkSub) * 255 + dither)),
        );
        darkData[idx] = val;
        darkData[idx + 1] = val;
        darkData[idx + 2] = val;
        darkData[idx + 3] = 255;
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

  dispCtx.putImageData(dispImg, 0, 0);
  darkCtx.putImageData(darkImg, 0, 0);
  brightCtx.putImageData(brightImg, 0, 0);
  rimCtx.putImageData(rimImg, 0, 0);

  const result: CachedLayers = {
    displacementUrl: dispCanvas.toDataURL(),
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
  refraction?: number;
  depth?: number;
  dispersion?: number;
  frost?: number;
  splay?: number;
  lightAngle?: number;
  lightOpacity?: number;
  radius?: number;
}

export function LiquidGlass({
  refraction = GLASS_CONFIG.defaults.refraction,
  depth = GLASS_CONFIG.defaults.depth,
  dispersion = GLASS_CONFIG.defaults.dispersion,
  frost = GLASS_CONFIG.defaults.frost,
  splay = GLASS_CONFIG.defaults.splay,
  lightAngle = GLASS_CONFIG.defaults.lightAngle,
  lightOpacity = GLASS_CONFIG.defaults.lightOpacity,
  radius,
  className = "",
  children,
  style,
  ...props
}: LiquidGlassProps) {
  const rawId = useId();
  const cleanId = rawId.replace(/:/g, "");
  const dsSidesFilterId = `lg-ds-sides-${cleanId}`;
  const dsAllFilterId = `lg-ds-all-${cleanId}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<LayerState | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
          depth,
          splay,
          lightAngle,
          lightOpacity,
        );
        setLayers({ w, h, ...generated });
      });
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [radius, depth, splay, lightAngle, lightOpacity]);

  const {
    refraction: refCfg,
    dropShadow: dsCfg,
    rim: rimCfg,
    fill: fillCfg,
  } = GLASS_CONFIG;

  const activeFilterId = `lg-${cleanId}-${layers?.w ?? 0}x${layers?.h ?? 0}-${radius ?? "css"}-${depth}-${splay}-${lightAngle}-${lightOpacity}`;
  const glassBackdrop = layers
    ? `url(#${activeFilterId})`
    : `blur(${frost * refCfg.fallbackBlurFactor}px)`;

  const baseScale = (refraction / 100) * refCfg.baseScaleFactor;
  const chromaOffset = (dispersion / 100) * refCfg.chromaOffsetFactor;
  const scaleR = (baseScale - chromaOffset).toFixed(2);
  const scaleG = baseScale.toFixed(2);
  const scaleB = (baseScale + chromaOffset).toFixed(2);
  const stdDev = (frost * refCfg.frostStdDevFactor).toFixed(2);

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
            width={layers?.w ?? 256}
            height={layers?.h ?? 256}
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
              width={layers?.w ?? 256}
              height={layers?.h ?? 256}
              href={layers?.displacementUrl}
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
              width={layers?.w ?? 256}
              height={layers?.h ?? 256}
              href={layers?.darkenUrl}
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

          {/* Drop Shadow 3: True Plus-Darker (#CCCCCC) */}
          <filter id={dsAllFilterId} colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="linear" slope="1" intercept={-dsCfg.allSub} />
              <feFuncG type="linear" slope="1" intercept={-dsCfg.allSub} />
              <feFuncB type="linear" slope="1" intercept={-dsCfg.allSub} />
            </feComponentTransfer>
          </filter>

          {/* Drop Shadows 1 & 2: True Plus-Darker (#D0D0D0) */}
          <filter id={dsSidesFilterId} colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="linear" slope="1" intercept={-dsCfg.sidesSub} />
              <feFuncG type="linear" slope="1" intercept={-dsCfg.sidesSub} />
              <feFuncB type="linear" slope="1" intercept={-dsCfg.sidesSub} />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {/* 0A. Drop Shadow 3 (All-around outer ring) */}
      <div
        className="pointer-events-none absolute rounded-[inherit]"
        style={{
          inset: `-${dsCfg.allWidthPx}px`,
          padding: `${dsCfg.allWidthPx}px`,
          ...(radius !== undefined
            ? { borderRadius: `${radius + dsCfg.allWidthPx}px` }
            : {}),
          backdropFilter: `url(#${dsAllFilterId})`,
          WebkitBackdropFilter: `url(#${dsAllFilterId})`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* 0B. Drop Shadows 1 & 2 (Left & Right outer rings) */}
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
          backdropFilter: `url(#${dsSidesFilterId})`,
          WebkitBackdropFilter: `url(#${dsSidesFilterId})`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* 1. Glass Backdrop + True GPU Plus-Darker Pass (Top Bevel + Inner Shadow 3) */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        style={{
          backdropFilter: glassBackdrop,
          WebkitBackdropFilter: glassBackdrop,
        }}
      />

      {/* 1B. Glass Body Fill (#808080 4%, Luminosity) */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          backgroundColor: fillCfg.color,
          mixBlendMode: "luminosity",
        }}
      />

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
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
}
