'use client'

import { DiagramField } from '@/components/planner/DrillDetail'
import { saveCompetitionBoard } from '@/lib/competitionActions'
import type { Board } from '@/lib/planner'

/** A competition's field diagram, saved to the competition. */
export function CompetitionDiagram({ compKey, board, title }: { compKey: string; board: Board | null | undefined; title: string }) {
  return <DiagramField board={board} title={title} save={(next) => saveCompetitionBoard(compKey, next)} />
}
