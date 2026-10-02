// hud mod: the glyphs claude-hud writes, swappable by the mod's themes. The
// defaults are claude-hud's own, so without setGlyphs the output is upstream's.
import type { MessageKey } from '../i18n/types.js';

export interface Glyphs {
  /** Before the model badge, inside its color. */
  model: string;
  modelOpen: string;
  modelClose: string;
  /** Before the project path. */
  project: string;
  gitOpen: string;
  jjOpen: string;
  gitClose: string;
  worktree: string;
  ahead: string;
  behind: string;
  duration: string;
  running: string;
  done: string;
  todo: string;
  warning: string;
  pace: string;
  /** Before bar and value labels (Context, Usage, Weekly, Cache, Cost). */
  context: string;
  usage: string;
  weekly: string;
  promptCache: string;
  cost: string;
}

export const DEFAULT_GLYPHS: Glyphs = {
  model: '',
  modelOpen: '[',
  modelClose: ']',
  project: '',
  gitOpen: 'git:(',
  jjOpen: 'jj:(',
  gitClose: ')',
  worktree: '⎇',
  ahead: '↑',
  behind: '↓',
  duration: '⏱',
  running: '◐',
  done: '✓',
  todo: '▸',
  warning: '⚠',
  pace: '▲',
  context: '',
  usage: '',
  weekly: '',
  promptCache: '',
  cost: '',
};

let glyphs: Glyphs = DEFAULT_GLYPHS;

export function setGlyphs(next: Partial<Glyphs>): void {
  glyphs = { ...DEFAULT_GLYPHS, ...next };
}

export function glyph(slot: keyof Glyphs): string {
  return glyphs[slot];
}

/** `slot`'s glyph and a space, or '' when the slot is empty. */
export function prefix(slot: keyof Glyphs): string {
  return glyphs[slot] ? `${glyphs[slot]} ` : '';
}

const LABEL_SLOTS: Partial<Record<MessageKey, keyof Glyphs>> = {
  'label.context': 'context',
  'label.usage': 'usage',
  'label.weekly': 'weekly',
  'label.promptCache': 'promptCache',
  'label.cost': 'cost',
};

/** A label's text with its glyph in front, when the theme gives it one. */
export function iconLabel(key: MessageKey, text: string): string {
  const slot = LABEL_SLOTS[key];
  return slot ? `${prefix(slot)}${text}` : text;
}
