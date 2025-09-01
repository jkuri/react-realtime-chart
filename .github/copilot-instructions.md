# Project Overview

This is a reusable React component for displaying high-performance real-time time series charts using WebGL rendering.

## Architecture

**Dual Purpose Structure:**
- `/lib` - Core chart library (publishable npm package)
- `/src` - Demo application showcasing the chart

**WebGL-Based Rendering Pipeline:**
- `lib/chart.tsx` - Main component with WebGL context management and rendering loop
- `lib/shaders.ts` - WebGL vertex/fragment shaders for lines, areas, and text
- `lib/buffer-pool.ts` - Memory-efficient buffer pooling to avoid GC pressure
- `lib/utils.ts` - WebGL helper functions for geometry generation and rendering

## Key Technical Patterns

**Real-time Data Management:**
- Data flows as `RealtimeChartData[][]` (array of series, each with date/value pairs)
- Time window sliding with `timeSlots` option controls visible data range
- Automatic data filtering in `updateData()` based on current time minus `timeSlots`

**WebGL Performance Optimizations:**
- Buffer pooling prevents expensive buffer creation/deletion per frame
- Custom tick generation ensures exact count while maintaining smooth time progression
- Pixel ratio handling removed to fix mobile scaling issues (avoid `devicePixelRatio`)

**Responsive Design Integration:**
- `useMobile()` hook in `/src/hooks` for breakpoint detection
- Chart options conditionally adjusted based on screen size (margins, tick counts, font sizes)

## Development Workflow

**Build Commands:**
- `npm start` - Development server with hot reload
- `npm run build:lib` - TypeScript compilation for library distribution
- `npm run build` - Full build including demo app

**Library Development:**
- Edit files in `/lib` directory only for core functionality
- Use `tsconfig.lib.json` for library-specific TypeScript settings
- Export types from `lib/types.ts`, main component from `lib/chart.tsx`

**Demo Development:**
- `/src` contains demo app with Web Worker for data generation
- Uses alias `"react-realtime-chart": "./lib"` to import local library version

## WebGL-Specific Considerations

**Shader Management:**
- Two shader programs: main (lines/areas) and text rendering
- Coordinate system conversion from screen pixels to WebGL clip space
- Text rendering uses canvas-generated textures with shader-based positioning

**Critical Performance Details:**
- Time scale uses D3's `ticks()` for natural progression, linear scale uses custom exact count
- ResizeObserver tracks container dimensions without margin subtraction initially
- Canvas dimensions set to container size (no pixel ratio scaling) to prevent mobile sizing issues

## Coding Standards

- Use semicolons at the end of each statement
- No code comments in implementation files
- No examples or markdown documentation generation unless specifically requested
- Biome for linting/formatting instead of ESLint/Prettier
