"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  detectCssPlusDarkerSupport,
  detectSvgBackdropSupport,
  getOrGenerateLayers,
  type LayerState,
} from "./layers";
import {
  GLASS_CONFIG,
  GLASS_TINT_PRESETS,
  parseHexColor,
  resolvePreset,
  type GlassTheme,
  type GlassTintColor,
  type GlassVariant,
} from "./presets";

export interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
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
