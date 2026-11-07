/**
 * dsh-workstyle — Client half.
 *
 * A sidebar entry plus a full-width panel: active pack, rules, bundled skills,
 * local evidence sources and the distillation action. Everything reads through
 * the plugin's own exact HTTP routes, so the browser never touches the disk.
 */
window.__ModuleLoader__.load({
  id: 'dsh-workstyle',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-workstyle'

    const zh = {
      nav: '工作方式',
      eyebrow: 'WORKSTYLE AS CODE',
      title: '工作方式',
      subtitle: '把可评审的规则与技能打包，装给同事，就像你在做。',
      active: '当前生效',
      packs: '工作方式包',
      rules: '规则',
      skills: '技能',
      sources: '本地证据源',
      refresh: '刷新',
      distill: '蒸馏证据',
      distilling: '蒸馏中…',
      applying: '切换中…',
      noRules: '这个包还没有规则。',
      noSkills: '这个包没有内置技能。',
      evidence: '证据',
      severityHigh: '高',
      severityMedium: '中',
      severityLow: '低',
      generated: '最近蒸馏',
      never: '尚未蒸馏',
      apply: '应用',
      applied: '已应用',
      distilled: '蒸馏完成，报告已写入本机',
      error: '出错了',
      privacy: '只读本机数据 · 不联网 · 不上传 · 不保存 prompt 原文',
      license: '参考技能 MIT · iannil/skills',
    }
    const en = {
      nav: 'Workstyle',
      eyebrow: 'WORKSTYLE AS CODE',
      title: 'Workstyle',
      subtitle: 'A reviewable bundle of rules and skills — install it, and teammates work like you.',
      active: 'Active',
      packs: 'Packs',
      rules: 'Rules',
      skills: 'Skills',
      sources: 'Local evidence',
      refresh: 'Refresh',
      distill: 'Distill evidence',
      distilling: 'Distilling…',
      applying: 'Applying…',
      noRules: 'This pack has no rules yet.',
      noSkills: 'This pack ships no skills.',
      evidence: 'Evidence',
      severityHigh: 'high',
      severityMedium: 'medium',
      severityLow: 'low',
      generated: 'Latest distillation',
      never: 'Not distilled yet',
      apply: 'Apply',
      applied: 'Applied',
      distilled: 'Distillation finished; the report is stored locally',
      error: 'Error',
      privacy: 'Read-only local data · no network · no upload · raw prompts never stored',
      license: 'Reference skills MIT · iannil/skills',
    }

    /* ------------------------------ icons ------------------------------ */

    function Mark(props) {
      const size = (props && props.size) || 16
      return h('svg', {
        width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true,
        style: { display: 'block' },
      },
        h('path', { d: 'M20 40c0-8 5-13 12-13s12 5 12 13', fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'round' }),
        h('path', { d: 'M25 44c0-5 3-8 7-8s7 3 7 8', fill: 'none', stroke: 'currentColor', strokeWidth: 4, strokeLinecap: 'round', opacity: 0.7 }),
        h('circle', { cx: 32, cy: 19, r: 4, fill: 'currentColor' }))
    }

    /* ------------------------------ styles ----------------------------- */

    const S = {
      page: {
        minHeight: '100%', overflowY: 'auto', padding: '28px 30px 48px',
        background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)',
      },
      inner: { maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 },
      header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
      eyebrow: { fontSize: 10, letterSpacing: '0.18em', fontWeight: 700, color: 'var(--dsw-alias-brand-primary)' },
      title: { fontSize: 24, fontWeight: 700, margin: '4px 0 2px', letterSpacing: '-0.02em' },
      subtitle: { margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--dsw-alias-label-secondary)', maxWidth: '62ch' },
      toolbar: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      select: {
        font: 'inherit', fontSize: 12.5, color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 8, padding: '6px 9px', outline: 'none',
      },
      button: {
        font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, padding: '6px 12px',
      },
      buttonPrimary: {
        font: 'inherit', fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
        color: '#fff', background: 'var(--dsw-alias-brand-primary)',
        border: '1px solid transparent', borderRadius: 8, padding: '6px 13px',
      },
      card: {
        border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-1)',
        borderRadius: 14, padding: '16px 18px',
      },
      cardTitleRow: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 },
      cardTitle: { fontSize: 13.5, fontWeight: 650 },
      count: {
        fontSize: 10.5, fontWeight: 650, color: 'var(--dsw-alias-label-secondary)',
        background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 999, padding: '1px 8px',
      },
      rule: { display: 'flex', gap: 10, padding: '10px 0', borderTop: '1px solid var(--dsw-alias-border-l1)' },
      dot: (severity) => ({
        width: 7, height: 7, borderRadius: 999, marginTop: 6, flex: 'none',
        background: severity === 'high' ? 'var(--dsw-alias-state-warn-primary)'
          : severity === 'low' ? 'var(--dsw-alias-state-idle-primary)'
          : 'var(--dsw-alias-brand-primary)',
      }),
      ruleBody: { minWidth: 0 },
      ruleTitle: { fontSize: 12.5, fontWeight: 650, marginBottom: 3 },
      ruleText: { fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-primary)' },
      ruleEvidence: { fontSize: 11, lineHeight: 1.5, marginTop: 4, color: 'var(--dsw-alias-label-secondary)' },
      skill: {
        display: 'flex', flexDirection: 'column', gap: 3,
        border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-2)',
        borderRadius: 10, padding: '9px 11px',
      },
      skillName: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, fontWeight: 600 },
      skillDesc: { fontSize: 11, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)' },
      grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 },
      statRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 },
      stat: { border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 10, padding: '10px 12px' },
      statLabel: { fontSize: 10.5, color: 'var(--dsw-alias-label-secondary)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' },
      statValue: { fontSize: 12, lineHeight: 1.45, overflowWrap: 'anywhere' },
      footer: { fontSize: 10.5, color: 'var(--dsw-alias-label-secondary)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
      banner: (kind) => ({
        fontSize: 12, borderRadius: 8, padding: '8px 11px',
        background: kind === 'error' ? 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)' : 'var(--dsw-alias-bg-layer-2)',
        color: kind === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-secondary)',
        border: '1px solid var(--dsw-alias-border-l1)',
      }),
      hint: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
    }

    /* ------------------------------ panel ------------------------------ */

    function Panel(props) {
      const t = props && props.t ? props.t : (key) => key
      const [status, setStatus] = React.useState(null)
      const [busy, setBusy] = React.useState('')
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')

      const load = React.useCallback(() => {
        setError('')
        fetch('/api/dsh-workstyle/status', { headers: { accept: 'application/json' } })
          .then((response) => response.json())
          .then((data) => setStatus(data))
          .catch((err) => setError(String(err && err.message ? err.message : err)))
      }, [])

      React.useEffect(() => { load() }, [load])

      const onApply = (packId) => {
        if (!packId) return
        setBusy('apply'); setError(''); setNotice('')
        fetch('/api/dsh-workstyle/apply', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pack: packId }),
        })
          .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'apply failed')
            setStatus(data.status)
            setNotice(t('applied') + ': ' + data.applied.id)
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onDistill = () => {
        setBusy('distill'); setError(''); setNotice('')
        fetch('/api/dsh-workstyle/distill', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dshSessions: 12 }),
        })
          .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'distill failed')
            setNotice(t('distilled') + ' · ' + data.file)
            load()
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const severityLabel = (severity) => t(severity === 'high' ? 'severityHigh' : severity === 'low' ? 'severityLow' : 'severityMedium')

      if (!status) {
        return h('div', { style: S.page }, h('div', { style: S.inner },
          error ? h('div', { style: S.banner('error') }, t('error') + ': ' + error) : h('div', { style: S.hint }, '…')))
      }

      const active = status.activePack
      const latest = status.latestDistill

      return h('div', { style: S.page },
        h('div', { style: S.inner },

          h('div', { style: S.header },
            h('div', { style: { minWidth: 0 } },
              h('div', { style: S.eyebrow }, t('eyebrow')),
              h('h1', { style: S.title }, t('title')),
              h('p', { style: S.subtitle }, t('subtitle'))),
            h('div', { style: S.toolbar },
              h('select', {
                style: S.select, value: active.id, disabled: busy === 'apply',
                onChange: (event) => onApply(event.target.value),
                title: t('packs'),
              }, status.packs.map((pack) => h('option', { key: pack.id, value: pack.id },
                pack.displayName + '  v' + pack.version))),
              h('button', { style: S.button, onClick: load, disabled: !!busy }, t('refresh')),
              h('button', { style: S.buttonPrimary, onClick: onDistill, disabled: !!busy },
                busy === 'distill' ? t('distilling') : t('distill')))),

          error ? h('div', { style: S.banner('error') }, t('error') + ': ' + error) : null,
          notice ? h('div', { style: S.banner('info') }, notice) : null,

          h('div', { style: S.card },
            h('div', { style: S.cardTitleRow },
              h('span', { style: S.cardTitle }, t('active') + ' · ' + active.displayName),
              h('span', { style: S.count }, 'v' + active.version),
              h('span', { style: S.count }, active.format.toUpperCase()),
              h('span', { style: { ...S.count, marginLeft: 'auto' } },
                active.ruleCount + ' ' + t('rules') + ' / ' + active.skillCount + ' ' + t('skills'))),
            h('p', { style: { margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } }, active.description || ''),
            h('div', { style: { ...S.hint, marginTop: 8 } }, active.dir)),

          h('div', { style: S.card },
            h('div', { style: S.cardTitleRow },
              h('span', { style: S.cardTitle }, t('rules')),
              h('span', { style: S.count }, String(active.ruleCount))),
            active.ruleCount === 0 ? h('div', { style: S.hint }, t('noRules')) : null,
            (status.rules || []).map((rule, index) => h('div', { key: rule.id, style: index === 0 ? { ...S.rule, borderTop: 'none' } : S.rule },
              h('span', { style: S.dot(rule.severity), title: severityLabel(rule.severity) }),
              h('div', { style: S.ruleBody },
                h('div', { style: S.ruleTitle }, rule.title),
                h('div', { style: S.ruleText }, rule.text),
                rule.evidence ? h('div', { style: S.ruleEvidence }, t('evidence') + ' · ' + rule.evidence) : null)))),

          h('div', { style: S.card },
            h('div', { style: S.cardTitleRow },
              h('span', { style: S.cardTitle }, t('skills')),
              h('span', { style: S.count }, String(active.skillCount)),
              h('span', { ...S.hint, marginLeft: 'auto' }, t('license'))),
            active.skillCount === 0 ? h('div', { style: S.hint }, t('noSkills')) : null,
            h('div', { style: S.grid }, (status.skills || []).map((skill) => h('div', { key: skill.name, style: S.skill },
              h('div', { style: S.skillName }, skill.name),
              h('div', { style: S.skillDesc }, skill.description || ''))))),

          h('div', { style: S.card },
            h('div', { style: S.cardTitleRow },
              h('span', { style: S.cardTitle }, t('sources')),
              h('span', { style: { ...S.count, marginLeft: 'auto' } },
                t('generated') + ': ' + (latest ? new Date(latest.generatedAt).toLocaleString() : t('never')))),
            h('div', { style: S.statRow },
              h('div', { style: S.stat },
                h('div', { style: S.statLabel }, 'Claude Code'),
                h('div', { style: S.statValue }, status.sources.claude)),
              h('div', { style: S.stat },
                h('div', { style: S.statLabel }, 'Codex'),
                h('div', { style: S.statValue }, status.sources.codex)),
              h('div', { style: S.stat },
                h('div', { style: S.statLabel }, 'DeepSeek Harness'),
                h('div', { style: S.statValue }, status.sources.dsh)),
              h('div', { style: S.stat },
                h('div', { style: S.statLabel }, 'Pi'),
                h('div', { style: S.statValue }, status.sources.pi)))),

          h('div', { style: S.footer },
            h('span', null, t('privacy')),
            h('span', null, 'dsh-workstyle v' + status.plugin.version))))
    }

    /* ------------------------------- apply ----------------------------- */

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-workstyle: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: NS,
        locale: NS,
        inject: () => ({ t }),
      }, () => h(Panel, { t })))

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: NS,
        order: 6,
        label: () => t('nav'),
        locale: NS,
      }, (owner) => h(Mark, { size: owner && owner.size ? owner.size : 16 })))
    }

    return { name: NS, inject: ['slots', 'locale'], apply }
  },
})
