import assert from 'node:assert/strict'

const panel = await import('./panel-render.mjs')
const { route, hashChange, settle, act, remount, textOf, findHost, button, input, checkbox, detailControl, envControl, statusControl, exportControl, exportCalls, fetchLog, failEnv } = panel
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

/* Task 7 shared state and accessibility coverage. */
view = await navigateHash('#/run')
const refresh = button(view, '刷新')
assert.ok(refresh, 'shared header exposes a refresh action')
failEnv.scope = true
view = await panel.act(() => refresh.props.onClick())
text = textOf(view)
ok(text.includes('刷新当前环境失败') && text.includes('重试'), 'route failure offers retry')
ok(text.includes('当前环境'), 'shared context remains visible after a route failure')
failEnv.scope = false
failEnv.emptyMetrics = true
view = await panel.act(() => button(view, '刷新').props.onClick())
view = await navigateHash('#/metrics')
text = textOf(view)
ok(text.includes('尚未蒸馏'), 'metrics empty state explains its next action')
ok(!!findHost(view, (node) => node.props && node.props['aria-current'] === 'page'), 'active navigation is announced')
ok(!!findHost(view, (node) => node.props && node.props.id === 'dsw-main' && node.type === 'main'), 'page content uses a main landmark')
const root = findHost(view, (node) => node.props && node.props.id === 'dsw-root')
const style = findHost(view, (node) => node.type === 'style')
ok(!!root && text.includes('当前环境'), 'dark-mode fixture keeps the shared context label')
ok(!!root && root.props.style['--dsw-color-ink'] === '#14171C' && root.props.style['--dsw-color-surface'] === '#FBF9F5', 'theme token set is present on the themed root')
ok(!!style && textOf(style).includes('focus-visible') && textOf(style).includes('prefers-reduced-motion'), 'focus-visible and reduced-motion rules stay scoped')
failEnv.emptyMetrics = false
view = await panel.act(() => button(view, '刷新').props.onClick())

/* Fix round: review findings — in-place pack retry, the shell around every
   initial state, export retry preserving its mode, and per-history errors. */

/* 1. Pack detail retry refetches in place on both supported pack routes:
   navigating to the same route must not be the retry mechanism. */
detailControl.fail = true
view = await navigateHash('#/pack/fde-engineering')
text = textOf(view)
ok(text.includes('加载工作方式包失败') && text.includes('重试'), '#/pack/<id> failure surfaces the shared error state')
const packRetry = findHost(view, (node) => node.type === 'button' && textOf(node) === '重试')
detailControl.fail = false
view = await panel.act(() => packRetry.props.onClick())
text = textOf(view)
ok(text.includes('FDE 工程工作方式') && text.includes('先方案后实现'), '#/pack/<id> retry refetches the detail without navigating')
ok(route.hash === '#/pack/fde-engineering', '#/pack/<id> retry preserves the route hash')

detailControl.fail = true
view = await navigateHash('#/packs/fde-engineering')
const packsRetry = findHost(view, (node) => node.type === 'button' && textOf(node) === '重试')
detailControl.fail = false
view = await panel.act(() => packsRetry.props.onClick())
text = textOf(view)
ok(text.includes('FDE 工程工作方式') && text.includes('先方案后实现'), '#/packs/<id> retry refetches the detail without navigating')

/* 3. A failed export names the operation and retries the same export mode. */
view = await navigateHash('#/distribute')
exportControl.fail = true
view = await panel.act(() => button(view, '导出包 + 作用域快照').props.onClick())
const exportErrNode = findHost(view, (node) => node.props && node.props.role === 'alert' && textOf(node).includes('导出工作方式包失败'))
ok(!!exportErrNode && textOf(exportErrNode).includes('重试'), 'export failure names the operation with a retry action')
exportControl.fail = false
const exportRetry = exportErrNode && findHost(exportErrNode, (node) => node.type === 'button' && textOf(node) === '重试')
const exportRetryBefore = fetchLog.filter((url) => url.endsWith('/api/dsh-workstyle/export')).length
view = await panel.act(() => exportRetry.props.onClick())
const exportRetryAfter = fetchLog.filter((url) => url.endsWith('/api/dsh-workstyle/export')).length
ok(exportRetryAfter === exportRetryBefore + 1, 'export retry re-posts the export route')
ok(exportCalls[exportCalls.length - 1] && exportCalls[exportCalls.length - 1].withProject === true, 'export retry preserves the scoped mode')

