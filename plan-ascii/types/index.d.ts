export type StepStatus = 'pending' | 'in_progress' | 'completed'
// `detail` is what the step is doing now (the todo's activeForm), while it runs.
export type Step = { id: string; label: string; status: StepStatus; detail?: string }
export type ContextFill = { percent?: number; tokens?: number; window: number }
// The plan's name: the person's last message before the plan began.
export type Topic = { title?: string; lastPrompt?: string }
// Which of the five styles is drawn, and whether it shows the sample plan.
export type View = { style: number; demo: boolean }

declare module 'claude-code' {
  interface PluginState {
    'plan-ascii': {
      steps: Shaped<Step[]>
      context: Shaped<ContextFill>
      topic: Shaped<Topic>
      view: Shaped<View>
    }
  }
}
