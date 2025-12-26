import { useEffect } from "react";
import type { JitterConfig } from "@/core/jitter";
import type { BrushPatternId } from "@/core/types";
import type { EraserVariant, PenVariant } from "@/engine/variants";
import type { Tool, WigglyEngine } from "@/engine/WigglyEngine";

type UseWigglyEngineSyncParams = {
  engine: WigglyEngine | null;
  tool: Tool;
  colorIndex: number;
  brushWidth: number;
  penVariant: PenVariant;
  eraserVariant: EraserVariant;
  patternId: BrushPatternId;
  backgroundColor: string;
  jitterConfig: JitterConfig;
  palette: string[];
};

export function useWigglyEngineSync({
  engine,
  tool,
  colorIndex,
  brushWidth,
  penVariant,
  eraserVariant,
  patternId,
  backgroundColor,
  jitterConfig,
  palette,
}: UseWigglyEngineSyncParams): void {
  // エンジンの生成完了後に同期を走らせる
  useEffect(() => {
    if (!engine) return;
    engine.setTool(tool);
  }, [engine, tool]);

  useEffect(() => {
    if (!engine) return;
    engine.setBrushColor({ kind: "palette", index: colorIndex });
  }, [colorIndex, engine]);

  useEffect(() => {
    if (!engine) return;
    engine.setBrushWidth(brushWidth);
  }, [brushWidth, engine]);

  useEffect(() => {
    if (!engine) return;
    engine.setPattern(patternId);
  }, [engine, patternId]);

  useEffect(() => {
    if (!engine) return;
    engine.setPenVariant(penVariant);
  }, [engine, penVariant]);

  useEffect(() => {
    if (!engine) return;
    engine.setEraserVariant(eraserVariant);
  }, [engine, eraserVariant]);

  useEffect(() => {
    if (!engine) return;
    engine.setBackgroundColor(backgroundColor);
  }, [backgroundColor, engine]);

  useEffect(() => {
    if (!engine) return;
    engine.setJitterConfig(jitterConfig);
  }, [engine, jitterConfig]);

  useEffect(() => {
    if (!engine) return;
    engine.setPaletteColors(palette);
  }, [engine, palette]);
}
