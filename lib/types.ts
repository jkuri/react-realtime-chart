import {
  type CurveFactory,
  curveBasis,
  curveBasisClosed,
  curveBasisOpen,
  curveCardinal,
  curveCardinalClosed,
  curveCardinalOpen,
  curveCatmullRom,
  curveCatmullRomClosed,
  curveCatmullRomOpen,
  curveLinear,
  curveLinearClosed,
  curveMonotoneX,
  curveMonotoneY,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
} from "d3";

export const curveTypeMapping: { [name: string]: CurveFactory } = {
  basis: curveBasis,
  basisClosed: curveBasisClosed,
  basisOpen: curveBasisOpen,
  cardinal: curveCardinal,
  cardinalClosed: curveCardinalClosed,
  cardinalOpen: curveCardinalOpen,
  catmullRom: curveCatmullRom,
  catmullRomClosed: curveCatmullRomClosed,
  catmullRomOpen: curveCatmullRomOpen,
  linear: curveLinear,
  linearClosed: curveLinearClosed,
  monotoneX: curveMonotoneX,
  monotoneY: curveMonotoneY,
  natural: curveNatural,
  step: curveStep,
  stepAfter: curveStepAfter,
  stepBefore: curveStepBefore,
};

export type RealtimeChartData = {
  date: Date;
  value: number;
};

export type RealtimeChartLineOptions = {
  color?: string;
  opacity?: number;
  lineWidth?: number;
  area?: boolean;
  areaColor?: string;
  areaOpacity?: number;
  curve?: string;
};

export type RealtimeChartGridOptions = {
  enable?: boolean;
  color?: string;
  size?: number;
  dashed?: boolean;
  opacity?: number;
  ticks?: boolean;
  tickNumber?: number;
  tickPadding?: number;
  tickFontSize?: number;
  tickFontWeight?: "normal" | "bold" | "bolder" | "lighter" | number;
  tickFontColor?: string;
  tickFontFamily?: string;
  tickFontAnchor?: "start" | "middle" | "end";
  min?: number | "auto";
  max?: number | "auto";
  tickValues?: string[];
  tickFormat?: string | ((v: string | number) => string);
};

export type RealtimeChartOptions = {
  width?: number;
  height?: number;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  fps?: number;
  timeSlots?: number;
  lines?: RealtimeChartLineOptions[];
  xGrid?: RealtimeChartGridOptions;
  yGrid?: RealtimeChartGridOptions;
  colors?: string[];
};
