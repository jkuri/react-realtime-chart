import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/providers/theme-provider";
import type { CurveType } from "@/types/curve";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
interface ControlsProps {
  fps: number;
  setFps: (value: number) => void;
  timeSlots: number;
  setTimeSlots: (value: number) => void;
  curveType: CurveType;
  setCurveType: (value: CurveType) => void;
  color: string;
  setColor: (value: string) => void;
  areaOpacity: number;
  setAreaOpacity: (value: number) => void;
  lineWidth: number;
  setLineWidth: (value: number) => void;
  gridColor: string;
  setGridColor: (value: string) => void;
  gridOpacity: number;
  setGridOpacity: (value: number) => void;
}

export function Controls({
  fps,
  setFps,
  timeSlots,
  setTimeSlots,
  curveType,
  setCurveType,
  color,
  setColor,
  areaOpacity,
  setAreaOpacity,
  lineWidth,
  setLineWidth,
  gridColor,
  setGridColor,
  gridOpacity,
  setGridOpacity,
}: ControlsProps) {
  const { isDark } = useTheme();
  const isMobile = useMobile();
  const [isOpen, setIsOpen] = useState(false);

  const controlsContent = (
    <div className="z-10 flex flex-col sm:flex-row w-full sm:items-end gap-3">
      <div className="space-y-1 sm:flex-1 sm:min-w-0">
        <Label htmlFor="fps" className="block text-sm">
          FPS
        </Label>
        <Select value={fps.toString()} onValueChange={(value) => setFps(Number(value))}>
          <SelectTrigger id="fps" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="15">15</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="24">24</SelectItem>
            <SelectItem value="30">30</SelectItem>
            <SelectItem value="60">60</SelectItem>
            <SelectItem value="120">120</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 sm:flex-1 sm:min-w-0">
        <Label htmlFor="time-slots" className="block text-sm">
          Time Slots
        </Label>
        <Select value={timeSlots.toString()} onValueChange={(value) => setTimeSlots(Number(value))}>
          <SelectTrigger id="time-slots" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="30">30</SelectItem>
            <SelectItem value="40">40</SelectItem>
            <SelectItem value="60">60</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 sm:flex-1 sm:min-w-0">
        <Label htmlFor="curve-type" className="block text-sm">
          Curve Type
        </Label>
        <Select value={curveType} onValueChange={(value) => setCurveType(value as CurveType)}>
          <SelectTrigger id="curve-type" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basis">Basis</SelectItem>
            <SelectItem value="basisOpen">Basis Open</SelectItem>
            <SelectItem value="cardinal">Cardinal</SelectItem>
            <SelectItem value="cardinalOpen">Cardinal Open</SelectItem>
            <SelectItem value="catmullRom">Catmull Rom</SelectItem>
            <SelectItem value="catmullRomOpen">Catmull Rom Open</SelectItem>
            <SelectItem value="linear">Linear</SelectItem>
            <SelectItem value="monotoneX">Monotone X</SelectItem>
            <SelectItem value="monotoneY">Monotone Y</SelectItem>
            <SelectItem value="natural">Natural</SelectItem>
            <SelectItem value="step">Step</SelectItem>
            <SelectItem value="stepAfter">Step After</SelectItem>
            <SelectItem value="stepBefore">Step Before</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 sm:flex-1 sm:min-w-0">
        <Label htmlFor="color" className="block text-sm">
          Color
        </Label>
        <Select value={color} onValueChange={setColor}>
          <SelectTrigger id="color" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={isDark ? "#ffffff" : "#09090B"}>Primary</SelectItem>
            <SelectItem value="#EF4444">Red</SelectItem>
            <SelectItem value="#F97316">Orange</SelectItem>
            <SelectItem value="#F59E0B">Amber</SelectItem>
            <SelectItem value="#EAB308">Yellow</SelectItem>
            <SelectItem value="#84CC16">Lime</SelectItem>
            <SelectItem value="#22C55E">Green</SelectItem>
            <SelectItem value="#10B981">Emerald</SelectItem>
            <SelectItem value="#14B8A6">Teal</SelectItem>
            <SelectItem value="#06B6D4">Cyan</SelectItem>
            <SelectItem value="#0EA5E9">Light Blue</SelectItem>
            <SelectItem value="#3B82F6">Blue</SelectItem>
            <SelectItem value="#6366F1">Indigo</SelectItem>
            <SelectItem value="#8B5CF6">Violet</SelectItem>
            <SelectItem value="#A855F7">Purple</SelectItem>
            <SelectItem value="#EC4899">Fuchsia</SelectItem>
            <SelectItem value="#D946EF">Pink</SelectItem>
            <SelectItem value="#F43F5E">Rose</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 sm:flex-1 sm:min-w-0">
        <Label htmlFor="area-opacity" className="block text-sm">
          Area Opacity
        </Label>
        <Select value={areaOpacity.toString()} onValueChange={(value) => setAreaOpacity(Number(value))}>
          <SelectTrigger id="area-opacity" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0</SelectItem>
            <SelectItem value="0.03">0.03</SelectItem>
            <SelectItem value="0.05">0.05</SelectItem>
            <SelectItem value="0.1">0.1</SelectItem>
            <SelectItem value="0.2">0.2</SelectItem>
            <SelectItem value="0.3">0.3</SelectItem>
            <SelectItem value="0.4">0.4</SelectItem>
            <SelectItem value="0.5">0.5</SelectItem>
            <SelectItem value="0.6">0.6</SelectItem>
            <SelectItem value="0.7">0.7</SelectItem>
            <SelectItem value="0.8">0.8</SelectItem>
            <SelectItem value="0.9">0.9</SelectItem>
            <SelectItem value="1">1</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 sm:flex-1 sm:min-w-0">
        <Label htmlFor="line-width" className="block text-sm">
          Line Width
        </Label>
        <Select value={lineWidth.toString()} onValueChange={(value) => setLineWidth(Number(value))}>
          <SelectTrigger id="line-width" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="4">4</SelectItem>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="6">6</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 sm:flex-1 sm:min-w-0">
        <Label htmlFor="grid-color" className="block text-sm">
          Grid Color
        </Label>
        <Select value={gridColor} onValueChange={setGridColor}>
          <SelectTrigger id="grid-color" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={isDark ? "#171717" : "#CCCCCC"}>Primary</SelectItem>
            <SelectItem value="#EF4444">Red</SelectItem>
            <SelectItem value="#F97316">Orange</SelectItem>
            <SelectItem value="#F59E0B">Amber</SelectItem>
            <SelectItem value="#EAB308">Yellow</SelectItem>
            <SelectItem value="#84CC16">Lime</SelectItem>
            <SelectItem value="#22C55E">Green</SelectItem>
            <SelectItem value="#10B981">Emerald</SelectItem>
            <SelectItem value="#14B8A6">Teal</SelectItem>
            <SelectItem value="#06B6D4">Cyan</SelectItem>
            <SelectItem value="#0EA5E9">Light Blue</SelectItem>
            <SelectItem value="#3B82F6">Blue</SelectItem>
            <SelectItem value="#6366F1">Indigo</SelectItem>
            <SelectItem value="#8B5CF6">Violet</SelectItem>
            <SelectItem value="#A855F7">Purple</SelectItem>
            <SelectItem value="#EC4899">Fuchsia</SelectItem>
            <SelectItem value="#D946EF">Pink</SelectItem>
            <SelectItem value="#F43F5E">Rose</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 sm:flex-1 sm:min-w-0">
        <Label htmlFor="grid-opacity" className="block text-sm">
          Grid Opacity
        </Label>
        <Select value={gridOpacity.toString()} onValueChange={(value) => setGridOpacity(Number(value))}>
          <SelectTrigger id="grid-opacity" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0</SelectItem>
            <SelectItem value="0.03">0.03</SelectItem>
            <SelectItem value="0.05">0.05</SelectItem>
            <SelectItem value="0.1">0.1</SelectItem>
            <SelectItem value="0.2">0.2</SelectItem>
            <SelectItem value="0.3">0.3</SelectItem>
            <SelectItem value="0.4">0.4</SelectItem>
            <SelectItem value="0.5">0.5</SelectItem>
            <SelectItem value="0.6">0.6</SelectItem>
            <SelectItem value="0.7">0.7</SelectItem>
            <SelectItem value="0.8">0.8</SelectItem>
            <SelectItem value="0.9">0.9</SelectItem>
            <SelectItem value="1">1</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
        <div className="w-full p-4 border rounded-md">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <span className="text-sm font-medium">Chart Controls</span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">{controlsContent}</CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  return <div className="w-full p-4 border rounded-md">{controlsContent}</div>;
}
