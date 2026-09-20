/**
 * Behavior tests for the completion alert: when any session's turn finishes
 * while the tab is hidden, the title gets a checkmark (short burst, then a
 * persistent marker until the tab is seen); anything the user can already
 * see leaves the plain title alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TARGET } from '../src/title-guard.ts'
import { ALERT_TITLE, installTitleController } from '../src/tab-alert.ts'

type Rows = Record<string, { running: boolean }>

/** Minimal sessions-list double: same subscribe/getSnapshot face, manual emit. */
function makeStore(initial: Rows) {
  let snapshot = { byId: initial }
  const listeners = new Set<() => void>()
  return {
    list: {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    setRows(next: Rows) {
      snapshot = { byId: next }
      for (const listener of listeners) listener()
    },
  }
}


/** A pending-interactions feed that never changes (no agent questions). */
function emptyPending() {
  return {
    getSnapshot: () => new Map(),
    subscribe: () => () => undefined,
  }
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

beforeEach(() => {
  vi.useFakeTimers()
  document.title = 'DeepSeek Harness'
})

afterEach(() => {
  vi.useRealTimers()
  setHidden(false)
  vi.restoreAllMocks()
})

describe('installTitleController', () => {
  it('keeps the plain title while nothing transitions', () => {
    const store = makeStore({ s1: { running: true } })
    const handle = installTitleController(document, store.list, emptyPending())
    expect(document.title).toBe(TARGET)
    handle.dispose()
  })

  it('shows the checkmark when a session finishes while hidden', () => {
    setHidden(true)
    const store = makeStore({ s1: { running: true } })
    const handle = installTitleController(document, store.list, emptyPending())
    store.setRows({ s1: { running: false } })
    expect(document.title).toBe(ALERT_TITLE)
    handle.dispose()
  })

  it('does not alert when the session finishes while the tab is visible', () => {
    setHidden(false)
    const store = makeStore({ s1: { running: true } })
    const handle = installTitleController(document, store.list, emptyPending())
    store.setRows({ s1: { running: false } })
    expect(document.title).toBe(TARGET)
    handle.dispose()
  })

  it('bursts a few times then settles on the checkmark while still hidden', () => {
    setHidden(true)
    const store = makeStore({ s1: { running: true } })
    const handle = installTitleController(document, store.list, emptyPending())
    store.setRows({ s1: { running: false } })

    // Armed at t=0 with the checkmark; the burst alternates on 1 s ticks.
    vi.advanceTimersByTime(1000)
    expect(document.title).toBe(TARGET)
    vi.advanceTimersByTime(1000)
    expect(document.title).toBe(ALERT_TITLE)
    // Past the burst window it settles on the persistent marker (no infinite flicker).
    vi.advanceTimersByTime(60_000)
    expect(document.title).toBe(ALERT_TITLE)
    handle.dispose()
  })

  it('clears the checkmark when the tab becomes visible', () => {
    setHidden(true)
    const store = makeStore({ s1: { running: true } })
    const handle = installTitleController(document, store.list, emptyPending())
    store.setRows({ s1: { running: false } })
    expect(document.title).toBe(ALERT_TITLE)

    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(document.title).toBe(TARGET)
    handle.dispose()
  })

  it('clears a stale checkmark when a new turn starts', () => {
    setHidden(true)
    const store = makeStore({ s1: { running: true } })
    const handle = installTitleController(document, store.list, emptyPending())
    store.setRows({ s1: { running: false } })
    expect(document.title).toBe(ALERT_TITLE)

    store.setRows({ s1: { running: false }, s2: { running: true } })
    expect(document.title).toBe(TARGET)
    handle.dispose()
  })

  it('alerts only on a true→false transition, not for already-idle sessions', () => {
    setHidden(true)
    const store = makeStore({ s1: { running: false } })
    const handle = installTitleController(document, store.list, emptyPending())
    store.setRows({ s1: { running: false } })
    expect(document.title).toBe(TARGET)
    handle.dispose()
  })

  it('stops watching after dispose', () => {
    setHidden(true)
    const store = makeStore({ s1: { running: true } })
    const handle = installTitleController(document, store.list, emptyPending())
    handle.dispose()
    store.setRows({ s1: { running: false } })
    expect(document.title).toBe(TARGET)
    handle.dispose()
  })
})
