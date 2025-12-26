import type { RefObject } from "react";
import { useEffect } from "react";
import type { JitterConfig } from "@/core/jitter";
import type { BrushPatternId } from "@/core/types";
import type { EraserVariant, PenVariant } from "@/engine/variants";
import type { Tool, WigglyEngine } from "@/engine/WigglyEngine";

type UseWigglyEngineSyncParams = {
  engineRef: RefObject<WigglyEngine | null>;
  engineVersion: number;
  tool: Tool;
  color: string;
  brushWidth: number;
  penVariant: PenVariant;
  eraserVariant: EraserVariant;
  patternId: BrushPatternId;
  backgroundColor: string;
  jitterConfig: JitterConfig;
  palette: string[];
};

export function useWigglyEngineSync({
  engineRef,
  engineVersion,
  tool,
  color,
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
    if (engineVersion === 0) return;
    engineRef.current?.setTool(tool);
  }, [engineRef, engineVersion, tool]);

  useEffect(() => {
    if (engineVersion === 0) return;
    engineRef.current?.setBrushColor(color);
  }, [color, engineRef, engineVersion]);

  useEffect(() => {
    if (engineVersion === 0) return;
    engineRef.current?.setBrushWidth(brushWidth);
  }, [brushWidth, engineRef, engineVersion]);

  useEffect(() => {
    if (engineVersion === 0) return;
    engineRef.current?.setPattern(patternId);
  }, [engineRef, engineVersion, patternId]);

  useEffect(() => {
    if (engineVersion === 0) return;
    engineRef.current?.setPenVariant(penVariant);
  }, [engineRef, engineVersion, penVariant]);

  useEffect(() => {
    if (engineVersion === 0) return;
    engineRef.current?.setEraserVariant(eraserVariant);
  }, [engineRef, engineVersion, eraserVariant]);

  useEffect(() => {
    if (engineVersion === 0) return;
    engineRef.current?.setBackgroundColor(backgroundColor);
  }, [backgroundColor, engineRef, engineVersion]);

  useEffect(() => {
    if (engineVersion === 0) return;
    engineRef.current?.setJitterConfig(jitterConfig);
  }, [engineRef, engineVersion, jitterConfig]);

  // パレット変更時は既存のImageBitmapが古い色になるためキャッシュを破棄する
  // biome-ignore lint/correctness/useExhaustiveDependencies: パレット変更で再描画が必要なため
  useEffect(() => {
    if (engineVersion === 0) return;
    engineRef.current?.clearRendererCache();
  }, [palette, engineRef, engineVersion]);
}
