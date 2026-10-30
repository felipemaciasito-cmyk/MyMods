export type StepStatus = 'pending' | 'in_progress' | 'completed'
export type Step = { id: string; label: string; status: StepStatus }
export type ContextFill = { percent?: number; tokens?: number; window: number }

declare module 'claude-code' {
  interface PluginState {
    'boussole-du-plan': {
      steps: Shaped<Step[]>
      context: Shaped<ContextFill>
    }
  }
}