/* 4. Report/export history failures explain and retry while the stale rows stay visible. */
exportControl.failReports = true
view = await panel.act(() => button(view, '刷新').props.onClick())
view = await navigateHash('#/distill')
const distillHistoryDuring = findHost(view, (node) => node.props && node.props.id === 'dsw-distill-history')
const reportsErrNode = distillHistoryDuring && findHost(distillHistoryDuring, (node) => node.props && node.props.role === 'alert')
ok(!!reportsErrNode && textOf(reportsErrNode).includes('加载报告历史失败') && textOf(reportsErrNode).includes('重试'), 'report history failure explains with retry')
ok(!!distillHistoryDuring && textOf(distillHistoryDuring).includes('report-2026-11-07.json'), 'failed report history keeps the stale metadata rows')
exportControl.failReports = false
const reportsRetry = reportsErrNode && findHost(reportsErrNode, (node) => node.type === 'button' && textOf(node) === '重试')
view = await panel.act(() => reportsRetry.props.onClick())
const distillHistoryAfter = findHost(view, (node) => node.props && node.props.id === 'dsw-distill-history')
ok(!!distillHistoryAfter && textOf(distillHistoryAfter).includes('report-2026-11-07.json') && !textOf(distillHistoryAfter).includes('加载报告历史失败'), 'report history retry restores the metadata rows')

exportControl.failHistory = true
view = await panel.act(() => button(view, '刷新').props.onClick())
view = await navigateHash('#/distribute')
const distributionHistoryDuring = findHost(view, (node) => node.props && node.props.id === 'dsw-distribution-history')
const exportsErrNode = distributionHistoryDuring && findHost(distributionHistoryDuring, (node) => node.props && node.props.role === 'alert')
ok(!!exportsErrNode && textOf(exportsErrNode).includes('加载导出历史失败') && textOf(exportsErrNode).includes('重试'), 'export history failure explains with retry')
ok(!!distributionHistoryDuring && textOf(distributionHistoryDuring).includes('fde-engineering-v0.1.0-2026-11-08T01-00-00-000Z.tar.gz'), 'failed export history keeps the stale metadata rows')
exportControl.failHistory = false
const exportsRetry = exportsErrNode && findHost(exportsErrNode, (node) => node.type === 'button' && textOf(node) === '重试')
view = await panel.act(() => exportsRetry.props.onClick())
const distributionHistoryAfter = findHost(view, (node) => node.props && node.props.id === 'dsw-distribution-history')
ok(!!distributionHistoryAfter && textOf(distributionHistoryAfter).includes('fde-engineering-v0.1.0-2026-11-08T01-00-00-000Z.tar.gz') && !textOf(distributionHistoryAfter).includes('加载导出历史失败'), 'export history retry restores the metadata rows')

/* Export success followed by a failed /exports refresh: the export result
   stands, the history error explains with retry, and rows are preserved. */
