import { useSyncExternalStore } from 'react'
import { api } from '../lib/api'

export type SnapshotPhase = 'idle' | 'running' | 'done' | 'error'

export type SnapshotState = {
  phase: SnapshotPhase
  arquivos_enviados: number
  arquivos_total: number
  bytes_enviados: number
  bytes_total: number
  erro: string | null
}

const initial: SnapshotState = {
  phase: 'idle',
  arquivos_enviados: 0,
  arquivos_total: 0,
  bytes_enviados: 0,
  bytes_total: 0,
  erro: null,
}

let state: SnapshotState = initial
const listeners = new Set<() => void>()
let subscribers = 0
let unsubscribeEvents: (() => void) | null = null
let resetTimer: number | null = null

function setState(next: SnapshotState) {
  state = next
  listeners.forEach((listener) => listener())
}

function scheduleReset(delay: number) {
  if (resetTimer) window.clearTimeout(resetTimer)
  resetTimer = window.setTimeout(() => {
    setState(initial)
    resetTimer = null
  }, delay)
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function handleEvent(tipo: string, dados: Record<string, unknown> | null | undefined) {
  if (tipo === 'backup_iniciado') {
    if (resetTimer) {
      window.clearTimeout(resetTimer)
      resetTimer = null
    }
    setState({
      phase: 'running',
      arquivos_enviados: 0,
      arquivos_total: num(dados?.arquivos_total),
      bytes_enviados: 0,
      bytes_total: num(dados?.bytes_total),
      erro: null,
    })
  } else if (tipo === 'backup_progresso') {
    setState({
      phase: 'running',
      arquivos_enviados: num(dados?.arquivos_enviados),
      arquivos_total: num(dados?.arquivos_total),
      bytes_enviados: num(dados?.bytes_enviados),
      bytes_total: num(dados?.bytes_total),
      erro: null,
    })
  } else if (tipo === 'backup_concluido' || tipo === 'backup_r2_criado') {
    setState({
      ...state,
      phase: 'done',
      arquivos_enviados: state.arquivos_total || state.arquivos_enviados,
      bytes_enviados: state.bytes_total || state.bytes_enviados,
      erro: null,
    })
    scheduleReset(1800)
  } else if (tipo === 'backup_falhou') {
    setState({
      ...state,
      phase: 'error',
      erro: typeof dados?.mensagem === 'string' ? (dados.mensagem as string) : 'falha no snapshot',
    })
    scheduleReset(4500)
  }
}

function attach() {
  subscribers += 1
  if (unsubscribeEvents) return
  unsubscribeEvents = api.events((event) => {
    if (!event.tipo.startsWith('backup_')) return
    handleEvent(event.tipo, event.dados ?? null)
  })
}

function detach() {
  subscribers -= 1
  if (subscribers <= 0 && unsubscribeEvents) {
    unsubscribeEvents()
    unsubscribeEvents = null
    subscribers = 0
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  attach()
  return () => {
    listeners.delete(listener)
    detach()
  }
}

function getSnapshot() {
  return state
}

export function useSnapshotState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Dispara snapshot. Trava o botão otimisticamente; SSE assume a UI de progresso.
 * Fallback se SSE não chegar: a Promise resolve/rejeita e força done/error.
 */
export async function triggerSnapshot(): Promise<void> {
  if (getSnapshot().phase === 'running') return
  if (resetTimer) {
    window.clearTimeout(resetTimer)
    resetTimer = null
  }
  setState({ ...initial, phase: 'running' })
  try {
    await api.saveSnapshot()
    const after = getSnapshot()
    if (after.phase === 'running') {
      setState({ ...after, phase: 'done' })
      scheduleReset(1800)
    }
  } catch (err) {
    setState({
      ...getSnapshot(),
      phase: 'error',
      erro: err instanceof Error ? err.message : 'falha no snapshot',
    })
    scheduleReset(4500)
    throw err
  }
}
