export type Link = 'direct' | 'peer-relay' | 'derp' | 'offline'

export type Node = { name: string; isOnline: boolean; link: Link; via: string }

export type Snapshot = { nodes: Node[]; checkedAt: number; error: string | null }

declare module 'claude-code' {
  interface PluginState {
    'ts-band': { snapshot: Snapshot | null; isHidden: boolean | null; isPicking: boolean }
  }
}
