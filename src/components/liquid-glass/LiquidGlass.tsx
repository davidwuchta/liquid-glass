"use client";

import React, { useEffect, useId, useRef, useState, useCallback } from "react";
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
  type LiquidGlassConfig,
} from "./presets";

const SVG_STYLE: React.CSSProperties = {
  pointerEvents: "none",
  position: "absolute",
  left: 0,
  top: 0,
  overflow: "visible",
};

const RING_BASE_STYLE: React.CSSProperties = {
  pointerEvents: "none",
  position: "absolute",
};

const RING_MASK_STYLE: React.CSSProperties = {
  WebkitMask:
    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
};

const LAYER_BASE_STYLE: React.CSSProperties = {
  pointerEvents: "none",
  position: "absolute",
  inset: 0,
  borderRadius: "inherit",
};

const LAYER_BG_STYLE: React.CSSProperties = {
  ...LAYER_BASE_STYLE,
  backgroundSize: "cover",
  backgroundPosition: "center",
};

const CONTENT_SLOT_STYLE: React.CSSProperties = {
  position: "relative",
  zIndex: 10,
  height: "100%",
  width: "100%",
};

function sanitizeIdPart(value: number | string): string {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_");
}

export interface LiquidGlassProps
  extends React.ComponentPropsWithRef<"div">, LiquidGlassConfig {
  /** Color theme calibrated for dark or light surfaces. @default "dark" */
  theme?: GlassTheme;
  /** Glass preset variant. Automatically defaults to `"tinted"` when `tint` is provided without `variant`. @default "clear" */
  variant?: GlassVariant;
  /** Tint preset name or custom hex color (e.g. `"purple"` or `"#FF2D55"`). Automatically switches `variant` to `"tinted"` unless `variant` is explicitly set. @default "blue" */
  tint?: GlassTintColor | (string & {});
  /** Explicit corner radius in pixels. Omit to use CSS / Tailwind border-radius utilities. */
  radius?: number;
  /** Class name applied to the inner `z-10` content slot. */
  contentClassName?: string;
  /** Inline styles applied to the inner `z-10` content slot. */
  contentStyle?: React.CSSProperties;
}

