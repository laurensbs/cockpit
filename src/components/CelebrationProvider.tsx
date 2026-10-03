'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { Celebration, type CelebrationContent } from './Celebration'

const CelebrateContext = createContext<(content: CelebrationContent) => void>(() => {})

/**
 * Lives in the app layout, so a celebration survives the page refreshing underneath it (a quest
 * that is done moves to another list, and the item that was clicked is gone).
 */
export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<CelebrationContent | null>(null)
  const close = useCallback(() => setContent(null), [])
  return (
    <CelebrateContext.Provider value={setContent}>
      {children}
      {content ? <Celebration content={content} onDone={close} /> : null}
    </CelebrateContext.Provider>
  )
}

export const useCelebrate = () => useContext(CelebrateContext)
