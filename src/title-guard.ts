/**
 * Title guard: keep the document title on a state-driven target, overriding
 * every later write by the host application (the per-session chat title
 * projection) via a MutationObserver on the `<title>` element. Deliberately
 * decoupled from DSH internals: it depends only on the DOM, so any upstream
 * change to how the app composes the title is caught the same way.
 *
 * The target is read through a getter on every enforcement, so the owner of
 * the guard can switch targets (idle pin ↔ completion alert) without
 * fighting this writer — there is exactly one writer to `document.title`.
 *
 * Feedback safety: the guard rewrites only when the effective text differs
 * from the target, so its own writes settle instead of looping.
 */

/** The idle (pinned) product title. */
export const TARGET = 'DeepSeek Harness'

/** Disposable handle returned by {@link pinDocumentTitle}. */
export interface TitleGuardHandle {
  /** Re-enforce the current target after the owner changed it. */
  refresh(): void
  /** Disconnect every observer and stop guarding. */
  dispose(): void
}

/**
 * Pin the document's title to `getTarget()` and keep re-applying it whenever
 * anything else writes the title.
 * @param doc - the document to guard (injected for testability).
 * @param getTarget - reads the currently enforced title (re-read per enforcement).
 * @returns a handle with refresh and dispose.
 */
export function pinDocumentTitle(doc: Document, getTarget: () => string): TitleGuardHandle {
  const enforce = (): void => {
    const target = getTarget()
    if (doc.title !== target) doc.title = target
  }

  enforce()

  const titleElement = (): HTMLTitleElement | null => doc.head.querySelector('title')
  const observers: MutationObserver[] = []

  const title = titleElement()
  if (title !== null) {
    const titleObserver = new MutationObserver(enforce)
    titleObserver.observe(title, { childList: true, characterData: true, subtree: true })
    observers.push(titleObserver)
  } else {
    // No title element yet: watch the head until one appears, then move the
    // observation onto it. DSH's index.html ships a static title, so this is
    // insurance for host pages that build the head dynamically.
    let titleObserver: MutationObserver | undefined
    const headObserver = new MutationObserver(() => {
      const lateTitle = titleElement()
      if (lateTitle === null || titleObserver !== undefined) return
      titleObserver = new MutationObserver(enforce)
      titleObserver.observe(lateTitle, { childList: true, characterData: true, subtree: true })
      observers.push(titleObserver)
      enforce()
    })
    headObserver.observe(doc.head, { childList: true })
    observers.push(headObserver)
  }

  return {
    refresh: enforce,
    dispose(): void {
      for (const observer of observers) observer.disconnect()
      observers.length = 0
    },
  }
}
