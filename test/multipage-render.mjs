import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const client = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
let checks = 0
function ok(condition, label) {
  checks += 1
  assert.ok(condition, label)
  console.log('  ✓ ' + label)
}

ok(client.includes("const ROUTES = new Set(['run', 'packs', 'pack'"), 'multipage router includes pack routes')
ok(client.includes("routeHash('packs', pack.id)"), 'pack list links use #/packs/<id>')
ok(client.includes("getJson('pack?id=' + encodeURIComponent(id))"), 'pack detail fetches the portable pack endpoint')
ok(client.includes('找不到工作方式包'), 'missing pack renders a recoverable message')
ok(client.includes("href: '#/packs'"), 'missing pack links back to the pack list')
ok(client.includes("'规则', selectedPack"), 'detail exposes the rules tab')
ok(client.includes("'技能', selectedPack"), 'detail exposes the skills tab')
ok(client.includes("'预设', selectedPack"), 'detail exposes the presets tab')
ok(client.includes("'模板', selectedPack"), 'detail exposes the templates tab')
ok(client.includes("'只读'"), 'bundled resources are marked read-only')
ok(client.includes("postJson('rule', { cwd, rule: normalized })"), 'rule save preserves the host write contract')
ok(client.includes("postJson('rule', { cwd, rule: { id: normalizedId }, remove: true })"), 'rule removal preserves the host write contract')
ok(client.includes("navigate({ page: 'run' })"), 'successful project edits return to the run route')
ok(client.includes("' · ' + t('fingerprint')"), 'writes surface the refreshed fingerprint')
ok(client.includes("postJson('preset', { action: 'use', preset: id, cwd })"), 'preset switching uses the existing use contract')

console.log('\nMULTIPAGE RENDER CONTRACT: ' + checks + ' CHECKS PASSED')