export function LiquidGlass({
  ref,
  theme = GLASS_CONFIG.defaults.theme,
  variant,
  tint,
  refraction,
  depth,
  dispersion,
  frost,
  splay,
  lightAngle,
  lightOpacity,
  backingColor,
  bevel,
  innerShadow,
  rim,
  dropShadow,
  fills: fillsOverride,
  radius,
  className,
  contentClassName,
  contentStyle,
  children,
  style,
  ...props
}: LiquidGlassProps) {
  const resolvedVariant: GlassVariant =
    variant ?? (tint !== undefined ? "tinted" : GLASS_CONFIG.defaults.variant);
  const resolvedTint = tint ?? GLASS_CONFIG.defaults.tint;

  const preset = resolvePreset(theme, resolvedVariant, {
    refraction,
    depth,
    dispersion,
    frost,
    splay,
    lightAngle,
    lightOpacity,
    backingColor,
    bevel,
    innerShadow,
    rim,
    dropShadow,
    fills: fillsOverride,
  });

  const {
    refraction: resolvedRefraction,
    depth: resolvedDepth,
    dispersion: resolvedDispersion,
    frost: resolvedFrost,
    splay: resolvedSplay,
    lightAngle: resolvedLightAngle,
    lightOpacity: resolvedLightOpacity,
    backingColor: resolvedBackingColor,
    bevel: bevelCfg,
    innerShadow: { light: isLightCfg, dark: isDarkCfg },
    rim: rimCfg,
    dropShadow: dsCfg,
    fills,
  } = preset;

  const hasSolidBacking = Boolean(resolvedBackingColor);
  const needsDisplacement =
    !hasSolidBacking && (resolvedRefraction !== 0 || resolvedDispersion !== 0);
  const hasDispersion = resolvedDispersion !== 0;
  const hasFrost = resolvedFrost > 0;
  const styleBorderRadius = style?.borderRadius;

  // Primitive extraction keeps useEffect immune to inline object literal re-renders
  const {
    shadeRadiusFactor,
    shadeDepthMin,
    shadeDepthFactor,
    topDarkenScale,
    topProfileExp,
    topDirExp,
    bottomBrightenScale,
    bottomProfileExp,
    bottomDirExp,
  } = bevelCfg;
  const {
    depth: isLightDepth,
    intensity: isLightIntensity,
    falloff: isLightFalloff,
    dirExp: isLightDirExp,
  } = isLightCfg;
  const {
    depth: isDarkDepth,
    intensity: isDarkIntensity,
    falloff: isDarkFalloff,
    dirExp: isDarkDirExp,
  } = isDarkCfg;
  const {
    primaryScale: rimPrimaryScale,
    bounceScale: rimBounceScale,
    exp: rimExp,
  } = rimCfg;

  const isTinted = resolvedVariant === "tinted";
  const tintHex = isTinted
    ? (GLASS_TINT_PRESETS[resolvedTint as GlassTintColor] ?? resolvedTint)
    : null;
  const [tintR, tintG, tintB] = tintHex ? parseHexColor(tintHex) : [0, 0, 0];
  const tintSubR = (1 - tintR / 255).toFixed(4);
  const tintSubG = (1 - tintG / 255).toFixed(4);
  const tintSubB = (1 - tintB / 255).toFixed(4);

  const rawId = useId();
  const cleanId = rawId.replace(/:/g, "");
  const dsSidesFilterId = `lg-ds-sides-${cleanId}-${sanitizeIdPart(dsCfg.sides.intensity)}`;
  const dsAllFilterId = `lg-ds-all-${cleanId}-${sanitizeIdPart(dsCfg.all.intensity)}`;
  const tintFilterId = tintHex
    ? `lg-tint-${cleanId}-${tintHex.replace(/[^a-zA-Z0-9]/g, "")}`
    : "";

  const containerRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<LayerState | null>(null);

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof ref === "function") {
        return ref(node);
      }
      if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const svgBackdrop = detectSvgBackdropSupport();
    const cssPlusDarker = detectCssPlusDarkerSupport();
    const layerConfig = {
      needsDisplacement,
      bevel: {
        shadeRadiusFactor,
        shadeDepthMin,
        shadeDepthFactor,
        topDarkenScale,
        topProfileExp,
        topDirExp,
        bottomBrightenScale,
        bottomProfileExp,
        bottomDirExp,
      },
      innerShadow: {
        light: {
          depth: isLightDepth,
          intensity: isLightIntensity,
          falloff: isLightFalloff,
          dirExp: isLightDirExp,
        },
        dark: {
          depth: isDarkDepth,
          intensity: isDarkIntensity,
          falloff: isDarkFalloff,
          dirExp: isDarkDirExp,
        },
      },
      rim: {
        primaryScale: rimPrimaryScale,
        bounceScale: rimBounceScale,
        exp: rimExp,
      },
    };

    let lastW = 0;
    let lastH = 0;
    let lastR = -1;
    let rafId = 0;

    const observer = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const computedRadius =
        radius ??
        (parseFloat(getComputedStyle(container).borderTopLeftRadius) || 0);

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
          layerConfig,
          svgBackdrop,
        );
        const clampedRadius = Math.min(computedRadius, w / 2, h / 2);
        setLayers((prev) => {
          if (
            prev &&
            prev.w === w &&
            prev.h === h &&
            prev.radius === clampedRadius &&
            prev.svgBackdrop === svgBackdrop &&
            prev.cssPlusDarker === cssPlusDarker &&
            prev.displacementUrl === generated.displacementUrl &&
            prev.darkenUrl === generated.darkenUrl &&
            prev.brightenUrl === generated.brightenUrl &&
            prev.rimUrl === generated.rimUrl
          ) {
            return prev;
          }
          return {
            version: (prev?.version ?? 0) + 1,
            w,
            h,
            radius: clampedRadius,
            svgBackdrop,
            cssPlusDarker,
            ...generated,
          };
        });
      });
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [
    radius,
    styleBorderRadius,
    className,
    resolvedDepth,
    resolvedSplay,
    resolvedLightAngle,
    resolvedLightOpacity,
    needsDisplacement,
    shadeRadiusFactor,
    shadeDepthMin,
    shadeDepthFactor,
    topDarkenScale,
    topProfileExp,
    topDirExp,
    bottomBrightenScale,
    bottomProfileExp,
    bottomDirExp,
    isLightDepth,
    isLightIntensity,
    isLightFalloff,
    isLightDirExp,
    isDarkDepth,
    isDarkIntensity,
    isDarkFalloff,
    isDarkDirExp,
    rimPrimaryScale,
    rimBounceScale,
    rimExp,
  ]);

  const refCfg = GLASS_CONFIG.refraction;
  const useSvg = layers?.svgBackdrop ?? false;
  const fallbackDarkBlend: React.CSSProperties["mixBlendMode"] =
    layers?.cssPlusDarker ? "plus-darker" : "normal";

  const activeFilterId = `lg-${cleanId}-v${layers?.version ?? 0}-${sanitizeIdPart(resolvedRefraction)}-${sanitizeIdPart(resolvedDispersion)}-${sanitizeIdPart(resolvedFrost)}`;
  const glassBackdrop = useSvg
    ? `url(#${activeFilterId})`
    : hasSolidBacking || !hasFrost
      ? undefined
      : `blur(${resolvedFrost * refCfg.fallbackBlurFactor}px)`;

  const baseScale = (resolvedRefraction / 100) * refCfg.baseScaleFactor;
  const chromaOffset = (resolvedDispersion / 100) * refCfg.chromaOffsetFactor;
  const scaleR = (baseScale - chromaOffset).toFixed(2);
  const scaleG = baseScale.toFixed(2);
  const scaleB = (baseScale + chromaOffset).toFixed(2);
  const stdDev = (resolvedFrost * refCfg.frostStdDevFactor).toFixed(2);

  const blurResult = hasFrost ? "blurred" : "SourceGraphic";
  const dispResult = needsDisplacement
    ? hasDispersion
      ? "rgb"
      : "disp"
    : blurResult;
  const hasBrightenLayer =
    Boolean(layers) && (bottomBrightenScale > 0 || isLightIntensity > 0);

  const resolvedBoxShadow =
    dsCfg.ambient && style?.boxShadow
      ? `${dsCfg.ambient}, ${style.boxShadow}`
      : (dsCfg.ambient ?? style?.boxShadow);

  return (
    <div
      ref={setContainerRef}
      className={className || undefined}
      style={{
        position: "relative",
        ...style,
        ...(radius !== undefined ? { borderRadius: `${radius}px` } : {}),
        ...(resolvedBoxShadow ? { boxShadow: resolvedBoxShadow } : {}),
      }}
      {...props}
    >
      {useSvg && layers && (
        <svg width="0" height="0" style={SVG_STYLE} aria-hidden="true">
          <defs>
            {/* Main Glass Filter (3-channel dispersion, single-pass displacement, or darken-only) */}
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
              {!hasSolidBacking && hasFrost && (
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation={stdDev}
                  edgeMode="duplicate"
                  result="blurred"
                />
              )}

              {needsDisplacement && layers.displacementUrl && (
                <>
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
                  {hasDispersion ? (
                    <>
                      <feDisplacementMap
                        in={blurResult}
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
                        in={blurResult}
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
                        in={blurResult}
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
                    </>
                  ) : (
                    <feDisplacementMap
                      in={blurResult}
                      in2="dispMap"
                      scale={scaleG}
                      xChannelSelector="R"
                      yChannelSelector="G"
                      result="disp"
                    />
                  )}
                </>
              )}

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
                in={hasSolidBacking ? "SourceGraphic" : dispResult}
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
            {dsCfg.all.enabled && (
              <filter id={dsAllFilterId} colorInterpolationFilters="sRGB">
                <feComponentTransfer>
                  <feFuncR
                    type="linear"
                    slope="1"
                    intercept={-dsCfg.all.intensity}
                  />
                  <feFuncG
                    type="linear"
                    slope="1"
                    intercept={-dsCfg.all.intensity}
                  />
                  <feFuncB
                    type="linear"
                    slope="1"
                    intercept={-dsCfg.all.intensity}
                  />
                </feComponentTransfer>
              </filter>
            )}

            {/* Drop Shadows 1 & 2: True Plus-Darker */}
            {dsCfg.sides.enabled && (
              <filter id={dsSidesFilterId} colorInterpolationFilters="sRGB">
                <feComponentTransfer>
                  <feFuncR
                    type="linear"
                    slope="1"
                    intercept={-dsCfg.sides.intensity}
                  />
                  <feFuncG
                    type="linear"
                    slope="1"
                    intercept={-dsCfg.sides.intensity}
                  />
                  <feFuncB
                    type="linear"
                    slope="1"
                    intercept={-dsCfg.sides.intensity}
                  />
                </feComponentTransfer>
              </filter>
            )}

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
      {layers && dsCfg.all.enabled && (
        <div
          style={{
            ...RING_BASE_STYLE,
            ...RING_MASK_STYLE,
            inset: `-${dsCfg.all.widthPx}px`,
            padding: `${dsCfg.all.widthPx}px`,
            borderRadius:
              layers.radius > 0
                ? `${layers.radius + dsCfg.all.widthPx}px`
                : "0px",
            ...(useSvg
              ? {
                  backdropFilter: `url(#${dsAllFilterId})`,
                  WebkitBackdropFilter: `url(#${dsAllFilterId})`,
                }
              : {
                  backgroundColor: `rgba(0, 0, 0, ${dsCfg.all.intensity})`,
                  mixBlendMode: fallbackDarkBlend,
                }),
          }}
        />
      )}

      {/* 0B. Drop Shadows 1 & 2 (Left & Right outer rings) */}
      {layers && dsCfg.sides.enabled && (
        <div
          style={{
            ...RING_BASE_STYLE,
            ...RING_MASK_STYLE,
            top: 0,
            bottom: 0,
            left: `-${dsCfg.sides.widthPx}px`,
            right: `-${dsCfg.sides.widthPx}px`,
            padding: `0px ${dsCfg.sides.widthPx}px`,
            borderRadius:
              layers.radius > 0
                ? `${layers.radius + dsCfg.sides.widthPx}px`
                : "0px",
            ...(useSvg
              ? {
                  backdropFilter: `url(#${dsSidesFilterId})`,
                  WebkitBackdropFilter: `url(#${dsSidesFilterId})`,
                }
              : {
                  backgroundColor: `rgba(0, 0, 0, ${dsCfg.sides.intensity})`,
                  mixBlendMode: fallbackDarkBlend,
                }),
          }}
        />
      )}

      {/* 0C. Solid Backing (Tinted variant: 100% white behind the glass) */}
      {resolvedBackingColor && (
        <div
          style={{
            ...LAYER_BASE_STYLE,
            backgroundColor: resolvedBackingColor,
          }}
        />
      )}

      {/* 1. Glass Backdrop (+ True GPU Plus-Darker Pass in Chromium) */}
      {glassBackdrop && (
        <div
          style={{
            ...LAYER_BASE_STYLE,
            overflow: "hidden",
            backdropFilter: glassBackdrop,
            WebkitBackdropFilter: glassBackdrop,
          }}
        />
      )}

      {/* 1A. Non-Chromium Top Darkening + Inner Shadow 3 Fallback */}
      {!useSvg && layers && (
        <div
          style={{
            ...LAYER_BG_STYLE,
            backgroundImage: `url(${layers.darkenUrl})`,
            mixBlendMode: fallbackDarkBlend,
          }}
        />
      )}

      {/* 1B. Tinted Variant Fill (100% Tint Color, Plus Darker) */}
      {tintHex && (
        <div
          style={{
            ...LAYER_BASE_STYLE,
            ...(useSvg
              ? {
                  backdropFilter: `url(#${tintFilterId})`,
                  WebkitBackdropFilter: `url(#${tintFilterId})`,
                }
              : {
                  backgroundColor: tintHex,
                  mixBlendMode: layers?.cssPlusDarker
                    ? "plus-darker"
                    : "multiply",
                }),
          }}
        />
      )}

      {/* 1C. Glass Body Fills (rendered bottom-to-top) */}
      {fills.map((fill, index) => (
        <div
          key={index}
          style={{
            ...LAYER_BASE_STYLE,
            backgroundColor: fill.color,
            mixBlendMode: fill.blendMode ?? "normal",
          }}
        />
      ))}

      {/* 2. Additive Brightening + Inner Shadows 1 & 2 (mixBlendMode: "plus-lighter") */}
      {hasBrightenLayer && layers && (
        <div
          style={{
            ...LAYER_BG_STYLE,
            mixBlendMode: "plus-lighter",
            backgroundImage: `url(${layers.brightenUrl})`,
          }}
        />
      )}

      {/* 3. Surface-Normal Specular Rim */}
      {layers && rimCfg.enabled && (
        <div
          style={{
            ...LAYER_BG_STYLE,
            ...RING_MASK_STYLE,
            padding: `${rimCfg.widthPx}px`,
            backgroundImage: `url(${layers.rimUrl})`,
          }}
        />
      )}

      {/* Content Slot */}
      <div
        className={contentClassName || undefined}
        style={
          contentStyle
            ? { ...CONTENT_SLOT_STYLE, ...contentStyle }
            : CONTENT_SLOT_STYLE
        }
      >
        {children}
      </div>
    </div>
  );
}
