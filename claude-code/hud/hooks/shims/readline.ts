// `node:readline`: unused in the mod (the transcript comes through
// setTranscriptProvider), present so upstream's fallback still compiles.
export function createInterface(_options: unknown): AsyncIterable<string> {
  throw new Error('hud: readline is not available in the hooks environment')
}
