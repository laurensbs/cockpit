import { Lesson } from '@/components/Lesson'
import { getDb } from '@/db'
import { playerStats } from '@/server/game'
import { lessonCards } from '@/server/lesson'
import { requireOwner } from '@/server/session'
import { dayProgress } from '@/server/today'
import { loadWeekScore } from '@/server/week-score'

export const metadata = { title: 'Je dag' }

/** The day as a lesson, without the sidebar: one card at a time. */
export default async function DayLessonPage() {
  const owner = await requireOwner('/dag')
  const db = await getDb()
  const [cards, progress, stats, week] = await Promise.all([lessonCards(db, owner.userId), dayProgress(db, owner.userId), playerStats(db, owner.userId), loadWeekScore(db, owner.userId)])
  return <Lesson cards={cards} done={progress.done} goal={progress.goal} streak={stats.actionStreak.length} week={{ now: week.now, before: week.before }} />
}
