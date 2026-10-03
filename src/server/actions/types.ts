export interface FormState {
  ok: boolean
  error?: string
  message?: string
}

export const initialFormState: FormState = { ok: false }