view = await navigateHash('#/distribute')
exportControl.failHistory = true
view = await panel.act(() => button(view, '导出包（仅包）').props.onClick())
const postExportHistory = findHost(view, (node) => node.props && node.props.id === 'dsw-distribution-history')
const postExportErrNode = postExportHistory && findHost(postExportHistory, (node) => node.props && node.props.role === 'alert')
ok(textOf(view).includes('已导出'), 'the export itself still reports success')
ok(!!postExportErrNode && textOf(postExportErrNode).includes('加载导出历史失败') && textOf(postExportErrNode).includes('重试'), 'failed post-export history refresh explains with retry')
ok(!!postExportHistory && textOf(postExportHistory).includes('fde-engineering-v0.1.0-2026-11-08T01-00-00-000Z.tar.gz'), 'post-export history failure keeps the previous rows')
exportControl.failHistory = false
const postExportRetry = postExportErrNode && findHost(postExportErrNode, (node) => node.type === 'button' && textOf(node) === '重试')
const exportsGetsBefore = fetchLog.filter((url) => url.endsWith('/api/dsh-workstyle/exports')).length
view = await panel.act(() => postExportRetry.props.onClick())
const exportsGetsAfter = fetchLog.filter((url) => url.endsWith('/api/dsh-workstyle/exports')).length
ok(exportsGetsAfter === exportsGetsBefore + 1, 'post-export history retry refetches /exports')
const postExportHistoryAfter = findHost(view, (node) => node.props && node.props.id === 'dsw-distribution-history')
ok(!!postExportHistoryAfter && textOf(postExportHistoryAfter).includes('fde-engineering-v0.1.0-2026-11-08T01-00-00-000Z.tar.gz') && !textOf(postExportHistoryAfter).includes('加载导出历史失败'), 'post-export history retry restores the metadata rows')

/* 2. Initial loading, initial status failure, and a status without an active
   pack all render inside the shared shell. */
route.hash = '#/run'
statusControl.delayed = true
remount()
view = await settle(2)
text = textOf(view)
ok(text.includes('正在加载工作方式状态'), 'initial loading explains itself')
ok(!!findHost(view, (node) => node.type === 'nav'), 'initial loading keeps semantic navigation')
ok(text.includes('当前环境'), 'initial loading keeps the shared context bar')
ok(!!findHost(view, (node) => node.type === 'main' && node.props && node.props.id === 'dsw-main'), 'initial loading keeps the main landmark')
ok(!!findHost(view, (node) => node.props && node.props['aria-current'] === 'page'), 'initial loading announces the active route')
const initialStyle = findHost(view, (node) => node.type === 'style')
ok(!!initialStyle && textOf(initialStyle).includes('focus-visible'), 'initial loading keeps the focus stylesheet')
statusControl.delayed = false
while (statusControl.pending.length) statusControl.pending.shift()()
view = await settle(10)
ok(textOf(view).includes('FDE 工程工作方式'), 'resolving the initial status restores the full panel')

statusControl.fail = true
remount()
view = await settle(3)
text = textOf(view)
ok(text.includes('状态加载失败') && text.includes('重试'), 'initial status failure explains and offers retry')
ok(!!findHost(view, (node) => node.type === 'nav'), 'initial status failure keeps semantic navigation')
ok(text.includes('当前环境'), 'initial status failure keeps the shared context bar')
ok(!!findHost(view, (node) => node.type === 'main' && node.props && node.props.id === 'dsw-main'), 'initial status failure keeps the main landmark')
statusControl.fail = false
const statusRetry = findHost(view, (node) => node.type === 'button' && textOf(node) === '重试')
view = await act(() => statusRetry.props.onClick())
ok(textOf(view).includes('FDE 工程工作方式'), 'retrying the initial status failure recovers the panel')

statusControl.noActive = true
remount()
view = await settle(3)
text = textOf(view)
ok(text.includes('读取当前工作方式包失败') && text.includes('重试'), 'missing active pack explains and offers retry')
ok(!!findHost(view, (node) => node.type === 'nav'), 'missing active pack keeps semantic navigation')
ok(text.includes('当前环境'), 'missing active pack keeps the shared context bar')
ok(!!findHost(view, (node) => node.type === 'main' && node.props && node.props.id === 'dsw-main'), 'missing active pack keeps the main landmark')
statusControl.noActive = false
const noActiveRetry = findHost(view, (node) => node.type === 'button' && textOf(node) === '重试')
view = await act(() => noActiveRetry.props.onClick())
ok(textOf(view).includes('FDE 工程工作方式'), 'retrying after a missing active pack recovers the panel')

console.log('\nMULTIPAGE RENDER: ' + checks + ' CHECKS PASSED')
