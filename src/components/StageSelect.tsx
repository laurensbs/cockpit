'use client'

import { useTransition } from 'react'
import { STAGES, STAGE_LABELS } from '@/lib/options'
import { setProjectStage } from '@/server/actions/projects'

export function StageSelect({ projectId, stage }: { projectId: string; stage: string }) {
  const [pending, start] = useTransition()
  return (
    <select
      className="select"
      aria-label="Status"
      defaultValue={stage}
      disabled={pending}
      style={{ width: 'auto', minHeight: 36, borderRadius: 999 }}
      onChange={(e) => {
        const next = e.target.value
        start(() => setProjectStage(projectId, next))
      }}
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  )
}
