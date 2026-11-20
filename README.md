# liquid-glass

Apple-inspired Liquid Glass component for React 19+ with physical edge refraction, RGB chromatic dispersion, specular rim lighting, and zero CSS framework dependencies.

---

## Features

- **GPU SVG filter pipeline (Chromium):** Real-time edge lens displacement, chromatic dispersion, and calibrated `plus-darker` compositing.
- **Cross-browser fallback (Safari & Firefox):** Automatic `backdrop-filter: blur()` fallback with procedural bevel shading, specular rim maps, and native `plus-darker` / `plus-lighter` compositing where supported.
- **Zero styling dependencies:** Self-contained inline styles—works seamlessly with Tailwind CSS, CSS Modules, or plain CSS.
- **Performance-aware rendering:** Automatically collapses RGB dispersion to a single pass when `dispersion={0}`, skips unused shading canvases, and shares generated maps across instances via an internal LRU cache.
- **React 19 & RSC ready:** Native `ref`-as-a-prop forwarding (including cleanup functions) and `"use client"` ESM bundle output.

---

## Installation

**From GitHub:**

```bash
npm install github:davidwuchta/liquid-glass
```

**From npm:**

```bash
npm install liquid-glass
```

> **Peer dependencies:** Requires `react >= 19` and `react-dom >= 19`.

---

## Quick Start

```tsx
import { LiquidGlass } from "liquid-glass";

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

      {/* Opaque light surface */}
      <LiquidGlass
        className="w-80 h-44"
        contentClassName="flex items-center justify-center text-black"
        radius={34}
        theme="light"
        variant="opaque"
      >
        Opaque light glass
      </LiquidGlass>

      {/* Passing `tint` automatically switches `variant` to "tinted" */}
      <LiquidGlass
        className="w-24 h-12 rounded-full"
        theme="dark"
        tint="purple"
      />

      {/* Custom hex tint */}
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

`LiquidGlass` forwards all standard `<div>` props—including `ref`, `className`, and `style`—in addition to the props below.

### Core & Optical Props

| Prop               | Type                              | Default                | Description                                                                         |
| :----------------- | :-------------------------------- | :--------------------- | :---------------------------------------------------------------------------------- |
| `theme`            | `"dark" \| "light"`               | `"dark"`               | Calibrates fills, shadows, and rim lighting for dark or light surfaces.             |
| `variant`          | `"clear" \| "opaque" \| "tinted"` | `"clear"`              | Preset glass style. Defaults to `"tinted"` when `tint` is passed without `variant`. |
| `tint`             | `GlassTintColor \| string`        | `"blue"`               | Built-in tint name or custom hex color (`#RGB`, `#RRGGBB`, `#RRGGBBAA`).            |
| `radius`           | `number`                          | CSS `border-radius`    | Explicit corner radius in pixels. Omit to control rounding via CSS or Tailwind.     |
| `refraction`       | `number`                          | `70`                   | Edge lens displacement strength (`0`–`100`).                                        |
| `depth`            | `number`                          | `30`                   | Width of the refracting glass bevel in pixels.                                      |
| `dispersion`       | `number`                          | `20`                   | RGB chromatic aberration spread. Set to `0` for a faster single-pass GPU filter.    |
| `frost`            | `number`                          | `6` (`16` on `opaque`) | Backdrop blur intensity.                                                            |
| `splay`            | `number`                          | `20`                   | Bevel falloff curve sharpness (`0`–`100`).                                          |
| `lightAngle`       | `number`                          | `0`                    | Specular rim and bevel lighting direction in degrees.                               |
| `lightOpacity`     | `number`                          | `25`                   | Master brightness of the rim highlight and bevel shading (`0`–`100`).               |
| `contentClassName` | `string`                          | `undefined`            | Class name applied to the inner `z-10` content slot.                                |
| `contentStyle`     | `React.CSSProperties`             | `undefined`            | Inline styles applied to the inner `z-10` content slot.                             |

### Layer Overrides

Every visual layer can be fine-tuned, toggled via `enabled`, or disabled completely with `false`:

| Prop           | Merge Behavior | Description                                                                                                                      |
| :------------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| `innerShadow`  | Deep merge     | Customizes `light` (top/bottom `plus-lighter`) and `dark` (top `plus-darker`). Accepts Figma hex `color` or numeric `intensity`. |
| `dropShadow`   | Deep merge     | Customizes `sides`, `all` outer rings (hex `color` or `intensity`), and CSS `ambient` box-shadow.                                |
| `bevel`        | Shallow merge  | Controls bevel shading depth, radius scaling, and directional falloff exponents.                                                 |
| `rim`          | Shallow merge  | Controls 1px specular rim `primaryScale`, `bounceScale`, `exp`, and `widthPx`.                                                   |
| `fills`        | Replaces       | Array of `{ color, blendMode }` layers rendered bottom-to-top. Pass `false` to remove all fills.                                 |
| `backingColor` | Replaces       | Solid backing color rendered behind the glass (`"#FFFFFF"` on `tinted`), or `false` to remove it.                                |

#### Customizing Layers

To append to a preset's fills instead of replacing them, spread `resolvePreset(theme, variant).fills`:

```tsx
import { LiquidGlass, resolvePreset } from "liquid-glass";

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
      fills={[
        ...baseFills,
        { color: "rgba(0, 136, 255, 0.12)", blendMode: "normal" },
      ]}
    >
      Custom layered glass
    </LiquidGlass>
  );
}
```

#### Reusable Presets (`LiquidGlassConfig`)

Define shared configurations with `LiquidGlassConfig` and spread them onto any instance:

```tsx
import type React from "react";
import { LiquidGlass, type LiquidGlassConfig } from "liquid-glass";

const modalGlass: LiquidGlassConfig = {
  frost: 24,
  dispersion: 0,
  innerShadow: { dark: false },
  dropShadow: {
    all: false,
    ambient: "0px 20px 40px 0px rgba(0, 0, 0, 0.2)",
  },
};

export function ModalCard({ children }: { children: React.ReactNode }) {
  return (
    <LiquidGlass
      className="w-96 p-6"
      radius="{32}"
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
