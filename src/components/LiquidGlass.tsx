"use client";

import React, { useEffect, useId, useRef } from "react";

const SHADER_VERSION = 9;
const mapCache = new Map<string, string>();

function getOrGenerateMap(
  w: number,
  h: number,
  radius: number,
  depth: number,
  splay: number,
): string {
  const key = `${w}x${h}-${radius}-${depth}-${splay}-v${SHADER_VERSION}`;
  if (mapCache.has(key)) return mapCache.get(key)!;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  const rx = w / 2;
  const ry = h / 2;
  const r = Math.min(radius, rx, ry);
  const bevel = Math.max(1, depth);

  // Controls how sharply the refraction ramps up toward the outer lip (Figma Splay: 20)
  const splayExp = 1.85 + ((100 - splay) / 100) * 0.75;

  const sdRoundedBox = (px: number, py: number) => {
    const qx = Math.abs(px) - (rx - r);
    const qy = Math.abs(py) - (ry - r);
    return (
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
      Math.min(Math.max(qx, qy), 0) -
      r
    );
  };

  for (let y = 0; y < h; y++) {
    const py = y - ry;
    for (let x = 0; x < w; x++) {
      const px = x - rx;
      const d = sdRoundedBox(px, py);
      const distFromEdge = -d;

      let nx = 0;
      let ny = 0;

      if (distFromEdge < bevel) {
        const clampedDist = Math.max(0, distFromEdge);
        const t = 1 - clampedDist / bevel;
        const mag = Math.pow(t, splayExp);

        const gx = sdRoundedBox(px + 1, py) - sdRoundedBox(px - 1, py);
        const gy = sdRoundedBox(px, py + 1) - sdRoundedBox(px, py - 1);
        const len = Math.hypot(gx, gy) || 1;
        const normX = gx / len;
        const normY = gy / len;

        nx = -normX * mag;
        ny = -normY * mag;
      }

      const idx = (y * w + x) * 4;
      data[idx] = Math.round(Math.min(255, Math.max(0, 128 + nx * 127)));
      data[idx + 1] = Math.round(Math.min(255, Math.max(0, 128 + ny * 127)));
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const dataUrl = canvas.toDataURL();
  mapCache.set(key, dataUrl);
  return dataUrl;
}

// Surface-normal-based rim generator: spans 100% of flat edges and falls off only inside the corner radius
const rimCache = new Map<string, string>();

function getOrGenerateRim(
  w: number,
  h: number,
  radius: number,
  lightAngle: number,
  lightOpacity: number,
): string {
  const key = `${w}x${h}-${radius}-${lightAngle}-${lightOpacity}-rim-v${SHADER_VERSION}`;
  if (rimCache.has(key)) return rimCache.get(key)!;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  const rx = w / 2;
  const ry = h / 2;
  const r = Math.min(radius, rx, ry);

  // Convert Figma lightAngle (0deg = top-down vertical light vector) to unit vector (lx, ly)
  const rad = ((lightAngle - 90) * Math.PI) / 180;
  const lx = Math.cos(rad);
  const ly = Math.sin(rad);

  const l = lightOpacity / 100;
  const primaryMax = Math.min(1, l * 0.5);
  const bounceMax = Math.min(1, l * 0.38);

  const sdRoundedBox = (px: number, py: number) => {
    const qx = Math.abs(px) - (rx - r);
    const qy = Math.abs(py) - (ry - r);
    return (
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
      Math.min(Math.max(qx, qy), 0) -
      r
    );
  };

  for (let y = 0; y < h; y++) {
    const py = y - ry;
    for (let x = 0; x < w; x++) {
      const px = x - rx;
      const d = sdRoundedBox(px, py);
      const distFromEdge = -d;

      // Only compute within the outer 2.5px border band so the rest of the image stays empty
      if (distFromEdge >= -1 && distFromEdge <= 2.5) {
        const gx = sdRoundedBox(px + 1, py) - sdRoundedBox(px - 1, py);
        const gy = sdRoundedBox(px, py + 1) - sdRoundedBox(px, py - 1);
        const len = Math.hypot(gx, gy) || 1;
        const normX = gx / len;
        const normY = gy / len;

        // Dot product between outward border normal and light direction
        // Constant along the entire straight edge; falls off smoothly only inside the corner arcs!
        const dot = normX * lx + normY * ly;
        const primary = Math.pow(Math.max(0, dot), 2.2) * primaryMax;
        const bounce = Math.pow(Math.max(0, -dot), 2.2) * bounceMax;
        const alpha = Math.min(1, primary + bounce);

        const idx = (y * w + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = Math.round(alpha * 255);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const dataUrl = canvas.toDataURL();
  rimCache.set(key, dataUrl);
  return dataUrl;
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
  const rimRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<SVGFilterElement>(null);
  const feImageRef = useRef<SVGFEImageElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const el = glassRef.current;
    const rimEl = rimRef.current;
    const filterEl = filterRef.current;
    const feImage = feImageRef.current;
    if (!container || !el || !rimEl || !filterEl || !feImage) return;

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
        const displacementUrl = getOrGenerateMap(
          w,
          h,
          computedRadius,
          depth,
          splay,
        );
        const rimUrl = getOrGenerateRim(
          w,
          h,
          computedRadius,
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

      {/* 2. Directional Tonal Shading */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background: `linear-gradient(${lightAngle + 180}deg, rgba(0, 0, 0, 0.14) 0%, rgba(0, 0, 0, 0.02) 35%, rgba(255, 255, 255, 0.02) 100%)`,
          boxShadow: "inset 0px 20px 24px -16px rgba(0, 0, 0, 0.18)",
        }}
      />

      {/* 3. Surface-Normal Specular Rim (Spans 100% of flat edges on any box size + falls off inside corner arcs + supports any 360deg lightAngle) */}
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
