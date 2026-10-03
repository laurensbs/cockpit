'use client'

import { startTransition, useActionState } from 'react'

/**
 * useActionState without React's automatic form reset after an action, so a
 * validation error never wipes what someone just typed.
 */
export function useForm<S>(action: (prev: Awaited<S>, form: FormData) => Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState<S, FormData>(action, initial)
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null
    let data: FormData
    try {
      data = new FormData(form, submitter)
    } catch {
      data = new FormData(form)
    }
    startTransition(() => dispatch(data))
  }
  return { state, pending, onSubmit }
}
