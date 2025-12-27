# Wiggly Zakomemo

Pixel-art drawing app that keeps strokes gently wiggling. Pattern brushes are
anchored to the canvas, strokes are jittered, and exports are animated GIFs.

## Features

- Pen, pattern, and eraser tools with 1-48px widths
- Palette presets, custom palette, and background color
- Body (console) color presets
- Animated GIF export (3-frame jitter loop at 10fps)
- Desktop and mobile layouts

## Getting Started

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>

## Scripts

- `pnpm dev`: start the Next.js dev server
- `pnpm build`: production build
- `pnpm lint`: Biome checks
- `pnpm format`: Biome formatting
- `pnpm test`: run Vitest
- `pnpm typecheck`: TypeScript type checking

## Docs

See `docs/README.md` for the spec and implementation notes.

## Project Structure

- `src/core/`: pure logic (types, history, jitter, patterns)
- `src/engine/`: app logic (WigglyEngine, ports, renderScheduler)
- `src/infra/`: browser-specific implementations
- `src/ui/`: React components
- `src/app/`: Next.js wiring
