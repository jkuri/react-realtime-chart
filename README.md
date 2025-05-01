# React Realtime Chart

A lightweight, customizable real-time chart component for React applications.

## Installation

```bash
npm install react-realtime-chart
```

## Usage

```tsx
import RealtimeChart, { type RealtimeChartData, type RealtimeChartOptions } from "react-realtime-chart";
import { useEffect, useState } from "react";

const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const generateRandomRealtimeData = (n = 10, step = 1, min = 0, max = 100, date = new Date()) => {
  return Array.from(Array(n).keys())
    .map((_, i) => ({
      date: new Date(date.getTime() - i * step * 1000),
      value: randomInt(min, max),
    }))
    .reverse();
};

function Demo() {
  const [data, setData] = useState([
    [...generateRandomRealtimeData(120, 1, 10, 90)]
  ]);

  const options = {
    margin: { top: 10, right: 25, bottom: 25, left: 50 },
    colors: ["#171717"],
    lines: [{ area: false }],
    yGrid: {
      min: 0,
      max: 100,
      color: "#09090B",
      opacity: 0.03,
      tickNumber: 5,
      tickFormat: (v) => `${v}%`,
      tickPadding: 25,
      tickFontWeight: "normal",
      tickFontColor: "#171717",
      tickFontSize: 10,
    },
    xGrid: {
      color: "#09090B",
      opacity: 0.03,
      tickNumber: 8,
      tickFontColor: "#171717",
      tickFontSize: 10,
    },
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const data = [...prev];
        data[0] = [...data[0], { date: new Date(), value: randomInt(10, 90) }];
        return data;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return <RealtimeChart options={options} data={data} />;
}
```

## API Reference

### RealtimeChart Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | `RealtimeChartData[][]` | Array of data series to display on the chart |
| `options` | `RealtimeChartOptions` | Configuration options for the chart |

### RealtimeChartData

```ts
type RealtimeChartData = {
  date: Date;
  value: number;
};
```

### RealtimeChartOptions

```ts
type RealtimeChartOptions = {
  width?: number;                // Chart width (defaults to container width)
  height?: number;               // Chart height (defaults to container height)
  margin?: {                     // Chart margins
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  fps?: number;                  // Frames per second for rendering (default: 24)
  timeSlots?: number;            // Number of time slots to display (default: 60)
  lines?: RealtimeChartLineOptions[]; // Options for each line
  xGrid?: RealtimeChartGridOptions;   // X-axis grid options
  yGrid?: RealtimeChartGridOptions;   // Y-axis grid options
  colors?: string[];             // Array of colors for lines
};
```

### RealtimeChartLineOptions

```ts
type RealtimeChartLineOptions = {
  color?: string;                // Line color
  opacity?: number;              // Line opacity (0-1)
  lineWidth?: number;            // Line width in pixels
  area?: boolean;                // Whether to fill area under the line
  areaColor?: string;            // Area fill color
  areaOpacity?: number;          // Area fill opacity (0-1)
  curve?: string;                // Curve type (linear, basis, cardinal, etc.)
};
```

### RealtimeChartGridOptions

```ts
type RealtimeChartGridOptions = {
  enable?: boolean;              // Enable/disable grid
  color?: string;                // Grid line color
  size?: number;                 // Grid line width
  dashed?: boolean;              // Use dashed lines for grid
  opacity?: number;              // Grid line opacity (0-1)
  ticks?: boolean;               // Show tick marks
  tickNumber?: number;           // Number of ticks to display
  tickPadding?: number;          // Padding between tick and label
  tickFontSize?: number;         // Tick label font size
  tickFontWeight?: string|number; // Tick label font weight
  tickFontColor?: string;        // Tick label font color
  tickFontFamily?: string;       // Tick label font family
  tickFontAnchor?: string;       // Tick label text anchor
  min?: number | "auto";         // Minimum value (auto for data-based)
  max?: number | "auto";         // Maximum value (auto for data-based)
  tickValues?: string[];         // Custom tick values
  tickFormat?: string | Function; // Tick format function or string
};
```

## Features

- Real-time data visualization with smooth animations
- Customizable appearance (colors, line styles, grid, etc.)
- Multiple data series support
- Automatic scaling and time-based x-axis
- Optimized rendering using canvas for performance
- Responsive design

## License

MIT
