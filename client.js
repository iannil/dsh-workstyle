/**
 * dsh-workstyle - Client half.
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

    const luminance = (color) => {
      const match = color && color.match(/rgba?\(([^)]+)\)/)
      if (!match) return null
      const parts = match[1].split(/[,\s/]+/).filter(Boolean)
      const alpha = parts.length > 3 ? parseFloat(parts[3]) : 1
      if (!(alpha > 0.1)) return null
      const [r, g, b] = parts.map(Number)
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 128
    }

    const isDark = (() => {
      try {
        if (typeof document !== 'undefined' && document.body && document.createElement) {
          const probe = document.createElement('div')
          probe.setAttribute('aria-hidden', 'true')
          probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;background:var(--dsw-alias-bg-base,transparent)'
          document.body.appendChild(probe)
          const fromToken = luminance(getComputedStyle(probe).backgroundColor)
          probe.remove()
          if (fromToken !== null) return fromToken
        }
        let el = document.body
        while (el) {
          const fromBody = luminance(getComputedStyle(el).backgroundColor)
          if (fromBody !== null) return fromBody
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
    const STATE_INFO = 'var(--dsw-alias-state-info-primary)'
    const PRIMARY_BG = isDark ? PAPER : INK
    const PRIMARY_FG = isDark ? INK : PAPER
    const BUILD = 'home v5 · 2026-11-08'

    /* ------------------------------ dictionaries --------------------------- */

    const zh = {
      nav: '工作方式',
      title: '工作方式',
      packs: '工作方式包',
      rules: '规则',
      skills: '技能',
      refresh: '刷新',
      distill: '蒸馏证据',
      distilling: '蒸馏中…',
      export: '导出包',
      exporting: '导出中…',
      exported: '已导出',
      copyCommand: '复制安装命令',
      copyPath: '复制路径',
      copyFailed: '复制失败，请手动复制',
      copied: '已复制',
      packDir: '包目录',
      installHint: '队友装好插件后，把导出的包解压到 ~/.dsh/workstyle/packs/ 即可在左上角切换。',
      distribution: '分发',
      allEnabled: '全部生效',
      disabledUnit: '条停用',
      adoptedUnit: '条本地采纳',
      reportStored: '报告已存本机',
      fromPack: '随包提供',
      pendingReview: '待审阅',
      reviewDone: '已全部处理',
      never: '尚未蒸馏',
      generated: '蒸馏于',
      review: '蒸馏建议',
      reviewHint: '勾选建议规则并采纳进当前包；采纳的规则会进入系统提示、随包导出，也可随时撤销。',
      reviewEmpty: '暂无待审建议。先点「蒸馏证据」扫一次本机会话。',
      adoptSelected: '采纳选中',
      adoptAll: '全部采纳',
      adopting: '采纳中…',
      adoptedNotice: '已采纳建议规则',
      adoptedLabel: '蒸馏采纳',
      presentLabel: '已在包内',
      unadopt: '撤销',
      severityHigh: '高',
      severityMedium: '中',
      severityLow: '低',
      evidence: '证据',
      noEvidence: '无证据',
      noRules: '这个包还没有规则。',
      noSkills: '这个包没有内置技能。',
      noMatch: '没有匹配的条目。',
      clearFilters: '清除筛选',
      all: '全部',
      enabled: '启用',
      disabled: '停用',
      distilledFilter: '蒸馏采纳',
      noEvidenceFilter: '缺证据',
      searchRules: '搜索规则…',
      searchSkills: '搜索技能…',
      expandAll: '展开全部',
      collapseAll: '收起全部',
      showAll: '展开全部',
      showLess: '收起',
      evidenceToggle: '本地证据与来源',
      aboutHint: '只读本机数据，不联网、不上传；蒸馏只保存聚合统计。',
      privacy: '只读本机数据，不联网、不上传，不保存 prompt 原文',
      evidenceHint: '点「蒸馏证据」扫描本机会话，生成可审阅的聚合报告（不保存原文）。',
      promptUnit: '条 prompt',
      chineseUnit: '条中文',
      planUnit: '条方案词',
      sessionUnit: '个会话',
      toolCallsUnit: '次工具调用',
      messagesUnit: '条消息',
      sampled: '采样',
      error: '出错了',
      applied: '已应用',
      distilled: '蒸馏完成，报告已写入本机',
      confidence: '置信度',
      toggleOn: '已启用',
      toggleOff: '已停用',
      handled: '已处理',
      viewHandled: '查看已处理',
      hideHandled: '收起已处理',
      allHandled: '已全部处理',
      inPackUnit: '条已在包内',

      /* v5 · 环境 */
      session: '当前会话',
      project: '项目',
      workspace: '全局',
      scope: '作用域',
      scopeWorkspace: '全局',
      scopeSession: '会话',
      injected: '注入中',
      fingerprint: '指纹',
      pending: '待办',
      navInject: '载入预览',
      navPresets: '预设与规则',
      navMetrics: '度量',
      navDistribution: '分发',
      injectTitle: '载入预览',
      injectHint: '系统提示里真实的那一段，与 /workstyle status 同源',
      injectRender: '渲染函数 renderRules()',
      injectCopy: '复制',
      injectExpand: '展开全文',
      injectCollapse: '收起全文',
      injectChars: '字符',
      injectRulesUnit: '条规则',
      injectSkillsUnit: '个技能',
      injectSources: '来源',
      injectMoved: '指纹已变，说明注入内容变了',
      effectiveTitle: '有效规则',
      effectiveHint: '勾选即切换；徽标说明它来自哪一层',
      presetsTitle: '预设与组装',
      presetsHint: '规则 > 预设（组合）> 技能 > 模板',
      presetCurrent: '当前',
      presetLabel: '预设',
      presetNew: '新建预设',
      presetRules: '规则',
      presetSkills: '技能',
      presetTemplates: '模板',
      usePreset: '启用',
      metricsTitle: '度量',
      metricsHint: '只用可复算的代理指标，不推断是否遵守',
      metricsWindow: '窗口',
      metricsRebuild: '重新蒸馏',
      metricsUnavailable: '尚未蒸馏：先运行一次蒸馏，度量才有可复算的底稿。',
      metricsFormula: '口径',
      metricsDenominator: '分母',
      baseline: '较上次',
      distributionTitle: '分发',
      exportWithScope: '导出包 + 作用域快照',
      exportPackOnly: '导出包（仅包）',
      todoDistill: '蒸馏建议待审',
      todoEvidence: '规则缺证据',
      todoConflict: '作用域冲突',
      todoUnverified: '未验证宣称',
      todoNone: '没有待办',
      projectFile: '项目叠层读取自',
      noProjectFile: '尚未创建项目叠层',
      disabledBy: '被覆盖',
      severity: '严重度',
      severityHigh: '高',
      severityMedium: '中',
      severityLow: '低',
      originPack: '包',
      originDistilled: '蒸馏',
      originProject: '项目',
      newRule: '新建规则',
      editRule: '编辑',
      saveRule: '保存',
      cancel: '取消',
      ruleIdLabel: '规则 id',
      ruleTitleLabel: '标题',
      ruleTextLabel: '正文',
      ruleSaved: '规则已保存到项目叠层',
      ruleRemoved: '规则已从项目叠层移除',
      removeRule: '移除',
      envUnavailable: '环境视图不可用：',
      onboardingTitle: '3 分钟上手',
      onboardingStep1: '① 看状态带的注入指纹——有指纹就说明规则已进系统提示',
      onboardingStep2: '② 新开一个对话，说「帮我加个登录」——应先出方案再动代码',
      onboardingStep3: '③ 面板「载入预览」可核对真实注入文本；随时可关本提示',
      onboardingDismiss: '知道了',
      onboardingDismissed: '已关闭上手提示',
    }
    const en = {
      nav: 'Workstyle',
      title: 'Workstyle',
      packs: 'Packs',
      rules: 'Rules',
      skills: 'Skills',
      refresh: 'Refresh',
      distill: 'Distill evidence',
      distilling: 'Distilling…',
      export: 'Export pack',
      exporting: 'Exporting…',
      exported: 'Exported',
      copyCommand: 'Copy install command',
      copyPath: 'Copy path',
      copyFailed: 'Copy failed; please copy manually',
      copied: 'Copied',
      packDir: 'pack directory',
      installHint: 'After installing the plugin, extract exported packs into ~/.dsh/workstyle/packs/ and switch from the picker.',
      distribution: 'Distribution',
      allEnabled: 'all active',
      disabledUnit: 'disabled',
      adoptedUnit: 'local adoption(s)',
      reportStored: 'report saved locally',
      fromPack: 'from pack',
      pendingReview: 'to review',
      reviewDone: 'all handled',
      never: 'Not distilled yet',
      generated: 'Latest distillation',
      review: 'Distillation review',
      reviewHint: 'Tick suggested rules to adopt them into the active pack. Adopted rules join the system prompt, travel with exports, and can be revoked any time.',
      reviewEmpty: 'Nothing to review. Run "Distill evidence" to scan local sessions.',
      adoptSelected: 'Adopt selected',
      adoptAll: 'Adopt all',
      adopting: 'Adopting…',
      adoptedNotice: 'Adopted suggested rules',
      adoptedLabel: 'adopted',
      presentLabel: 'already in pack',
      unadopt: 'Revoke',
      severityHigh: 'high',
      severityMedium: 'medium',
      severityLow: 'low',
      evidence: 'Evidence',
      noEvidence: 'No evidence',
      noRules: 'This pack has no rules yet.',
      noSkills: 'This pack ships no skills.',
      noMatch: 'No matching items.',
      clearFilters: 'Clear filters',
      all: 'All',
      enabled: 'Enabled',
      disabled: 'Disabled',
      distilledFilter: 'Adopted',
      noEvidenceFilter: 'No evidence',
      searchRules: 'Search rules…',
      searchSkills: 'Search skills…',
      expandAll: 'Expand all',
      collapseAll: 'Collapse all',
      showAll: 'Show all',
      showLess: 'Collapse',
      evidenceToggle: 'Local evidence & sources',
      aboutHint: 'Read-only local data · no network · no upload; distillation stores aggregates only.',
      privacy: 'Read-only local data. No network. No upload. Raw prompts never stored.',
      evidenceHint: 'Run "Distill evidence" to scan local sessions into a reviewable aggregate report (raw prompts are never stored).',
      promptUnit: 'prompts',
      chineseUnit: 'in Chinese',
      planUnit: 'plan keywords',
      sessionUnit: 'sessions',
      toolCallsUnit: 'tool calls',
      messagesUnit: 'messages',
      sampled: 'sampled',
      error: 'Error',
      applied: 'Applied',
      distilled: 'Distillation finished; the report is stored locally',
      confidence: 'confidence',
      toggleOn: 'Enabled',
      toggleOff: 'Disabled',
      handled: 'Handled',
      viewHandled: 'View handled',
      hideHandled: 'Hide handled',
      allHandled: 'All handled',
      inPackUnit: 'already in pack',

      /* v5 · environment */
      session: 'Session',
      project: 'Project',
      workspace: 'Global',
      scope: 'Scope',
      scopeWorkspace: 'Global',
      scopeSession: 'Session',
      injected: 'Injecting',
      fingerprint: 'Fingerprint',
      pending: 'To do',
      navInject: 'Loaded text',
      navPresets: 'Presets & rules',
      navMetrics: 'Metrics',
      navDistribution: 'Distribute',
      injectTitle: 'Loaded text',
      injectHint: 'The exact section sent in the system prompt — same source as /workstyle status',
      injectRender: 'renderer renderRules()',
      injectCopy: 'Copy',
      injectExpand: 'Show all',
      injectCollapse: 'Collapse',
      injectChars: 'chars',
      injectRulesUnit: 'rules',
      injectSkillsUnit: 'skills',
      injectSources: 'Sources',
      injectMoved: 'Fingerprint changed, so the injected text changed',
      effectiveTitle: 'Effective rules',
      effectiveHint: 'Tick to switch; the badge says which layer it came from',
      presetsTitle: 'Presets & assembly',
      presetsHint: 'rules > preset (a combination) > skills > templates',
      presetCurrent: 'current',
      presetLabel: 'Preset',
      presetNew: 'New preset',
      presetRules: 'Rules',
      presetSkills: 'Skills',
      presetTemplates: 'Templates',
      usePreset: 'Use',
      metricsTitle: 'Metrics',
      metricsHint: 'Recomputable proxies only; never infers compliance',
      metricsWindow: 'Window',
      metricsRebuild: 'Re-distill',
      metricsUnavailable: 'Not distilled yet: run a distillation first, then the numbers have a source.',
      metricsFormula: 'Formula',
      metricsDenominator: 'Denominator',
      baseline: 'vs previous',
      distributionTitle: 'Distribute',
      exportWithScope: 'Export pack + scope snapshot',
      exportPackOnly: 'Export pack only',
      todoDistill: 'suggestions to review',
      todoEvidence: 'rules without evidence',
      todoConflict: 'scope conflicts',
      todoUnverified: 'unverified claims',
      todoNone: 'Nothing to do',
      projectFile: 'Project layer read from',
      noProjectFile: 'No project layer yet',
      disabledBy: 'overridden',
      severity: 'severity',
      severityHigh: 'high',
      severityMedium: 'medium',
      severityLow: 'low',
      originPack: 'pack',
      originDistilled: 'distilled',
      originProject: 'project',
      newRule: 'New rule',
      editRule: 'Edit',
      saveRule: 'Save',
      cancel: 'Cancel',
      ruleIdLabel: 'Rule id',
      ruleTitleLabel: 'Title',
      ruleTextLabel: 'Text',
      ruleSaved: 'Rule saved to the project layer',
      ruleRemoved: 'Rule removed from the project layer',
      removeRule: 'Remove',
      envUnavailable: 'Environment view unavailable: ',
      onboardingTitle: '3-minute start',
      onboardingStep1: '① Check the status-rail fingerprint — if it shows, rules are in the system prompt',
      onboardingStep2: '② Open a new chat and ask to “add login” — expect a plan before code',
      onboardingStep3: '③ “Loaded text” shows the exact inject; dismiss this tip any time',
      onboardingDismiss: 'Got it',
      onboardingDismissed: 'Onboarding tip dismissed',
    }

    /* -------------------------------- icons -------------------------------- */

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

    const nf = (value) => (typeof value === 'number' ? value.toLocaleString('en-US') : String(value === undefined || value === null ? '-' : value))

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
        maxWidth: 1000, margin: '0 auto', padding: '36px 32px 64px',
        display: 'flex', flexDirection: 'column', gap: 36,
      },

      header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' },
      brandRow: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, minWidth: 0 },
      title: {
        margin: 0, fontSize: 26, fontWeight: 650,
        letterSpacing: '-0.024em', lineHeight: 1.14,
      },
      statusLine: {
        display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
        marginTop: 7, fontSize: 12, color: 'var(--dsw-alias-label-secondary)',
        minWidth: 0, overflowWrap: 'anywhere',
      },
      statusStrong: { fontWeight: 650, color: 'var(--dsw-alias-label-primary)' },
      statusDivider: { width: 1, height: 10, background: HAIRLINE, flex: 'none' },
      toolbar: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      select: {
        font: 'inherit', fontSize: 13, color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid ' + HAIRLINE,
        borderRadius: 8, padding: '8px 10px', outline: 'none',
      },
      button: {
        font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid ' + HAIRLINE, borderRadius: 8, padding: '8px 14px',
        opacity: 1,
      },
      buttonPrimary: {
        font: 'inherit', fontSize: 13, fontWeight: 650, cursor: 'pointer',
        color: PRIMARY_FG, background: PRIMARY_BG,
        border: '1px solid ' + PRIMARY_BG, borderRadius: 8, padding: '8px 16px',
      },
      disabled: { opacity: 0.45, cursor: 'default' },

      overview: { display: 'flex', flexDirection: 'column', gap: 16 },
      tiles: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(158px, 1fr))', gap: 10,
      },
      tile: {
        display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
        border: '1px solid ' + HAIRLINE, borderRadius: 12,
        background: 'var(--dsw-alias-bg-layer-2)', padding: '16px 18px',
      },
      tileLabel: {
        fontSize: 11.5, letterSpacing: '0.01em', fontWeight: 550,
        color: 'var(--dsw-alias-label-secondary)',
      },
      tileValue: {
        fontSize: 24, fontWeight: 600, letterSpacing: '-0.024em',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.28,
      },
      tileSub: {
        fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      },
      chip: {
        fontSize: 11.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)',
        border: '1px solid ' + HAIRLINE, borderRadius: 999, padding: '0 7px',
        fontVariantNumeric: 'tabular-nums',
      },
      badge: {
        fontSize: 10.5, lineHeight: 1.7, fontWeight: 650, color: ACCENT,
        background: ACCENT_SOFT, border: '1px solid ' + ACCENT_LINE,
        borderRadius: 999, padding: '0 7px',
      },
      mono: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
      },

      section: { display: 'flex', flexDirection: 'column' },
      sectionHead: {
        display: 'flex', alignItems: 'baseline', gap: 8,
        paddingBottom: 12, borderBottom: '1px solid ' + HAIRLINE,
      },
      sectionLabel: {
        fontSize: 14, letterSpacing: '-0.006em', fontWeight: 650,
        color: 'var(--dsw-alias-label-primary)',
      },
      sectionCount: {
        fontSize: 12, color: 'var(--dsw-alias-label-secondary)', fontVariantNumeric: 'tabular-nums',
      },
      sectionRight: { marginLeft: 'auto', fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },

      rule: {
        borderBottom: '1px solid ' + HAIRLINE,
      },
      ruleHead: {
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto 16px', gap: 12,
        alignItems: 'center', padding: '14px 0', cursor: 'pointer', outline: 'none',
        borderRadius: 8,
      },
      ruleBody: { padding: '0 0 18px 0', display: 'flex', flexDirection: 'column' },
      chevron: {
        fontSize: 10.5, color: 'var(--dsw-alias-label-secondary)', opacity: 0.6, marginLeft: 2, flex: 'none',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      ruleTitleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      ruleTitle: { fontSize: 14, fontWeight: 600, letterSpacing: '-0.008em' },
      ruleText: { fontSize: 13, lineHeight: 1.7, marginTop: 8 },
      ruleEvidence: {
        fontSize: 12, lineHeight: 1.65, marginTop: 12, paddingLeft: 12,
        borderLeft: '2px solid ' + ACCENT_LINE, color: 'var(--dsw-alias-label-secondary)',
      },
      ruleSide: { display: 'flex', alignItems: 'center', gap: 7 },
      ruleSideText: { fontSize: 11, letterSpacing: '0.01em', color: 'var(--dsw-alias-label-secondary)' },
      dot: (severity) => ({
        width: 5, height: 5, borderRadius: 999, flex: 'none',
        background: severity === 'high' ? 'var(--dsw-alias-state-warn-primary)'
          : severity === 'low' ? 'var(--dsw-alias-label-secondary)'
          : ACCENT,
      }),
      linkButton: {
        font: 'inherit', fontSize: 12, color: 'var(--dsw-alias-label-secondary)', fontWeight: 550,
        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
        textDecoration: 'underline', textUnderlineOffset: 2,
      },
      linkAccent: {
        font: 'inherit', fontSize: 12, color: ACCENT, fontWeight: 650,
        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
        textDecoration: 'underline', textUnderlineOffset: 2,
        textDecorationColor: ACCENT_LINE,
      },

      hint: { fontSize: 12, lineHeight: 1.65, color: 'var(--dsw-alias-label-secondary)' },
      empty: { padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 8 },

      handledRow: { display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, flexWrap: 'wrap', paddingTop: 12 },
      reviewRow: {
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto 16px', gap: 12,
        padding: '16px 0', borderBottom: '1px solid ' + HAIRLINE, alignItems: 'center',
      },
      checkbox: { margin: 0, flex: 'none' },
      lockMark: {
        fontSize: 11.5, lineHeight: '18px', height: 18, textAlign: 'center',
        color: ACCENT, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      reviewIdRow: { display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' },
      reviewId: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11,
        color: 'var(--dsw-alias-label-secondary)',
      },
      reviewTitle: { fontSize: 13, fontWeight: 600 },
      reviewState: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      actions: { display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end', flexWrap: 'wrap' },

      aboutHead: {
        display: 'flex', alignItems: 'baseline', gap: 10, width: '100%',
        padding: '0 0 9px', border: 'none', borderBottom: '1px solid ' + HAIRLINE,
        background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left',
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
        borderTop: '1px solid ' + HAIRLINE, paddingTop: 18,
        fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)',
      },
      banner: (kind) => ({
        fontSize: 12, lineHeight: 1.55, borderRadius: 8, padding: '9px 12px',
        border: '1px solid ' + (kind === 'error' ? 'var(--dsw-alias-state-error-primary)' : HAIRLINE),
        color: kind === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-secondary)',
        background: kind === 'error' ? 'transparent' : 'var(--dsw-alias-bg-layer-2)',
      }),
      tileClickable: { cursor: 'pointer' },
      actionsBar: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      actionsNote: { marginLeft: 'auto', fontSize: 10.5, color: 'var(--dsw-alias-label-secondary)' },

      searchRow: {
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '14px 0 2px',
      },
      input: {
        font: 'inherit', fontSize: 13, color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid ' + HAIRLINE,
        borderRadius: 8, padding: '8px 12px', outline: 'none', flex: '1 1 220px', minWidth: 160,
      },
      filterRow: { display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap', marginLeft: 'auto', flexShrink: 0 },
      pill: {
        font: 'inherit', fontSize: 10.5, lineHeight: 1.5, cursor: 'pointer',
        color: 'var(--dsw-alias-label-secondary)', background: 'transparent',
        border: '1px solid transparent', borderRadius: 999, padding: '3px 10px',
        whiteSpace: 'nowrap', flex: 'none',
      },
      pillActive: {
        color: ACCENT, background: ACCENT_SOFT,
        border: '1px solid ' + ACCENT_LINE, fontWeight: 650,
      },
      mutedBadge: {
        fontSize: 10.5, lineHeight: 1.7, fontWeight: 600, color: 'var(--dsw-alias-label-secondary)',
        border: '1px solid ' + HAIRLINE, borderRadius: 999, padding: '0 7px',
      },
      faint: { color: 'var(--dsw-alias-label-secondary)', opacity: 0.8 },

      skillRow: { borderBottom: '1px solid ' + HAIRLINE },
      skillHead: {
        display: 'grid', gridTemplateColumns: 'minmax(180px, 268px) minmax(0, 1fr) auto 16px',
        gap: 12, alignItems: 'center', padding: '14px 0', cursor: 'pointer', outline: 'none',
        borderRadius: 8,
      },
      skillNameCell: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
      skillName: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, fontWeight: 600,
        color: 'var(--dsw-alias-label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      },
      skillDesc: {
        fontSize: 12, color: 'var(--dsw-alias-label-secondary)', lineHeight: 1.55,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      },
      skillBody: { padding: '0 0 14px 0', display: 'flex', flexDirection: 'column' },

      distRow: {
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18,
        padding: '12px 0 6px', flexWrap: 'wrap',
      },
      distTitle: { fontSize: 13, fontWeight: 650, letterSpacing: '-0.005em' },
      distActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
      installRow: { display: 'flex', alignItems: 'center', gap: 10, paddingTop: 9, flexWrap: 'wrap' },
      code: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11,
        background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid ' + HAIRLINE,
        borderRadius: 6, padding: '4px 8px', whiteSpace: 'nowrap',
      },
      monoRow: { display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 },
      skeleton: {
        background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 6, border: '1px solid ' + HAIRLINE,
      },

      /* ---------------------------- v5 · environment ---------------------------- */
      rail: {
        display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap',
        border: '1px solid ' + HAIRLINE, borderRadius: 10,
        background: 'var(--dsw-alias-bg-layer-2)', padding: '9px 4px',
      },
      railItem: {
        display: 'flex', alignItems: 'baseline', gap: 5, padding: '0 13px',
        borderLeft: '1px solid ' + HAIRLINE, minWidth: 0,
      },
      railItemFirst: { borderLeft: 'none' },
      railLabel: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' },
      railValue: {
        fontSize: 12.5, fontWeight: 650, fontVariantNumeric: 'tabular-nums',
        color: 'var(--dsw-alias-label-primary)', whiteSpace: 'nowrap',
      },
      railValueAccent: { color: ACCENT },
      railMono: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, fontWeight: 600,
        color: ACCENT, whiteSpace: 'nowrap',
      },

      tidy: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 2 },
      tidyItem: {
        display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
        font: 'inherit', fontSize: 12, color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid ' + HAIRLINE,
        borderRadius: 8, padding: '6px 11px',
      },
      tidyCount: {
        fontSize: 10.5, lineHeight: '16px', minWidth: 17, textAlign: 'center', fontWeight: 700,
        color: ACCENT, background: ACCENT_SOFT, border: '1px solid ' + ACCENT_LINE,
        borderRadius: 999, padding: '0 5px', fontVariantNumeric: 'tabular-nums',
      },
      tidyCountZero: {
        fontSize: 10.5, lineHeight: '16px', minWidth: 17, textAlign: 'center', fontWeight: 650,
        color: 'var(--dsw-alias-label-secondary)', background: 'transparent',
        border: '1px solid ' + HAIRLINE, borderRadius: 999, padding: '0 5px',
      },

      tabs: {
        display: 'flex', alignItems: 'stretch', gap: 2, flexWrap: 'wrap',
        borderBottom: '1px solid ' + HAIRLINE, marginBottom: 4,
      },
      tab: {
        font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 7,
        color: 'var(--dsw-alias-label-secondary)', background: 'transparent',
        border: 'none', borderBottom: '2px solid transparent',
        padding: '9px 14px 10px', marginBottom: -1,
      },
      tabOn: { color: ACCENT, borderBottom: '2px solid ' + ACCENT },
      tabCount: {
        fontSize: 10.5, lineHeight: '16px', minWidth: 17, textAlign: 'center', fontWeight: 650,
        color: 'var(--dsw-alias-label-secondary)', border: '1px solid ' + HAIRLINE,
        borderRadius: 999, padding: '0 5px', fontVariantNumeric: 'tabular-nums',
      },
      tabCountOn: {
        fontSize: 10.5, lineHeight: '16px', minWidth: 17, textAlign: 'center', fontWeight: 700,
        color: ACCENT, background: ACCENT_SOFT, border: '1px solid ' + ACCENT_LINE,
        borderRadius: 999, padding: '0 5px', fontVariantNumeric: 'tabular-nums',
      },
      anchors: {
        display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
        paddingBottom: 12, borderBottom: '1px solid ' + HAIRLINE,
      },
      anchor: {
        font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        color: 'var(--dsw-alias-label-secondary)', background: 'transparent',
        border: 'none', borderRadius: 6, padding: '4px 9px',
      },
      anchorOn: { color: ACCENT, background: ACCENT_SOFT },
      anchorCount: { fontSize: 11, marginLeft: 4, fontVariantNumeric: 'tabular-nums', opacity: 0.8 },

      injectBox: {
        marginTop: 14, border: '1px solid ' + HAIRLINE, borderRadius: 10, overflow: 'hidden',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      injectHead: {
        display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
        padding: '9px 14px', borderBottom: '1px solid ' + HAIRLINE,
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.022)',
      },
      injectSectionName: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, fontWeight: 650,
        color: 'var(--dsw-alias-label-primary)',
      },
      injectOrder: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      injectFp: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11,
        color: ACCENT, background: ACCENT_SOFT, border: '1px solid ' + ACCENT_LINE,
        borderRadius: 5, padding: '1px 6px',
      },
      injectRight: {
        marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 11, color: 'var(--dsw-alias-label-secondary)', fontVariantNumeric: 'tabular-nums',
      },
      injectText: {
        margin: 0, padding: '14px 16px', maxHeight: 300, overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5,
        lineHeight: 1.85, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        color: 'var(--dsw-alias-label-primary)', opacity: 0.92,
      },
      injectTextOpen: { maxHeight: 'none' },
      injectFootSep: { color: 'var(--dsw-alias-label-tertiary)' },
      injectFoot: {
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '8px 14px', borderTop: '1px solid ' + HAIRLINE,
        fontSize: 11, color: 'var(--dsw-alias-label-secondary)',
      },

      scopeBadge: (kind) => ({
        fontSize: 10, lineHeight: 1.75, fontWeight: 650, letterSpacing: '0.01em',
        borderRadius: 4, padding: '0 6px', whiteSpace: 'nowrap',
        color: kind === 'project' ? ACCENT : kind === 'session' ? STATE_INFO : 'var(--dsw-alias-label-secondary)',
        background: kind === 'project' ? ACCENT_SOFT : kind === 'session' ? (isDark ? 'rgba(96,150,255,0.14)' : 'rgba(30,90,200,0.08)') : 'transparent',
        border: '1px solid ' + (kind === 'project' ? ACCENT_LINE : kind === 'session' ? (isDark ? 'rgba(96,150,255,0.45)' : 'rgba(30,90,200,0.35)') : HAIRLINE),
      }),
      ruleRowV5: {
        display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto auto', gap: 11,
        alignItems: 'center', padding: '10px 0', borderBottom: '1px solid ' + HAIRLINE,
      },
      ruleRowOff: { opacity: 0.55 },
      overridden: {
        fontSize: 10.5, color: ACCENT, fontWeight: 600, whiteSpace: 'nowrap',
      },

      presetGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))', gap: 10, paddingTop: 14,
      },
      presetCard: (current) => ({
        display: 'flex', flexDirection: 'column', gap: 7, textAlign: 'left',
        font: 'inherit', cursor: 'pointer', minWidth: 0,
        border: '1px solid ' + (current ? ACCENT_LINE : HAIRLINE), borderRadius: 10,
        background: current ? ACCENT_SOFT : 'var(--dsw-alias-bg-layer-2)', padding: '13px 15px',
      }),
      presetCardNew: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
        font: 'inherit', cursor: 'pointer', minHeight: 92,
        border: '1px dashed ' + HAIRLINE, borderRadius: 10, background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)', fontSize: 12,
      },
      presetTitleRow: { display: 'flex', alignItems: 'baseline', gap: 8 },
      presetTitle: { fontSize: 13.5, fontWeight: 650, letterSpacing: '-0.006em' },
      presetDesc: {
        fontSize: 11.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)',
        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      },
      presetCounts: {
        display: 'flex', gap: 10, fontSize: 11, color: 'var(--dsw-alias-label-secondary)',
        fontVariantNumeric: 'tabular-nums', paddingTop: 2,
      },
      presetCountEm: { fontWeight: 650, color: 'var(--dsw-alias-label-primary)' },

      metricGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 10, paddingTop: 14,
      },
      metricCard: {
        display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0,
        border: '1px solid ' + HAIRLINE, borderRadius: 10,
        background: 'var(--dsw-alias-bg-layer-2)', padding: '14px 16px',
      },
      metricValueRow: { display: 'flex', alignItems: 'baseline', gap: 1 },
      metricValue: {
        fontSize: 27, fontWeight: 600, letterSpacing: '-0.03em',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.15,
      },
      metricUnit: { fontSize: 13, fontWeight: 500, color: 'var(--dsw-alias-label-secondary)', letterSpacing: 0 },
      metricLabel: { fontSize: 12, fontWeight: 600 },
      metricFormula: {
        fontSize: 10.5, lineHeight: 1.55, color: 'var(--dsw-alias-label-secondary)',
        borderTop: '1px solid ' + HAIRLINE, paddingTop: 7, marginTop: 2,
      },
      metricTop: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
      deltaUp: { fontSize: 10.5, fontWeight: 650, color: ACCENT, fontVariantNumeric: 'tabular-nums' },
      deltaDown: { fontSize: 10.5, fontWeight: 650, color: 'var(--dsw-alias-label-secondary)', fontVariantNumeric: 'tabular-nums' },
      caveat: {
        fontSize: 11, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)',
        marginTop: 12, paddingLeft: 11, borderLeft: '2px solid ' + HAIRLINE,
      },

      distHeadRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 14 },
      distPrimaryRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },

      editorBox: {
        display: 'flex', flexDirection: 'column', gap: 9, padding: '14px 0 16px',
        borderBottom: '1px solid ' + HAIRLINE,
      },
      fieldRow: { display: 'flex', gap: 9, flexWrap: 'wrap' },
      field: { display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 200px', minWidth: 0 },
      fieldLabel: { fontSize: 11, fontWeight: 600, color: 'var(--dsw-alias-label-secondary)' },
      textarea: {
        font: 'inherit', fontSize: 13, lineHeight: 1.6, color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid ' + HAIRLINE,
        borderRadius: 8, padding: '9px 11px', outline: 'none', resize: 'vertical', minHeight: 62,
      },
      editorActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
    }

    const CSS = `
      #dsw-root *, #dsw-root *::before, #dsw-root *::after { box-sizing: border-box; }
      #dsw-root button { transition: filter .12s ease, outline-color .12s ease; }
      #dsw-root input::placeholder { color: var(--dsw-alias-label-secondary); opacity: .78; }
      #dsw-root button:hover:not(:disabled) { filter: brightness(0.97); }
      #dsw-root button:active:not(:disabled) { transform: translateY(0.5px); }
      #dsw-root button:focus-visible, #dsw-root input:focus-visible, #dsw-root select:focus-visible {
        outline: 2px solid ${ACCENT}; outline-offset: 2px;
      }
      #dsw-root a:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; border-radius: 6px; }
      #dsw-root input[type="checkbox"] {
        -webkit-appearance: none; appearance: none;
        width: 14px; height: 14px; margin: 0; flex: none;
        border: 1px solid ${isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.30)'};
        border-radius: 4px; background: transparent; position: relative; cursor: pointer;
        transition: background-color .12s ease, border-color .12s ease;
      }
      #dsw-root input[type="checkbox"]:checked { background: ${ACCENT}; border-color: ${ACCENT}; }
      #dsw-root input[type="checkbox"]:checked::after {
        content: ""; position: absolute; left: 4px; top: 1.5px; width: 4px; height: 7px;
        border: solid ${PRIMARY_FG}; border-width: 0 1.5px 1.5px 0; transform: rotate(45deg);
      }
      #dsw-root input[type="checkbox"]:disabled { opacity: .45; cursor: default; }
      #dsw-root .dsw-row { transition: background-color .12s ease; }
      #dsw-root .dsw-row:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent); }
      #dsw-root .dsw-tile-click { transition: box-shadow .12s ease; }
      #dsw-root .dsw-tile-click:hover { box-shadow: inset 0 0 0 1px ${ACCENT_LINE}; }
      #dsw-review, #dsw-rules, #dsw-skills, #dsw-distribution, #dsw-evidence { scroll-margin-top: 16px; }
      @media (prefers-reduced-motion: reduce) {
        #dsw-root *, #dsw-root *::before, #dsw-root *::after { transition: none !important; }
      }
    `

    /* ----------------------------- sub components --------------------------- */

    function Section(props) {
      const { id, label, count, right, children } = props
      return h('section', { id, style: S.section },
        h('div', { style: S.sectionHead },
          h('span', { style: S.sectionLabel }, label),
          count === undefined || count === null ? null : h('span', { style: S.sectionCount }, String(count)),
          right ? h('span', { style: S.sectionRight }, right) : null),
        children)
    }

    function Tile(props) {
      const { label, value, sub, compact, onClick, title } = props
      return h('div', {
        className: onClick ? 'dsw-tile-click' : undefined,
        style: onClick ? { ...S.tile, ...S.tileClickable } : S.tile,
        role: onClick ? 'button' : undefined,
        tabIndex: onClick ? 0 : undefined,
        title: title || undefined,
        onClick,
        onKeyDown: onClick ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() }
        } : undefined,
      },
        h('span', { style: S.tileLabel }, label),
        h('span', { style: compact ? { ...S.tileValue, fontSize: 15.5 } : S.tileValue }, String(value)),
        sub ? h('span', { style: S.tileSub, title: String(sub) }, sub) : null)
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
      const [statusLoading, setStatusLoading] = React.useState(true)
      const [report, setReport] = React.useState(null)
      const [busy, setBusy] = React.useState('')
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [selected, setSelected] = React.useState([])
      const [openRules, setOpenRules] = React.useState([])
      const [openSkills, setOpenSkills] = React.useState([])
      const [ruleQuery, setRuleQuery] = React.useState('')
      const [ruleFilter, setRuleFilter] = React.useState('all')
      const [skillQuery, setSkillQuery] = React.useState('')
      const [skillFilter, setSkillFilter] = React.useState('all')
      const [showAllSkills, setShowAllSkills] = React.useState(false)
      const [showEvidence, setShowEvidence] = React.useState(false)
      const [showHandled, setShowHandled] = React.useState(false)

      /* v5 · environment */
      const [env, setEnv] = React.useState(null)
      const [envError, setEnvError] = React.useState('')
      const [injectOpen, setInjectOpen] = React.useState(false)
      const [presetTab, setPresetTab] = React.useState('rules')
      const [packTab, setPackTab] = React.useState('rules')
      const [metricTab, setMetricTab] = React.useState('metrics')
      const [editing, setEditing] = React.useState(null)
      const ONBOARDING_KEY = 'dsw-workstyle:onboarding-v1'
      const [onboardingOpen, setOnboardingOpen] = React.useState(() => {
        try { return window.localStorage.getItem(ONBOARDING_KEY) !== 'done' } catch (err) { return true }
      })

      /**
       * The panel knows the live session; the host does not. So the panel
       * passes `cwd` and `session` down with every environment call, and the
       * injected text it shows is rendered by the host from those two values —
       * the same values the system prompt section uses.
       */
      const session = (() => {
        try {
          if (typeof props.sessionId !== 'string' || !props.sessionId) return null
          const ids = props.sessionIds || null
          // The host may pass plain ids or { id, cwd } records; accept both.
          const known = Array.isArray(ids)
            ? ids.find((id) => id === props.sessionId
              || (id && typeof id === 'object' && id.id === props.sessionId))
            : null
          return {
            id: props.sessionId,
            cwd: (known && typeof known === 'object' && known.cwd) ? known.cwd : (props.cwd || ''),
          }
        } catch (err) {
          return null
        }
      })()

      const envQuery = (() => {
        const parts = []
        if (session && session.cwd) parts.push('cwd=' + encodeURIComponent(session.cwd))
        if (session && session.id) parts.push('session=' + encodeURIComponent(session.id))
        return parts.length ? '?' + parts.join('&') : ''
      })()
      const envQueryRef = React.useRef(envQuery)
      envQueryRef.current = envQuery

      const ROUTES = new Set(['run', 'packs', 'pack', 'distill', 'metrics', 'distribute'])
      const readRoute = () => {
        const raw = typeof location !== 'undefined' ? String(location.hash || '') : '#/run'
        const [, page = 'run', packId] = raw.match(/^#\/?([^/]+)?(?:\/(.*))?$/) || []
        return ROUTES.has(page) ? { page, packId: packId || undefined } : { page: 'run' }
      }
      const routeHash = (page, packId) => '#/' + page + (packId ? '/' + encodeURIComponent(packId) : '')

      const getJson = (path) => fetch('/api/dsh-workstyle/' + path, { headers: { accept: 'application/json' } })
        .then((response) => {
          if (!response.ok) throw new Error('HTTP ' + response.status)
          return response.json()
        })
        .then((data) => ({ ok: true, data }))
        .catch((err) => ({ ok: false, error: String(err && err.message ? err.message : err) }))

      const [route, setRoute] = React.useState(readRoute)
      const statusRequest = React.useRef(0)
      const [packDetail, setPackDetail] = React.useState(null)
      const envRequest = React.useRef(0)
      const [packLoading, setPackLoading] = React.useState(false)
      const [packError, setPackError] = React.useState('')
      const [envLoading, setEnvLoading] = React.useState(false)
      const navigate = React.useCallback((next) => {
        const target = typeof next === 'string' ? { page: next } : next
        const hash = routeHash(target.page, target.packId)
        try {
          if (typeof location !== 'undefined') location.hash = hash
        } catch (err) { /* memory shims may expose a read-only location */ }
        setRoute(readRoute())
      })

      React.useEffect(() => {
        if (typeof window === 'undefined' || !window.addEventListener) return undefined
        const onHashChange = () => setRoute(readRoute())
        window.addEventListener('hashchange', onHashChange)
        return () => window.removeEventListener && window.removeEventListener('hashchange', onHashChange)
      }, [])

      React.useEffect(() => {
        const id = route.page === 'packs' || route.page === 'pack' ? route.packId : undefined
        if (!id) {
          setPackDetail(null)
          setPackError('')
          return undefined
        }
        let cancelled = false
        setPackDetail(null)
        setPackLoading(true)
        setPackError('')
        getJson('pack?id=' + encodeURIComponent(id)).then((result) => {
          if (cancelled) return
          if (!result.ok || !result.data || !result.data.pack) {
            setPackDetail(null)
            setPackError(result.error || (result.data && result.data.error) || 'pack unavailable')
            return
          }
          setPackDetail(result.data.pack)
        }).finally(() => { if (!cancelled) setPackLoading(false) })
        return () => { cancelled = true }
      }, [route.page, route.packId])

      const loadEnv = React.useCallback(() => {
        const requestId = ++envRequest.current
        setEnvLoading(true)
        return Promise.all([
          getJson('scope' + envQuery),
          getJson('inject' + envQuery),
          getJson('metrics' + envQuery),
        ]).then(([scope, inject, metrics]) => {
          if (requestId !== envRequest.current) return null
          const routeNames = ['scope', 'inject', 'metrics']
          const failed = routeNames.filter((name, index) => !([scope, inject, metrics][index]).ok)
          if (failed.length === routeNames.length) {
            // Every route failed: keep the last successful values and say so.
            setEnvError('routes unavailable')
            return
          }
          if (failed.length) setEnvError(failed.join(', ') + ' failed to load')
          else setEnvError('')
          const scopeData = scope.ok ? scope.data : null
          const injectData = inject.ok ? inject.data : null
          const metricsData = metrics.ok ? metrics.data : null
          setEnv((prev) => ({
            scope: scopeData || (prev && prev.scope) || null,
            inject: injectData || (prev && prev.inject) || null,
            metrics: metricsData || (prev && prev.metrics) || null,
            fingerprint: prev && prev.inject && injectData && prev.inject.fingerprint !== injectData.fingerprint
              ? { from: prev.inject.fingerprint, to: injectData.fingerprint }
              : (prev && prev.fingerprint) || null,
          }))
          return { scope: scopeData, inject: injectData, metrics: metricsData }
        })
        .finally(() => { if (requestId === envRequest.current) setEnvLoading(false) })
      }, [envQuery])

      const load = React.useCallback(() => {
        const requestId = ++statusRequest.current
        const requestEnvQuery = envQuery
        setError('')
        setStatusLoading(true)
        fetch('/api/dsh-workstyle/status', { headers: { accept: 'application/json' } })
          .then((response) => {
            if (!response.ok) throw new Error('status unavailable')
            return response.json()
          })
          .then((data) => {
            if (requestId !== statusRequest.current || requestEnvQuery !== envQueryRef.current) return null
            setStatus(data)
            // A refresh reloads the environment; keep the handled list folded
            // until the user asks to open it again.
            setShowHandled(false)
            if (data && data.latestDistill) {
              fetch('/api/dsh-workstyle/evidence', { headers: { accept: 'application/json' } })
                .then((response) => (response.ok ? response.json() : null))
                .then((evidence) => { if (evidence) setReport(evidence) })
                .catch(() => {})
            }
            loadEnv()
          })
          .catch((err) => {
            if (requestId === statusRequest.current && requestEnvQuery === envQueryRef.current) {
              setError(String(err && err.message ? err.message : err))
            }
          })
          .finally(() => {
            if (requestId === statusRequest.current && requestEnvQuery === envQueryRef.current) setStatusLoading(false)
          })
      }, [loadEnv])

      React.useEffect(() => { load() }, [load])

      const call = (path, body) => fetch('/api/dsh-workstyle/' + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then((response) => response.json().then((data) => ({ ok: response.ok, data })))

      const scrollTo = (id) => {
        try {
          const el = document.getElementById(id)
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } catch (err) { /* no DOM in tests */ }
      }

      const onApply = (packId) => {
        if (!packId) return
        setBusy('apply'); setError(''); setNotice('')
        call('apply', { pack: packId })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'apply failed')
            setStatus(data.status)
            return loadEnv().then((loaded) => {
              const fingerprint = loaded && loaded.inject && loaded.inject.fingerprint
              setNotice(t('applied') + '：' + data.applied.id + (fingerprint ? ' · ' + t('fingerprint') + ' ' + fingerprint : ''))
            })
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onDistill = () => {
        setBusy('distill'); setError(''); setNotice('')
        call('distill', { dshSessions: 12 })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'distill failed')
            setNotice(t('distilled') + '：' + data.file)
            setReport(null)
            load()
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onToggle = (kind, id, enabled) => {
        setBusy('toggle'); setError(''); setNotice('')
        call('toggle', { kind, id, enabled })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'toggle failed')
            setStatus(data.status)
            setNotice((enabled ? t('toggleOn') : t('toggleOff')) + '：' + id)
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
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
            setNotice(t('adoptedNotice') + '：' + data.added.length +
              (data.skipped && data.skipped.length ? '，' + data.skipped.length + ' skipped' : ''))
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
            setNotice(t('exported') + '：' + data.file)
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onCopy = (text, label) => {
        setError(''); setNotice('')
        if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) {
          setError(t('copyFailed'))
          return
        }
        navigator.clipboard.writeText(text)
          .then(() => setNotice(t('copied') + '：' + label))
          .catch(() => setError(t('copyFailed')))
      }

      /* ---------------------------- v5 · environment ---------------------------- */

      const postJson = (path, body) => fetch('/api/dsh-workstyle/' + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then((response) => response.json().then((data) => ({ ok: response.ok, data })))

      /** Enable or disable a rule in the layer that owns the decision. */
      const onRuleToggle = (rule, enabled) => {
        const layer = rule && rule.textScope === 'project' && rule.origin === 'project' ? 'project' : 'workspace'
        if (layer === 'project' || !session || !session.id) {
          // No session to scope the change to: use the pack-level switch.
          return onToggle('rule', rule.id, enabled)
        }
        setBusy('rule'); setError(''); setNotice('')
        const disabled = (env && env.scope && env.scope.session && env.scope.session.disabledRules) || []
        const next = enabled ? disabled.filter((id) => id !== rule.id) : [...disabled, rule.id]
        return postJson('scope', { layer: 'session', sessionId: session.id, patch: { disabledRules: next } })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'scope save failed')
            setNotice((enabled ? t('toggleOn') : t('toggleOff')) + '：' + rule.id)
            loadEnv()
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const refreshEnvironment = (changedId, message) => loadEnv().then((loaded) => {
        const fingerprint = loaded && loaded.inject && loaded.inject.fingerprint
        setNotice(message + '：' + changedId + (fingerprint ? ' · ' + t('fingerprint') + ' ' + fingerprint : ''))
        navigate({ page: 'run' })
        return loaded
      })

      const onSaveRule = (draft) => {
        const cwd = env && env.scope ? env.scope.cwd : (session && session.cwd)
        const normalized = {
          id: typeof draft.id === 'string' ? draft.id.trim() : '',
          title: typeof draft.title === 'string' ? draft.title.trim() : '',
          text: typeof draft.text === 'string' ? draft.text.trim() : '',
        }
        if (!normalized.id || !normalized.title || !normalized.text) {
          setError(t('ruleIdLabel') + '、' + t('ruleTitleLabel') + '、' + t('ruleTextLabel') + '不能为空')
          return Promise.resolve()
        }
        if (!cwd) { setError(t('envUnavailable') + 'no cwd'); return Promise.resolve() }
        setBusy('rule'); setError(''); setNotice('')
        return postJson('rule', { cwd, rule: normalized })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'rule save failed')
            setEditing(null)
            return refreshEnvironment(normalized.id, t('ruleSaved'))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onRemoveRule = (id) => {
        const cwd = env && env.scope ? env.scope.cwd : (session && session.cwd)
        const normalizedId = typeof id === 'string' ? id.trim() : ''
        if (!cwd || !normalizedId) return
        setBusy('rule'); setError(''); setNotice('')
        postJson('rule', { cwd, rule: { id: normalizedId }, remove: true })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'rule remove failed')
            return refreshEnvironment(normalizedId, t('ruleRemoved'))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onUsePreset = (id) => {
        const cwd = env && env.scope ? env.scope.cwd : (session && session.cwd)
        setBusy('preset'); setError(''); setNotice('')
        postJson('preset', { action: 'use', preset: id, cwd })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'preset use failed')
            return loadEnv().then((loaded) => {
              const fingerprint = loaded && loaded.inject && loaded.inject.fingerprint
              setNotice(t('presetCurrent') + '：' + id + (fingerprint ? ' · ' + t('fingerprint') + ' ' + fingerprint : ''))
            })
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const toggleSelected = (id) => {
        setSelected((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
      }

      const toggleRuleOpen = (id) => {
        setOpenRules((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
      }

      const toggleSkillOpen = (id) => {
        setOpenSkills((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
      }

      const severityLabel = (severity) => t(severity === 'high' ? 'severityHigh' : severity === 'low' ? 'severityLow' : 'severityMedium')

      if (!status) {
        if (error) {
          return h('div', { style: S.page },
            h('div', { style: S.inner }, h('div', { style: S.banner('error') }, t('error') + '：' + error)))
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
      const summary = status.summary || {}

      if (!active) {
        return h('div', { style: S.page },
          h('div', { style: S.inner }, h('div', { style: S.banner('error') }, t('error') + '：no active pack')))
      }

      const enabledRules = rules.filter((rule) => rule.enabled !== false)
      const enabledSkills = skills.filter((skill) => skill.enabled !== false)
      const totalRules = typeof summary.ruleCount === 'number' ? summary.ruleCount : rules.length
      const totalSkills = typeof summary.skillCount === 'number' ? summary.skillCount : skills.length
      const disabledRules = typeof summary.disabledRuleCount === 'number' ? summary.disabledRuleCount : rules.length - enabledRules.length
      const disabledSkills = typeof summary.disabledSkillCount === 'number' ? summary.disabledSkillCount : skills.length - enabledSkills.length
      const pendingCount = typeof summary.pendingSuggestionCount === 'number'
        ? summary.pendingSuggestionCount
        : suggestions.filter((rule) => !(rule.adopted || rule.present)).length
      const adoptedCount = typeof summary.adoptedRuleCount === 'number' ? summary.adoptedRuleCount : adoptions.length
      const allLocked = suggestions.length > 0 && pendingCount === 0

      /* ------------------------------ rule rows ----------------------------- */

      const ruleNeedle = ruleQuery.trim().toLowerCase()
      const filteredRules = rules.filter((rule) => {
        if (ruleFilter === 'enabled' && rule.enabled === false) return false
        if (ruleFilter === 'disabled' && rule.enabled !== false) return false
        if (ruleFilter === 'distilled' && rule.origin !== 'distilled') return false
        if (ruleFilter === 'noEvidence' && rule.evidence) return false
        if (!ruleNeedle) return true
        return ((rule.id || '') + ' ' + (rule.title || '') + ' ' + (rule.text || '') + ' ' + (rule.evidence || ''))
          .toLowerCase().includes(ruleNeedle)
      })
      const allRulesOpen = rules.length > 0 && openRules.length === rules.length
      const toggleAllRules = () => setOpenRules(allRulesOpen ? [] : rules.map((rule) => rule.id))

      const ruleRows = filteredRules.map((rule) => {
        const open = openRules.includes(rule.id)
        const enabled = rule.enabled !== false
        return h('div', { key: rule.id, style: enabled ? S.rule : { ...S.rule, opacity: 0.6 } },
          h('div', {
            className: 'dsw-row', style: S.ruleHead, role: 'button', tabIndex: 0,
            'aria-expanded': open ? 'true' : 'false',
            onClick: () => toggleRuleOpen(rule.id),
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                toggleRuleOpen(rule.id)
              }
            },
          },
            h('div', { style: S.ruleTitleRow },
              h('span', { style: S.ruleTitle }, rule.title),
              rule.origin === 'distilled' ? h('span', { style: S.badge }, t('adoptedLabel')) : null,
              enabled ? null : h('span', { style: S.mutedBadge }, t('disabled'))),
            h('div', { style: S.ruleSide },
              h('span', { style: S.dot(rule.severity) }),
              h('span', { style: S.ruleSideText }, severityLabel(rule.severity)),
              h('span', { style: S.chevron, 'aria-hidden': true }, open ? '▾' : '▸')),
            h('input', {
              type: 'checkbox', style: S.checkbox, checked: enabled, disabled: !!busy,
              'aria-label': rule.title,
              onClick: (event) => event.stopPropagation(),
              onChange: () => onToggle('rule', rule.id, !enabled),
            })),
          open ? h('div', { style: S.ruleBody },
            h('div', { style: S.ruleText }, rule.text),
            rule.evidence
              ? h('div', { style: S.ruleEvidence }, t('evidence') + ' · ' + rule.evidence)
              : h('div', { style: { ...S.ruleEvidence, ...S.faint } }, t('noEvidence')),
            rule.origin === 'distilled'
              ? h('div', { style: { paddingTop: 8 } },
                h('button', {
                  style: busy ? { ...S.linkButton, opacity: 0.45, cursor: 'default' } : S.linkButton,
                  disabled: !!busy,
                  onClick: (event) => { event.stopPropagation(); onUnadopt(rule.id) },
                }, t('unadopt')))
              : null) : null)
      })

      /* ---------------------------- review rows ----------------------------- */

      const pendingSuggestions = suggestions.filter((rule) => !(rule.adopted || rule.present))
      const handledSuggestions = suggestions.filter((rule) => rule.adopted || rule.present)
      const allHandled = suggestions.length > 0 && pendingSuggestions.length === 0
      const reviewRows = (list) => list.map((rule) => {
        const locked = rule.adopted || rule.present
        return h('label', { key: rule.id, style: locked ? { ...S.reviewRow, opacity: 0.55, cursor: 'default' } : { ...S.reviewRow, cursor: 'pointer' } },
          h('div', { style: { minWidth: 0 } },
            h('div', { style: S.reviewIdRow },
              h('span', { style: S.reviewId }, rule.id),
              h('span', { style: S.reviewTitle }, rule.title),
              rule.adopted ? h('span', { style: S.reviewState }, '（' + t('adoptedLabel') + '）') : null,
              rule.present ? h('span', { style: S.reviewState }, '（' + t('presentLabel') + '）') : null),
            h('div', { style: S.ruleText }, rule.text),
            rule.evidence ? h('div', { style: S.ruleEvidence }, t('evidence') + ' · ' + rule.evidence) : null),
          h('span', { style: S.chip }, t('confidence') + ' ' + (rule.confidence || 'medium')),
          locked
            ? h('span', { style: S.lockMark, 'aria-hidden': true }, '✓')
            : h('input', {
              type: 'checkbox', style: S.checkbox, disabled: !!busy,
              checked: selected.includes(rule.id),
              onChange: () => toggleSelected(rule.id),
            }))
      })

      /* ---------------------------- skill rows ------------------------------ */

      const skillNeedle = skillQuery.trim().toLowerCase()
      const filteredSkills = skills.filter((skill) => {
        if (skillFilter === 'enabled' && skill.enabled === false) return false
        if (skillFilter === 'disabled' && skill.enabled !== false) return false
        if (!skillNeedle) return true
        return ((skill.name || '') + ' ' + (skill.description || '') + ' ' + (skill.whenToUse || ''))
          .toLowerCase().includes(skillNeedle)
      })
      const isPristine = skillFilter === 'all' && !skillNeedle
      const visibleSkills = isPristine && !showAllSkills ? filteredSkills.slice(0, 24) : filteredSkills

      const skillRows = visibleSkills.map((skill) => {
        const open = openSkills.includes(skill.name)
        const enabled = skill.enabled !== false
        return h('div', { key: skill.name, style: enabled ? S.skillRow : { ...S.skillRow, opacity: 0.6 } },
          h('div', {
            className: 'dsw-row', style: S.skillHead, role: 'button', tabIndex: 0,
            'aria-expanded': open ? 'true' : 'false',
            onClick: () => toggleSkillOpen(skill.name),
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                toggleSkillOpen(skill.name)
              }
            },
          },
            h('span', { style: S.skillNameCell },
              h('span', { style: S.skillName, title: skill.name }, skill.name),
              enabled ? null : h('span', { style: S.mutedBadge }, t('disabled'))),
            h('span', { style: S.skillDesc, title: skill.description || '' }, skill.description || ''),
            h('span', { style: S.chevron, 'aria-hidden': true }, open ? '▾' : '▸'),
            h('input', {
              type: 'checkbox', style: S.checkbox, checked: enabled, disabled: !!busy,
              'aria-label': skill.name,
              onClick: (event) => event.stopPropagation(),
              onChange: () => onToggle('skill', skill.name, !enabled),
            })),
          open ? h('div', { style: S.skillBody },
            h('div', { style: S.ruleText }, skill.whenToUse || skill.description || ''),
            h('div', { style: { ...S.hint, paddingTop: 4 } }, t('fromPack'))) : null)
      })

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
        : h('div', { style: S.hint }, t('evidenceHint'))

      /* ------------------------------ filters ------------------------------- */

      const chipRow = (options, current, pick) => h('div', { style: S.filterRow },
        options.map((option) => h('button', {
          key: option.key,
          style: current === option.key ? { ...S.pill, ...S.pillActive } : S.pill,
          'aria-pressed': current === option.key ? 'true' : 'false',
          onClick: () => pick(option.key),
        }, option.label)))

      const ruleFilterOptions = [
        { key: 'all', label: t('all') },
        { key: 'enabled', label: t('enabled') },
        { key: 'disabled', label: t('disabled') },
        { key: 'distilled', label: t('distilledFilter') },
        { key: 'noEvidence', label: t('noEvidenceFilter') },
      ]
      const skillFilterOptions = [
        { key: 'all', label: t('all') },
        { key: 'enabled', label: t('enabled') },
        { key: 'disabled', label: t('disabled') },
      ]

      /* -------------------------------- render ------------------------------ */

      const installCommand = 'dsh plugin add dsh-workstyle'

      /* ---------------------------- v5 · environment ---------------------------- */

      const sc = env && env.scope ? env.scope : null
      const inj = env && env.inject ? env.inject : null
      const met = env && env.metrics ? env.metrics : null
      const scopedRules = sc && Array.isArray(sc.rules) ? sc.rules : rules
      const scopedSkills = sc && Array.isArray(sc.skills) ? sc.skills : skills
      const presets = sc && Array.isArray(sc.presets) ? sc.presets : []
      const templates = sc && Array.isArray(sc.templates) ? sc.templates : []
      const counts = (sc && sc.counts) || {
        injected: enabledRules.length, total: totalRules, project: 0, disabled: disabledRules,
        skills: enabledSkills.length, skillTotal: totalSkills,
      }
      const activePresetId = sc && sc.activePreset ? sc.activePreset.id : null
      const scopedDisabled = scopedRules.filter((rule) => rule.enabled === false)
      const projectRules = scopedRules.filter((rule) => rule.origin === 'project')
      const environment = {
        status,
        scope: sc,
        inject: inj,
        metrics: met,
        report,
        cwd: (sc && sc.cwd) || (session && session.cwd) || props.cwd || '',
        sessionId: (sc && sc.sessionId) || (session && session.id) || props.sessionId || '',
        loading: statusLoading || envLoading,
        error: error || envError,
      }

      const todoItems = [
        { key: 'distill', label: t('todoDistill'), count: pendingCount, target: 'distill' },
        { key: 'evidence', label: t('todoEvidence'), count: enabledRules.filter((rule) => !rule.evidence).length, target: 'packs', packId: active.id },
        { key: 'conflict', label: t('todoConflict'), count: scopedDisabled.filter((rule) => rule.disabledBy).length, target: 'packs', packId: active.id },
        { key: 'unverified', label: t('todoUnverified'), count: 0, target: 'metrics' },
      ]

      const scopeBadge = (rule) => {
        if (rule.enabled === false && rule.disabledBy) {
          return h('span', { style: S.scopeBadge(rule.disabledBy === 'session' ? 'session' : 'workspace'), title: t('disabledBy') + ' · ' + rule.disabledBy },
            t('disabled'))
        }
        if (rule.origin === 'project' || rule.textScope === 'project') {
          return h('span', { style: S.scopeBadge('project'), title: t('originProject') }, t('project'))
        }
        return h('span', { style: S.scopeBadge('workspace') }, t('scopeWorkspace'))
      }

      /* status rail — one line that answers "what is loaded right now" */
      const statusRail = h('div', { style: S.rail, role: 'status', 'aria-label': t('injected') },
        h('div', { style: { ...S.railItem, ...S.railItemFirst } },
          h('span', { style: S.railLabel }, t('injected')),
          h('span', { style: { ...S.railValue, ...S.railValueAccent } }, String(counts.injected)),
          h('span', { style: { ...S.railLabel, marginLeft: 2 } }, t('injectRulesUnit'))),
        h('div', { style: S.railItem },
          h('span', { style: S.railLabel }, t('scopeWorkspace')),
          h('span', { style: S.railValue }, String(counts.injected - counts.project))),
        h('div', { style: S.railItem },
          h('span', { style: S.railLabel }, t('project')),
          h('span', { style: S.railValue }, (counts.project > 0 ? '+' : '') + counts.project)),
        h('div', { style: S.railItem },
          h('span', { style: S.railLabel }, t('scopeSession')),
          h('span', { style: S.railValue }, (counts.disabled > 0 ? '−' : '') + counts.disabled)),
        h('div', { style: S.railItem },
          h('span', { style: S.railLabel }, t('skills')),
          h('span', { style: S.railValue }, counts.skills + '/' + counts.skillTotal)),
        h('div', { style: S.railItem },
          h('span', { style: S.railLabel }, t('presetLabel')),
          h('span', { style: S.railValue }, activePresetId || '-')),
        h('div', { style: S.railItem },
          h('span', { style: S.railLabel }, t('fingerprint')),
          h('span', { style: S.railMono, title: inj ? inj.fingerprint : '' }, inj ? inj.fingerprint : '-')),
        h('div', { style: S.railItem },
          h('span', { style: S.railLabel }, t('generated')),
          h('span', { style: S.railValue }, latest ? when(latest.generatedAt) : t('never'))))

      const todoBar = h('div', { style: S.tidy, role: 'group', 'aria-label': t('pending') },
        todoItems.map((item) => h('a', {
          key: item.key,
          href: routeHash(item.target, item.packId),
          style: S.tidyItem,
          onClick: (event) => {
            if (event && event.preventDefault) event.preventDefault()
            navigate({ page: item.target, packId: item.packId })
          },
          title: item.label,
        },
          h('span', { style: item.count > 0 ? S.tidyCount : S.tidyCountZero }, String(item.count)),
          h('span', null, item.label))))

      const dismissOnboarding = () => {
        try { window.localStorage.setItem(ONBOARDING_KEY, 'done') } catch (err) { /* tests / private mode */ }
        setOnboardingOpen(false)
        setNotice(t('onboardingDismissed'))
      }
      const onboardingTip = onboardingOpen ? h('div', {
        role: 'note',
        'data-testid': 'dsw-onboarding',
        style: {
          margin: '8px 0 0',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid color-mix(in srgb, var(--dsh-fg, #111) 12%, transparent)',
          background: 'color-mix(in srgb, var(--dsh-fg, #111) 4%, transparent)',
          display: 'grid',
          gap: 6,
        },
      },
        h('div', { style: { fontWeight: 600, fontSize: 13 } }, t('onboardingTitle')),
        h('div', { style: { fontSize: 12, lineHeight: 1.5 } }, t('onboardingStep1')),
        h('div', { style: { fontSize: 12, lineHeight: 1.5 } }, t('onboardingStep2')),
        h('div', { style: { fontSize: 12, lineHeight: 1.5 } }, t('onboardingStep3')),
        h('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
          h('button', { type: 'button', style: S.button, onClick: dismissOnboarding }, t('onboardingDismiss'))),
      ) : null

      /* ① loaded text — the real bytes, with their fingerprint */
      const injectBlock = h(Section, {
        id: 'dsw-inject',
        label: '① ' + t('injectTitle'),
        right: h('span', { style: { display: 'inline-flex', gap: 12, alignItems: 'center' } },
          h('button', { style: S.linkAccent, onClick: () => onCopy(inj ? inj.text : '', 'injected text') }, t('injectCopy')),
          h('button', {
            style: S.linkAccent,
            onClick: () => setInjectOpen((prev) => !prev),
          }, injectOpen ? t('injectCollapse') : t('injectExpand'))),
      },
        h('div', { style: { ...S.hint, paddingTop: 8 } }, t('injectHint')),
        inj
          ? h('div', { style: S.injectBox },
            h('div', { style: S.injectHead },
              h('span', { style: S.injectSectionName }, 'systemPrompt · ' + inj.section),
              h('span', { style: S.injectOrder }, '· order ' + (inj.order || 900)),
              h('span', {
                style: S.injectFp,
                title: env && env.fingerprint ? t('injectMoved') + '：' + env.fingerprint.from + ' → ' + env.fingerprint.to : t('fingerprint'),
              }, 'sha256 ' + inj.fingerprint),
              h('span', { style: S.injectRight },
                h('span', null, inj.chars + ' ' + t('injectChars')),
                h('span', null, inj.ruleCount + ' ' + t('injectRulesUnit') + ' · ' + inj.skillCount + ' ' + t('injectSkillsUnit')))),
            h('pre', { style: injectOpen ? { ...S.injectText, ...S.injectTextOpen } : S.injectText },
              injectOpen ? inj.text : (inj.text.split('\n').slice(0, 12).join('\n') + (inj.chars > 400 ? '\n…' : ''))),
            h('div', { style: S.injectFoot },
              h('span', null, t('injectSources') + '：' + t('originPack') + ' ' + (counts.injected - counts.project) +
                ' · ' + t('project') + ' +' + counts.project +
                ' · ' + t('scopeSession') + ' −' + counts.disabled),
              h('span', { style: S.injectFootSep }, '·'),
              h('span', { style: S.mono }, t('injectRender'))))
          : h('div', { style: S.empty }, h('div', { style: S.hint }, t('envUnavailable') + (envError || t('refresh')))))

      /* ② effective rules — every layer visible, overrides named */
      const scopedRuleRows = scopedRules.map((rule) => h('div', {
        key: rule.id,
        className: 'dsw-row',
        style: rule.enabled === false ? { ...S.ruleRowV5, ...S.ruleRowOff } : S.ruleRowV5,
      },
        h('input', {
          type: 'checkbox',
          style: S.checkbox,
          checked: rule.enabled !== false,
          disabled: !!busy,
          'aria-label': rule.title,
          onChange: (event) => onRuleToggle(rule, event.target.checked),
        }),
        h('div', { style: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 } },
          h('span', { style: S.ruleTitle }, rule.title),
          rule.enabled === false && rule.disabledBy
            ? h('span', { style: S.overridden }, t('disabledBy') + ' · ' + (rule.disabledBy === 'session' ? t('scopeSession') : rule.disabledBy === 'project' ? t('project') : t('scopeWorkspace')))
            : null),
        h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
          scopeBadge(rule),
          h('span', { style: S.ruleSideText }, t('severity') + ' ' + (rule.severity === 'high' ? t('severityHigh') : rule.severity === 'low' ? t('severityLow') : t('severityMedium')))),
        h('div', { style: { display: 'flex', gap: 8 } },
          rule.origin === 'project'
            ? h('button', { style: S.linkButton, onClick: () => setEditing({ id: rule.id, title: rule.title, text: rule.text, existing: true }) }, t('editRule'))
            : null,
          rule.origin === 'project'
            ? h('button', { style: S.linkButton, onClick: () => onRemoveRule(rule.id) }, t('removeRule'))
            : null)))

      const editor = editing
        ? h('div', { style: S.editorBox },
          h('div', { style: S.fieldRow },
            h('label', { style: S.field },
              h('span', { style: S.fieldLabel }, t('ruleIdLabel')),
              h('input', {
                style: S.input,
                value: editing.id,
                disabled: editing.existing,
                placeholder: 'my-project-rule',
                onChange: (event) => setEditing({ ...editing, id: event.target.value }),
              })),
            h('label', { style: S.field },
              h('span', { style: S.fieldLabel }, t('ruleTitleLabel')),
              h('input', {
                style: S.input,
                value: editing.title,
                placeholder: t('ruleTitleLabel'),
                onChange: (event) => setEditing({ ...editing, title: event.target.value }),
              }))),
          h('label', { style: S.field },
            h('span', { style: S.fieldLabel }, t('ruleTextLabel')),
            h('textarea', {
              style: S.textarea,
              value: editing.text,
              placeholder: t('ruleTextLabel'),
              onChange: (event) => setEditing({ ...editing, text: event.target.value }),
            })),
          h('div', { style: S.editorActions },
            h('button', { style: S.button, onClick: () => setEditing(null) }, t('cancel')),
            h('button', {
              style: busy ? { ...S.buttonPrimary, ...S.disabled } : S.buttonPrimary,
              disabled: !!busy,
              onClick: () => onSaveRule({ id: editing.id.trim(), title: editing.title.trim(), text: editing.text.trim() }),
            }, t('saveRule'))))
        : null

      const rulesBlock = h(Section, {
        id: 'dsw-rules',
        label: '② ' + t('effectiveTitle'),
        count: scopedRules.length,
        right: h('span', { style: { display: 'inline-flex', gap: 12, alignItems: 'center' } },
          counts.disabled ? h('span', null, counts.disabled + ' ' + t('disabled')) : null,
          h('button', {
            style: S.linkAccent,
            onClick: () => setEditing({ id: '', title: '', text: '' }),
          }, t('newRule'))),
      },
        h('div', { style: { ...S.hint, paddingTop: 8 } }, t('effectiveHint')),
        editor,
        scopedRuleRows.length
          ? h('div', null, scopedRuleRows)
          : h('div', { style: S.empty }, h('div', { style: S.hint }, t('reviewEmpty'))))

      /* ③ presets, then what a preset is made of */
      const presetCards = presets.map((preset) => h('button', {
        key: preset.id,
        style: S.presetCard(preset.id === activePresetId),
        onClick: () => onUsePreset(preset.id),
        title: preset.description || preset.id,
      },
        h('div', { style: S.presetTitleRow },
          h('span', { style: S.presetTitle }, preset.title),
          preset.id === activePresetId ? h('span', { style: S.badge }, t('presetCurrent')) : null),
        preset.description ? h('span', { style: S.presetDesc }, preset.description) : null,
        h('div', { style: S.presetCounts },
          h('span', null, t('presetRules') + ' ', h('span', { style: S.presetCountEm }, String(preset.rules.length))),
          h('span', null, t('presetSkills') + ' ', h('span', { style: S.presetCountEm }, String(preset.skills.length))),
          h('span', null, t('presetTemplates') + ' ', h('span', { style: S.presetCountEm }, String(preset.templates.length))))))

      /* The run page is intentionally a compact operational surface. Full rule
         and skill inventories live on their own routes; this page proves what
         is active and offers only the next useful actions. */
      const RunPage = ({ environment: runEnvironment, onNavigate, onRefresh, onUsePreset: usePreset }) => h(
        'div',
        null,
        statusRail,
        todoBar,
        onboardingTip,
        runEnvironment && runEnvironment.error
          ? h('div', { style: S.banner('error'), role: 'alert' },
            t('envUnavailable') + runEnvironment.error,
            h('button', { style: S.linkAccent, type: 'button', onClick: onRefresh }, t('refresh')))
          : null,
        h('section', { 'aria-labelledby': 'dsw-quick-presets-title', style: { paddingTop: 14 } },
          h('div', { style: S.sectionHead },
            h('span', { id: 'dsw-quick-presets-title', style: S.sectionLabel }, t('presetsTitle')),
            h('a', {
              href: routeHash('pack', active.id), style: S.linkAccent,
              onClick: (event) => {
                if (event && event.preventDefault) event.preventDefault()
                onNavigate({ page: 'pack', packId: active.id })
              },
            }, t('navPresets')),
          ),
          h('div', { style: { ...S.presetGrid, paddingTop: 10 } },
            presets.slice(0, 3).map((preset) => h('button', {
              key: preset.id,
              type: 'button',
              style: S.presetCard(preset.id === activePresetId),
              onClick: () => usePreset(preset.id),
              title: preset.description || preset.id,
            },
              h('span', { style: S.presetTitle }, preset.title),
              preset.id === activePresetId ? h('span', { style: S.badge }, t('presetCurrent')) : null)))),
        injectBlock,
      )

      const presetTabs = [
        ['rules', t('presetRules'), scopedRules.length],
        ['skills', t('presetSkills'), scopedSkills.length],
        ['templates', t('presetTemplates'), templates.length],
      ]

      const presetDetail = presetTab === 'rules'
        ? h('div', null, scopedRules.slice(0, 8).map((rule) => h('div', {
          key: rule.id,
          style: { display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid ' + HAIRLINE },
        },
          h('input', {
            type: 'checkbox',
            style: S.checkbox,
            checked: rule.enabled !== false,
            disabled: !!busy,
            'aria-label': rule.title,
            onChange: (event) => onRuleToggle(rule, event.target.checked),
          }),
          h('span', { style: S.ruleTitle }, rule.title),
          scopeBadge(rule))))
        : presetTab === 'skills'
          ? h('div', null, scopedSkills.slice(0, 10).map((skill) => h('div', {
            key: skill.name,
            className: 'dsw-row',
            style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid ' + HAIRLINE },
          },
            h('span', { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
              h('span', { style: S.skillName }, skill.name),
              h('span', { style: S.skillDesc, title: skill.description }, skill.description || '')),
            h('span', { style: skill.enabled === false ? S.scopeBadge('workspace') : S.mutedBadge },
              skill.enabled === false ? t('disabled') : (skill.inPreset ? t('presetCurrent') : t('enabled'))))))
          : (templates.length
            ? h('div', null, templates.map((tpl) => h('div', {
              key: tpl.id,
              style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid ' + HAIRLINE },
            },
              h('span', { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
                h('span', { style: S.ruleTitle }, tpl.title || tpl.id),
                h('span', { style: S.skillDesc, title: tpl.text }, tpl.text.slice(0, 90))),
              h('button', { style: S.linkButton, onClick: () => onCopy(tpl.text, tpl.title || tpl.id) }, t('injectCopy')))))
            : h('div', { style: S.empty }, h('div', { style: S.hint }, t('envUnavailable') + t('presetTemplates'))))

      const presetsBlock = h(Section, {
        id: 'dsw-presets',
        label: '③ ' + t('presetsTitle'),
        right: h('button', { style: S.linkAccent, onClick: () => setEditing({ id: '', title: '', text: '' }) }, '+ ' + t('presetNew')),
      },
        h('div', { style: { ...S.hint, paddingTop: 8 } }, t('presetsHint')),
        h('div', { style: S.presetGrid },
          presetCards,
          h('button', { style: S.presetCardNew, onClick: () => setEditing({ id: '', title: '', text: '' }) },
            h('span', { style: { fontSize: 17, lineHeight: 1 } }, '+'),
            h('span', null, t('presetNew')))),
        h('div', { style: { ...S.filterRow, marginLeft: 0, paddingTop: 16, gap: 2 } },
          presetTabs.map(([key, label, count]) => h('button', {
            key,
            style: presetTab === key ? { ...S.pill, ...S.pillActive } : S.pill,
            onClick: () => setPresetTab(key),
          }, label + ' · ' + count))),
        presetDetail)

      /* ④ metrics — every number with the working shown */
      const metricTabs = [
        ['metrics', t('metricsTitle')],
        ['sources', t('injectSources')],
      ]

      /* The only honest comparison is against the previous report window. */
      const baselineKey = { 'plan-rate': 'planRate', 'verify-rate': 'verifyRate' }
      const metricDelta = (metrics, metric) => {
        const key = baselineKey[metric.id]
        if (!metrics || !metrics.baseline || !metrics.baseline.available || !key) return null
        const pair = metrics.baseline[key]
        return pair && typeof pair.delta === 'number' ? pair.delta : null
      }

      const metricCards = met && met.available
        ? met.metrics.map((metric) => h('div', { key: metric.id, style: S.metricCard },
          h('div', { style: S.metricTop },
            h('span', { style: S.metricLabel }, metric.label),
            metricDelta(met, metric)
              ? h('span', {
                style: metricDelta(met, metric) > 0 ? S.deltaUp : S.deltaDown,
                title: met.baseline.note,
              }, t('baseline') + ' ' + (metricDelta(met, metric) > 0 ? '+' : '') + metricDelta(met, metric) + '%')
              : null),
          h('div', { style: S.metricValueRow },
            h('span', { style: S.metricValue }, metric.value),
            h('span', { style: S.metricUnit }, metric.unit)),
          h('div', { style: S.metricFormula, title: metric.formula },
            h('strong', null, t('metricsFormula') + '：'), metric.formula),
          h('div', { style: S.metricFormula }, metric.denominator)))
        : null

      const metricsBody = met && met.available
        ? (metricTab === 'metrics'
          ? h('div', null,
            h('div', { style: S.metricGrid }, metricCards),
            met.caveat ? h('div', { style: S.caveat }, met.caveat) : null)
          : h('div', { style: S.evidenceGrid },
            (met.sources || []).map((item) => h('div', { key: item.key, style: S.stat },
              h('span', { style: S.statLabel }, item.label),
              h('span', { style: S.statValue }, item.available ? '✓' : '✗'),
              h('span', { style: S.statSub }, item.available ? t('enabled') : t('disabled'))))))
        : h('div', { style: S.empty }, h('div', { style: S.hint }, t('metricsUnavailable')))

      const metricsBlock = h(Section, {
        id: 'dsw-metrics',
        label: '④ ' + t('metricsTitle'),
        right: h('span', { style: { display: 'inline-flex', gap: 12, alignItems: 'center', fontSize: 12 } },
          met && met.scanned ? h('span', { style: S.faint, title: met.scanned }, t('metricsWindow')) : null,
          h('button', { style: S.linkAccent, onClick: onDistill, disabled: !!busy }, t('metricsRebuild'))),
      },
        h('div', { style: { ...S.hint, paddingTop: 8 } }, t('metricsHint')),
        met && met.available
          ? h('div', { style: { ...S.filterRow, marginLeft: 0, paddingTop: 12, gap: 2 } },
            metricTabs.map(([key, label]) => h('button', {
              key,
              style: metricTab === key ? { ...S.pill, ...S.pillActive } : S.pill,
              onClick: () => setMetricTab(key),
            }, label))) : null,
        metricsBody)

      const projectFileText = (() => {
        if (!sc || !sc.project || !sc.project.file) return ''
        return sc.project.present
          ? t('projectFile') + ' ' + sc.project.file
          : t('noProjectFile') + '（' + t('projectFile') + ' ' + sc.project.file + '）'
      })()

      /* ⑤ distribution */
      const distributionBlock = h(Section, {
        id: 'dsw-distribution',
        label: '⑤ ' + t('distributionTitle'),
        right: h('span', null, t('packs')),
      },
        h('div', { style: S.distHeadRow },
          h('div', { style: S.distPrimaryRow },
            h('button', {
              style: busy ? { ...S.buttonPrimary, ...S.disabled } : S.buttonPrimary,
              onClick: onExport, disabled: !!busy,
            }, busy === 'export' ? t('exporting') : t('exportWithScope')),
            h('button', { style: S.button, onClick: onExport, disabled: !!busy }, t('exportPackOnly')),
            h('button', { style: S.button, onClick: () => onCopy(installCommand, installCommand) }, t('copyCommand'))),
          h('span', { style: S.hint }, projectFileText)))


      const reviewSectionBody = suggestions.length === 0
              ? h('div', { style: S.empty }, h('div', { style: S.hint }, t('reviewEmpty')))
              : allHandled
                ? (showHandled ? h('div', { style: { display: 'flex', flexDirection: 'column' } }, reviewRows(handledSuggestions)) : null)
                : [
                  pendingSuggestions.length
                    ? h('div', { key: 'pending' },
                      h('div', { style: { ...S.hint, paddingTop: 10 } }, t('reviewHint')),
                      h('div', { style: { display: 'flex', flexDirection: 'column' } }, reviewRows(pendingSuggestions)),
                      h('div', { style: S.actions },
                        h('button', {
                          style: busy ? { ...S.button, ...S.disabled } : S.button,
                          disabled: !!busy, onClick: () => onAdopt(true),
                        }, t('adoptAll')),
                        h('button', {
                          style: (busy || selected.length === 0) ? { ...S.buttonPrimary, ...S.disabled } : S.buttonPrimary,
                          disabled: !!busy || selected.length === 0, onClick: () => onAdopt(false),
                        }, busy === 'adopt' ? t('adopting') : t('adoptSelected') + (selected.length ? ' (' + selected.length + ')' : ''))))
                    : null,
                  handledSuggestions.length
                    ? h('div', { key: 'handled' },
                      h('div', { style: S.handledRow, paddingTop: pendingSuggestions.length ? 12 : 10 },
                        h('span', { style: { ...S.sectionLabel, fontSize: 12.5, fontWeight: 600 } }, t('handled') + ' · ' + handledSuggestions.length),
                        h('button', {
                          style: S.linkAccent,
                          onClick: () => setShowHandled((prev) => !prev),
                        }, showHandled ? t('hideHandled') : t('viewHandled'))),
                      showHandled
                        ? h('div', { style: { display: 'flex', flexDirection: 'column' } }, reviewRows(handledSuggestions))
                        : null)
                    : null,
                ]

      const pageLinks = [
        ['run', '运行台'], ['packs', '工作方式包'], ['distill', '蒸馏'],
        ['metrics', '度量台'], ['distribute', '分发'],
      ]
      const primaryNav = h('nav', { 'aria-label': '工作方式', style: S.tabs },
        pageLinks.map(([page, label]) => h('a', {
          key: page,
          href: routeHash(page),
          'aria-current': route.page === page ? 'page' : undefined,
          style: route.page === page ? { ...S.tab, ...S.tabOn, textDecoration: 'none' } : { ...S.tab, textDecoration: 'none' },
          onClick: (event) => {
            if (event && event.preventDefault) event.preventDefault()
            navigate({ page })
          },
        }, label)))
      const environmentBar = h('div', {
        role: 'region', 'aria-label': '当前环境',
        style: { ...S.rail, marginBottom: 16 },
      },
        h('span', { style: S.railLabel }, '环境'),
        h('span', { style: S.railValue }, environment.cwd || '未指定目录'),
        h('span', { style: S.railLabel }, environment.sessionId ? '会话 ' + environment.sessionId : '未指定会话'),
        environment.loading ? h('span', { style: S.railLabel }, '加载中…') : null,
        environment.error ? h('span', { style: S.railLabel }, environment.error) : null)

      const evidenceSection = h(Section, {
        id: 'dsw-evidence',
        label: t('about'),
        right: h('span', { style: S.sectionRight }, latest ? t('generated') + ' ' + when(latest.generatedAt) : t('never')),
      },
        h('div', { style: { paddingTop: 10 } },
          evidenceBody,
          h('div', { style: S.sourceList },
            [['Claude Code', 'claude'], ['Codex', 'codex'], ['DeepSeek Harness', 'dsh'], ['Pi', 'pi']].map(([label, key]) => h('div', { key, style: S.sourceRow },
              h('span', { style: S.sourceName }, label),
              h('span', { style: S.sourcePath, title: (status.sources || {})[key] || '' }, (status.sources || {})[key] || '-')))),
          h('div', { style: { ...S.hint, paddingTop: 8 } }, t('aboutHint'))))

      const runBody = h(RunPage, {
        environment,
        onNavigate: navigate,
        onRefresh: load,
        onUsePreset,
      })

      /* The pack routes own the deep inventories: every effective rule with
         its layer, presets, and the distillation review queue. The run page
         proves what is active; the pack page is where that is edited. */
      const packDetailBody = h('div', null,
        rulesBlock,
        presetsBlock,
        (pendingCount > 0 || allHandled) ? h(Section, {
          id: 'dsw-review',
          label: t('review'),
          count: suggestions.length,
          right: allHandled
            ? h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 10 } },
              h('span', null, t('allHandled') + ' · ' + handledSuggestions.length + ' ' + t('inPackUnit')),
              h('button', { style: S.linkAccent, onClick: () => setShowHandled((prev) => !prev) },
                showHandled ? t('hideHandled') : t('viewHandled')))
            : (adoptions.length ? adoptedCount + ' ' + t('adoptedUnit') : null),
        }, reviewSectionBody) : null)

      const packListBody = h('div', null,
        h('div', { style: S.hint }, '选择一个包查看它的规则、技能、预设与模板。'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10, paddingTop: 14 } },
          packs.map((pack) => h('a', {
            key: pack.id, href: routeHash('packs', pack.id), style: { ...S.tile, textDecoration: 'none' },
            onClick: (event) => { if (event && event.preventDefault) event.preventDefault(); navigate({ page: 'packs', packId: pack.id }) },
          },
            h('div', { style: S.ruleTitleRow },
              h('span', { style: S.ruleTitle }, pack.displayName || pack.name || pack.id),
              pack.id === active.id ? h('span', { style: S.badge }, '当前') : null),
            h('span', { style: S.mono }, pack.id + ' · v' + pack.version),
            h('span', { style: S.tileSub }, '来源：' + (pack.source || '本地内置') + ' · ' + (pack.ruleCount || 0) + ' 条规则 · ' + (pack.skillCount || 0) + ' 个技能'),
            pack.id === active.id ? h('span', { style: S.hint }, '当前生效') : h('span', { style: S.hint }, '可查看')))))

      const routePackDetail = packDetail && packDetail.id === route.packId ? packDetail : null
      const selectedPack = routePackDetail || packs.find((pack) => pack.id === route.packId) || null
      const selectedIsActive = !!selectedPack && selectedPack.id === active.id
      const detailTabs = [
        ['rules', '规则', selectedPack ? (selectedIsActive ? scopedRules.length : (selectedPack.rules || []).length) : 0],
        ['skills', '技能', selectedPack ? (selectedIsActive ? scopedSkills.length : (selectedPack.skills || []).length) : 0],
        ['presets', '预设', selectedPack ? (selectedIsActive ? presets.length : (selectedPack.presets || []).length) : 0],
        ['templates', '模板', selectedPack ? (selectedIsActive ? templates.length : (selectedPack.templates || []).length) : 0],
      ]
      const readOnlyResource = (label, items, render) => h('section', { style: S.section },
        h('div', { style: S.sectionHead }, h('span', { style: S.sectionLabel }, label), h('span', { style: S.sectionCount }, String(items.length)),
          h('span', { style: S.sectionRight }, '只读')),
        items.length ? h('div', { style: { display: 'flex', flexDirection: 'column' } }, items.map(render))
          : h('div', { style: S.empty }, h('div', { style: S.hint }, '暂无' + label)))
      const nonActiveDetail = selectedPack
        ? packTab === 'rules'
          ? readOnlyResource('规则', selectedPack.rules || [], (rule) => h('div', { key: rule.id, style: S.ruleRowV5 },
            h('span', { style: S.scopeBadge('workspace') }, '包'), h('div', { style: { minWidth: 0 } }, h('div', { style: S.ruleTitle }, rule.title), h('div', { style: S.ruleText }, rule.text)), h('span', { style: S.mutedBadge }, '只读')))
          : packTab === 'skills'
            ? readOnlyResource('技能', selectedPack.skills || [], (skill) => h('div', { key: skill.name, style: S.skillRow },
              h('div', { style: S.skillHead }, h('span', { style: S.skillName }, skill.name), h('span', { style: S.skillDesc }, skill.description || ''), h('span', { style: S.mutedBadge }, '只读'))))
            : packTab === 'presets'
              ? readOnlyResource('预设', selectedPack.presets || [], (preset) => h('div', { key: preset.id, style: S.ruleRowV5 }, h('div', { style: S.ruleTitle }, preset.title || preset.id), h('span', { style: S.ruleSideText }, preset.description || ''), h('span', { style: S.mutedBadge }, '只读')))
              : readOnlyResource('模板', selectedPack.templates || [], (template) => h('div', { key: template.id, style: S.ruleRowV5 }, h('div', { style: S.ruleTitle }, template.title || template.id), h('span', { style: S.ruleSideText }, template.text || ''), h('span', { style: S.mutedBadge }, '只读')))
        : null
      const packDetailPageBody = !route.packId
        ? packListBody
        : packLoading && !selectedPack
          ? h('div', { style: S.empty }, h('div', { style: S.hint }, '正在加载工作方式包…'))
          : (packError && !selectedPack) || !selectedPack
            ? h('div', { style: S.empty }, h('div', { style: S.banner('error') }, '找不到工作方式包：' + (route.packId || '') ), h('a', { href: '#/packs', style: S.linkAccent, onClick: (event) => { if (event && event.preventDefault) event.preventDefault(); navigate({ page: 'packs' }) } }, '返回工作方式包'))
            : h('div', null,
              h('div', { style: S.tile }, h('div', { style: S.ruleTitleRow }, h('span', { style: S.ruleTitle }, selectedPack.displayName || selectedPack.name || selectedPack.id), selectedIsActive ? h('span', { style: S.badge }, '当前') : h('span', { style: S.mutedBadge }, '未启用')), h('span', { style: S.mono }, selectedPack.id + ' · v' + selectedPack.version), h('span', { style: S.hint }, '来源：' + (selectedPack.source || '本地内置') + ' · ' + selectedPack.ruleCount + ' 条规则 · ' + selectedPack.skillCount + ' 个技能')),
              h('div', { role: 'tablist', 'aria-label': '工作方式包资源', style: S.tabs }, detailTabs.map(([key, label, count]) => h('button', { key, role: 'tab', id: 'dsw-pack-tab-' + key, 'aria-controls': 'dsw-pack-panel-' + key, 'aria-selected': packTab === key ? 'true' : 'false', tabIndex: packTab === key ? 0 : -1, style: packTab === key ? { ...S.tab, ...S.tabOn } : S.tab, onClick: () => setPackTab(key) }, label + ' · ' + count))),
              h('div', { role: 'tabpanel', id: 'dsw-pack-panel-' + packTab, 'aria-labelledby': 'dsw-pack-tab-' + packTab }, selectedIsActive ? packDetailBody : nonActiveDetail))

      const pageBody = route.page === 'run'
        ? h('section', { 'aria-labelledby': 'dsw-run-title' },
          h('h2', { id: 'dsw-run-title', style: { ...S.sectionLabel, fontSize: 18, margin: '0 0 12px' } }, '运行台'),
          runBody)
        : route.page === 'packs' || route.page === 'pack'
          ? h('section', { 'aria-labelledby': 'dsw-packs-title' },
            h('h2', { id: 'dsw-packs-title', style: { ...S.sectionLabel, fontSize: 18 } }, route.packId ? '工作方式包详情' : '工作方式包'),
            packDetailPageBody)
          : route.page === 'distill'
              ? h('section', { 'aria-labelledby': 'dsw-distill-title' },
                h('h2', { id: 'dsw-distill-title', style: { ...S.sectionLabel, fontSize: 18 } }, '蒸馏'),
                h('div', { style: S.hint }, '从本机会话生成可审阅的工作方式建议。'),
                h('button', { style: S.buttonPrimary, onClick: onDistill, disabled: !!busy }, busy === 'distill' ? t('distilling') : t('distill')))
              : route.page === 'metrics'
                ? h('section', { 'aria-labelledby': 'dsw-metrics-title' },
                  h('h2', { id: 'dsw-metrics-title', style: { ...S.sectionLabel, fontSize: 18 } }, '度量台'),
                  metricsBlock)
                : h('section', { 'aria-labelledby': 'dsw-distribute-title' },
                  h('h2', { id: 'dsw-distribute-title', style: { ...S.sectionLabel, fontSize: 18 } }, '分发'),
                  h('div', null, distributionBlock, evidenceSection))

      return h('div', { id: 'dsw-root', style: S.page },
        h('style', null, CSS),
        h('div', { style: S.inner },
          primaryNav,
          environmentBar,
          h('div', { style: S.header },
            h('div', { style: S.brandRow },
              h('div', { style: { minWidth: 0 } },
                h('h1', { style: S.title }, t('title')),
                h('div', { style: S.statusLine },
                  h('span', null,
                    t('session') + ' ',
                    h('span', { style: S.statusStrong }, session && session.id ? session.id.slice(0, 12) : '-')),
                  h('span', { style: S.statusDivider }),
                  h('span', null, projectFileText || t('noProjectFile')),
                  h('span', { style: S.statusDivider }),
                  h('span', null, active.displayName + ' v' + active.version)))),
            h('div', { style: S.toolbar },
              h('select', {
                style: S.select, value: active.id, disabled: busy === 'apply',
                onChange: (event) => onApply(event.target.value), title: t('packs'),
              }, packs.map((pack) => h('option', { key: pack.id, value: pack.id },
                (pack.displayName || pack.name || pack.id) + '  v' + pack.version))),
              h('button', {
                style: busy ? { ...S.button, ...S.disabled } : S.button,
                onClick: load, disabled: !!busy,
              }, t('refresh')))),

          error ? h('div', { style: S.banner('error') }, t('error') + '：' + error) : null,
          notice ? h('div', { style: S.banner('info') }, notice) : null,
          route.page !== 'run' && envError ? h('div', { style: S.banner('error'), role: 'alert' },
            t('envUnavailable') + envError,
            h('button', { style: S.linkAccent, type: 'button', onClick: load }, t('refresh'))) : null,

          pageBody,

          h('div', { style: S.footer },
            h('span', null, BUILD),
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
      }, (host) => h(Panel, {
        t,
        cwd: host && host.cwd,
        sessionId: host && host.sessionId,
        sessionIds: host && host.sessionIds,
      })))

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
