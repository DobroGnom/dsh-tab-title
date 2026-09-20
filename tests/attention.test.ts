/**
 * Behavior tests for the attention marker: a pending interaction (user
 * question, plan review, approval) is the agent blocking on the user — a
 * higher-priority signal than a finished turn, shown with its own marker.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TARGET } from '../src/title-guard.ts'
import { ALERT_TITLE, ATTENTION_TITLE, installTitleController } from '../src/tab-alert.ts'

interface InteractionRow {
  key: string
  kind: string
}

type Rows = Record<string, { running: boolean }>

/** Minimal doubles with the same observable faces the runtime exposes. */
function makeFeeds(initialSessions: Rows, initialPending?: Record<string, InteractionRow>) {
  let sessions = { byId: initialSessions }
  let pending: ReadonlyMap<string, InteractionRow> = new Map(Object.entries(initialPending ?? {}))
  const sessionListeners = new Set<() => void>()
  const pendingListeners = new Set<() => void>()
  return {
    sessions: {
      getSnapshot: () => sessions,
      subscribe: (listener: () => void) => {
        sessionListeners.add(listener)
        return () => sessionListeners.delete(listener)
      },
    },
    pendingInteractions: {
      getSnapshot: () => pending,
      subscribe: (listener: () => void) => {
        pendingListeners.add(listener)
        return () => pendingListeners.delete(listener)
      },
    },
    setSessions(next: Rows) {
      sessions = { byId: next }
      for (const listener of sessionListeners) listener()
    },
    setPending(next: Record<string, InteractionRow>) {
      pending = new Map(Object.entries(next))
      for (const listener of pendingListeners) listener()
    },
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

describe('attention interactions', () => {
  it('exports the distinct attention marker', () => {
    expect(ATTENTION_TITLE).toBe('❓ DeepSeek Harness')
    expect(ALERT_TITLE).toBe('✓ DeepSeek Harness')
  })

  it('shows ❓ when a user question appears while hidden', () => {
    setHidden(true)
    const feeds = makeFeeds({ s1: { running: true } })
    const handle = installTitleController(document, feeds.sessions, feeds.pendingInteractions)
    feeds.setPending({ s1: { key: 'q1', kind: 'question' } })
    expect(document.title).toBe(ATTENTION_TITLE)
    handle.dispose()
  })

  it('shows ❓ for plan-review and approval kinds too', () => {
    setHidden(true)
    const feeds = makeFeeds({ s1: { running: true } })
    const handle = installTitleController(document, feeds.sessions, feeds.pendingInteractions)
    feeds.setPending({ s1: { key: 'p1', kind: 'plan-review' } })
    expect(document.title).toBe(ATTENTION_TITLE)
    feeds.setPending({ s1: { key: 'p1', kind: 'plan-review' }, s2: { key: 'a1', kind: 'approval' } })
    expect(document.title).toBe(ATTENTION_TITLE)
    handle.dispose()
  })

  it('does not alert for interactions while the tab is visible', () => {
    setHidden(false)
    const feeds = makeFeeds({ s1: { running: true } })
    const handle = installTitleController(document, feeds.sessions, feeds.pendingInteractions)
    feeds.setPending({ s1: { key: 'q1', kind: 'question' } })
    expect(document.title).toBe(TARGET)
    handle.dispose()
  })

  it('upgrades a standing ✓ to ❓ when an interaction arrives', () => {
    setHidden(true)
    const feeds = makeFeeds({ s1: { running: true } })
    const handle = installTitleController(document, feeds.sessions, feeds.pendingInteractions)
    feeds.setSessions({ s1: { running: false } })
    expect(document.title).toBe(ALERT_TITLE)
    feeds.setPending({ s1: { key: 'q1', kind: 'question' } })
    expect(document.title).toBe(ATTENTION_TITLE)
    handle.dispose()
  })

  it('clears ❓ when the tab becomes visible', () => {
    setHidden(true)
    const feeds = makeFeeds({ s1: { running: true } })
    const handle = installTitleController(document, feeds.sessions, feeds.pendingInteractions)
    feeds.setPending({ s1: { key: 'q1', kind: 'question' } })
    expect(document.title).toBe(ATTENTION_TITLE)
    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(document.title).toBe(TARGET)
    handle.dispose()
  })

  it('does not re-arm for the same interaction (no flicker on repeat snapshots)', () => {
    setHidden(true)
    const feeds = makeFeeds({ s1: { running: true } })
    const handle = installTitleController(document, feeds.sessions, feeds.pendingInteractions)
    feeds.setPending({ s1: { key: 'q1', kind: 'question' } })
    expect(document.title).toBe(ATTENTION_TITLE)
    // Burst ticks run; then an unrelated snapshot emission must not re-arm.
    vi.advanceTimersByTime(60_000)
    feeds.setSessions({ s1: { running: false } })
    feeds.setPending({ s1: { key: 'q1', kind: 'question' } })
    expect(document.title).toBe(ATTENTION_TITLE)
    handle.dispose()
  })
})
