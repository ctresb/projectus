import { describe, expect, it } from 'vitest'
import type { Column } from '../../lib/types'
import {
  findPlacementAtPoint,
  hasFastHorizontalIntent,
  projectPlacement,
  stabilizePlacement,
  type MeasuredCard,
  type MeasuredColumn,
} from './kanbanPlacement'

const columns: Column[] = [
  { id: 'planejado', titulo: 'Planejado', cor: '#fff' },
  { id: 'fazendo', titulo: 'Fazendo', cor: '#fff' },
]
const cards = [
  { id: 'a', status: 'planejado' },
  { id: 'b', status: 'fazendo' },
  { id: 'c', status: 'fazendo' },
]
const measuredColumns: MeasuredColumn[] = [
  { id: 'planejado', rect: { left: 0, right: 100, top: 0, bottom: 400, height: 400 } },
  { id: 'fazendo', rect: { left: 120, right: 220, top: 0, bottom: 400, height: 400 } },
]
const measuredCards: MeasuredCard[] = [
  { id: 'b', rect: { left: 125, right: 215, top: 30, bottom: 70, height: 40 } },
  { id: 'c', rect: { left: 125, right: 215, top: 90, bottom: 130, height: 40 } },
]

describe('smart snap do kanban', () => {
  it('nao seleciona uma coluna quando o ponteiro esta no gap', () => {
    expect(findPlacementAtPoint(cards, 'a', { x: 110, y: 50 }, measuredColumns, measuredCards)).toBeNull()
  })

  it('calcula a insercao pela metade vertical dos cards da coluna atingida', () => {
    expect(findPlacementAtPoint(cards, 'a', { x: 150, y: 20 }, measuredColumns, measuredCards)).toEqual({
      status: 'fazendo',
      indice: 0,
    })
    expect(findPlacementAtPoint(cards, 'a', { x: 150, y: 81 }, measuredColumns, measuredCards)).toEqual({
      status: 'fazendo',
      indice: 1,
    })
    expect(findPlacementAtPoint(cards, 'a', { x: 150, y: 160 }, measuredColumns, measuredCards)).toEqual({
      status: 'fazendo',
      indice: 2,
    })
  })

  it('insere no fim de uma coluna vazia', () => {
    expect(findPlacementAtPoint(cards, 'b', { x: 50, y: 70 }, measuredColumns, measuredCards)).toEqual({
      status: 'planejado',
      indice: 1,
    })
  })

  it('projeta reorder e movimento entre colunas somente no placement final', () => {
    const projected = projectPlacement(cards, columns, 'c', { status: 'fazendo', indice: 0 })
    expect(projected.map((card) => card.id)).toEqual(['a', 'c', 'b'])
    expect(projectPlacement(cards, columns, 'a', { status: 'fazendo', indice: 1 }).map((card) => card.id)).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('usa intencao horizontal apenas para estabilizar indice na coluna ja atingida', () => {
    const fast = hasFastHorizontalIntent(
      { point: { x: 10, y: 40 }, timestamp: 0 },
      { point: { x: 35, y: 42 }, timestamp: 16 },
    )
    expect(fast).toBe(true)
    expect(stabilizePlacement({ status: 'fazendo', indice: 0 }, { status: 'fazendo', indice: 1 }, fast)).toEqual({
      status: 'fazendo',
      indice: 0,
    })
    expect(stabilizePlacement(null, null, fast)).toBeNull()
    expect(stabilizePlacement(null, { status: 'fazendo', indice: 1 }, fast)).toEqual({ status: 'fazendo', indice: 1 })
  })
})
