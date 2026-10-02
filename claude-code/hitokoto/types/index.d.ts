export type Quote = { text: string; from: string; fromWho: string }

declare module 'claude-code' {
  interface PluginState {
    hitokoto: { quote: Quote | null; isHidden: boolean }
  }
}
