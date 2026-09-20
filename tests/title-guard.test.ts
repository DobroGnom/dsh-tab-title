/**
 * Behavior tests for the title guard: the browser half must pin the document
 * title to a constant, overriding every later write by the app (the session
 * title projection), without feeding back into its own writes.
 */
import { describe, expect, it, vi } from 'vitest'
import { TARGET, pinDocumentTitle } from '../src/title-guard.ts'

/** Flush MutationObserver microtasks plus timer queues. */
async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 20))
}

function makeDoc(initialTitle: string): Document {
  document.title = initialTitle
  return document
}

describe('pinDocumentTitle', () => {
  it('exports the pinned product title constant', () => {
    expect(TARGET).toBe('DeepSeek Harness')
  })

  it('rewrites a foreign title on install', () => {
    const doc = makeDoc('Мой чат — DSH Local Build')
    const handle = pinDocumentTitle(doc, () => TARGET)
    expect(doc.title).toBe(TARGET)
    handle.dispose()
  })

  it('restores the target after a later foreign write', async () => {
    const doc = makeDoc('Первый чат')
    const handle = pinDocumentTitle(doc, () => TARGET)
    doc.title = 'Второй чат — DSH Local Build'
    await vi.waitFor(() => expect(doc.title).toBe(TARGET))
    handle.dispose()
  })

  it('re-applies across repeated foreign writes (session switches)', async () => {
    const doc = makeDoc('Чат 1')
    const handle = pinDocumentTitle(doc, () => TARGET)
    for (const foreign of ['Чат 2', 'Чат 3', 'Чат 4']) {
      doc.title = foreign
      await vi.waitFor(() => expect(doc.title).toBe(TARGET))
    }
    handle.dispose()
  })

  it('does not feed back into its own rewrite (no mutation loop)', async () => {
    const doc = makeDoc('Чат')
    const handle = pinDocumentTitle(doc, () => TARGET)
    const titleEl = doc.head.querySelector('title')!
    let mutations = 0
    const probe = new MutationObserver(() => { mutations += 1 })
    probe.observe(titleEl, { childList: true, characterData: true, subtree: true })

    doc.title = 'Чужая запись'
    await settle()
    const afterForeignWrite = mutations
    expect(afterForeignWrite).toBeGreaterThanOrEqual(1)

    // Everything settles: the foreign write happened, the guard rewrote once,
    // and the rewrite itself must not have produced further rewrites.
    await settle()
    expect(mutations).toBeLessThan(afterForeignWrite + 2)
    probe.disconnect()
    handle.dispose()
  })

  it('stops guarding after dispose', async () => {
    const doc = makeDoc('Чат')
    const handle = pinDocumentTitle(doc, () => TARGET)
    handle.dispose()
    doc.title = 'После dispose'
    await settle()
    expect(doc.title).toBe('После dispose')
  })

  it('attaches to a title element that appears after install', async () => {
    document.head.querySelector('title')?.remove()
    const doc = document
    const handle = pinDocumentTitle(doc, () => TARGET)
    doc.title = 'Поздний чат'
    await vi.waitFor(() => expect(doc.title).toBe(TARGET))
    handle.dispose()
  })

  it('re-enforces the new target after refresh()', () => {
    const doc = makeDoc('Чат')
    let target = TARGET
    const handle = pinDocumentTitle(doc, () => target)
    expect(doc.title).toBe(TARGET)
    target = '✓ DeepSeek Harness'
    handle.refresh()
    expect(doc.title).toBe('✓ DeepSeek Harness')
    handle.dispose()
  })
})
