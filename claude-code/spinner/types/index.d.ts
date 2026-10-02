export type FinaleState = { kind: 'answer' | 'aborted' | 'error'; label: string; id: string }
export type Preview = { theme: string; id: string }
/** What the running turn is doing, and the tool when it is running one. */
export type Activity = { act: 'think' | 'tool' | 'ask' | 'say' | 'wait'; tool?: string }
export type PetStats = { xp: number; love: number }

declare module 'claude-code' {
  interface PluginState {
    spinner: {
      theme: string
      choice: string
      isHidden: boolean
      isStageOff: boolean
      isCompanionOff: boolean
      finale: FinaleState | null
      preview: Preview | null
      activity: Activity
      mood: 'hello' | 'ready' | 'aborted' | 'error' | 'sleep'
      pet: PetStats
      pat: string | null
    }
  }
}
