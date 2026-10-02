export type FinaleState = { kind: 'answer' | 'aborted' | 'error'; label: string; id: string }
export type Preview = { theme: string; id: string }

declare module 'claude-code' {
  interface PluginState {
    spinner: {
      theme: string
      choice: string
      isHidden: boolean
      isStageOff: boolean
      finale: FinaleState | null
      preview: Preview | null
    }
  }
}
