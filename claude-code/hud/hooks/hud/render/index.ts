import type { RenderContext } from '../types.js';
import { getTerminalWidth } from '../utils/terminal.js';
import { RESET } from './colors.js';
import { wrapToWidth } from './ansi.js';
import { compactLines } from './compact.js';
import { expandedLines } from './expanded.js';
import { createFrame } from './frame.js';

/** The lines the HUD prints, wrapped to the terminal width when it is known. */
export function renderLines(ctx: RenderContext, columns: number | null, now: number): string[] {
  const frame = createFrame(ctx, columns, now);
  const lines = (ctx.config?.lineLayout ?? 'expanded') === 'expanded' ? expandedLines(frame) : compactLines(frame);
  return lines
    .flatMap((line) => line.split('\n'))
    .flatMap((line) => wrapToWidth(line, frame.width ?? 0))
    .map((line) => `${RESET}${line}`);
}

// hud mod: lines go to a sink the mod sets instead of stdout.
let lineSink: (line: string) => void = (line) => console.log(line);

export function setRenderSink(sink: (line: string) => void): void {
  lineSink = sink;
}

export function emitLine(line: string): void {
  lineSink(line);
}

export function render(ctx: RenderContext): void {
  for (const line of renderLines(ctx, getTerminalWidth(), Date.now())) lineSink(line);
}
