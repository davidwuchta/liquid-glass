"use client";

import React, { useEffect, useId, useRef } from "react";

const SHADER_VERSION = 15;

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

  // 2A. Top Darkening Canvas (Black pixels with alpha -> subtracts brightness via plus-darker)
  const darkCanvas = document.createElement("canvas");
  darkCanvas.width = w;
  darkCanvas.height = h;
  const darkCtx = darkCanvas.getContext("2d")!;
  const darkImg = darkCtx.createImageData(w, h);
  const darkData = darkImg.data;

  // 2B. Bottom Brightening Canvas (White pixels with alpha -> adds brightness via plus-lighter)
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

  // Smooth corner taper for the inner shading band even on small border radii
  const rShade = Math.min(Math.max(r, bevel * 1.25), rx, ry);

  // Controls how sharply the refraction ramps up toward the outer lip (Figma Splay: 20)
  const splayExp = 1.85 + ((100 - splay) / 100) * 0.75;

  // Fixed pixel reach inward from the lip
  const shadeDepth = Math.max(24, depth * 1.35);

  // Convert Figma lightAngle (0deg = top-down vertical light vector) to unit vector (lx, ly)
  const rad = ((lightAngle - 90) * Math.PI) / 180;
  const lx = Math.cos(rad);
  const ly = Math.sin(rad);

  const l = lightOpacity / 100;

  // 1:1 rim intensity (20% top / 16.8% bottom at 40% light; 50% top / 42% bottom at 100% light)
  const primaryRimMax = Math.min(1, l * 0.7); // 0.5
  const bounceRimMax = Math.min(1, l * 0.42); // 0.42

  // Subtractive (plus-darker) & Additive (plus-lighter) peak intensities:
  // Under plus-darker, 0.095 subtracts 9.5% directly from the background RGB:
  // - White (100%) -> 90.5% (subtle light gray shadow)
  // - Dark photo rooftop (~8%) -> max(0, 8% - 9.5%) = 0% (pitch black at the top lip!)
  const topDarkenMax = Math.min(1, l * 0.55);
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

  const maxComputeDist = Math.max(bevel, shadeDepth, 3);

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

      // Outward surface normal for exact box geometry
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

      // --- B. Fixed-Distance Bevel Shading (Separate plus-darker & plus-lighter) ---
      if (distFromEdge >= 0 && distFromEdge < shadeDepth) {
        const s = 1 - distFromEdge / shadeDepth;
        const profile = Math.pow(s, 1.95);

        const sgx =
          sdRoundedBox(px + 1, py, rShade) - sdRoundedBox(px - 1, py, rShade);
        const sgy =
          sdRoundedBox(px, py + 1, rShade) - sdRoundedBox(px, py - 1, rShade);
        const slen = Math.hypot(sgx, sgy) || 1;
        const shadeDot = (sgx / slen) * lx + (sgy / slen) * ly;

        if (shadeDot > 0) {
          const topProfile = Math.pow(s, 2.0);
          const dir = Math.pow(shadeDot, 1.5);
          const alpha = Math.min(1, topDarkenMax * topProfile * dir);
          darkData[idx] = 0;
          darkData[idx + 1] = 0;
          darkData[idx + 2] = 0;
          darkData[idx + 3] = Math.round(alpha * 255);
        } else if (shadeDot < 0) {
          const dir = Math.pow(-shadeDot, 2.0);
          const alpha = bottomBrightenMax * profile * dir;
          brightData[idx] = 255;
          brightData[idx + 1] = 255;
          brightData[idx + 2] = 255;
          brightData[idx + 3] = Math.round(alpha * 255);
        }
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
  const filterId = `lg-${rawId.replace(/:/g, "")}-${SHADER_VERSION}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const darkRef = useRef<HTMLDivElement>(null);
  const brightRef = useRef<HTMLDivElement>(null);
  const rimRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<SVGFilterElement>(null);
  const feImageRef = useRef<SVGFEImageElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const el = glassRef.current;
    const darkEl = darkRef.current;
    const brightEl = brightRef.current;
    const rimEl = rimRef.current;
    const filterEl = filterRef.current;
    const feImage = feImageRef.current;
    if (
      !container ||
      !el ||
      !darkEl ||
      !brightEl ||
      !rimEl ||
      !filterEl ||
      !feImage
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

        el.style.backdropFilter = `url(#${filterId})`;
        el.style.setProperty("-webkit-backdrop-filter", `url(#${filterId})`);

        darkEl.style.backgroundImage = `url(${darkenUrl})`;
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

  return (
    <div
      ref={containerRef}
      style={{
        ...(radius !== undefined ? { borderRadius: `${radius}px` } : {}),
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
          </filter>
        </defs>
      </svg>

      {/* 1. Glass Backdrop Layer */}
      <div
        ref={glassRef}
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        style={{
          backdropFilter: `blur(${frost * 0.5}px)`,
          WebkitBackdropFilter: `blur(${frost * 0.5}px)`,
        }}
      />

      {/* 2A. Top Subtractive Darkening (Inline mixBlendMode: "plus-darker") */}
      <div
        ref={darkRef}
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-cover bg-center"
        style={{ mixBlendMode: "plus-darker" }}
      />

      {/* 2B. Bottom Additive Brightening (Inline mixBlendMode: "plus-lighter") */}
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
