import { useSyncExternalStore } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type State = {
  status: SaveStatus
  lastSavedAt: number | null
  errorMessage: string | null
}

let state: State = { status: 'idle', lastSavedAt: null, errorMessage: null }
const listeners = new Set<() => void>()

function emit(next: State) {
  state = next
  listeners.forEach((listener) => listener())
}

export function markSaving() {
  if (state.status === 'saving') return
  emit({ ...state, status: 'saving', errorMessage: null })
}

export function markSaved() {
  emit({ status: 'saved', lastSavedAt: Date.now(), errorMessage: null })
}

export function markError(message: string) {
  emit({ ...state, status: 'error', errorMessage: message })
}

export function markIdle() {
  emit({ status: 'idle', lastSavedAt: state.lastSavedAt, errorMessage: null })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

export function useSaveStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
