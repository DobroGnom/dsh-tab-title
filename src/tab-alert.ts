/**
 * Alert controller: watch the sessions-list feed (turn completions) and the
 * pending-interactions feed (agent blocking on the user — question, plan
 * review, approval) and drive the tab title accordingly while the tab is
 * hidden. The guard owns the single write to `document.title`; this
 * controller only decides the current target and asks the guard to
 * re-enforce it.
 *
 * State machine:
 * - idle: target is the plain pin.
 * - alert: a short burst (alternating marker / plain at ~1 s, background
 *   timers are throttled to whole seconds) settles on the persistent marker.
 *   The marker is `❓` for a pending interaction (higher priority — the agent
 *   is blocked waiting) and `✓` for a finished turn. Cleared by: the tab
 *   becoming visible, a new turn starting anywhere, or dispose.
 */

import { TARGET, pinDocumentTitle } from './title-guard.ts'

/** The unread-marker title for a finished turn. */
export const ALERT_TITLE = `✓ ${TARGET}`

/** The attention-marker title for a pending interaction (agent waits on you). */
export const ATTENTION_TITLE = `❓ ${TARGET}`

/** Burst cadence in ms: within background-timer clamping (≥1 s granularity). */
const BURST_INTERVAL_MS = 1000

/** How long the burst alternates before settling on the marker. */
const BURST_DURATION_MS = 6000

/** Structural slice of the sessions list feed this controller consumes. */
interface SessionsListFeed {
  getSnapshot(): { byId: Record<string, { running?: boolean }> }
  subscribe(listener: () => void): () => void
}

/** Structural slice of the pending-interactions feed (kind → marker class). */
interface PendingInteractionsFeed {
  getSnapshot(): ReadonlyMap<string, { key?: string, kind?: string }>
  subscribe(listener: () => void): () => void
}

/** Handles owned by one controller instance. */
export interface AlertControllerHandle {
  /** Unsubscribe, stop timers, and release the guard. */
  dispose(): void
}

/**
 * Install the alert controller on top of a title guard.
 * @param doc - the guarded document (injected for testability).
 * @param sessions - the sessions-list observable (ctx.sessions.list at runtime).
 * @param pendingInteractions - the pending-interaction observable (ctx.uiSession.pendingInteractions).
 * @returns a disposer releasing every subscription and timer.
 */
export function installTitleController(
  doc: Document,
  sessions: SessionsListFeed,
  pendingInteractions: PendingInteractionsFeed,
): AlertControllerHandle {
  type Marker = '✓' | '❓'
  let marker: Marker | undefined
  let burstTimer: ReturnType<typeof setInterval> | undefined
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let disposeGuard: (() => void) | undefined

  const stopBurst = (): void => {
    if (burstTimer !== undefined) clearInterval(burstTimer)
    if (settleTimer !== undefined) clearTimeout(settleTimer)
    burstTimer = undefined
    settleTimer = undefined
  }

  const currentTarget = (): string => (marker === undefined ? TARGET : `${marker} ${TARGET}`)

  const guard = pinDocumentTitle(doc, currentTarget)
  disposeGuard = () => { guard.dispose(); disposeGuard = undefined }

  const disarm = (): void => {
    stopBurst()
    if (marker === undefined) return
    marker = undefined
    guard.refresh()
  }

  const arm = (withMarker: Marker): void => {
    marker = withMarker
    guard.refresh()
    // The burst alternates the marker a few times, then settles on the
    // persistent marker. 1 s cadence survives background-tab timer clamping
    // for the whole burst.
    let tick = 0
    burstTimer = setInterval(() => {
      tick += 1
      if (tick % 2 === 0) guard.refresh()
      else doc.title = TARGET
    }, BURST_INTERVAL_MS)
    settleTimer = setTimeout(() => {
      stopBurst()
      marker = withMarker
      guard.refresh()
    }, BURST_DURATION_MS)
  }

  // Sessions feed: each row's running flag pairs with the previous snapshot.
  let previousRunning = new Map<string, boolean | undefined>(
    Object.entries(sessions.getSnapshot().byId).map(([id, row]) => [id, row.running]),
  )
  const unsubscribeSessions = sessions.subscribe(() => {
    const byId = sessions.getSnapshot().byId
    for (const [id, row] of Object.entries(byId)) {
      const was = previousRunning.get(id)
      const is = row.running
      if (is === true) {
        // A new turn started anywhere: any stale marker is obsolete.
        disarm()
      } else if (was === true && is === false && doc.hidden && marker !== '❓') {
        // A finished turn never downgrades a standing attention marker:
        // the agent blocking on the user outranks a completion.
        arm('✓')
      }
    }
    previousRunning = new Map(Object.entries(byId).map(([id, row]) => [id, row.running]))
  })

  // Pending-interactions feed: any NEW interaction (new session key, or a
  // replaced request key on a known session) while hidden raises ❓. Repeat
  // snapshot emissions with identical contents must not re-arm the burst.
  let previousPending = pendingKeys(pendingInteractions.getSnapshot())
  const unsubscribePending = pendingInteractions.subscribe(() => {
    const current = pendingInteractions.getSnapshot()
    const currentKeys = pendingKeys(current)
    let hasNew = currentKeys.size > previousPending.size
    if (!hasNew) {
      for (const [id, key] of currentKeys) {
        if (previousPending.get(id) !== key) { hasNew = true; break }
      }
    }
    previousPending = currentKeys
    if (hasNew && doc.hidden) arm('❓')
  })

  const onVisibility = (): void => {
    if (!doc.hidden) disarm()
  }
  doc.addEventListener('visibilitychange', onVisibility)

  return {
    dispose(): void {
      unsubscribeSessions()
      unsubscribePending()
      doc.removeEventListener('visibilitychange', onVisibility)
      stopBurst()
      marker = undefined
      disposeGuard?.()
    },
  }
}

/** Session id → stable interaction identity, across alpha1 keys and alpha2 objects. */
function pendingKeys(snapshot: ReadonlyMap<string, { key?: string }>): Map<string, unknown> {
  return new Map([...snapshot.entries()].map(([id, interaction]) => [id, interaction.key ?? interaction]))
}
