/**
 * Client-half plugin entry. The loader imports these exports and hands them
 * to the cordis registry, so the surface must satisfy the plugin contract: a
 * function or an object with an `apply` method.
 *
 * One effect installs the title controller: it owns the single title guard
 * (DOM-only) and drives its target from two feeds — the sessions list (turn
 * completions) and pending interactions (question / plan-review / approval,
 * i.e. the agent blocking on the user). Exactly one writer to
 * `document.title` — a second guard would ping-pong mutations with this one.
 *
 * The `inject` face below is the ONLY coupling to DSH: if a future DSH
 * release renames or removes either service, this fiber fails loudly at
 * activation and the plugin goes off with one remove command.
 */
import { installTitleController } from './tab-alert.ts'

interface SessionsService {
  /** The sessions-list observable feed (read face). */
  list: {
    getSnapshot(): { byId: Record<string, { running?: boolean }> }
    subscribe(listener: () => void): () => void
  }
}

interface PendingInteraction {
  readonly key?: string
  readonly kind?: string
}

interface PendingInteractionsFeed {
  getSnapshot(): ReadonlyMap<string, PendingInteraction>
  subscribe(listener: () => void): () => void
}

interface UiSessionService {
  /** Alpha1 read face. */
  pendingInteractions?: PendingInteractionsFeed
  /** Alpha2 unified Session UI status read face. */
  sessionStatus?: {
    getSnapshot(): ReadonlyMap<string, { pendingInteraction?: PendingInteraction }>
    subscribe(listener: () => void): () => void
  }
}

interface PluginContext {
  effect(apply: () => void | (() => void), label?: string): void
}

/** Services required at activation: must match the inject read below. */
export const inject = ['sessions', 'uiSession']

/** Normalize the alpha1 and alpha2 uiSession pending-interaction read faces. */
export function resolvePendingInteractions(uiSession: UiSessionService): PendingInteractionsFeed {
  if (uiSession.pendingInteractions !== undefined) return uiSession.pendingInteractions
  if (uiSession.sessionStatus !== undefined) {
    return {
      getSnapshot: () => new Map(
        [...uiSession.sessionStatus!.getSnapshot().entries()]
          .flatMap(([id, status]) => status.pendingInteraction === undefined
            ? []
            : [[id, status.pendingInteraction] as const]),
      ),
      subscribe: listener => uiSession.sessionStatus!.subscribe(listener),
    }
  }
  throw new Error('dsh-tab-title: uiSession exposes no pending-interaction feed')
}

/**
 * Start the title controller for the plugin fiber's lifetime.
 * @param ctx - client root context.
 */
export function apply(ctx: PluginContext & { sessions: SessionsService, uiSession: UiSessionService }): void {
  ctx.effect(() => {
    const controller = installTitleController(
      document,
      ctx.sessions.list,
      resolvePendingInteractions(ctx.uiSession),
    )
    return () => controller.dispose()
  }, 'tab-title: guard + completion/attention alerts')
}
