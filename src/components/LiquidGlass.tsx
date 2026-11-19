"use client";

import React, { useEffect, useId, useRef } from "react";

const SHADER_VERSION = 25;

interface CachedLayers {
  displacementUrl: string;
  darkenUrl: string;
  brightenUrl: string;
  rimUrl: string;
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
  const key = `${w}x${h}-${radius}-${depth}-${splay}-${lightAngle}-${lightOpacity}-v${SHADER_VERSION}`;
  if (layerCache.has(key)) return layerCache.get(key)!;

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

  const rShade = Math.min(Math.max(r, bevel * 1.25), rx, ry);
  const splayExp = 1.85 + ((100 - splay) / 100) * 0.75;
  const shadeDepth = Math.max(24, depth * 1.35);

  // --- INNER SHADOWS 1 & 2 (Top + Bottom, Plus lighter) ---
  const is1Depth = 8;
  const is1Peak = 0.08;
  const is1Falloff = 2.2;

  // --- INNER SHADOW 3 (Top only: #E6E6E6, Plus darker) ---
  const is3Depth = 28;
  const is3Peak = 0.025;
  const is3Falloff = 1.9;

  const rad = ((lightAngle - 90) * Math.PI) / 180;
  const lx = Math.cos(rad);
  const ly = Math.sin(rad);

  const l = lightOpacity / 100;

  const primaryRimMax = Math.min(1, l * 0.7);
  const bounceRimMax = Math.min(1, l * 0.42);

  const topDarkenMax = Math.min(1, l * 0.12);
  const bottomBrightenMax = Math.min(1, l * 0.045);

  const sdRoundedBox = (px: number, py: number, cornerR: number) => {
    const qx = Math.abs(px) - (rx - cornerR);
    const qy = Math.abs(py) - (ry - cornerR);
    return (
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
      Math.min(Math.max(qx, qy), 0) -
      cornerR
    );
  };

  const maxShadeDist = Math.max(shadeDepth, is1Depth, is3Depth);
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

      const gx = sdRoundedBox(px + 1, py, r) - sdRoundedBox(px - 1, py, r);
      const gy = sdRoundedBox(px, py + 1, r) - sdRoundedBox(px, py - 1, r);
      const len = Math.hypot(gx, gy) || 1;
      const normX = gx / len;
      const normY = gy / len;

      const dot = normX * lx + normY * ly;

      // --- A. Displacement Map ---
      let nx = 0;
      let ny = 0;
      if (distFromEdge < bevel) {
        const clampedDist = Math.max(0, distFromEdge);
        const t = 1 - clampedDist / bevel;
        const mag = Math.pow(t, splayExp);
        nx = -normX * mag;
        ny = -normY * mag;
      }
      dispData[idx] = Math.round(Math.min(255, Math.max(0, 128 + nx * 127)));
      dispData[idx + 1] = Math.round(
        Math.min(255, Math.max(0, 128 + ny * 127)),
      );
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
          const profile = Math.pow(s, 1.95);

          if (shadeDot > 0) {
            const topProfile = Math.pow(s, 2.0);
            const dir = Math.pow(shadeDot, 1.5);
            darkSub += topDarkenMax * topProfile * dir;
          } else if (shadeDot < 0) {
            const dir = Math.pow(-shadeDot, 2.0);
            addAlpha += bottomBrightenMax * profile * dir;
          }
        }

        // Inner Shadows 1 & 2 (Top + Bottom, Plus lighter)
        const verticalDot = Math.abs(sgy / slen);
        if (verticalDot > 0 && distFromEdge < is1Depth) {
          const innerT = Math.max(
            0,
            1 - Math.max(0, distFromEdge - 1) / is1Depth,
          );
          const is1Profile = Math.pow(innerT, is1Falloff);
          const is1Dir = Math.pow(verticalDot, 1.8);
          addAlpha += is1Peak * is1Profile * is1Dir;
        }

        // Inner Shadow 3 (Top only: #E6E6E6, Plus darker)
        const topVerticalDot = -(sgy / slen);
        if (topVerticalDot > 0 && distFromEdge < is3Depth) {
          const innerT3 = Math.max(
            0,
            1 - Math.max(0, distFromEdge - 1) / is3Depth,
          );
          const is3Profile = Math.pow(innerT3, is3Falloff);
          const is3Dir = Math.pow(topVerticalDot, 1.8);
          darkSub += is3Peak * is3Profile * is3Dir;
        }
      }

      if (darkSub > 0) {
        const val = Math.round(Math.max(0, 1 - darkSub) * 255);
        darkData[idx] = val;
        darkData[idx + 1] = val;
        darkData[idx + 2] = val;
        darkData[idx + 3] = 255;
      }

      if (addAlpha > 0) {
        brightData[idx] = 255;
        brightData[idx + 1] = 255;
        brightData[idx + 2] = 255;
        brightData[idx + 3] = Math.round(Math.min(1, addAlpha) * 255);
      }

      // --- C. 1px Surface-Normal Specular Rim ---
      if (distFromEdge >= -1 && distFromEdge <= 2.5) {
        const primary = Math.pow(Math.max(0, dot), 2.2) * primaryRimMax;
        const bounce = Math.pow(Math.max(0, -dot), 2.2) * bounceRimMax;
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
  layerCache.set(key, result);
  return result;
}

interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  refraction?: number; // Figma: 70
  depth?: number; // Figma: 30
  dispersion?: number; // Figma: 20
  frost?: number; // Figma: 6
  splay?: number; // Figma: 20
  lightAngle?: number; // Figma: 0
  lightOpacity?: number; // Figma: 40
  radius?: number; // Figma: 23 (or use Tailwind rounded-* classes)
}

export function LiquidGlass({
  refraction = 70,
  depth = 30,
  dispersion = 20,
  frost = 6,
  splay = 20,
  lightAngle = 0,
  lightOpacity = 40,
  radius,
  className = "",
  children,
  style,
  ...props
}: LiquidGlassProps) {
  const rawId = useId();
  const cleanId = rawId.replace(/:/g, "");
  const filterId = `lg-${cleanId}-${SHADER_VERSION}`;
  const dsSidesFilterId = `lg-ds-sides-${cleanId}-${SHADER_VERSION}`;
  const dsAllFilterId = `lg-ds-all-${cleanId}-${SHADER_VERSION}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const brightRef = useRef<HTMLDivElement>(null);
  const rimRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<SVGFilterElement>(null);
  const feImageRef = useRef<SVGFEImageElement>(null);
  const feDarkImageRef = useRef<SVGFEImageElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const el = glassRef.current;
    const brightEl = brightRef.current;
    const rimEl = rimRef.current;
    const filterEl = filterRef.current;
    const feImage = feImageRef.current;
    const feDarkImage = feDarkImageRef.current;
    if (
      !container ||
      !el ||
      !brightEl ||
      !rimEl ||
      !filterEl ||
      !feImage ||
      !feDarkImage
    )
      return;

    let lastW = 0;
    let lastH = 0;
    let lastR = -1;
    let lastAngle = NaN;
    let lastOpacity = NaN;
    let rafId = 0;

    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      const computedRadius =
        radius ??
        (parseFloat(getComputedStyle(container).borderTopLeftRadius) || 23);

      if (
        w <= 0 ||
        h <= 0 ||
        (w === lastW &&
          h === lastH &&
          computedRadius === lastR &&
          lightAngle === lastAngle &&
          lightOpacity === lastOpacity)
      ) {
        return;
      }
      lastW = w;
      lastH = h;
      lastR = computedRadius;
      lastAngle = lightAngle;
      lastOpacity = lightOpacity;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const { displacementUrl, darkenUrl, brightenUrl, rimUrl } =
          getOrGenerateLayers(
            w,
            h,
            computedRadius,
            depth,
            splay,
            lightAngle,
            lightOpacity,
          );

        filterEl.setAttribute("width", String(w));
        filterEl.setAttribute("height", String(h));

        feImage.setAttribute("width", String(w));
        feImage.setAttribute("height", String(h));
        feImage.setAttribute("href", displacementUrl);
        feImage.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "xlink:href",
          displacementUrl,
        );

        feDarkImage.setAttribute("width", String(w));
        feDarkImage.setAttribute("height", String(h));
        feDarkImage.setAttribute("href", darkenUrl);
        feDarkImage.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "xlink:href",
          darkenUrl,
        );

        el.style.backdropFilter = `url(#${filterId})`;
        el.style.setProperty("-webkit-backdrop-filter", `url(#${filterId})`);

        brightEl.style.backgroundImage = `url(${brightenUrl})`;
        rimEl.style.backgroundImage = `url(${rimUrl})`;
      });
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [filterId, radius, depth, splay, lightAngle, lightOpacity]);

  const baseScale = (refraction / 100) * 68;
  const chromaOffset = (dispersion / 100) * 14;
  const scaleR = (baseScale - chromaOffset).toFixed(2);
  const scaleG = baseScale.toFixed(2);
  const scaleB = (baseScale + chromaOffset).toFixed(2);
  const stdDev = (frost * 0.35).toFixed(2);

  // --- TWEAK DROP SHADOWS HERE ---
  // DS 1 & 2: x: ±1.25, y: 0, blur: 0, spread: -0.75 -> 0.5px left & right edges, #D0D0D0 (1 - 208/255 = 0.184)
  const ds12Width = 1;
  const ds12Sub = 0.092;

  // DS 3: x: 0, y: 0, blur: 0, spread: 0.5 -> 0.5px all around, #CCCCCC (1 - 204/255 = 0.20)
  const ds3Width = 1;
  const ds3Sub = 0.1;

  // DS 4: x: 0, y: 8, blur: 15, spread: 0, #000000 2%, normal
  const ds4Shadow = "0px 8px 15px 0px rgba(0, 0, 0, 0.02)";

  return (
    <div
      ref={containerRef}
      style={{
        ...(radius !== undefined ? { borderRadius: `${radius}px` } : {}),
        boxShadow: style?.boxShadow
          ? `${ds4Shadow}, ${style.boxShadow}`
          : ds4Shadow,
        ...style,
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
            ref={filterRef}
            id={filterId}
            x="0"
            y="0"
            width="256"
            height="256"
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
              ref={feImageRef}
              x="0"
              y="0"
              width="256"
              height="256"
              preserveAspectRatio="none"
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
              ref={feDarkImageRef}
              x="0"
              y="0"
              width="256"
              height="256"
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

          {/* Drop Shadow 3: True Plus-Darker (#CCCCCC -> subtract 0.20) */}
          <filter id={dsAllFilterId} colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="linear" slope="1" intercept={-ds3Sub} />
              <feFuncG type="linear" slope="1" intercept={-ds3Sub} />
              <feFuncB type="linear" slope="1" intercept={-ds3Sub} />
            </feComponentTransfer>
          </filter>

          {/* Drop Shadows 1 & 2: True Plus-Darker (#D0D0D0 -> subtract 0.184) */}
          <filter id={dsSidesFilterId} colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="linear" slope="1" intercept={-ds12Sub} />
              <feFuncG type="linear" slope="1" intercept={-ds12Sub} />
              <feFuncB type="linear" slope="1" intercept={-ds12Sub} />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {/* 0A. Drop Shadow 3 (x:0 y:0 blur:0 spread:0.5 #CCCCCC Plus darker) */}
      <div
        className="pointer-events-none absolute rounded-[inherit]"
        style={{
          inset: `-${ds3Width}px`,
          padding: `${ds3Width}px`,
          ...(radius !== undefined
            ? { borderRadius: `${radius + ds3Width}px` }
            : {}),
          backdropFilter: `url(#${dsAllFilterId})`,
          WebkitBackdropFilter: `url(#${dsAllFilterId})`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* 0B. Drop Shadows 1 & 2 (x:±1.25 y:0 blur:0 spread:-0.75 #D0D0D0 Plus darker) */}
      <div
        className="pointer-events-none absolute rounded-[inherit]"
        style={{
          top: 0,
          bottom: 0,
          left: `-${ds12Width}px`,
          right: `-${ds12Width}px`,
          padding: `0px ${ds12Width}px`,
          ...(radius !== undefined
            ? { borderRadius: `${radius + ds12Width}px` }
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
        ref={glassRef}
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        style={{
          backdropFilter: `blur(${frost * 0.5}px)`,
          WebkitBackdropFilter: `blur(${frost * 0.5}px)`,
        }}
      />

      {/* 1B. Glass Body Fill (#808080 4%, Luminosity) */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          backgroundColor: "rgba(128, 128, 128, 0.04)",
          mixBlendMode: "luminosity",
        }}
      />

      {/* 2. Additive Brightening + Inner Shadows 1 & 2 (mixBlendMode: "plus-lighter") */}
      <div
        ref={brightRef}
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-cover bg-center"
        style={{ mixBlendMode: "plus-lighter" }}
      />

      {/* 3. Surface-Normal Specular Rim */}
      <div
        ref={rimRef}
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-cover bg-center"
        style={{
          padding: "1px",
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
