/**
 * Build-contract tests: the artifacts the DSH client-module system consumes
 * must exist and carry the loader wire format. Run after `pnpm run build`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const client = readFileSync(resolve(process.cwd(), 'lib/client.js'), 'utf8')
const nodeHalf = readFileSync(resolve(process.cwd(), 'lib/index.js'), 'utf8')

describe('lib/client.js', () => {
  it('registers itself with the module loader facade', () => {
    expect(client).toContain('window.__ModuleLoader__.load(')
  })

  it('uses the package name as the module id', () => {
    expect(client).toContain('"dsh-tab-title"')
  })

  it('returns the module exports from the factory', () => {
    expect(client).toContain('return module.exports')
  })
})

describe('lib/index.js (node half)', () => {
  it('exports an apply function for the host loader', () => {
    expect(nodeHalf).toMatch(/export\s+function\s+apply/)
  })
})
