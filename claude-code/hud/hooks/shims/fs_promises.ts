// `node:fs/promises`: the reads claude-hud makes outside a replayed pass.
import { getIo } from './host.js'

export async function readFile(path: string, _options?: unknown): Promise<string> {
  return getIo().read(path)
}
