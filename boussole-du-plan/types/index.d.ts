export type StepStatus = 'pending' | 'in_progress' | 'completed'
// `detail` is what the step is doing now (the todo's activeForm), while it runs.
export type Step = { id: string; label: string; status: StepStatus; detail?: string }
// `history` holds the last fills measured, oldest first, for the small bars.
export type ContextFill = { percent?: number; tokens?: number; window: number; history?: number[] }
// The plan's name: the person's last message before the plan began.
export type Topic = { title?: string; lastPrompt?: string }

declare module 'claude-code' {
  interface PluginState {
    'boussole-du-plan': {
      steps: Shaped<Step[]>
      context: Shaped<ContextFill>
      topic: Shaped<Topic>
    }
  }
}
