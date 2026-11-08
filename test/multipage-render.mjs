import assert from 'node:assert/strict'

const panel = await import('./panel-render.mjs')
const { route, hashChange, settle, textOf, findHost, button, input, checkbox, detailControl, envControl, statusControl, fetchLog, failEnv } = panel
let checks = 0
function ok(condition, label) {
  checks += 1
  assert.ok(condition, label)
  console.log('  ✓ ' + label)
}

const navigateHash = async (hash) => {
  route.hash = hash
  hashChange()
  return settle(10)
}

/* Actual React-shim mounting with a delayed detail response. The old detail
   must disappear synchronously when the requested id changes. */
detailControl.delayed = false
let view = await navigateHash('#/packs/fde-engineering')
let text = textOf(view)
ok(text.includes('FDE 工程工作方式'), 'pack A detail mounts through the React shim')
ok(text.includes('只读') || text.includes('规则 > 预设（组合）> 技能 > 模板'), 'built-in resources expose the read-only boundary')
ok(!!findHost(view, (node) => node.props && node.props.role === 'tablist'), 'pack detail tabs expose tablist semantics')
ok(!!findHost(view, (node) => node.props && node.props.role === 'tab' && node.props['aria-selected'] === 'true' && node.props['aria-controls']), 'active pack detail tab exposes selection and panel linkage')

// B is delayed: route identity must prevent A content from leaking while B loads.
detailControl.delayed = true
view = await navigateHash('#/packs/minimal')
text = textOf(view)
ok(!text.includes('FDE 交付') && !text.includes('规则正文-先方案'), 'A content is hidden while B detail is pending')
ok(text.includes('正在加载工作方式包') || text.includes('极简工作方式'), 'B route shows loading or its own summary while pending')
const resolveB = detailControl.pending.shift()
assert.ok(resolveB, 'B detail request was captured')
detailControl.delayed = false
resolveB()
view = await settle(10)
text = textOf(view)
ok(text.includes('极简工作方式') && text.includes('极简规则 B'), 'B detail replaces A after its response resolves')
ok(!text.includes('FDE 交付'), 'B detail has no stale A preset content')

