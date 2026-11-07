/**
 * dsh-workstyle — Client half.
 *
 * A sidebar entry plus a full-width panel: the active pack, its rules, the
 * distillation review queue, bundled skills and the local evidence the pack was
 * distilled from. Everything reads through the plugin's own HTTP routes, so the
 * browser never touches the disk.
 */
window.__ModuleLoader__.load({
  id: 'dsh-workstyle',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-workstyle'

    /* ----------------------------- brand tokens ---------------------------- */

    const INK = '#14171c'
    const PAPER = '#f4f0e8'
    const AMBER = '#d7913a'

    const isDark = (() => {
      try {
        let el = document.body
        while (el) {
          const color = getComputedStyle(el).backgroundColor
          const match = color && color.match(/rgba?\(([^)]+)\)/)
          if (match) {
            const parts = match[1].split(/[,\s/]+/).filter(Boolean)
            const alpha = parts.length > 3 ? parseFloat(parts[3]) : 1
            if (alpha > 0.1) {
              const [r, g, b] = parts.map(Number)
              return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 128
            }
          }
          el = el.parentElement
        }
        return false
      } catch (err) {
        return false
      }
    })()

    const ACCENT = isDark ? '#e3a660' : '#95550f'
    const ACCENT_LINE = isDark ? 'rgba(227,166,96,0.55)' : 'rgba(149,85,15,0.45)'
    const ACCENT_SOFT = isDark ? 'rgba(227,166,96,0.16)' : 'rgba(149,85,15,0.09)'
    const HAIRLINE = 'var(--dsw-alias-border-l1)'
    const PRIMARY_BG = isDark ? PAPER : INK
    const PRIMARY_FG = isDark ? INK : PAPER

    /* ------------------------------ dictionaries --------------------------- */

    const zh = {
      nav: '工作方式',
      eyebrow: 'WORKSTYLE AS CODE',
      title: '工作方式',
      subtitle: '把可评审的规则与技能打包，装给同事，就像你在做。',
      coverLabel: '当前生效',
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
      review: '蒸馏建议',
      reviewHint: '勾选建议规则并采纳进当前包；采纳的规则会进入系统提示、随包导出，也可随时撤销。',
      adoptSelected: '采纳选中',
      adoptAll: '全部采纳',
      adopting: '采纳中…',
      adoptedNotice: '已采纳建议规则',
      adoptedLabel: '蒸馏采纳',
      presentLabel: '已在包内',
      unadopt: '撤销',
      noSuggestions: '还没有可审阅的建议。先点「蒸馏证据」扫一次本机会话。',
      allPresent: '本次建议已全部在包内，暂无需要采纳的条目。',
      export: '导出包',
      exporting: '导出中…',
      exported: '已导出',
      confidence: '置信度',
      customCount: '条本地采纳',
      showAll: '展开全部',
      showLess: '收起',
      skillsLicense: '参考技能 MIT · iannil/skills',
      promptUnit: '条 prompt',
      chineseUnit: '条中文',
      planUnit: '条方案词',
      sessionUnit: '个会话',
      toolCallsUnit: '次工具调用',
      messagesUnit: '条消息',
      sampled: '采样',
      evidenceHint: '点「蒸馏证据」扫描本机会话，生成可审阅的聚合报告（不保存原文）。',
      sourcesHint: '数据源路径',
    }
    const en = {
      nav: 'Workstyle',
      eyebrow: 'WORKSTYLE AS CODE',
      title: 'Workstyle',
      subtitle: 'A reviewable bundle of rules and skills — install it, and teammates work like you.',
      coverLabel: 'Active',
      packs: 'Packs',
      rules: 'Rules',
      skills: 'Skills',
      sources: 'Local evidence',
      refresh: 'Refresh',
      distill: 'Distill evidence',
      distilling: 'Distilling…',
      applying: 'Switching…',
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
      review: 'Distillation review',
      reviewHint: 'Tick suggested rules to adopt them into the active pack. Adopted rules join the system prompt, travel with exports, and can be revoked any time.',
      adoptSelected: 'Adopt selected',
      adoptAll: 'Adopt all',
      adopting: 'Adopting…',
      adoptedNotice: 'Adopted suggested rules',
      adoptedLabel: 'adopted',
      presentLabel: 'already in pack',
      unadopt: 'Revoke',
      noSuggestions: 'Nothing to review yet. Run "Distill evidence" first.',
      allPresent: 'Every suggestion is already in the pack — nothing to adopt right now.',
      export: 'Export pack',
      exporting: 'Exporting…',
      exported: 'Exported',
      confidence: 'confidence',
      customCount: 'local adoption(s)',
      showAll: 'Show all',
      showLess: 'Collapse',
      skillsLicense: 'Reference skills MIT · iannil/skills',
      promptUnit: 'prompts',
      chineseUnit: 'in Chinese',
      planUnit: 'plan keywords',
      sessionUnit: 'sessions',
      toolCallsUnit: 'tool calls',
      messagesUnit: 'messages',
      sampled: 'sampled',
      evidenceHint: 'Run "Distill evidence" to scan local sessions into a reviewable aggregate report (raw prompts are never stored).',
      sourcesHint: 'Source paths',
    }

    /* -------------------------------- icons -------------------------------- */

    function BrandMark(props) {
      const size = (props && props.size) || 40
      return h('svg', {
        width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true,
        style: { display: 'block', flex: 'none' },
      },
        h('rect', { x: 1, y: 1, width: 62, height: 62, rx: 16, fill: INK }),
        h('rect', { x: 6, y: 6, width: 52, height: 52, rx: 11, fill: 'none', stroke: AMBER, strokeWidth: 2.2 }),
        h('path', {
          d: 'M19 22 L25 42 L32 30 L39 42 L45 22', fill: 'none', stroke: PAPER,
          strokeWidth: 5.2, strokeLinecap: 'round', strokeLinejoin: 'round',
        }))
    }

    function Mark(props) {
      const size = (props && props.size) || 16
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true,
        style: { display: 'block' },
      },
        h('rect', {
          x: 3, y: 3, width: 18, height: 18, rx: 5,
          fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, opacity: 0.85,
        }),
        h('path', {
          d: 'M7.4 8.2 L9.8 16 L12 11.4 L14.2 16 L16.6 8.2',
          fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
          strokeLinecap: 'round', strokeLinejoin: 'round',
        }))
    }

    /* -------------------------------- helpers ------------------------------ */

    const nf = (value) => (typeof value === 'number' ? value.toLocaleString('en-US') : String(value === undefined || value === null ? '—' : value))

    const when = (iso) => {
      if (!iso) return ''
      try {
        const date = new Date(iso)
        if (Number.isNaN(date.getTime())) return String(iso)
        return date.toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      } catch (err) {
        return String(iso)
      }
    }

    /* -------------------------------- styles ------------------------------- */

    const S = {
      page: {
        minHeight: '100%', overflowY: 'auto',
        background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)',
      },
      inner: {
        maxWidth: 1060, margin: '0 auto', padding: '32px 34px 56px',
        display: 'flex', flexDirection: 'column', gap: 26,
      },

      header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' },
      brandRow: { display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 },
      eyebrow: {
        fontSize: 9.5, letterSpacing: '0.24em', fontWeight: 700,
        color: ACCENT, textTransform: 'uppercase',
      },
      title: {
        margin: '3px 0 0', fontSize: 25, fontWeight: 700,
        letterSpacing: '-0.022em', lineHeight: 1.15,
      },
      subtitle: {
        margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.6,
        color: 'var(--dsw-alias-label-secondary)', maxWidth: '56ch',
      },
      toolbar: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      select: {
        font: 'inherit', fontSize: 12.5, color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid ' + HAIRLINE,
        borderRadius: 8, padding: '7px 9px', outline: 'none',
      },
      button: {
        font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid ' + HAIRLINE, borderRadius: 8, padding: '7px 13px',
        opacity: 1,
      },
      buttonPrimary: {
        font: 'inherit', fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
        color: PRIMARY_FG, background: PRIMARY_BG,
        border: '1px solid ' + PRIMARY_BG, borderRadius: 8, padding: '7px 15px',
      },
      disabled: { opacity: 0.45, cursor: 'default' },

      cover: {
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '2px 0 16px 18px', borderLeft: '2px solid ' + ACCENT_LINE,
        borderBottom: '1px solid ' + HAIRLINE,
      },
      coverTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
      coverLabel: {
        fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 700,
        color: 'var(--dsw-alias-label-secondary)', textTransform: 'uppercase',
      },
      coverNameRow: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 4 },
      coverName: { fontSize: 16.5, fontWeight: 650, letterSpacing: '-0.01em' },
      chip: {
        fontSize: 10.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)',
        border: '1px solid ' + HAIRLINE, borderRadius: 999, padding: '0 7px',
        fontVariantNumeric: 'tabular-nums',
      },
      badge: {
        fontSize: 10, lineHeight: 1.7, fontWeight: 650, color: ACCENT,
        background: ACCENT_SOFT, border: '1px solid ' + ACCENT_LINE,
        borderRadius: 999, padding: '0 7px',
      },
      coverDesc: {
        margin: '2px 0 0', fontSize: 12.5, lineHeight: 1.65,
        color: 'var(--dsw-alias-label-secondary)', maxWidth: '82ch',
      },
      metaRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      mono: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
      },
      metaDot: { opacity: 0.5 },

      section: { display: 'flex', flexDirection: 'column' },
      sectionHead: {
        display: 'flex', alignItems: 'baseline', gap: 10,
        paddingBottom: 9, borderBottom: '1px solid ' + HAIRLINE,
      },
      sectionLabel: {
        fontSize: 10.5, letterSpacing: '0.18em', fontWeight: 700,
        textTransform: 'uppercase', color: 'var(--dsw-alias-label-secondary)',
      },
      sectionCount: {
        fontSize: 10.5, color: 'var(--dsw-alias-label-secondary)',
        fontVariantNumeric: 'tabular-nums',
      },
      sectionRight: { marginLeft: 'auto', fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },

      rule: {
        display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) auto', gap: 14,
        padding: '14px 0', borderBottom: '1px solid ' + HAIRLINE,
      },
      ruleIndex: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 10.5, color: 'var(--dsw-alias-label-secondary)', paddingTop: 3,
        fontVariantNumeric: 'tabular-nums',
      },
      ruleTitleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      ruleTitle: { fontSize: 13, fontWeight: 650, letterSpacing: '-0.005em' },
      ruleText: { fontSize: 12.5, lineHeight: 1.65, marginTop: 4 },
      ruleEvidence: { fontSize: 11.5, lineHeight: 1.55, marginTop: 5, color: 'var(--dsw-alias-label-secondary)' },
      ruleSide: { display: 'flex', alignItems: 'center', gap: 6, paddingTop: 3 },
      ruleSideText: { fontSize: 10, letterSpacing: '0.06em', color: 'var(--dsw-alias-label-secondary)' },
      dot: (severity) => ({
        width: 6, height: 6, borderRadius: 999, flex: 'none',
        background: severity === 'high' ? 'var(--dsw-alias-state-warn-primary)'
          : severity === 'low' ? 'var(--dsw-alias-label-secondary)'
          : ACCENT,
      }),
      linkButton: {
        font: 'inherit', fontSize: 11, color: 'var(--dsw-alias-label-secondary)',
        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
        textDecoration: 'underline', textUnderlineOffset: 2,
      },

      hint: { fontSize: 11.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' },
      empty: { padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 8 },

      reviewRow: {
        display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr) auto', gap: 12,
        padding: '13px 0', borderBottom: '1px solid ' + HAIRLINE, alignItems: 'start',
      },
      checkbox: { margin: '3px 0 0', accentColor: ACCENT, width: 13, height: 13 },
      lockMark: {
        fontSize: 11.5, lineHeight: '18px', height: 18, textAlign: 'center',
        color: ACCENT, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      reviewIdRow: { display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' },
      reviewId: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10.5,
        color: 'var(--dsw-alias-label-secondary)',
      },
      reviewTitle: { fontSize: 12.5, fontWeight: 650 },
      reviewState: { fontSize: 10.5, color: 'var(--dsw-alias-label-secondary)' },
      actions: { display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end', flexWrap: 'wrap' },

      skillsGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        columnGap: 28, rowGap: 0,
      },
      skill: { padding: '10px 0', borderBottom: '1px solid ' + HAIRLINE, minWidth: 0 },
      skillName: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11, fontWeight: 600, marginBottom: 3,
      },
      skillDesc: {
        fontSize: 11, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      },

      evidenceGrid: { display: 'flex', flexWrap: 'wrap', gap: '18px 38px', padding: '16px 0 18px' },
      stat: { minWidth: 140, display: 'flex', flexDirection: 'column', gap: 2 },
      statLabel: {
        fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
        color: 'var(--dsw-alias-label-secondary)',
      },
      statValue: { fontSize: 21, fontWeight: 650, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 },
      statUnit: { fontSize: 11, fontWeight: 400, color: 'var(--dsw-alias-label-secondary)', marginLeft: 4, letterSpacing: 0 },
      statSub: { fontSize: 10.5, color: 'var(--dsw-alias-label-secondary)' },

      sourceList: { display: 'flex', flexDirection: 'column', gap: 5, padding: '14px 0 4px' },
      sourceRow: { display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: 12, alignItems: 'baseline' },
      sourceName: { fontSize: 11, fontWeight: 600 },
      sourcePath: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10.5,
        color: 'var(--dsw-alias-label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      },

      footer: {
        display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        borderTop: '1px solid ' + HAIRLINE, paddingTop: 14,
        fontSize: 10.5, color: 'var(--dsw-alias-label-secondary)',
      },
      banner: (kind) => ({
        fontSize: 12, lineHeight: 1.55, borderRadius: 8, padding: '9px 12px',
        border: '1px solid ' + (kind === 'error' ? 'var(--dsw-alias-state-error-primary)' : HAIRLINE),
        color: kind === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-secondary)',
        background: kind === 'error' ? 'transparent' : 'var(--dsw-alias-bg-layer-2)',
      }),
      skeleton: {
        background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 6, border: '1px solid ' + HAIRLINE,
      },
    }

    /* ----------------------------- sub components --------------------------- */

    function Section(props) {
      const { label, count, right, children } = props
      return h('section', { style: S.section },
        h('div', { style: S.sectionHead },
          h('span', { style: S.sectionLabel }, label),
          count === undefined || count === null ? null : h('span', { style: S.sectionCount }, String(count)),
          right ? h('span', { style: S.sectionRight }, right) : null),
        children)
    }

    function Loading() {
      return h('div', { style: S.page },
        h('div', { style: S.inner },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
            h('div', { style: { ...S.skeleton, width: 44, height: 44, borderRadius: 14 } }),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              h('div', { style: { ...S.skeleton, width: 128, height: 9 } }),
              h('div', { style: { ...S.skeleton, width: 220, height: 21 } }),
              h('div', { style: { ...S.skeleton, width: 320, height: 11 } }))),
          h('div', { style: { ...S.skeleton, height: 74, borderRadius: 10 } }),
          h('div', { style: { ...S.skeleton, height: 26, width: '40%' } }),
          h('div', { style: { ...S.skeleton, height: 180, borderRadius: 10 } })))
    }

    /* --------------------------------- panel ------------------------------- */

    function Panel(props) {
      const t = props && props.t ? props.t : (key) => key
      const [status, setStatus] = React.useState(null)
      const [report, setReport] = React.useState(null)
      const [busy, setBusy] = React.useState('')
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [selected, setSelected] = React.useState([])
      const [showAllSkills, setShowAllSkills] = React.useState(false)

      const load = React.useCallback(() => {
        setError('')
        fetch('/api/dsh-workstyle/status', { headers: { accept: 'application/json' } })
          .then((response) => response.json())
          .then((data) => {
            setStatus(data)
            if (data && data.latestDistill) {
              fetch('/api/dsh-workstyle/evidence', { headers: { accept: 'application/json' } })
                .then((response) => (response.ok ? response.json() : null))
                .then((evidence) => { if (evidence) setReport(evidence) })
                .catch(() => {})
            }
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
      }, [])

      React.useEffect(() => { load() }, [load])

      const call = (path, body) => fetch('/api/dsh-workstyle/' + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then((response) => response.json().then((data) => ({ ok: response.ok, data })))

      const onApply = (packId) => {
        if (!packId) return
        setBusy('apply'); setError(''); setNotice('')
        call('apply', { pack: packId })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'apply failed')
            setStatus(data.status)
            setNotice(t('applied') + ' · ' + data.applied.id)
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onDistill = () => {
        setBusy('distill'); setError(''); setNotice('')
        call('distill', { dshSessions: 12 })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'distill failed')
            setNotice(t('distilled') + ' · ' + data.file)
            setReport(null)
            load()
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const toggleRule = (id) => {
        setSelected((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
      }

      const onAdopt = (all) => {
        const ruleIds = all ? [] : selected
        if (!all && ruleIds.length === 0) return
        setBusy('adopt'); setError(''); setNotice('')
        call('adopt', all ? { all: true } : { ruleIds })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'adopt failed')
            setStatus(data.status)
            setSelected([])
            setNotice(t('adoptedNotice') + ' · ' + data.added.length +
              (data.skipped && data.skipped.length ? ' · ' + data.skipped.length + ' skipped' : ''))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onUnadopt = (ruleId) => {
        setBusy('unadopt'); setError(''); setNotice('')
        call('unadopt', { ruleId })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'unadopt failed')
            setStatus(data.status)
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onExport = () => {
        setBusy('export'); setError(''); setNotice('')
        call('export', {})
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'export failed')
            setNotice(t('exported') + ' · ' + data.file)
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const severityLabel = (severity) => t(severity === 'high' ? 'severityHigh' : severity === 'low' ? 'severityLow' : 'severityMedium')

      if (!status) {
        if (error) {
          return h('div', { style: S.page },
            h('div', { style: S.inner }, h('div', { style: S.banner('error') }, t('error') + ' · ' + error)))
        }
        return h(Loading, null)
      }

      const active = status.activePack
      const latest = status.latestDistill
      const packs = status.packs || []
      const rules = status.rules || []
      const suggestions = status.suggestions || []
      const skills = status.skills || []
      const adoptions = status.adoptions || []
      const sources = status.sources || {}

      if (!active) {
        return h('div', { style: S.page },
          h('div', { style: S.inner }, h('div', { style: S.banner('error') }, t('error') + ' · no active pack')))
      }

      /* ------------------------------ rule rows ----------------------------- */

      const ruleRows = rules.map((rule, index) => h('div', { key: rule.id, style: S.rule },
        h('span', { style: S.ruleIndex }, String(index + 1).padStart(2, '0')),
        h('div', { style: { minWidth: 0 } },
          h('div', { style: S.ruleTitleRow },
            h('span', { style: S.ruleTitle }, rule.title),
            rule.source === 'distilled' ? h('span', { style: S.badge }, t('adoptedLabel')) : null,
            rule.source === 'distilled'
              ? h('button', {
                style: busy ? { ...S.linkButton, opacity: 0.45, cursor: 'default' } : S.linkButton,
                disabled: !!busy, onClick: () => onUnadopt(rule.id),
              }, t('unadopt'))
              : null),
          h('div', { style: S.ruleText }, rule.text),
          rule.evidence ? h('div', { style: S.ruleEvidence }, t('evidence') + ' · ' + rule.evidence) : null),
        h('div', { style: S.ruleSide },
          h('span', { style: S.dot(rule.severity) }),
          h('span', { style: S.ruleSideText }, severityLabel(rule.severity)))))

      /* ---------------------------- review rows ----------------------------- */

      const allLocked = suggestions.length > 0 && suggestions.every((rule) => rule.adopted || rule.present)
      const reviewRows = suggestions.map((rule) => {
        const locked = rule.adopted || rule.present
        return h('label', { key: rule.id, style: locked ? { ...S.reviewRow, opacity: 0.55, cursor: 'default' } : { ...S.reviewRow, cursor: 'pointer' } },
          locked
            ? h('span', { style: S.lockMark, 'aria-hidden': true }, '✓')
            : h('input', {
              type: 'checkbox', style: S.checkbox, disabled: !!busy,
              checked: selected.includes(rule.id),
              onChange: () => toggleRule(rule.id),
            }),
          h('div', { style: { minWidth: 0 } },
            h('div', { style: S.reviewIdRow },
              h('span', { style: S.reviewId }, rule.id),
              h('span', { style: S.reviewTitle }, rule.title),
              locked ? h('span', { style: S.reviewState }, '· ' + (rule.adopted ? t('adoptedLabel') : t('presentLabel'))) : null),
            h('div', { style: S.ruleText }, rule.text),
            rule.evidence ? h('div', { style: S.ruleEvidence }, t('evidence') + ' · ' + rule.evidence) : null),
          h('span', { style: S.chip }, t('confidence') + ' ' + (rule.confidence || 'medium')))
      })

      /* ---------------------------- skill blocks ---------------------------- */

      const visibleSkills = showAllSkills ? skills : skills.slice(0, 12)
      const skillBlocks = visibleSkills.map((skill) => h('div', { key: skill.name, style: S.skill },
        h('div', { style: S.skillName }, skill.name),
        h('div', { style: S.skillDesc, title: skill.description || '' }, skill.description || '')))

      /* --------------------------- evidence blocks -------------------------- */

      const evidenceSource = (report && report.sources) || null
      const statBlocks = evidenceSource ? [
        {
          key: 'claude', label: 'Claude Code',
          value: evidenceSource.claude && evidenceSource.claude.prompts,
          unit: t('promptUnit'),
          sub: evidenceSource.claude
            ? nf(evidenceSource.claude.chinese) + ' ' + t('chineseUnit') + ' · ' + nf(evidenceSource.claude.planKeywords) + ' ' + t('planUnit')
            : '',
        },
        {
          key: 'codex', label: 'Codex',
          value: evidenceSource.codex && evidenceSource.codex.sessions,
          unit: t('sessionUnit'),
          sub: evidenceSource.codex && evidenceSource.codex.latest ? when(evidenceSource.codex.latest) : '',
        },
        {
          key: 'dsh', label: 'DeepSeek Harness',
          value: evidenceSource.dsh && evidenceSource.dsh.sessions,
          unit: t('sessionUnit'),
          sub: evidenceSource.dsh
            ? t('sampled') + ' ' + nf(evidenceSource.dsh.sampled) + ' · ' + nf(evidenceSource.dsh.toolCalls) + ' ' + t('toolCallsUnit')
            : '',
        },
        {
          key: 'pi', label: 'Pi',
          value: evidenceSource.pi && evidenceSource.pi.sessions,
          unit: t('sessionUnit'),
          sub: evidenceSource.pi ? nf(evidenceSource.pi.messages) + ' ' + t('messagesUnit') : '',
        },
      ] : []

      const evidenceBody = evidenceSource
        ? h('div', { style: S.evidenceGrid }, statBlocks.map((stat) => h('div', { key: stat.key, style: S.stat },
          h('span', { style: S.statLabel }, stat.label),
          h('span', { style: S.statValue }, nf(stat.value), h('span', { style: S.statUnit }, stat.unit)),
          stat.sub ? h('span', { style: S.statSub }, stat.sub) : null)))
        : h('div', { style: S.sourceList },
          h('div', { style: S.hint }, t('evidenceHint')),
          [['Claude Code', 'claude'], ['Codex', 'codex'], ['DeepSeek Harness', 'dsh'], ['Pi', 'pi']].map(([label, key]) => h('div', { key, style: S.sourceRow },
            h('span', { style: S.sourceName }, label),
            h('span', { style: S.sourcePath, title: sources[key] || '' }, sources[key] || '—'))))

      /* -------------------------------- render ------------------------------ */

      return h('div', { style: S.page },
        h('div', { style: S.inner },

          h('div', { style: S.header },
            h('div', { style: S.brandRow },
              h(BrandMark, { size: 44 }),
              h('div', { style: { minWidth: 0 } },
                h('div', { style: S.eyebrow }, t('eyebrow')),
                h('h1', { style: S.title }, t('title')),
                h('p', { style: S.subtitle }, t('subtitle')))),
            h('div', { style: S.toolbar },
              h('select', {
                style: S.select, value: active.id, disabled: busy === 'apply',
                onChange: (event) => onApply(event.target.value), title: t('packs'),
              }, packs.map((pack) => h('option', { key: pack.id, value: pack.id },
                (pack.displayName || pack.name || pack.id) + '  v' + pack.version))),
              h('button', {
                style: busy ? { ...S.button, ...S.disabled } : S.button,
                onClick: load, disabled: !!busy,
              }, t('refresh')),
              h('button', {
                style: busy ? { ...S.button, ...S.disabled } : S.button,
                onClick: onExport, disabled: !!busy,
              }, busy === 'export' ? t('exporting') : t('export')),
              h('button', {
                style: busy ? { ...S.buttonPrimary, ...S.disabled } : S.buttonPrimary,
                onClick: onDistill, disabled: !!busy,
              }, busy === 'distill' ? t('distilling') : t('distill')))),

          error ? h('div', { style: S.banner('error') }, t('error') + ' · ' + error) : null,
          notice ? h('div', { style: S.banner('info') }, notice) : null,

          h('div', { style: S.cover },
            h('div', { style: S.coverTop },
              h('div', { style: { minWidth: 0 } },
                h('div', { style: S.coverLabel }, t('coverLabel')),
                h('div', { style: S.coverNameRow },
                  h('span', { style: S.coverName }, active.displayName || active.name || active.id),
                  h('span', { style: S.chip }, 'v' + active.version),
                  h('span', { style: S.chip }, String(active.format || 'json').toUpperCase()),
                  h('span', { style: S.chip }, active.ruleCount + ' ' + t('rules')),
                  h('span', { style: S.chip }, active.skillCount + ' ' + t('skills')))),
              adoptions.length
                ? h('span', { style: S.badge }, adoptions.length + ' ' + t('customCount'))
                : null),
            active.description ? h('p', { style: S.coverDesc }, active.description) : null,
            h('div', { style: S.metaRow },
              h('span', { style: { ...S.mono, flex: '0 1 auto' }, title: active.dir || '' }, active.dir || ''),
              h('span', { style: S.metaDot }, '·'),
              h('span', null, t('generated') + ' ' + (latest ? when(latest.generatedAt) : t('never'))))),

          h(Section, { label: t('rules'), count: active.ruleCount },
            active.ruleCount === 0
              ? h('div', { style: S.empty }, h('div', { style: S.hint }, t('noRules')))
              : h('div', { style: { display: 'flex', flexDirection: 'column' } }, ruleRows)),

          h(Section, {
            label: t('review'),
            count: suggestions.length,
            right: adoptions.length ? adoptions.length + ' ' + t('customCount') : null,
          },
            h('div', { style: { ...S.hint, paddingTop: 10 } }, t('reviewHint')),
            suggestions.length === 0
              ? h('div', { style: S.empty }, h('div', { style: S.hint }, t('noSuggestions')))
              : h('div', { style: { display: 'flex', flexDirection: 'column' } }, reviewRows),
            suggestions.length === 0 ? null : h('div', { style: { ...S.hint, paddingTop: 10 } }, allLocked ? t('allPresent') : null),
            suggestions.length === 0 || allLocked ? null : h('div', { style: S.actions },
              h('button', {
                style: (busy || allLocked) ? { ...S.button, ...S.disabled } : S.button,
                disabled: !!busy || allLocked, onClick: () => onAdopt(true),
              }, t('adoptAll')),
              h('button', {
                style: (busy || selected.length === 0) ? { ...S.buttonPrimary, ...S.disabled } : S.buttonPrimary,
                disabled: !!busy || selected.length === 0, onClick: () => onAdopt(false),
              }, busy === 'adopt' ? t('adopting') : t('adoptSelected') + (selected.length ? ' (' + selected.length + ')' : '')))),

          h(Section, { label: t('skills'), count: active.skillCount, right: active.skillCount === 0 ? null : t('skillsLicense') },
            active.skillCount === 0
              ? h('div', { style: S.empty }, h('div', { style: S.hint }, t('noSkills')))
              : h('div', { style: S.skillsGrid }, skillBlocks),
            skills.length > 12
              ? h('div', { style: { paddingTop: 10 } },
                h('button', {
                  style: { ...S.button, padding: '5px 11px', fontSize: 11.5 },
                  onClick: () => setShowAllSkills((prev) => !prev),
                }, showAllSkills ? t('showLess') : t('showAll') + ' ' + skills.length))
              : null),

          h(Section, {
            label: t('sources'),
            right: latest ? t('generated') + ' ' + when(latest.generatedAt) : t('never'),
          },
            evidenceBody),

          h('div', { style: S.footer },
            h('span', null, t('privacy')),
            h('span', { style: S.mono }, 'dsh-workstyle v' + status.plugin.version))))
    }

    /* --------------------------------- apply -------------------------------- */

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
