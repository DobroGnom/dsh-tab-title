/**
 * Build script: emits the two artifacts DSH consumes.
 * - lib/client.js: the browser half, wrapped in the loader factory format
 *   the DSH client-module system serves from /plugins/<id>/client.js. The
 *   banner/footer mirror the workspace tsdown preset exactly.
 * - lib/index.js: the node half (an empty loader seat).
 */
import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'

const ID = 'dsh-tab-title'

await mkdir('lib', { recursive: true })

// Browser half → the __ModuleLoader__ factory closure.
await build({
  entryPoints: ['src/client.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  outfile: 'lib/client.js',
  sourcemap: true,
  minify: false,
  banner: {
    js: [
      `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      'var module = { exports: {} }; var exports = module.exports;',
    ].join('\n'),
  },
  footer: { js: 'return module.exports; } });' },
  logLevel: 'warning',
})

// Node half → an empty loader seat (ESM, matching the workspace lib builds).
await writeFile(
  'lib/index.js',
  '/** Host loader seat: the plugin has no host-side behavior. */\nexport function apply() {}\n',
)

console.log('built lib/client.js + lib/index.js')
