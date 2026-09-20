/**
 * Client-plugin contract test: both halves must satisfy the cordis plugin
 * shape — a function or an object with an `apply` method. The loader imports
 * the client entry's exports and hands them straight to registry.plugin()
 * (vendor/cordis/src/registry.ts throws «received object» otherwise), so the
 * shape is verified at the source surface, not inside the built bundle.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as clientHalf from '../src/client.ts'
import * as nodeHalf from '../src/index.ts'

/** The check registry.resolve() performs before accepting a plugin. */
function satisfiesCordisContract(mod: unknown): boolean {
  return typeof mod === 'function'
    || (typeof mod === 'object' && mod !== null && typeof (mod as { apply?: unknown }).apply === 'function')
}

describe('plugin contract', () => {
  it('client half exports a function or an object with an apply method', () => {
    expect(satisfiesCordisContract(clientHalf)).toBe(true)
  })

  it('node half exports a function or an object with an apply method', () => {
    expect(satisfiesCordisContract(nodeHalf)).toBe(true)
  })

  it('declares client service dependencies in the package manifest', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
    expect(manifest.dsh.client.inject).toEqual(clientHalf.inject)
  })

  it('adapts the alpha2 unified sessionStatus feed to pending interactions', () => {
    const interaction = { sessionId: 's1', kind: 'approval' }
    const sessionStatus = {
      getSnapshot: () => new Map([
        ['s1', { running: true, pendingInteraction: interaction, completionUnread: false }],
        ['s2', { running: false, pendingInteraction: undefined, completionUnread: false }],
      ]),
      subscribe: (_listener: () => void) => () => {},
    }

    const source = clientHalf.resolvePendingInteractions({ sessionStatus })

    expect(source.getSnapshot()).toEqual(new Map([['s1', interaction]]))
  })
})