// A missing id is delayed, then returns 404: stale B must not suppress recovery.
detailControl.delayed = true
view = await navigateHash('#/packs/missing-pack')
text = textOf(view)
ok(!text.includes('极简规则 B') && !text.includes('B 包预设'), 'B content is hidden while the missing detail is pending')
const resolveMissing = detailControl.pending.shift()
assert.ok(resolveMissing, 'missing detail request was captured')
detailControl.delayed = false
resolveMissing()
view = await settle(10)
text = textOf(view)
ok(text.includes('找不到工作方式包：missing-pack'), 'missing detail renders a recoverable error')
ok(!!findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/packs'), 'missing detail links back to #/packs')

/* Environment responses are also generation-guarded. Resolve project A late
   after project B has become current; B must remain visible. */
envControl.delayed = true
panel.hostContext.cwd = '/tmp/project-a'
view = await navigateHash('#/run')
const resolveScopeA = envControl.pending.shift()
assert.ok(resolveScopeA, 'project A scope request was captured')
panel.hostContext.cwd = '/tmp/project-b'
view = await navigateHash('#/packs')
const resolveScopeB = envControl.pending.shift()
assert.ok(resolveScopeB, 'project B scope request was captured')
envControl.delayed = false
resolveScopeB()
view = await settle(10)
ok(textOf(view).includes('/tmp/project-b'), 'current project B environment wins when it resolves first')
resolveScopeA()
view = await settle(10)
ok(textOf(view).includes('/tmp/project-b') && !textOf(view).includes('/tmp/project-a'), 'late project A environment cannot overwrite B')

/* A stale status response must not call its captured A loadEnv after B is current. */
statusControl.delayed = true
envControl.delayed = true
panel.hostContext.cwd = '/tmp/status-a'
view = await navigateHash('#/run')
const resolveStatusA = statusControl.pending.shift()
assert.ok(resolveStatusA, 'project A status request was captured')
panel.hostContext.cwd = '/tmp/status-b'
view = await navigateHash('#/packs')
const resolveStatusB = statusControl.pending.shift()
assert.ok(resolveStatusB, 'project B status request was captured')
statusControl.delayed = false
resolveStatusB()
view = await settle(10)
const resolveStatusEnvB = envControl.pending.shift()
assert.ok(resolveStatusEnvB, 'project B status started a B environment request')
envControl.delayed = false
resolveStatusEnvB()
view = await settle(10)
resolveStatusA()
view = await settle(10)
ok(textOf(view).includes('/tmp/status-b') && envControl.pending.length === 0, 'late project A status cannot start an old environment load')

// Existing active route behavior remains available after recovery.
view = await navigateHash('#/packs/fde-engineering')
const newRule = button(view, '新建规则')
ok(!!newRule, 'active pack retains project rule editing')
view = await panel.act(() => newRule.props.onClick())
view = await panel.act(() => button(view, '保存').props.onClick())
ok(textOf(view).includes('不能为空'), 'empty project rule is rejected before posting')
const idField = input(view, 'my-project-rule')
const titleField = input(view, '标题')
const textField = findHost(view, (node) => node.type === 'textarea' && node.props && node.props.placeholder === '正文')
view = await panel.act(() => idField.props.onChange({ target: { value: 'mp-project-rule' } }))
view = await panel.act(() => input(view, '标题').props.onChange({ target: { value: '多页项目规则' } }))
view = await panel.act(() => findHost(view, (node) => node.type === 'textarea' && node.props && node.props.placeholder === '正文').props.onChange({ target: { value: '项目规则正文' } }))
view = await panel.act(() => button(view, '保存').props.onClick())
text = textOf(view)
ok(text.includes('规则已保存到项目叠层') && text.includes('指纹'), 'project rule save refreshes and reports its fingerprint')
ok(text.includes('mp-project-rule') || text.includes('多页项目规则'), 'saved project rule remains visible in the refreshed scope')
view = await navigateHash('#/packs/fde-engineering')
const remove = button(view, '移除')
ok(!!remove, 'project rule exposes remove action')
view = await panel.act(() => remove.props.onClick())
ok(textOf(view).includes('规则已从项目叠层移除'), 'project rule removal refreshes the environment')
view = await navigateHash('#/packs/fde-engineering')
const writingPreset = findHost(view, (node) => node.type === 'button' && textOf(node).includes('写书'))
ok(!!writingPreset, 'preset switch is available on the active pack page')
view = await panel.act(() => writingPreset.props.onClick())
ok(textOf(view).includes('写书') && textOf(view).includes('指纹'), 'preset switch refreshes and reports the fingerprint')

/* Dedicated analysis pages: real route mounts and click handlers. */
view = await navigateHash('#/distill')
text = textOf(view)
ok(text.includes('蒸馏审阅'), 'distill page has an explicit heading')
ok(text.includes('本地数据') && text.includes('不保存 prompt 原文'), 'distill page states privacy boundary')
ok(text.includes('建议审阅') && text.includes('报告历史'), 'distill page separates review from report history')
const scan = button(view, '蒸馏证据')
ok(!!scan, 'distill page exposes a scan action')
view = await panel.act(() => scan.props.onClick())
ok(textOf(view).includes('蒸馏完成'), 'distill scan interaction refreshes the report')
view = await navigateHash('#/metrics')
text = textOf(view)
ok(text.includes('规则命中') && text.includes('先方案率'), 'metrics page renders proxy metrics')
ok(text.includes('公式') && text.includes('分母'), 'metrics page shows metric definitions')
ok(!text.includes('遵守率') && !text.includes('违反率'), 'metrics page avoids unsupported compliance claims')
ok(text.includes('较上次 +0.6%'), 'plan-rate card renders its baseline delta from metrics.baseline.planRate')
ok(text.includes('较上次 -0.2%'), 'verify-rate card renders its negative baseline delta from metrics.baseline.verifyRate')
const metricPill = findHost(view, (node) => node.type === 'button' && textOf(node) === '度量')
ok(metricPill && metricPill.props['aria-pressed'] === 'true', 'metric pill exposes aria-pressed=true')
const sourcePill = findHost(view, (node) => node.type === 'button' && textOf(node) === '来源')
ok(sourcePill && sourcePill.props['aria-pressed'] === 'false', 'source pill exposes aria-pressed=false')
view = await panel.act(() => sourcePill.props.onClick())
const pressedSource = findHost(view, (node) => node.type === 'button' && textOf(node) === '来源' && node.props['aria-pressed'] === 'true')
ok(!!pressedSource, 'sources pill becomes pressed after switching')

/* Distribution page: explicit export modes, install command, metadata-only history. */
view = await navigateHash('#/distribute')
text = textOf(view)
ok(text.includes('导出包 + 作用域快照'), 'distribution page offers scoped export')
ok(text.includes('导出包（仅包）'), 'distribution page offers pack-only export')
ok(text.includes('复制安装命令'), 'distribution page offers install command copy')
ok(text.includes('最近导出'), 'distribution page lists export history')
ok(fetchLog.some((url) => url.includes('/api/dsh-workstyle/exports')), 'distribution page refresh loads export metadata')
ok(!text.includes('先给方案') && !text.includes('规则正文'), 'distribution history carries no rule, report or archive contents')
const exportsBefore = fetchLog.filter((url) => url.endsWith('/api/dsh-workstyle/export')).length
view = await panel.act(() => button(view, '导出包（仅包）').props.onClick())
const exportsAfter = fetchLog.filter((url) => url.endsWith('/api/dsh-workstyle/export')).length
ok(exportsAfter === exportsBefore + 1, 'distribution export posts to the export route')

/* Fix round 1: distill history, revoke, and the adopt selection contract. */
view = await navigateHash('#/distill')
text = textOf(view)
const historySection = findHost(view, (node) => node.props && node.props.id === 'dsw-distill-history')
ok(!!historySection && textOf(historySection).includes('report-2026-11-07.json'), 'report history lists metadata rows')
ok(!!historySection && textOf(historySection).includes('2 条建议'), 'report history shows suggestion counts')
ok(!!historySection && !textOf(historySection).includes('正文') && !textOf(historySection).includes('先给方案'), 'report history carries no report body or prompt text')
ok(fetchLog.some((url) => url.includes('/api/dsh-workstyle/reports')), 'distill page refresh loads report metadata')

const showHandled = button(view, '查看已处理')
ok(!!showHandled, 'distill page exposes handled suggestions')
view = await panel.act(() => showHandled.props.onClick())
const revoke = findHost(view, (node) => node.type === 'button' && textOf(node) === '撤销')
ok(!!revoke, 'handled suggestion exposes a revoke action on the distill page')
const unadoptBefore = fetchLog.filter((url) => url.includes('/api/dsh-workstyle/unadopt')).length
view = await panel.act(() => revoke.props.onClick())
const unadoptAfter = fetchLog.filter((url) => url.includes('/api/dsh-workstyle/unadopt')).length
ok(unadoptAfter === unadoptBefore + 1, 'revoke posts the existing unadopt route')

const select = checkbox(view, '中文短句')
ok(!!select, 'pending suggestion exposes a labeled selection checkbox')
view = await panel.act(() => select.props.onChange({ target: {} }))
failEnv.adopt = true
const rejectedAdopt = findHost(view, (node) => node.type === 'button' && textOf(node).includes('采纳选中'))
view = await panel.act(() => rejectedAdopt.props.onClick())
text = textOf(view)
ok(text.includes('adopt rejected'), 'rejected adopt reports the failure')
const keptBox = checkbox(view, '中文短句')
ok(keptBox && keptBox.props.checked === true, 'selection survives a rejected adopt')
failEnv.adopt = false
const retryAdopt = findHost(view, (node) => node.type === 'button' && textOf(node).includes('采纳选中'))
view = await panel.act(() => retryAdopt.props.onClick())
text = textOf(view)
ok(text.includes('已采纳建议规则'), 'successful adopt reports its notice')
ok(!checkbox(view, '中文短句'), 'successful adopt clears the selection from the pending queue')

console.log('\nMULTIPAGE RENDER: ' + checks + ' CHECKS PASSED')
