# @davidwuchta/liquid-glass

[![npm version](https://img.shields.io/npm/v/@davidwuchta/liquid-glass)](https://www.npmjs.com/package/@davidwuchta/liquid-glass)
[![license](https://img.shields.io/npm/l/@davidwuchta/liquid-glass)](./LICENSE)

Apple-inspired Liquid Glass component for React 19+ with physical edge refraction, RGB chromatic dispersion, specular rim lighting, container gradients, and zero CSS framework dependencies.

---

## Features

- **GPU SVG filter pipeline (Chromium):** Real-time edge lens displacement, chromatic dispersion, and calibrated `plus-darker` compositing.
- **Cross-browser fallback (Safari & Firefox):** Automatic `backdrop-filter: blur()` fallback with procedural bevel shading, specular rim maps, and native `plus-darker` / `plus-lighter` compositing where supported.
- **Container gradients:** Optional GPU-composited linear gradient overlay with configurable angle, start/end stops, custom multi-stop arrays, and `mix-blend-mode`.
- **Unified color formats:** Every color prop (`fills`, `gradient`, `tint`, `innerShadow`, `dropShadow`, `backingColor`) accepts hex (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`), `rgb()`, and `rgba()`—with an optional `opacity` multiplier on fills and gradients.
- **Zero styling dependencies:** Self-contained inline styles—works seamlessly with Tailwind CSS, CSS Modules, or plain CSS.
- **Performance-aware rendering:** Automatically collapses RGB dispersion to a single pass when `dispersion={0}`, skips unused shading canvases, and shares generated maps across instances via an internal LRU cache.
- **React 19 & RSC ready:** Native `ref`-as-a-prop forwarding (including cleanup functions) and `"use client"` ESM bundle output.

---

## Installation

**From npm:**

```bash
npm install @davidwuchta/liquid-glass
```

**From GitHub:**

```bash
npm install github:davidwuchta/liquid-glass
```

> **Peer dependencies:** Requires `react >= 19` and `react-dom >= 19`.

---

## Quick Start

```tsx
import { LiquidGlass } from "@davidwuchta/liquid-glass";

export function Example() {
  return (
    <div className="flex flex-wrap gap-6">
      {/* Default: dark + clear */}
      <LiquidGlass
        className="w-64 h-32"
        contentClassName="flex items-center justify-center"
        radius={24}
      >
        Clear dark glass
      </LiquidGlass>

      {/* Opaque dark widget with subtle top-down sheen */}
      <LiquidGlass
        className="w-80 h-44"
        contentClassName="flex items-center justify-center"
        radius={34}
        theme="dark"
        variant="opaque"
        gradient={{
          color: "#FFFFFF",
          opacity: 0.1,
          start: 0,
          end: 75,
          blendMode: "plus-lighter",
        }}
      >
        Opaque dark glass
      </LiquidGlass>

      {/* Passing `tint` automatically switches `variant` to "tinted" */}
      <LiquidGlass
        className="w-24 h-12 rounded-full"
        theme="dark"
        tint="orange"
      />

      {/* Custom tint (hex, rgb(), or rgba()) */}
      <LiquidGlass
        className="w-24 h-12"
        radius={1000}
        theme="light"
        tint="#FF2D55"
      />
    </div>
  );
}
```

### Built-in Tint Presets

| Preset     | Hex       |
| :--------- | :-------- |
| `"blue"`   | `#0088FF` |
| `"green"`  | `#34C759` |
| `"yellow"` | `#FFCC00` |
| `"orange"` | `#FF8D28` |
| `"red"`    | `#FF383C` |
| `"purple"` | `#CB30E0` |

---

## API Reference

`LiquidGlass` forwards all standard `<div>` props (including `ref`, `className`, and `style`) in addition to the props below.

### Core & Optical Props

| Prop               | Type                              | Default               | Description                                                                                        |
| :----------------- | :-------------------------------- | :-------------------- | :------------------------------------------------------------------------------------------------- |
| `theme`            | `"dark" \| "light"`               | `"dark"`              | Preset to calibrate fills, shadows, and rim lighting for dark or light surfaces.                   |
| `variant`          | `"clear" \| "opaque" \| "tinted"` | `"clear"`             | Preset glass style. Defaults to `"tinted"` when `tint` is passed without `variant`.                |
| `tint`             | `GlassTintColor \| string`        | `"blue"`              | Built-in tint-colors or custom color (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, `rgb()`, `rgba()`). |
| `radius`           | `number`                          | CSS `border-radius`   | Explicit corner radius in pixels. Omit to control rounding via CSS or Tailwind.                    |
| `refraction`       | `number`                          | `70`                  | Edge lens displacement strength (`0`–`100`).                                                       |
| `depth`            | `number`                          | `30`                  | Width of the refracting glass bevel in pixels.                                                     |
| `dispersion`       | `number`                          | `20`                  | RGB chromatic aberration spread. Set to `0` for a faster single-pass GPU filter.                   |
| `frost`            | `number`                          | `6`, `16` (on opaque) | Backdrop blur intensity.                                                                           |
| `splay`            | `number`                          | `20`                  | Bevel falloff curve sharpness (`0`–`100`).                                                         |
| `lightAngle`       | `number`                          | `0`                   | Specular rim and bevel lighting direction in degrees.                                              |
| `lightOpacity`     | `number`                          | `25`                  | Master brightness of the rim highlight and bevel shading (`0`–`100`).                              |
| `contentClassName` | `string`                          | `undefined`           | ClassName applied to the inner `z-10` content slot.                                                |
| `contentStyle`     | `React.CSSProperties`             | `undefined`           | CSS Style applied to the inner `z-10` content slot.                                                |

### Layer Overrides

Every visual layer can be fine-tuned, toggled via the `enabled` prop, or disabled completely when passing `false`:

| Prop           | Merge Behavior | Description                                                                                                                                                        |
| :------------- | :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `innerShadow`  | Deep merge     | Customizes `light` (top/bottom `plus-lighter`) and `dark` (top `plus-darker`). Accepts hex/`rgb()`/`rgba()` `color` or numeric `intensity`.                        |
| `dropShadow`   | Deep merge     | Customizes `sides`, `all` outer rings (hex/`rgb()`/`rgba()` `color` or `intensity`), and CSS `ambient` box-shadow.                                                 |
| `bevel`        | Shallow merge  | Controls bevel shading depth, radius scaling, and directional falloff exponents.                                                                                   |
| `rim`          | Shallow merge  | Controls 1px specular rim `primaryScale`, `bounceScale`, `exp`, and `widthPx`.                                                                                     |
| `gradient`     | Shallow merge  | Optional linear gradient overlay rendered above body fills and below inner shadows/rim. Disabled by default; pass `{}` for default sheen.                          |
| `fills`        | Replaces       | Array of `{ color, opacity?, blendMode? }` layers rendered bottom-to-top. Accepts hex, `rgb()`, or `rgba()`. Pass `false` to remove all (including default fills). |
| `backingColor` | Replaces       | Solid backing color rendered behind the glass (`"#FFFFFF"` on `tinted`), or `false` to remove it.                                                                  |

#### Merge behavior:

- **Deep merge:** Only the nested keys you specify are overridden; sibling properties and other sub-layers keep their preset defaults (e.g., `innerShadow={{ light: { depth: 12 } }}` keeps the preset's `light.intensity` and `dark` settings).
- **Shallow merge:** Flat object where specified keys override defaults and omitted keys fall back to the active preset.
- **Replaces:** Completely overwrites the preset value. To extend a preset's `fills` instead of replacing them, spread `resolvePreset(theme, variant).fills`.

### Container Gradient (`gradient`)

Pass `gradient={{}}` to enable the default top-to-bottom sheen, or customize any property:

| Option       | Type                                  | Default                      | Description                                                                                                                       |
| :----------- | :------------------------------------ | :--------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`    | `boolean`                             | `true` (when object passed)  | Toggles the gradient layer.                                                                                                       |
| `color`      | `string`                              | `"rgba(255, 255, 255, 0.1)"` | Start color (hex, `rgb()`, or `rgba()`).                                                                                          |
| `opacity`    | `number`                              | `undefined`                  | Optional `0`–`1` opacity multiplier applied to `color`.                                                                           |
| `endColor`   | `string`                              | `color` at `0` opacity       | End color. Omit to fade cleanly to the same RGB at `0` alpha without dark banding.                                                |
| `endOpacity` | `number`                              | `undefined`                  | Optional `0`–`1` opacity multiplier applied to `endColor`.                                                                        |
| `angle`      | `number`                              | `0`                          | Direction the gradient originates from in degrees, matching `lightAngle` (`0` = top, `90` = right, `180` = bottom, `270` = left). |
| `start`      | `number \| string`                    | `0`                          | Where the gradient begins (number treated as `%`, or any CSS length/percentage like `"12px"`).                                    |
| `end`        | `number \| string`                    | `75`                         | Where the gradient ends (number treated as `%`, or any CSS length/percentage).                                                    |
| `blendMode`  | `React.CSSProperties["mixBlendMode"]` | `"normal"`                   | CSS `mix-blend-mode` for the gradient layer (e.g. `"plus-lighter"`, `"screen"`, `"soft-light"`).                                  |
| `stops`      | `GlassGradientStop[]`                 | `undefined`                  | Custom multi-stop array (`{ color, opacity?, position? }`). Overrides `color`, `endColor`, `start`, `end`.                        |

Example: Multi-stop gradient for a brighter top edge with a long soft tail

```tsx
<LiquidGlass
  theme="dark"
  variant="opaque"
  radius={34}
  className="w-80 h-44"
  gradient={{
    blendMode: "plus-lighter",
    stops: [
      { color: "#FFFFFF", opacity: 0.12, position: 0 },
      { color: "rgb(255, 255, 255)", opacity: 0.04, position: 45 },
      { color: "#FFFFFF", opacity: 0, position: 85 },
    ],
  }}
/>
```

### Customizing Layers & Color Formats

All color props accept hex (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`), `rgb()`, and `rgba()`. On `fills` and `gradient`, you can pass a separate `opacity` (`0`–`1`)—if the color already includes an alpha channel, `opacity` multiplies it.

To append to a preset's fills instead of replacing them, spread `resolvePreset(theme, variant).fills`:

```tsx
import { LiquidGlass, resolvePreset } from "@davidwuchta/liquid-glass";

const baseFills = resolvePreset("light", "clear").fills;

export function CustomGlass() {
  return (
    <LiquidGlass
      theme="light"
      variant="clear"
      radius={28}
      className="w-80 h-40"
      contentClassName="flex items-center justify-center p-6"
      innerShadow={{
        light: { color: "#282828", depth: 10 },
        dark: false,
      }}
      dropShadow={{
        all: false,
        ambient: "0px 12px 24px 0px rgba(0, 0, 0, 0.15)",
      }}
      rim={{
        primaryScale: 0.9,
        widthPx: 1,
      }}
      gradient={{
        color: "#FFFFFF",
        opacity: 0.18,
        start: 0,
        end: 65,
        blendMode: "plus-lighter",
      }}
      fills={[
        ...baseFills,
        { color: "#0088FF", opacity: 0.12, blendMode: "normal" },
      ]}
    >
      Custom layered glass
    </LiquidGlass>
  );
}
```

### Reusable Presets (`LiquidGlassConfig`)

Define shared configurations with `LiquidGlassConfig` and spread them onto any instance:

```tsx
import type React from "react";
import { LiquidGlass, type LiquidGlassConfig } from "@davidwuchta/liquid-glass";

const modalGlass: LiquidGlassConfig = {
  frost: 24,
  dispersion: 0,
  innerShadow: { dark: false },
  dropShadow: {
    all: false,
    ambient: "0px 20px 40px 0px rgba(0, 0, 0, 0.2)",
  },
  gradient: {
    color: "#FFFFFF",
    opacity: 0.08,
    end: 70,
    blendMode: "plus-lighter",
  },
};

export function ModalCard({ children }: { children: React.ReactNode }) {
  return (
    <LiquidGlass
      className="w-96 p-6"
      radius={32}
      theme="dark"
      variant="opaque"
      {...modalGlass}
    >
      {children}
    </LiquidGlass>
  );
}
```

---

## Browser Support

| Browser                            | Rendering Pipeline                                                                                 |
| :--------------------------------- | :------------------------------------------------------------------------------------------------- |
| **Chromium** (Chrome, Edge, Brave) | Full SVG `backdrop-filter` pipeline (refraction, RGB dispersion, frost, `plus-darker`).            |
| **Safari / iOS**                   | `backdrop-filter: blur()` + native CSS `plus-darker` / `plus-lighter` + procedural rim/bevel maps. |
| **Firefox**                        | `backdrop-filter: blur()` + standard/multiply compositing fallback + procedural rim/bevel maps.    |

---

## Usage Notes

- **Blend-mode stacking contexts:** Avoid placing `transform`, `opacity < 1`, `z-index`, or `isolation: isolate` on a direct wrapper around `LiquidGlass` when using `clear` or `opaque` variants, as isolated stacking contexts prevent glass fills and shadows from blending with content behind them.
- **Dynamic corner rounding:** When `radius` is omitted, the internal `ResizeObserver` reads the element's computed `border-radius` (including dynamic Tailwind class or inline style updates) and keeps outer drop-shadow rings concentric.

---

## Development

```bash
# 1. Install dependencies and build the library
npm install
npm run build

# 2. Install playground dependencies
npm --prefix playground install

# 3. Run library watcher and Next.js playground in separate terminals
npm run dev
npm run playground
```

---

## License

[MIT](./LICENSE)
