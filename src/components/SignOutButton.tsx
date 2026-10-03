'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { authClient } from '@/lib/auth-client'
import { Icon } from './Icon'

export function SignOutButton() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      className="icon-button"
      disabled={pending}
      aria-label="Uitloggen"
      title="Uitloggen"
      onClick={() =>
        start(async () => {
          await authClient.signOut()
          router.push('/login')
          router.refresh()
        })
      }
    >
      <Icon name="logout" size={18} />
    </button>
  )
}
