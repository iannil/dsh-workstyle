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

    const TOKENS = {
      light: { bg:'#FFFFFF', surface:'#F7F6F3', sel:'#EFEDEA', border:'#EDECE9',
               ink:'#37352F', ink2:'#787774', ink3:'#9B9A97', accent:'#37352F',
               danger:'#EB5757', ok:'#2E9E5B' },
      dark:  { bg:'#191919', surface:'#202020', sel:'#2C2C2C', border:'#313131',
               ink:'#E9E9E7', ink2:'#9B9B98', ink3:'#6F6F6C', accent:'#E9E9E7',
               danger:'#E5484D', ok:'#4CB782' },
    }

    /* Theme tokens resolve through the harness CSS variables, never a
       load-time snapshot: the plugin can mount before the shell paints its
       theme, and a snapshot would leave dark-mode text invisible. TOKENS stays
       as the documented palette behind those variables. */
    const T = {
      bg: 'var(--dsw-alias-bg-base)',
      surface: 'var(--dsw-alias-bg-layer-1)',
      sel: 'color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent)',
      border: 'color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent)',
      ink: 'var(--dsw-alias-label-primary)',
      ink2: 'var(--dsw-alias-label-secondary)',
      ink3: 'color-mix(in srgb, var(--dsw-alias-label-secondary) 62%, transparent)',
      accent: 'var(--dsw-alias-label-primary)',
      danger: 'var(--dsw-alias-state-error-primary)',
      ok: 'var(--dsw-alias-state-success-primary)',
    }
    const ACCENT = T.accent
    const ACCENT_LINE = 'color-mix(in srgb, currentColor 45%, transparent)'
    const ACCENT_SOFT = 'color-mix(in srgb, currentColor 9%, transparent)'
    const HAIRLINE = 'var(--dsw-alias-border-l1)'
    const STATE_INFO = 'var(--dsw-alias-state-info-primary, ' + T.ink2 + ')'
    const PRIMARY_BG = T.accent
    const PRIMARY_FG = T.bg
    const BUILD = 'home v5 · 2026-11-08'

    /* ------------------------------ dictionaries --------------------------- */

    let scopedT = (key) => key
    const zh = {
      nav: '工作方式',
      title: '工作方式',
      packs: '工作方式包',
      skills: '技能',
      refresh: '刷新',
      distill: '蒸馏证据',
      distilling: '蒸馏中…',
      exporting: '导出中…',
      exported: '已导出',
      copyCommand: '复制安装命令',
      copyPath: '复制路径',
      copyFailed: '复制失败，请手动复制',
      copied: '已复制',
      adoptedUnit: '条本地采纳',
      fromPack: '随包提供',
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
      evidence: '证据',
      noEvidence: '无证据',
      all: '全部',
      enabled: '启用',
      disabled: '停用',
      distilledFilter: '蒸馏采纳',
      noEvidenceFilter: '缺证据',
      about: '关于',
      aboutHint: '只读本机数据，不联网、不上传；蒸馏只保存聚合统计。',
      rulesLabel: '规则',
      skillsLabel: '技能',
      loadingPack: '正在加载工作方式包…',
      opLoadPack: '加载工作方式包',
      packNotFound: '找不到工作方式包：',
      backToPacks: '返回工作方式包',
      loadingDefault: '正在加载…',
      failPrefix: '失败：',
      failFallback: '暂时无法完成。',
      retry: '重试',
      noCwd: '未指定目录',
      sessionPrefix: '会话 ',
      noSession: '未指定会话',
      loadingShort: '加载中…',
      reportsUnavailable: '报告历史不可用',
      exportsUnavailable: '导出历史不可用',
      envLoadingRetry: '环境正在加载，请稍后重试',
      opStatus: '状态加载',
      loadingStatus: '正在加载工作方式状态…',
      packResourcesAria: '工作方式包资源',
      opExport: '导出工作方式包',
      recentExports: '最近导出',
      opLoadExportHistory: '加载导出历史',
      noExportsYet: '还没有导出记录。复制安装命令后，导出一个包交给队友。',
      loadingEnv: '正在读取当前环境的数据，请稍候。',
      envLabel: '当前环境',
      tabRun: '运行台',
      pageRun: '运行台',
      tabPacks: '工作方式包',
      pageMetrics: '指标与运行',
      pageDistribute: '分发',
      pagePackDetail: '工作包',
      tabDistill: '蒸馏',
      tabMetrics: '度量台',
      tabDistribute: '分发',
      navWorkstyle: '工作方式',
      opRun: '执行当前操作',
      opRefreshEnv: '刷新当前环境',
      opReadPack: '读取当前工作方式包',
      noActivePackLong: '没有可用的当前工作方式包。',
      packHint: '选择一个包查看它的规则、技能、预设与模板。',
      packActiveBadge: '当前',
      packInactiveBadge: '未启用',
      packActiveNow: '当前生效',
      packViewable: '可查看',
      packNew: '新建包',
      packImport: '导入包',
      packDuplicate: '复制',
      packRename: '重命名',
      packDelete: '删除',
      packRestore: '恢复',
      packTrash: '回收站',
      packTrashHint: '删除的包会移到本机回收站，可以在这里恢复。',
      packTrashEmpty: '回收站是空的。',
      packTrashUnavailable: '回收站暂时无法读取',
      packReadonlyNote: '只读包：不能重命名或删除。',
      packWritableNote: '本机包：可以重命名、复制和删除。',
      packImportPath: '包目录',
      packIdLabel: '包 id',
      packDisplayNameLabel: '显示名称',
      packFieldRequired: '请填写必填项。',
      packSave: '保存',
      packDeleteConfirm: '确认删除',
      packDeleteHint: '删除后移入回收站，可稍后恢复。',
      revisionsTitle: '修订历史',
      revisionsEmpty: '还没有修订记录。',
      revisionRestore: '回滚',
      presetAddedNotice: '已加入当前预设',
      sourcePrefix: '来源：',
      sourceBuiltin: '本地内置',
      rulesUnit: '条规则',
      skillsUnit: '个技能',
      readonly: '只读',
      emptyNone: '暂无',
      emptyPrefix: '暂无',
      emptySuffix: '，',
      emptyOr: ' 或 ',
      originPackBadge: '包',
      presetsLabel: '预设',
      templatesLabel: '模板',
      currentProject: '当前项目：',
      installCommandLabel: '安装命令',
      filesUnit: '个文件',
      exportScopeHint: '导出只包含可移植的工作方式包；作用域快照只保存项目规则、停用项与预设，不包含任意文件内容。',
      distillReview: '蒸馏审阅',
      localData: '本地数据',
      scanHint: '扫描本机会话生成聚合建议；不联网、不上传，不保存 prompt 原文。',
      lastGenerated: '最近生成：',
      neverScanned: '尚未扫描',
      sourceAvailable: '可用',
      sourceMissing: '未发现',
      sourcesAfterScan: '扫描后显示本机来源状态。',
      suggestionsReview: '建议审阅',
      reportHistory: '报告历史',
      opLoadHistory: '加载报告历史',
      noAvailableSources: '无可用来源',
      suggestionsCountUnit: '条建议',
      noReportsYet: '还没有报告。扫描本地数据后，这里只显示生成时间、来源和建议数量。',
      viewMetrics: '查看代理度量 →',
      formula: '公式：',
      denominator: '分母：',
      window: '窗口：',
      agentMetrics: '代理度量',
      recomputable: '可复算',
      metricsCaveat: '这些数字描述可观察的提示与来源覆盖，不能说明模型是否遵守规则。',
      tabMetricsPill: '度量',
      tabSources: '来源',
      defaultCaveat: '这些是代理指标，只描述可观察信号。',
      navOverview: '概览',
      packSwitch: '切换包',
      quickActions: '快捷动作',
      statRules: '生效规则',
      statSuggestions: '待审查建议',
      statSkills: '技能数',
      quickEditRules: '编辑规则',
      quickLoadPreview: '载入预览',
      quickDistill: '蒸馏一次',
      navRail: '工作包',
      navRules: '规则',
      navPresets: '预设',
      navSkills: '技能',
      navDistill: '蒸馏审查',
      navMetrics: '指标与运行',
      navDistribute: '分发',
      navGroupState: '状态',
      navGroupContent: '内容',
      navGroupMaintain: '维护',
      distillFirstHint: '先蒸馏一次本机会话，再回来查看代理度量。',
      goDistill: '先去蒸馏 →',
      metricsEmptyNoun: '可用度量',
      metricsEmptyPrimary: '先去蒸馏',

      privacy: '只读本机数据，不联网、不上传，不保存 prompt 原文',
      evidenceHint: '点「蒸馏证据」扫描本机会话，生成可审阅的聚合报告（不保存原文）。',
      promptUnit: '条 prompt',
      chineseUnit: '条中文',
      planUnit: '条方案词',
      sessionUnit: '个会话',
      toolCallsUnit: '次工具调用',
      messagesUnit: '条消息',
      sampled: '采样',
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
      scopeWorkspace: '全局',
      scopeSession: '会话',
      injected: '注入中',
      fingerprint: '指纹',
      pending: '待办',
      navPresets: '预设与规则',
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
      editPreset: '编辑',
      duplicatePreset: '复制',
      deletePreset: '删除',
      restorePreset: '恢复',
      savePreset: '保存',
      presetEditorTitle: '编辑预设',
      presetIdLabel: '预设 id',
      presetDescLabel: '说明',
      presetWhitelistHint: '提示：只有勾选的规则会被注入',
      presetDanglingRules: '预设引用的规则已不存在',
      presetIdRequired: '预设 id 和名称不能为空',
      presetSaved: '预设已保存到本机覆盖层',
      presetDeleted: '预设已删除',
      presetDeletedLocal: '本机预设已删除',
      presetBlockedNotice: '包内预设不能删除，已屏蔽',
      presetDuplicated: '预设已复制',
      presetRestored: '预设已恢复',
      presetBlockedTitle: '已屏蔽预设',
      presetBlockedHint: '屏蔽的预设不再参与组装；恢复后重新出现在列表里。',
      presetForceTitle: '预设仍被会话占用',
      presetForceBody: '以下会话仍在使用这个预设；强制删除后它们会退回全局规则集。确认删除请点「删除」',
      metricsUnavailable: '尚未蒸馏：先运行一次蒸馏，度量才有可复算的底稿。',
      baseline: '较上次',
      distributionTitle: '分发',
      exportWithScope: '导出包 + 作用域快照',
      exportPackOnly: '导出包（仅包）',
      todoDistill: '蒸馏建议待审',
      todoEvidence: '规则缺证据',
      todoConflict: '作用域冲突',
      todoUnverified: '未验证宣称',
      projectFile: '项目叠层读取自',
      noProjectFile: '尚未创建项目叠层',
      disabledBy: '被覆盖',
      severity: '严重度',
      severityHigh: '高',
      severityMedium: '中',
      severityLow: '低',
      originPack: '包',
      originProject: '项目',
      newRule: '新建规则',
      rulesEmptyNoun: '规则',
      rulesEmptyPrimary: '+ 新规则',
      rulesEmptySource: '蒸馏生成',
      rulesDisabledNoun: '已停用',
      editRule: '编辑',
      saveRule: '保存',
      cancel: '取消',
      ruleIdLabel: '规则 id',
      ruleTitleLabel: '标题',
      ruleTextLabel: '正文',
      ruleSaved: '规则已保存到项目叠层',
      ruleSavedLocal: '规则已保存到本机',
      ruleRestored: '规则已恢复',
      ruleRemoved: '规则已从项目叠层移除',
      ruleRemovedLocal: '已从本机移除',
      removeRule: '移除',
      targetOverlay: '本机覆盖层（不改包文件）',
      targetPack: '包文件（直接写入）',
      targetProject: '项目层（.dsh/workstyle.json）',
      targetUnknown: '位置未知 · 只读',
      writeTarget: '将写入',
      writeBlocked: '无法写入：该包使用 workstyle.yaml，请直接编辑该文件',
      outsidePreset: '不在当前预设',
      addToPreset: '加入当前预设',
      restoreRule: '恢复',
      removedTag: '已移除',
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
      skills: 'Skills',
      refresh: 'Refresh',
      distill: 'Distill evidence',
      distilling: 'Distilling…',
      exporting: 'Exporting…',
      exported: 'Exported',
      copyCommand: 'Copy install command',
      copyPath: 'Copy path',
      copyFailed: 'Copy failed; please copy manually',
      copied: 'Copied',
      adoptedUnit: 'local adoption(s)',
      fromPack: 'from pack',
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
      evidence: 'Evidence',
      noEvidence: 'No evidence',
      all: 'All',
      enabled: 'Enabled',
      disabled: 'Disabled',
      distilledFilter: 'Adopted',
      noEvidenceFilter: 'No evidence',
      about: 'About',
      aboutHint: 'Read-only local data · no network · no upload; distillation stores aggregates only.',
      rulesLabel: 'Rules',
      skillsLabel: 'Skills',
      loadingPack: 'Loading pack…',
      opLoadPack: 'Load pack',
      packNotFound: 'Pack not found: ',
      backToPacks: 'Back to packs',
      loadingDefault: 'Loading…',
      failPrefix: 'failed: ',
      failFallback: 'The operation could not be completed.',
      retry: 'Retry',
      noCwd: 'no directory',
      sessionPrefix: 'session ',
      noSession: 'no session',
      loadingShort: 'loading…',
      reportsUnavailable: 'Report history unavailable',
      exportsUnavailable: 'Export history unavailable',
      envLoadingRetry: 'Environment is loading, please retry',
      opStatus: 'Load status',
      loadingStatus: 'Loading workstyle status…',
      packResourcesAria: 'Pack resources',
      opExport: 'Export pack',
      recentExports: 'Recent exports',
      opLoadExportHistory: 'Load export history',
      noExportsYet: 'No exports yet. Copy the install command, then export a pack for your teammate.',
      loadingEnv: 'Loading the current environment, please wait.',
      envLabel: 'Current environment',
      tabRun: 'Run console',
      pageRun: 'Run console',
      tabPacks: 'Workstyle packs',
      pageMetrics: 'Metrics & run',
      pageDistribute: 'Distribute',
      pagePackDetail: 'Work package',
      tabDistill: 'Distill',
      tabMetrics: 'Metrics',
      tabDistribute: 'Distribute',
      navWorkstyle: 'Workstyle',
      opRun: 'Run operation',
      opRefreshEnv: 'Refresh environment',
      opReadPack: 'Read active pack',
      noActivePackLong: 'No active workstyle pack available.',
      packHint: 'Pick a pack to inspect its rules, skills, presets and templates.',
      packActiveBadge: 'active',
      packInactiveBadge: 'inactive',
      packActiveNow: 'currently active',
      packViewable: 'viewable',
      packNew: 'New pack',
      packImport: 'Import pack',
      packDuplicate: 'Duplicate',
      packRename: 'Rename',
      packDelete: 'Delete',
      packRestore: 'Restore',
      packTrash: 'Trash',
      packTrashHint: 'Deleted packs move to the local trash and can be restored here.',
      packTrashEmpty: 'The trash is empty.',
      packTrashUnavailable: 'Trash is unavailable',
      packReadonlyNote: 'Read-only pack: rename and delete are unavailable.',
      packWritableNote: 'Local pack: rename, duplicate and delete are available.',
      packImportPath: 'Pack directory',
      packIdLabel: 'Pack id',
      packDisplayNameLabel: 'Display name',
      packFieldRequired: 'Fill in the required fields.',
      packSave: 'Save',
      packDeleteConfirm: 'Confirm delete',
      packDeleteHint: 'The pack moves to the trash and can be restored later.',
      revisionsTitle: 'Revision history',
      revisionsEmpty: 'No revisions yet.',
      revisionRestore: 'Roll back',
      presetAddedNotice: 'Added to the current preset',
      sourcePrefix: 'Source: ',
      sourceBuiltin: 'bundled',
      rulesUnit: 'rules',
      skillsUnit: 'skills',
      readonly: 'read-only',
      emptyNone: 'none',
      emptyPrefix: 'No',
      emptySuffix: ' yet,',
      emptyOr: ' or ',
      originPackBadge: 'pack',
      presetsLabel: 'Presets',
      templatesLabel: 'Templates',
      currentProject: 'Current project: ',
      installCommandLabel: 'Install command',
      filesUnit: 'files',
      exportScopeHint: 'Exports contain only the portable workstyle pack; the scope snapshot stores project rules, disabled ids and presets, never arbitrary file content.',
      distillReview: 'Distill review',
      localData: 'local data',
      scanHint: 'Scan local sessions into aggregate suggestions; no network, no upload, no prompt text stored.',
      lastGenerated: 'Last generated: ',
      neverScanned: 'not scanned yet',
      sourceAvailable: 'available',
      sourceMissing: 'not found',
      sourcesAfterScan: 'Source status appears after a scan.',
      suggestionsReview: 'Suggestion review',
      reportHistory: 'Report history',
      opLoadHistory: 'Load report history',
      noAvailableSources: 'no available sources',
      suggestionsCountUnit: ' suggestions',
      noReportsYet: 'No reports yet. After a scan this lists generation time, sources and suggestion counts only.',
      viewMetrics: 'View agent metrics →',
      formula: 'Formula: ',
      denominator: 'Denominator: ',
      window: 'Window: ',
      agentMetrics: 'Agent metrics',
      recomputable: 'recomputable',
      metricsCaveat: 'These numbers describe observable prompts and source coverage, not rule compliance.',
      tabMetricsPill: 'Metrics',
      tabSources: 'Sources',
      defaultCaveat: 'These are agent metrics over observable signals only.',
      navOverview: 'Overview',
      packSwitch: 'Switch pack',
      quickActions: 'Quick actions',
      statRules: 'Active rules',
      statSuggestions: 'Pending suggestions',
      statSkills: 'Skills',
      quickEditRules: 'Edit rules',
      quickLoadPreview: 'Load preview',
      quickDistill: 'Distill now',
      navRail: 'Work packages',
      navRules: 'Rules',
      navPresets: 'Presets',
      navSkills: 'Skills',
      navDistill: 'Distill review',
      navMetrics: 'Metrics & run',
      navDistribute: 'Distribute',
      navGroupState: 'Status',
      navGroupContent: 'Content',
      navGroupMaintain: 'Maintain',
      distillFirstHint: 'Distill local sessions once, then come back to agent metrics.',
      goDistill: 'Distill first →',
      metricsEmptyNoun: 'metrics',
      metricsEmptyPrimary: 'distill first',

      privacy: 'Read-only local data. No network. No upload. Raw prompts never stored.',
      evidenceHint: 'Run "Distill evidence" to scan local sessions into a reviewable aggregate report (raw prompts are never stored).',
      promptUnit: 'prompts',
      chineseUnit: 'in Chinese',
      planUnit: 'plan keywords',
      sessionUnit: 'sessions',
      toolCallsUnit: 'tool calls',
      messagesUnit: 'messages',
      sampled: 'sampled',
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
      scopeWorkspace: 'Global',
      scopeSession: 'Session',
      injected: 'Injecting',
      fingerprint: 'Fingerprint',
      pending: 'To do',
      navPresets: 'Presets & rules',
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
      editPreset: 'Edit',
      duplicatePreset: 'Duplicate',
      deletePreset: 'Delete',
      restorePreset: 'Restore',
      savePreset: 'Save',
      presetEditorTitle: 'Edit preset',
      presetIdLabel: 'Preset id',
      presetDescLabel: 'Description',
      presetWhitelistHint: 'Hint: only ticked rules are injected',
      presetDanglingRules: 'Preset references rules that no longer exist',
      presetIdRequired: 'Preset id and title are required',
      presetSaved: 'Preset saved to the local overlay',
      presetDeleted: 'Preset deleted',
      presetDeletedLocal: 'Local preset deleted',
      presetBlockedNotice: 'A bundled preset cannot be deleted; it was blocked instead',
      presetDuplicated: 'Preset duplicated',
      presetRestored: 'Preset restored',
      presetBlockedTitle: 'Blocked presets',
      presetBlockedHint: 'A blocked preset no longer takes part in composition; restore it to bring it back into the list.',
      presetForceTitle: 'Preset still in use',
      presetForceBody: 'These sessions still pin this preset; forcing the delete falls them back to the global rule set. Confirm with “Delete”',
      metricsUnavailable: 'Not distilled yet: run a distillation first, then the numbers have a source.',
      baseline: 'vs previous',
      distributionTitle: 'Distribute',
      exportWithScope: 'Export pack + scope snapshot',
      exportPackOnly: 'Export pack only',
      todoDistill: 'suggestions to review',
      todoEvidence: 'rules without evidence',
      todoConflict: 'scope conflicts',
      todoUnverified: 'unverified claims',
      projectFile: 'Project layer read from',
      noProjectFile: 'No project layer yet',
      disabledBy: 'overridden',
      severity: 'severity',
      severityHigh: 'high',
      severityMedium: 'medium',
      severityLow: 'low',
      originPack: 'pack',
      originProject: 'project',
      newRule: 'New rule',
      rulesEmptyNoun: 'rules',
      rulesEmptyPrimary: '+ New rule',
      rulesEmptySource: 'Distill',
      rulesDisabledNoun: 'Disabled',
      editRule: 'Edit',
      saveRule: 'Save',
      cancel: 'Cancel',
      ruleIdLabel: 'Rule id',
      ruleTitleLabel: 'Title',
      ruleTextLabel: 'Text',
      ruleSaved: 'Rule saved to the project layer',
      ruleSavedLocal: 'Rule saved on this machine',
      ruleRestored: 'Rule restored',
      ruleRemoved: 'Rule removed from the project layer',
      ruleRemovedLocal: 'Removed on this machine',
      removeRule: 'Remove',
      targetOverlay: 'Local overlay (pack file untouched)',
      targetPack: 'Pack file (written directly)',
      targetProject: 'Project layer (.dsh/workstyle.json)',
      targetUnknown: 'unknown · read-only',
      writeTarget: 'Will write to',
      writeBlocked: 'Cannot save: this pack uses workstyle.yaml — edit that file directly',
      outsidePreset: 'Not in the current preset',
      addToPreset: 'Add to current preset',
      restoreRule: 'Restore',
      removedTag: 'Removed',
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
        fontSize: 13, lineHeight: 1.55,
      },

      /* Layout lives in the scoped stylesheet (dsw-frame / dsw-body / dsw-rail)
         so the narrow-window breakpoint can collapse the rail. */
      footWrap: { marginTop: 34 },

      header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', width: '100%' },
      brandRow: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, minWidth: 0 },
      title: {
        margin: 0, fontSize: 25, fontWeight: 650,
        letterSpacing: '-0.024em', lineHeight: 1.14,
      },
      statusLine: {
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        marginTop: 2, fontSize: 12, color: 'var(--dsw-alias-label-secondary)',
        minWidth: 0, overflowWrap: 'anywhere',
      },
      statusStrong: { fontWeight: 650, color: 'var(--dsw-alias-label-primary)' },
      statusDivider: { width: 1, height: 10, background: HAIRLINE, flex: 'none' },
      toolbar: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      select: {
        font: 'inherit', fontSize: 13, color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid ' + HAIRLINE,
        borderRadius: 8, padding: '8px 10px', outline: 'none', maxWidth: 260,
      },

      /* One page header rhythm for every route: title (+ count) left,
         one action right. */
      pageHead: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', minWidth: 0,
      },
      pageHeadText: { display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0, flexWrap: 'wrap' },
      pageTitle: { margin: 0, fontSize: 18, fontWeight: 650, letterSpacing: '-0.012em' },
      pageCount: {
        fontSize: 12, color: 'var(--dsw-alias-label-secondary)',
        fontVariantNumeric: 'tabular-nums',
      },
      smallButton: {
        font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        color: 'var(--dsw-alias-label-primary)', background: 'transparent',
        border: '1px solid ' + T.border, borderRadius: 7, padding: '5px 10px',
        whiteSpace: 'nowrap',
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

      chip: {
        fontSize: 11.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)',
        border: '1px solid ' + HAIRLINE, borderRadius: 999, padding: '0 7px',
        fontVariantNumeric: 'tabular-nums',
      },
      stateChip: (on) => ({
        font: 'inherit', fontSize: 12, lineHeight: 1.6, cursor: 'pointer',
        borderRadius: 999, padding: '2px 10px',
        background: on ? T.sel : 'transparent',
        color: on ? T.ink : T.ink2,
        border: '1px solid ' + (on ? T.sel : T.border),
      }),
      card: {
        display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
        border: '1px solid ' + T.border, borderRadius: 10, padding: '14px 16px',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      statCardLink: {
        display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
        border: '1px solid ' + T.border, borderRadius: 10, padding: '14px 16px',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'inherit', textDecoration: 'none', cursor: 'pointer',
      },
      statGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10,
      },
      fpChip: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10.5,
        color: 'var(--dsw-alias-label-secondary)', background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid ' + HAIRLINE, borderRadius: 5, padding: '1px 6px',
        fontVariantNumeric: 'tabular-nums',
      },
      cardLabel: { fontSize: 11.5, letterSpacing: '0.01em', fontWeight: 550, color: T.ink2 },
      cardValue: (tone) => ({
        fontSize: 24, fontWeight: 650, letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.25,
        color: tone === 'danger' ? T.danger : T.ink,
      }),
      emptyCenter: {
        padding: '24px 0', display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center', gap: 8,
      },
      emptyLine: { fontSize: 13, color: T.ink2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' },
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
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 12, flexWrap: 'wrap', minWidth: 0,
        borderTop: '1px solid ' + HAIRLINE, paddingTop: 16,
        fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)',
      },
      footerMeta: { flexShrink: 0, textAlign: 'right' },
      footerNote: { flex: '1 1 220px', minWidth: 0, textAlign: 'center' },

      envBar: {
        display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
        fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)', minWidth: 0,
      },
      envLabel: {
        fontSize: 10.5, fontWeight: 650, letterSpacing: '0.06em',
        color: T.ink3, flex: 'none',
      },
      envPath: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11,
        color: 'var(--dsw-alias-label-secondary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: '52ch', minWidth: 0,
      },
      envNote: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      banner: (kind) => ({
        fontSize: 12, lineHeight: 1.55, borderRadius: 8, padding: '9px 12px',
        border: '1px solid ' + (kind === 'error' ? T.danger : HAIRLINE),
        color: kind === 'error' ? T.danger : 'var(--dsw-alias-label-secondary)',
        background: kind === 'error' ? 'transparent' : 'var(--dsw-alias-bg-layer-2)',
      }),
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
        color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      },
      skillDesc: {
        fontSize: 12, color: T.ink2, lineHeight: 1.55,
        display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
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
      navGroupTitle: {
        fontSize: 10.5, fontWeight: 650, letterSpacing: '0.06em',
        color: T.ink3, padding: '0 10px 6px',
      },
      navItem: {
        display: 'block', fontSize: 13, fontWeight: 500, lineHeight: 1.45,
        color: T.ink2, textDecoration: 'none',
        padding: '6px 10px', borderRadius: 7,
      },
      navItemOn: { background: T.sel, color: T.ink, fontWeight: 650 },
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
        background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent)',
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
        background: kind === 'project' ? ACCENT_SOFT : kind === 'session' ? 'color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent)' : 'transparent',
        border: '1px solid ' + (kind === 'project' ? ACCENT_LINE : kind === 'session' ? 'color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent)' : HAIRLINE),
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
      #dsw-root button:focus-visible, #dsw-root input:focus-visible, #dsw-root select:focus-visible, #dsw-root textarea:focus-visible, #dsw-root [tabindex]:focus-visible {
        outline: 2px solid ${ACCENT}; outline-offset: 2px;
      }
      #dsw-root a:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; border-radius: 6px; }
      #dsw-root [role="tab"]:focus-visible { outline-offset: -2px; }
      /* Two-column shell: sticky route rail + reading column. */
      #dsw-root .dsw-frame {
        max-width: 1180px; margin: 0 auto; padding: 30px 40px 64px;
        display: flex; flex-direction: column; container-type: inline-size;
      }
      #dsw-root .dsw-masthead { padding-bottom: 20px; border-bottom: 1px solid ${HAIRLINE}; }
      #dsw-root .dsw-body {
        display: flex; align-items: flex-start; gap: 44px; padding-top: 26px;
      }
      #dsw-root .dsw-rail {
        flex: 0 0 200px; width: 200px; position: sticky; top: 24px; align-self: flex-start;
      }
      #dsw-root .dsw-content {
        flex: 1 1 auto; min-width: 0;
        display: flex; flex-direction: column; gap: 22px;
      }
      #dsw-root .dsw-nav { display: flex; flex-direction: column; gap: 18px; }
      #dsw-root .dsw-nav-group { display: flex; flex-direction: column; gap: 1px; }
      #dsw-root .dsw-nav-item { transition: background-color .12s ease, color .12s ease; }
      #dsw-root .dsw-nav-item:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent); }
      #dsw-root .dsw-nav-item-on:hover { background: ${T.sel}; }
      @media (max-width: 920px) {
        #dsw-root .dsw-frame { padding: 20px 20px 48px; }
        #dsw-root .dsw-body { flex-direction: column; gap: 18px; padding-top: 18px; }
        #dsw-root .dsw-rail { position: static; width: 100%; flex: 0 0 auto; }
        #dsw-root .dsw-nav { flex-direction: row; flex-wrap: wrap; gap: 4px; }
        #dsw-root .dsw-nav-group { display: contents; }
        #dsw-root .dsw-nav-group-title { display: none; }
      }
      /* The panel can be narrower than the window (slot beside the chat rail),
         so collapse on the frame's own width too. */
      @container (max-width: 760px) {
        #dsw-root .dsw-body { flex-direction: column; gap: 18px; padding-top: 18px; }
        #dsw-root .dsw-rail { position: static; width: 100%; flex: 0 0 auto; }
        #dsw-root .dsw-nav { flex-direction: row; flex-wrap: wrap; gap: 4px; }
        #dsw-root .dsw-nav-group { display: contents; }
        #dsw-root .dsw-nav-group-title { display: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        #dsw-root *, #dsw-root *::before, #dsw-root *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
      }
      #dsw-root input[type="checkbox"] {
        -webkit-appearance: none; appearance: none;
        width: 14px; height: 14px; margin: 0; flex: none;
        border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 30%, transparent);
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
      #dsw-root .dsw-stat-card { transition: background-color .12s ease, border-color .12s ease; }
      #dsw-root .dsw-stat-card:hover {
        background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, var(--dsw-alias-bg-layer-2));
        border-color: color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent);
      }
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

    function Card(props) {
      const { value, label, tone, href, onClick, title } = props
      const labelNode = label ? h('span', { style: S.cardLabel }, label) : null
      const valueNode = h('span', { style: S.cardValue(tone) }, String(value))
      if (!href && !onClick) return h('div', { style: S.card }, labelNode, valueNode)
      return h('a', {
        href: href || '#',
        className: 'dsw-stat-card',
        title: title || label || undefined,
        style: S.statCardLink,
        onClick: (event) => {
          if (event && event.preventDefault) event.preventDefault()
          if (onClick) onClick()
        },
      }, labelNode, valueNode)
    }

    function Chip(props) {
      const { label, count, on, onClick } = props
      return h('button', {
        type: 'button', style: S.stateChip(on), 'aria-pressed': on ? 'true' : 'false',
        onClick,
      },
        label, count === undefined || count === null ? null : h('span', {
          style: { marginLeft: 5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', opacity: 0.72 },
        }, String(count)))
    }

    function Loading(props) {
      const label = (props && props.label) || scopedT('loadingDefault')
      return h('div', { style: S.empty, role: 'status', 'aria-live': 'polite' },
        h('div', { style: S.ruleTitle }, label),
        h('div', { style: S.hint }, scopedT('loadingEnv')),
        h('div', { style: { ...S.skeleton, height: 8, width: '38%' }, 'aria-hidden': 'true' }))
    }

    function EmptyState(props) {
      const { noun, primary, source, onPrimary, onSource } = props
      return h('div', { style: S.emptyCenter },
        h('div', { style: S.emptyLine },
          scopedT('emptyPrefix') + ' ' + noun + scopedT('emptySuffix'),
          primary ? h('button', { type: 'button', style: S.linkButton, onClick: onPrimary }, primary) : null,
          source ? scopedT('emptyOr') : null,
          source ? h('button', { type: 'button', style: S.linkButton, onClick: onSource }, source) : null))
    }

    /* Grouped sidebar IA: three groups, labels via t(), selection via T.sel. */
    const NAV_GROUPS = [
      ['navGroupState', [['overview', 'navOverview'], ['pack', 'navRail']]],
      ['navGroupContent', [['rules', 'navRules'], ['presets', 'navPresets'], ['skills', 'navSkills']]],
      ['navGroupMaintain', [['distill', 'navDistill'], ['metrics', 'navMetrics'], ['distribute', 'navDistribute']]],
    ]

    function Sidebar(props) {
      const { route, navigate, t } = props
      return h('nav', { 'aria-label': t('navWorkstyle'), className: 'dsw-nav' },
        NAV_GROUPS.map(([groupKey, items]) => h('div', { key: groupKey, className: 'dsw-nav-group' },
          h('div', { className: 'dsw-nav-group-title', style: S.navGroupTitle }, t(groupKey)),
          items.map(([page, labelKey]) => {
            const on = route.page === page
            return h('a', {
              key: page,
              href: '#/' + page,
              'aria-current': on ? 'page' : undefined,
              className: on ? 'dsw-nav-item dsw-nav-item-on' : 'dsw-nav-item',
              style: on ? { ...S.navItem, ...S.navItemOn } : S.navItem,
              onClick: (event) => {
                if (event && event.preventDefault) event.preventDefault()
                navigate({ page })
              },
            }, t(labelKey))
          }))))
    }

    function ErrorState(props) {
      const { operation, message, onRetry } = props
      return h('div', { style: S.banner('error'), role: 'alert' },
        h('span', null, operation + scopedT('failPrefix') + (message || scopedT('failFallback'))),
        onRetry ? h('button', { type: 'button', style: S.linkAccent, onClick: onRetry }, scopedT('retry')) : null)
    }

    function Notice(props) {
      return props && props.children ? h('div', { style: S.banner('info'), role: 'status', 'aria-live': 'polite' }, props.children) : null
    }

    function EnvironmentContextBar({ environment }) {
      return h('div', {
        role: 'region', 'aria-label': scopedT('envLabel'), className: 'dsw-env',
        style: S.envBar,
      },
        h('span', { style: S.envLabel }, scopedT('envLabel')),
        h('span', { style: S.envPath, title: environment.cwd || '' }, environment.cwd || scopedT('noCwd')),
        environment.loading ? h('span', { style: S.envNote }, scopedT('loadingShort')) : null,
        environment.error ? h('span', { style: { ...S.envNote, color: T.danger } }, environment.error) : null)
    }

    /* --------------------------------- panel ------------------------------- */

    function Panel(props) {
      const t = props && props.t ? props.t : (key) => key
      const [status, setStatus] = React.useState(null)
      const [statusLoading, setStatusLoading] = React.useState(true)
      const [report, setReport] = React.useState(null)
      const [reports, setReports] = React.useState([])
      const [exports, setExports] = React.useState([])
      const [exportResult, setExportResult] = React.useState(null)
      const [exportBusy, setExportBusy] = React.useState('')
      // The export mode the user picked, kept so a failed export can be
      // retried with the same mode (and the same fresh scope inputs).
      const [exportMode, setExportMode] = React.useState(null)
      // Per-history failures: the panel stays usable and the rows it already
      // has stay visible next to an explanation and a retry action.
      const [reportsError, setReportsError] = React.useState('')
      const [exportsError, setExportsError] = React.useState('')
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
      /* Preset editing is its own draft: a preset is a whitelist of rule,
         skill and template ids, so it needs a different shape from the rule
         editor and must never share its draft. */
      const [presetEditing, setPresetEditing] = React.useState(null)
      /* A delete refused only because other sessions still pin the preset is
         recoverable: the panel asks, then re-posts with force=true. */
      const [presetForce, setPresetForce] = React.useState(null)
      const [presetBusy, setPresetBusy] = React.useState('')
      /* Pack lifecycle: the editor draft (create/rename/import), the delete
         confirmation, and the host's trash listing. The listing is read from
         GET /pack, so a deleted pack stays restorable across reloads. */
      const [packEditing, setPackEditing] = React.useState(null)
      const [packDeleting, setPackDeleting] = React.useState('')
      const [packTrash, setPackTrash] = React.useState([])
      const [packTrashError, setPackTrashError] = React.useState('')
      const [packTrashReload, setPackTrashReload] = React.useState(0)
      const [revisions, setRevisions] = React.useState([])
      const [revisionsError, setRevisionsError] = React.useState('')
      const [revisionsReload, setRevisionsReload] = React.useState(0)
      const [scopeFilter, setScopeFilter] = React.useState('all')
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
      const envContextRef = React.useRef({ query: envQuery, loadedQuery: null })
      if (envContextRef.current.query !== envQuery) {
        envContextRef.current = { query: envQuery, loadedQuery: null }
      }

      const ROUTES = new Set(['overview', 'pack', 'rules', 'presets', 'skills', 'distill', 'metrics', 'distribute'])
      /* Legacy hash values keep working: run folded into metrics, packs
         folded into overview (deep pack links keep landing on the pack page). */
      const LEGACY_ROUTES = { run: 'metrics', packs: 'overview' }
      const readRoute = () => {
        const raw = typeof location !== 'undefined' ? String(location.hash || '') : '#/run'
        const [, rawPage = 'run', rawPackId] = raw.match(/^#\/?([^/]+)?(?:\/(.*))?$/) || []
        const packId = rawPackId || undefined
        const page = LEGACY_ROUTES[rawPage]
          ? (rawPage === 'packs' && packId ? 'pack' : LEGACY_ROUTES[rawPage])
          : rawPage
        return ROUTES.has(page) ? { page, packId } : { page: 'overview' }
      }
      const routeHash = (page, packId) => {
        const canonical = LEGACY_ROUTES[page]
          ? (page === 'packs' && packId ? 'pack' : LEGACY_ROUTES[page])
          : page
        return '#/' + canonical + (packId ? '/' + encodeURIComponent(packId) : '')
      }

      const getJson = (path) => fetch('/api/dsh-workstyle/' + path, { headers: { accept: 'application/json' } })
        .then((response) => {
          if (!response.ok) throw new Error('HTTP ' + response.status)
          return response.json()
        })
        .then((data) => ({ ok: true, data }))
        .catch((err) => ({ ok: false, error: String(err && err.message ? err.message : err) }))

      const [route, setRoute] = React.useState(readRoute)
      const statusRequest = React.useRef(0)
      const exportRequest = React.useRef(0)
      const exportBusyRef = React.useRef('')
      const [packDetail, setPackDetail] = React.useState(null)
      const envRequest = React.useRef(0)
      const [packLoading, setPackLoading] = React.useState(false)
      const [packError, setPackError] = React.useState('')
      // A generation counter, not a route change: retrying a failed detail
      // fetch must refetch even when the route hash stays exactly the same.
      const [packReload, setPackReload] = React.useState(0)
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
        const id = route.page === 'pack' ? route.packId : undefined
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
      }, [route.page, route.packId, packReload])

      /* The preset editor and the force card are page-scoped drafts: leaving
         the pages that host them drops both, so navigating back never revives
         an editor for a preset a refresh removed. */
      React.useEffect(() => {
        if (route.page === 'presets' || (route.page === 'pack' && !!route.packId)) return
        setPresetEditing(null)
        setPresetForce(null)
      }, [route.page, route.packId])

      /* The pack editor is page-scoped too: 新建/导入 belong to the list and
         重命名 to exactly one pack's detail. A draft that outlived its route
         would rename the pack the user is no longer looking at, so any route
         change drops the draft and the delete confirmation with it. */
      React.useEffect(() => {
        setPackEditing(null)
        setPackDeleting('')
      }, [route.page, route.packId])

      /* The trash listing belongs to the pack list page. Reading it from the
         host (not from delete responses) means a reload still offers 恢复 for
         every pack the host moved into trash/<id>-<stamp>. Re-entering the
         page re-reads it, so another tab's delete shows up here too. */
      React.useEffect(() => {
        if (route.page !== 'pack' || route.packId) return undefined
        let cancelled = false
        setPackTrashError('')
        getJson('pack').then((result) => {
          if (cancelled) return
          if (!result.ok || !result.data || !Array.isArray(result.data.trash)) {
            setPackTrash([])
            setPackTrashError(result.error || (result.data && result.data.error) || 'trash unavailable')
            return
          }
          setPackTrash(result.data.trash)
        })
        return () => { cancelled = true }
      }, [route, packTrashReload])

      /* Revision history is local state only: it is read from the host when the
         distribution page is open, and re-read after a rollback so the rows
         always describe the files the host has now. A row never outlives the
         fetch that produced it: leaving the page, refetching or failing clears
         the list, so an error state can never sit above stale 回滚 buttons. */
      React.useEffect(() => {
        if (route.page !== 'distribute') {
          setRevisions([])
          setRevisionsError('')
          return undefined
        }
        let cancelled = false
        setRevisions([])
        setRevisionsError('')
        getJson('revisions').then((result) => {
          if (cancelled) return
          if (!result.ok || !result.data || !Array.isArray(result.data.revisions)) {
            setRevisions([])
            setRevisionsError(result.error || (result.data && result.data.error) || 'revisions unavailable')
            return
          }
          setRevisions(result.data.revisions)
        })
        return () => {
          cancelled = true
          setRevisions([])
        }
      }, [route.page, revisionsReload])

      const loadEnv = React.useCallback(() => {
        const requestId = ++envRequest.current
        const requestQuery = envQuery
        envContextRef.current = { query: requestQuery, loadedQuery: null }
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
          if (scopeData && envContextRef.current.query === requestQuery) {
            envContextRef.current.loadedQuery = requestQuery
          }
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
        setReportsError('')
        setExportsError('')
        setStatusLoading(true)
        // History refreshes never block the panel and never clear the rows
        // they failed to replace: stale metadata stays visible next to the
        // per-history error and its retry action.
        getJson('reports').then((result) => {
          if (requestId !== statusRequest.current) return
          if (result.ok && result.data && Array.isArray(result.data.reports)) setReports(result.data.reports)
          else setReportsError(result.error || (result.data && result.data.error) || scopedT('reportsUnavailable'))
        })
        getJson('exports').then((result) => {
          if (requestId !== statusRequest.current) return
          if (result.ok && result.data && Array.isArray(result.data.exports)) setExports(result.data.exports)
          else setExportsError(result.error || (result.data && result.data.error) || scopedT('exportsUnavailable'))
        })
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
                .then((evidence) => {
                  // Same generation guard as reports/exports below: a slow
                  // stale response must not overwrite a newer distill result.
                  if (evidence && requestId === statusRequest.current && requestEnvQuery === envQueryRef.current) setReport(evidence)
                })
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
            load()
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
            load()
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      /**
       * Exports keep their own in-flight state, separate from the global
       * `busy`: switching the header pack or finishing another action must
       * neither clear it nor let a second export overlap. The guard is a ref,
       * not the state — state updates are asynchronous, so two synchronous
       * invocations before a rerender must not both start a request. A
       * request id keeps a stale run from writing history or errors over a
       * newer one, and a failed history refresh leaves the export result
       * untouched.
       */
      const onExport = (withProject) => {
        if (exportBusyRef.current) return
        if (withProject && !requireCurrentContext()) return
        const kind = withProject ? 'scoped' : 'pack'
        const requestId = ++exportRequest.current
        exportBusyRef.current = kind
        setExportMode(withProject)
        setExportBusy(kind); setError(''); setNotice(''); setExportResult(null)
        call('export', withProject ? { withProject: true, cwd: (env && env.scope && env.scope.cwd) || props.cwd || '' } : { withProject: false })
          .then(({ ok, data }) => {
            if (requestId !== exportRequest.current) return null
            if (!ok) throw new Error(data && data.error ? data.error : 'export failed')
            setExportResult(data)
            setNotice(t('exported') + '：' + data.file)
            return getJson('exports')
          })
          .then((result) => {
            if (requestId !== exportRequest.current) return
            // History refresh failure is not an export failure: keep the
            // result and the previous rows exactly as they are, but surface
            // the same per-history error and retry as load() would.
            if (result && result.ok && result.data && Array.isArray(result.data.exports)) {
              setExports(result.data.exports)
              setExportsError('')
            } else {
              setExportsError(result && result.error ? result.error : (result && result.data && result.data.error) || scopedT('exportsUnavailable'))
            }
          })
          .catch((err) => {
            if (requestId === exportRequest.current) setError(String(err && err.message ? err.message : err))
          })
          .finally(() => {
            if (requestId === exportRequest.current) {
              exportBusyRef.current = ''
              setExportBusy('')
            }
          })
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

      const requireCurrentContext = () => {
        if (envContextRef.current.loadedQuery === envQuery) return true
        setError(scopedT('envLoadingRetry'))
        return false
      }

      /* ---------------------------- packs & revisions --------------------------- */

      /* The detail route carries no dir, so writability is read from the
         status summary. Only a pack under the host's workstyle/packs root can
         be renamed or deleted in place; bundled packs stay read-only. */
      const packWritable = (pack) => /(^|[\\/])workstyle[\\/]packs[\\/]/.test((pack && pack.dir) || '')

      const packSummaryOf = (id) => {
        const list = status && Array.isArray(status.packs) ? status.packs : []
        return list.find((pack) => pack.id === id) || null
      }

      const sendPackAction = (body, message) => {
        setBusy('pack'); setError(''); setNotice('')
        return postJson('pack', body)
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'pack action failed')
            if (data && data.status) setStatus(data.status)
            else if (data && Array.isArray(data.packs)) {
              setStatus((prev) => {
                if (!prev) return prev
                const activePack = data.packs.find((pack) => pack.id === data.activePackId) || prev.activePack
                return { ...prev, packs: data.packs, activePack }
              })
            }
            const packId = (data && data.packId) || body.pack || body.id || body.from || ''
            /* The pack list re-reads the host's trash listing after every
               lifecycle action, so the rows always mirror what is on disk. */
            setPackTrashReload((value) => value + 1)
            setNotice(message + (packId ? '：' + packId : ''))
            setPackReload((value) => value + 1)
            return loadEnv().then(() => true)
          })
          .catch((err) => {
            setError(String(err && err.message ? err.message : err))
            return false
          })
          .finally(() => setBusy(''))
      }

      const onPackAction = (action, packId) => {
        if (action === 'apply') return sendPackAction({ action: 'apply', pack: packId }, t('packSwitch'))
        if (action === 'duplicate') return sendPackAction({ action: 'duplicate', from: packId }, t('packDuplicate'))
        if (action === 'delete') {
          setPackDeleting('')
          return sendPackAction({ action: 'delete', id: packId }, t('packDelete'))
            .then((saved) => { if (saved) navigate({ page: 'pack' }); return saved })
        }
        return Promise.resolve(false)
      }

      const onRestorePack = (packId) => sendPackAction({ action: 'restore', id: packId }, t('packRestore'))

      const onSavePack = (draft) => {
        if (!packEditing) return Promise.resolve()
        const mode = packEditing.mode
        /* A save is only valid on the page that owns the draft: create/import
           on the list, rename on the detail of exactly the pack it names. A
           click that reaches here after navigation drops the draft instead of
           posting a rename for the pack the user left. */
        const onOwnPage = mode === 'rename'
          ? route.page === 'pack' && route.packId === packEditing.id
          : route.page === 'pack' && !route.packId
        if (!onOwnPage) {
          setPackEditing(null)
          return Promise.resolve(false)
        }
        const id = mode === 'rename' ? packEditing.id : String((draft && draft.id) || '').trim()
        const displayName = String((draft && draft.displayName) || '').trim()
        const dir = String((draft && draft.path) || '').trim()
        if (mode === 'import' ? !dir : (!id || !displayName)) {
          setError(t('packFieldRequired'))
          return Promise.resolve()
        }
        const body = mode === 'create' ? { action: 'create', id, displayName }
          : mode === 'rename' ? { action: 'rename', id, displayName }
            : { action: 'import', path: dir }
        const message = mode === 'create' ? t('packNew') : mode === 'rename' ? t('packRename') : t('packImport')
        return sendPackAction(body, message).then((saved) => {
          if (saved) setPackEditing(null)
          return saved
        })
      }

      const onRestoreRevision = (id) => {
        setBusy('revision'); setError(''); setNotice('')
        return postJson('revisions', { action: 'restore', id })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'revision restore failed')
            if (data && data.status) setStatus(data.status)
            const file = data && data.restored ? data.restored.file : ''
            setNotice(t('revisionRestore') + '：' + (file || id))
            setRevisionsReload((value) => value + 1)
            return loadEnv()
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      /** Enable or disable a rule in the layer that owns the decision. */
      const onRuleToggle = (rule, enabled) => {
        if (!rule || !requireCurrentContext()) return
        const layer = rule.textScope === 'project' && rule.origin === 'project' ? 'project' : 'workspace'
        if (layer === 'project') {
          const cwd = env && env.scope && env.scope.cwd
          if (!cwd) { setError(t('envUnavailable') + 'no cwd'); return }
          setBusy('rule'); setError(''); setNotice('')
          const disabled = (env.scope.project && env.scope.project.disabledRules) || []
          const next = enabled ? disabled.filter((id) => id !== rule.id) : [...disabled, rule.id]
          return postJson('scope', { layer: 'project', cwd, patch: { disabledRules: next } })
            .then(({ ok, data }) => {
              if (!ok) throw new Error(data && data.error ? data.error : 'scope save failed')
              setNotice((enabled ? t('toggleOn') : t('toggleOff')) + '：' + rule.id)
              return loadEnv()
            })
            .catch((err) => setError(String(err && err.message ? err.message : err)))
            .finally(() => setBusy(''))
        }
        if (!session || !session.id) {
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
            return loadEnv()
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
        if (!requireCurrentContext()) return Promise.resolve()
        const cwd = env && env.scope ? env.scope.cwd : (session && session.cwd)
        /* A rule opened from the list remembers which layer owns it; a new
           rule has no owner yet and lands in the project layer. */
        const target = editing && editing.target ? editing.target : 'project'
        const packId = (editing && editing.packId)
          || (status && status.activePack ? status.activePack.id : '')
        const normalized = {
          id: typeof draft.id === 'string' ? draft.id.trim() : '',
          title: typeof draft.title === 'string' ? draft.title.trim() : '',
          text: typeof draft.text === 'string' ? draft.text.trim() : '',
        }
        if (!normalized.id || !normalized.title || !normalized.text) {
          setError(t('ruleIdLabel') + '、' + t('ruleTitleLabel') + '、' + t('ruleTextLabel') + '不能为空')
          return Promise.resolve()
        }
        if (target === 'project' && !cwd) { setError(t('envUnavailable') + 'no cwd'); return Promise.resolve() }
        if (target !== 'project' && !packId) { setError(t('envUnavailable') + 'no pack'); return Promise.resolve() }
        setBusy('rule'); setError(''); setNotice('')
        const body = target === 'project'
          ? { cwd, rule: normalized }
          : { target, packId, rule: normalized }
        return postJson('rule', body)
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'rule save failed')
            setEditing(null)
            return refreshEnvironment(normalized.id, target === 'project' ? t('ruleSaved') : t('ruleSavedLocal'))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      /* Where a rule lives decides where a write lands: an explicit writable
         wins, a project-owned row falls back to the project layer, and a row
         with no write target must not silently become a project write. */
      const writeTargetOf = (rule) => {
        if (!rule) return null
        if (rule.writable && rule.writable.scope) return rule.writable
        if (rule.origin === 'project' || rule.textScope === 'project') return { scope: 'project' }
        return null
      }

      const ruleWriteBody = (rule, extra) => {
        const writable = writeTargetOf(rule)
        if (!writable) return null
        const target = writable.scope
        const cwd = env && env.scope ? env.scope.cwd : (session && session.cwd)
        const packId = (writable && writable.packId)
          || (status && status.activePack ? status.activePack.id : '')
        return target === 'project'
          ? { cwd, rule: { id: rule.id }, ...(extra || {}) }
          : { target, packId, rule: { id: rule.id }, ...(extra || {}) }
      }

      const onRemoveRule = (rule) => {
        if (!rule || !requireCurrentContext()) return
        const normalizedId = typeof rule.id === 'string' ? rule.id.trim() : ''
        if (!normalizedId) return
        const body = ruleWriteBody({ ...rule, id: normalizedId }, { remove: true })
        if (!body) { setError(t('targetUnknown')); return }
        if (!body.cwd && body.target === undefined) return
        if (body.target !== undefined && !body.packId) return
        setBusy('rule'); setError(''); setNotice('')
        postJson('rule', body)
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'rule remove failed')
            return refreshEnvironment(normalizedId, body.target === undefined ? t('ruleRemoved') : t('ruleRemovedLocal'))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onRestoreRule = (rule) => {
        if (!rule || !requireCurrentContext()) return
        const normalizedId = typeof rule.id === 'string' ? rule.id.trim() : ''
        if (!normalizedId) return
        const body = ruleWriteBody({ ...rule, id: normalizedId }, { action: 'restore' })
        if (!body) { setError(t('targetUnknown')); return }
        if (!body.cwd && body.target === undefined) return
        if (body.target !== undefined && !body.packId) return
        setBusy('rule'); setError(''); setNotice('')
        postJson('rule', body)
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'rule restore failed')
            return refreshEnvironment(normalizedId, t('ruleRestored'))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onAddToPreset = (ruleId) => {
        if (!requireCurrentContext()) return
        const preset = scopedPreset
        if (!preset || !preset.id) { setError(t('envUnavailable') + 'no preset'); return }
        const packId = status && status.activePack ? status.activePack.id : ''
        const rules = Array.isArray(preset.rules) ? preset.rules.slice() : []
        if (!rules.includes(ruleId)) rules.push(ruleId)
        setBusy('preset'); setError(''); setNotice('')
        postJson('preset', {
          action: 'save',
          packId,
          preset: {
            id: preset.id,
            title: preset.title || preset.id,
            description: preset.description || '',
            rules,
            skills: Array.isArray(preset.skills) ? preset.skills.slice() : [],
            templates: Array.isArray(preset.templates) ? preset.templates.slice() : [],
          },
        })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'preset save failed')
            return refreshEnvironment(ruleId, t('presetAddedNotice'))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onUsePreset = (id) => {
        if (!requireCurrentContext()) return
        const cwd = env && env.scope ? env.scope.cwd : (session && session.cwd)
        /* Switching presets changes which cards are current: a pending
           delete confirmation for the previous one must not survive. */
        setPresetForce(null)
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

      /* ---------------------------- v5 · presets ---------------------------- */

      const activePackId = () => (status && status.activePack ? status.activePack.id : '')

      const presetDraft = (preset) => ({
        existing: !!preset,
        id: preset ? preset.id : '',
        title: preset ? (preset.title || preset.id) : '',
        description: preset ? (preset.description || '') : '',
        rules: preset && Array.isArray(preset.rules) ? preset.rules.slice() : [],
        skills: preset && Array.isArray(preset.skills) ? preset.skills.slice() : [],
        templates: preset && Array.isArray(preset.templates) ? preset.templates.slice() : [],
      })

      const openPresetEditor = (preset) => {
        setPresetForce(null)
        setError('')
        setNotice('')
        setPresetEditing(presetDraft(preset))
      }

      /* Closing the draft also drops any pending force confirmation: both
         describe one preset, and neither may outlive the view that showed
         it. */
      const closePresetEditor = () => {
        setPresetEditing(null)
        setPresetForce(null)
        setError('')
      }

      const togglePresetRule = (ruleId) => {
        setPresetEditing((prev) => {
          if (!prev) return prev
          const rules = prev.rules.includes(ruleId)
            ? prev.rules.filter((id) => id !== ruleId)
            : [...prev.rules, ruleId]
          return { ...prev, rules }
        })
      }

      /* The panel always writes presets to the overlay: the pack manifest is
         the pack author's file, and a local edit there would vanish on the
         next pack update. */
      const onSavePreset = (draft) => {
        const id = typeof draft.id === 'string' ? draft.id.trim() : ''
        const title = typeof draft.title === 'string' ? draft.title.trim() : ''
        if (!id || !title) {
          setError(t('presetIdRequired'))
          return Promise.resolve()
        }
        const packId = activePackId()
        if (!packId) { setError(t('envUnavailable') + 'no pack'); return Promise.resolve() }
        const preset = {
          id,
          title,
          description: typeof draft.description === 'string' ? draft.description.trim() : '',
          rules: Array.isArray(draft.rules) ? draft.rules.slice() : [],
          skills: Array.isArray(draft.skills) ? draft.skills.slice() : [],
          templates: Array.isArray(draft.templates) ? draft.templates.slice() : [],
        }
        setPresetBusy('save'); setError(''); setNotice('')
        return postJson('preset', { action: 'save', packId, target: 'overlay', preset })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'preset save failed')
            setPresetEditing(null)
            setPresetForce(null)
            return refreshEnvironment(id, t('presetSaved'))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setPresetBusy(''))
      }

      const presetNotice = (action, data) => {
        if (action === 'delete') {
          const removed = data && data.removed
          if (removed === 'blocked') return t('presetBlockedNotice')
          if (removed === 'local') return t('presetDeletedLocal')
          return t('presetDeleted')
        }
        if (action === 'duplicate') return t('presetDuplicated') + '：' + (data && data.saved ? data.saved : '')
        if (action === 'unblock') return t('presetRestored')
        if (action === 'block') return t('presetBlockedNotice')
        return t('presetSaved')
      }

      const onPresetAction = (action, preset, extra) => {
        if (!preset || !preset.id) return Promise.resolve()
        const packId = activePackId()
        if (!packId) { setError(t('envUnavailable') + 'no pack'); return Promise.resolve() }
        const opts = extra || {}
        const body = action === 'duplicate'
          ? { action, preset: preset.id, packId, newId: opts.newId || (preset.id + '-copy') }
          : { action, preset: preset.id, packId, ...(opts.force ? { force: true } : {}) }
        /* A new action supersedes any earlier refusal: the card describes one
           preset, and a click on another one must not leave it behind. */
        if (!opts.force) setPresetForce(null)
        setPresetBusy(action); setError(''); setNotice('')
        return postJson('preset', body)
          .then(({ ok, data }) => {
            if (!ok) {
              /* Only a cross-session refusal is recoverable; anything else
                 (`preset is in use` in this very context, a duplicate id, a
                 read-only pack) is final and stays an error. */
              if (!opts.force && action !== 'duplicate' && data && Array.isArray(data.sessions) && data.sessions.length) {
                setPresetForce({ id: preset.id, sessions: data.sessions.slice() })
                return null
              }
              setPresetForce(null)
              throw new Error(data && data.error ? data.error : 'preset ' + action + ' failed')
            }
            setPresetForce(null)
            setPresetEditing(null)
            return refreshEnvironment(preset.id, presetNotice(action, data))
          })
          .catch((err) => { setPresetForce(null); setError(String(err && err.message ? err.message : err)) })
          .finally(() => setPresetBusy(''))
      }

      const onConfirmForce = () => {
        if (!presetForce || !presetForce.id) return Promise.resolve()
        /* The confirmation carries the id it was opened for; the button never
           captures the preset card it happened to render under. */
        return onPresetAction('delete', { id: presetForce.id }, { force: true })
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

      /* ---------------------- shared shell around every state ---------------- */

      /* Everything the shell needs exists before the status gate: route,
         navigation, environment state and the local session context. The
         shell renders around initial loading, hard failures and the
         no-active-pack path too, so navigation, the 当前环境 context bar,
         the main landmark and the focus stylesheet never disappear. */
      const sc = env && env.scope ? env.scope : null
      const inj = env && env.inject ? env.inject : null
      const met = env && env.metrics ? env.metrics : null
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
      const primaryNav = h(Sidebar, { route, navigate, t })
      const environmentBar = h(EnvironmentContextBar, { environment })
      const rootStyle = { ...S.page }
      const shell = (mainChildren, headerContent, footerContent, showBanners) => h('div', { id: 'dsw-root', style: rootStyle },
        h('style', null, CSS),
        h('div', { className: 'dsw-frame' },
          headerContent ? h('header', { className: 'dsw-masthead' }, headerContent) : null,
          h('div', { className: 'dsw-body' },
            h('div', { className: 'dsw-rail' }, primaryNav),
            h('div', { className: 'dsw-content' },
              environmentBar,
              showBanners && error ? h(ErrorState, { operation: t('opRun'), message: error, onRetry: load }) : null,
              showBanners && notice ? h(Notice, null, notice) : null,
              showBanners && envError ? h(ErrorState, { operation: t('opRefreshEnv'), message: envError, onRetry: load }) : null,
              h('main', { id: 'dsw-main', 'aria-live': 'polite' }, mainChildren),
              footerContent ? h('div', { style: S.footWrap }, footerContent) : null))))

      if (!status) {
        if (error) {
          return shell(h(ErrorState, { operation: scopedT('opStatus'), message: error, onRetry: load }), null, null, false)
        }
        return shell(h(Loading, { label: scopedT('loadingStatus') }), null, null, false)
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
        return shell(h(ErrorState, { operation: t('opReadPack'), message: t('noActivePackLong'), onRetry: load }), null, null, false)
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
            ? (rule.adopted && !rule.present
              ? h('button', {
                style: busy ? { ...S.linkButton, opacity: 0.45, cursor: 'default' } : S.linkButton,
                disabled: !!busy,
                onClick: (event) => {
                  if (event && event.stopPropagation) event.stopPropagation()
                  onUnadopt(rule.id)
                },
              }, t('unadopt'))
              : h('span', { style: S.lockMark, 'aria-hidden': true }, '✓'))
            : h('input', {
              type: 'checkbox', style: S.checkbox, disabled: !!busy,
              checked: selected.includes(rule.id),
              'aria-label': rule.title,
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

      /* sc/inj/met and `environment` are computed above the status gate so the
         shared shell can render before any data arrives. */
      const scopedRules = sc && Array.isArray(sc.rules) ? sc.rules : rules
      const scopedSkills = sc && Array.isArray(sc.skills) ? sc.skills : skills
      const presets = sc && Array.isArray(sc.presets) ? sc.presets : []
      const templates = sc && Array.isArray(sc.templates) ? sc.templates : []
      /* Blocked presets are reported as `[{ id, packId }]`; anything else is
         ignored so a malformed scope cannot blank the card. */
      const blockedPresets = sc && Array.isArray(sc.blockedPresets)
        ? sc.blockedPresets.filter((entry) => entry && typeof entry.id === 'string' && entry.id)
        : []
      const counts = (sc && sc.counts) || {
        injected: enabledRules.length, total: totalRules, project: 0, disabled: disabledRules,
        skills: enabledSkills.length, skillTotal: totalSkills,
      }
      const activePresetId = sc && sc.activePreset ? sc.activePreset.id : null
      const scopedPreset = sc && sc.activePreset ? sc.activePreset : null
      const scopedDisabled = scopedRules.filter((rule) => rule.enabled === false)
      const projectRules = scopedRules.filter((rule) => rule.origin === 'project')

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

      /* One editor serves every store; the row carries where the text lives,
         so save/remove/restore write back to the layer that owns the rule. */
      const openRuleEditor = (rule) => {
        const writable = writeTargetOf(rule)
        if (!writable) { setError(t('targetUnknown')); return }
        setEditing({
          id: rule.id,
          title: rule.title,
          text: rule.text,
          existing: true,
          target: writable.scope,
          file: writable.file,
          packId: writable.packId,
        })
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
              injectOpen ? inj.text : ((inj.text || '').split('\n').slice(0, 12).join('\n') + (inj.chars > 400 ? '\n…' : ''))),
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
          writeTargetOf(rule)
            ? (rule.removed
              ? h('button', { style: S.linkButton, onClick: () => onRestoreRule(rule) }, t('restoreRule'))
              : h('button', { style: S.linkButton, onClick: () => openRuleEditor(rule) }, t('editRule')))
            : null,
          writeTargetOf(rule) && !rule.removed
            ? h('button', { style: S.linkButton, onClick: () => onRemoveRule(rule) }, t('removeRule'))
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
          editing.target
            ? h('div', { style: S.hint },
              t('writeTarget') + '：' + (editing.file === null
                ? t('targetUnknown')
                : editing.target === 'pack'
                  ? t('targetPack')
                  : editing.target === 'project'
                    ? t('targetProject')
                    : t('targetOverlay')))
            : null,
          editing.file === null
            ? h('div', { style: S.hint }, t('writeBlocked'))
            : null,
          h('div', { style: S.editorActions },
            h('button', { style: S.button, onClick: () => setEditing(null) }, t('cancel')),
            h('button', {
              style: busy || editing.file === null ? { ...S.buttonPrimary, ...S.disabled } : S.buttonPrimary,
              disabled: !!busy || editing.file === null,
              title: editing.file === null ? t('writeBlocked') : undefined,
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
      /* A refusal names the sessions that pin the preset and asks before
         overriding. The card belongs to that preset only: tying it to the id
         (not a bare flag) keeps a switch, an editor or another error from
         leaving a confirmation that would delete the wrong preset. */
      const presetForcePanel = (presetId) => (!presetForce || presetForce.id !== presetId
        ? null
        : h('div', { style: { ...S.card, marginTop: 10, padding: 10 }, 'data-testid': 'dsw-preset-force' },
          h('div', { style: S.sectionLabel }, t('presetForceTitle') + '：' + presetForce.id),
          h('div', { style: { ...S.hint, paddingTop: 6 } }, t('presetForceBody') + '：' + presetForce.sessions.join(', ')),
          h('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 10 } },
            h('button', {
              type: 'button', style: S.button,
              onClick: () => { setPresetForce(null); setError('') },
            }, t('cancel')),
            h('button', {
              type: 'button',
              style: presetBusy ? { ...S.button, ...S.disabled } : S.button,
              disabled: !!presetBusy,
              onClick: onConfirmForce,
            }, t('deletePreset')))))

      /* A preset card is a `div`, not a `button`: the per-preset actions
         (编辑 / 复制 / 删除) cannot nest inside a button. The body stays
         clickable so picking a preset still only takes one click. */
      const presetCards = presets.map((preset) => h('div', {
        key: preset.id,
        'data-preset': preset.id,
        style: S.presetCard(preset.id === activePresetId),
      },
        h('button', {
          type: 'button',
          style: {
            display: 'flex', flexDirection: 'column', gap: 7, textAlign: 'left',
            font: 'inherit', color: 'inherit', background: 'transparent',
            border: 'none', padding: 0, cursor: 'pointer', minWidth: 0,
          },
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
            h('span', null, t('presetTemplates') + ' ', h('span', { style: S.presetCountEm }, String(preset.templates.length))))),
        h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 } },
          h('button', { type: 'button', style: S.linkButton, disabled: !!presetBusy, onClick: () => openPresetEditor(preset) }, t('editPreset')),
          h('button', { type: 'button', style: S.linkButton, disabled: !!presetBusy, onClick: () => onPresetAction('duplicate', preset) }, t('duplicatePreset')),
          h('button', { type: 'button', style: S.linkButton, disabled: !!presetBusy, onClick: () => onPresetAction('delete', preset) }, t('deletePreset'))),
        presetForcePanel(preset.id)))

      /* A preset is a whitelist, so the editor explains that ticking is what
         injects — unticked rules are not "off", they are outside the preset. */
      const presetEditor = (() => {
        if (!presetEditing) return null
        const draft = presetEditing
        const known = new Set(scopedRules.map((rule) => rule.id))
        const dangling = draft.rules.filter((id) => !known.has(id))
        return h('div', { style: { ...S.card, marginTop: 12 }, 'data-testid': 'dsw-preset-editor' },
          h('div', { style: S.sectionLabel }, draft.existing ? t('presetEditorTitle') : t('presetNew')),
          h('div', { style: { display: 'flex', gap: 9, flexWrap: 'wrap', paddingTop: 8 } },
            h('label', { style: S.field },
              h('span', { style: S.hint }, t('presetIdLabel')),
              h('input', {
                style: S.input,
                value: draft.id,
                disabled: draft.existing,
                placeholder: 'my-preset',
                onChange: (event) => setPresetEditing({ ...draft, id: event.target.value }),
              })),
            h('label', { style: S.field },
              h('span', { style: S.hint }, t('ruleTitleLabel')),
              h('input', {
                style: S.input,
                value: draft.title,
                placeholder: t('ruleTitleLabel'),
                onChange: (event) => setPresetEditing({ ...draft, title: event.target.value }),
              }))),
          h('label', { style: { ...S.field, paddingTop: 8 } },
            h('span', { style: S.hint }, t('presetDescLabel')),
            h('input', {
              style: S.input,
              value: draft.description,
              placeholder: t('presetDescLabel'),
              onChange: (event) => setPresetEditing({ ...draft, description: event.target.value }),
            })),
          h('div', { style: { ...S.hint, paddingTop: 10 } }, t('presetWhitelistHint')),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', paddingTop: 6 } },
            scopedRules.map((rule) => h('label', {
              key: rule.id,
              style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
            },
              h('input', {
                type: 'checkbox',
                checked: draft.rules.includes(rule.id),
                onChange: () => togglePresetRule(rule.id),
              }),
              h('span', { style: S.ruleTitle }, rule.title || rule.id),
              h('span', { style: S.hint }, rule.id)))),
          dangling.length
            ? h('div', { style: { ...S.hint, paddingTop: 6 } }, t('presetDanglingRules') + '：' + dangling.join(', '))
            : null,
          h('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 10 } },
            h('button', { type: 'button', style: S.button, disabled: !!presetBusy, onClick: closePresetEditor }, t('cancel')),
            h('button', {
              type: 'button',
              style: presetBusy ? { ...S.button, ...S.disabled } : S.button,
              disabled: !!presetBusy,
              onClick: () => onSavePreset(draft),
            }, t('savePreset'))))
      })()

      /* Blocked presets are hidden from composition, so their rules no longer
         inject; the card is the only place to bring one back. */
      const presetBlockedCard = blockedPresets.length
        ? h('div', { style: { ...S.card, marginTop: 12 }, 'data-testid': 'dsw-preset-blocked' },
          h('div', { style: S.presetTitleRow },
            h('span', { style: S.presetTitle }, t('presetBlockedTitle')),
            h('span', { style: S.badge }, String(blockedPresets.length))),
          h('div', { style: S.hint }, t('presetBlockedHint')),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 } },
            blockedPresets.map((entry) => h('div', {
              key: (entry.packId || '') + ':' + entry.id,
              style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
            },
              h('span', { style: S.ruleTitle }, entry.id),
              entry.packId ? h('span', { style: S.hint }, entry.packId) : null,
              h('button', {
                type: 'button', style: S.linkButton, disabled: !!presetBusy,
                onClick: () => onPresetAction('unblock', { id: entry.id }),
              }, t('restorePreset'))))))
        : null

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
                h('span', { style: S.skillDesc, title: tpl.text }, (tpl.text || '').slice(0, 90))),
              h('button', { style: S.linkButton, onClick: () => onCopy(tpl.text || '', tpl.title || tpl.id) }, t('injectCopy')))))
            : h('div', { style: S.empty }, h('div', { style: S.hint }, t('envUnavailable') + t('presetTemplates'))))

      const presetGridBlock = h('div', { style: S.presetGrid }, presetCards)
      const presetTabsBlock = h('div', { style: { ...S.filterRow, marginLeft: 0, paddingTop: 16, gap: 2 } },
        presetTabs.map(([key, label, count]) => h('button', {
          key,
          style: presetTab === key ? { ...S.pill, ...S.pillActive } : S.pill,
          onClick: () => setPresetTab(key),
        }, label + ' · ' + count)))

      /* Preset cards, tab strip and the editor keep their existing logic;
         only the shell changes: the pack page wraps them in a Section, the
         presets page wraps them in a page header. Creation moved to the
         header-right primary action of whichever page is showing them, and
         both now open the preset editor instead of the rule editor. */
      const presetsBody = h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('div', { style: { ...S.hint, paddingTop: 8 } }, t('presetsHint')),
        presetEditor,
        presetBlockedCard,
        presetGridBlock,
        presetTabsBlock,
        presetDetail)

      const presetsBlock = h(Section, {
        id: 'dsw-presets',
        label: '③ ' + t('presetsTitle'),
        right: h('button', { style: S.linkButton, onClick: () => openPresetEditor(null) }, '+ ' + t('presetNew')),
      }, presetsBody)

      /* The only honest comparison is against the previous report window:
         metrics.baseline.planRate.delta / metrics.baseline.verifyRate.delta. */
      const baselineKey = { 'plan-rate': 'planRate', 'verify-rate': 'verifyRate' }
      const metricDelta = (payload, metric) => {
        const key = baselineKey[metric.id]
        if (!payload || !payload.baseline || !payload.baseline.available || !key) return null
        const pair = payload.baseline[key]
        return pair && typeof pair.delta === 'number' ? pair.delta : null
      }

      const projectFileText = (() => {
        if (!sc || !sc.project || !sc.project.file) return ''
        return sc.project.present
          ? t('projectFile') + ' ' + sc.project.file
          : t('noProjectFile') + '（' + t('projectFile') + ' ' + sc.project.file + '）'
      })()

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
      const reviewSectionRight = allHandled
        ? h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 10 } },
          h('span', null, t('allHandled') + ' · ' + handledSuggestions.length + ' ' + t('inPackUnit')),
          h('button', { style: S.linkAccent, onClick: () => setShowHandled((prev) => !prev) },
            showHandled ? t('hideHandled') : t('viewHandled')))
        : (adoptions.length ? adoptedCount + ' ' + t('adoptedUnit') : null)

      const packDetailBody = h('div', null,
        rulesBlock,
        presetsBlock,
        (pendingCount > 0 || allHandled) ? h(Section, {
          id: 'dsw-review',
          label: t('review'),
          count: suggestions.length,
          right: reviewSectionRight,
        }, reviewSectionBody) : null)

      /* One editor serves create, rename and import: the mode decides which
         fields appear and what the save posts. It renders only on the page
         that owns it — create/import on the list, rename on the detail of the
         pack it names — so a draft can never edit a different pack than the
         one on screen. */
      const packEditorOpen = !!packEditing && (packEditing.mode === 'rename'
        ? route.page === 'pack' && route.packId === packEditing.id
        : route.page === 'pack' && !route.packId)
      const packEditor = packEditorOpen
        ? h('div', { style: S.editorBox },
          h('div', { style: S.fieldRow },
            packEditing.mode === 'import'
              ? h('label', { style: S.field },
                h('span', { style: S.fieldLabel }, t('packImportPath')),
                h('input', {
                  style: S.input,
                  value: packEditing.path || '',
                  placeholder: '/path/to/pack',
                  onChange: (event) => setPackEditing({ ...packEditing, path: event.target.value }),
                }))
              : h('label', { style: S.field },
                h('span', { style: S.fieldLabel }, t('packIdLabel')),
                h('input', {
                  style: S.input,
                  value: packEditing.id || '',
                  disabled: packEditing.mode === 'rename',
                  placeholder: 'my-pack',
                  onChange: (event) => setPackEditing({ ...packEditing, id: event.target.value }),
                })),
            packEditing.mode === 'import'
              ? null
              : h('label', { style: S.field },
                h('span', { style: S.fieldLabel }, t('packDisplayNameLabel')),
                h('input', {
                  style: S.input,
                  value: packEditing.displayName || '',
                  placeholder: t('packDisplayNameLabel'),
                  onChange: (event) => setPackEditing({ ...packEditing, displayName: event.target.value }),
                }))),
          h('div', { style: S.editorActions },
            h('button', { style: S.button, onClick: () => setPackEditing(null) }, t('cancel')),
            h('button', {
              style: busy === 'pack' ? { ...S.buttonPrimary, ...S.disabled } : S.buttonPrimary,
              disabled: busy === 'pack',
              onClick: () => onSavePack(packEditing),
            }, t('packSave'))))
        : null

      const packListBody = h('div', null,
        h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 } },
          h('span', { style: S.hint }, t('packHint')),
          h('button', { style: S.smallButton, disabled: busy === 'pack', onClick: () => setPackEditing({ mode: 'create', id: '', displayName: '' }) }, '+ ' + t('packNew')),
          h('button', { style: S.smallButton, disabled: busy === 'pack', onClick: () => setPackEditing({ mode: 'import', path: '' }) }, t('packImport'))),
        packEditor,
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10, paddingTop: 14 } },
          packs.map((pack) => h('a', {
            key: pack.id, href: routeHash('pack', pack.id), style: { ...S.card, textDecoration: 'none' },
            onClick: (event) => { if (event && event.preventDefault) event.preventDefault(); navigate({ page: 'pack', packId: pack.id }) },
          },
            h('div', { style: S.ruleTitleRow },
              h('span', { style: S.ruleTitle }, pack.displayName || pack.name || pack.id),
              pack.id === active.id ? h('span', { style: S.badge }, t('packActiveBadge')) : null),
            h('span', { style: S.mono }, pack.id + ' · v' + pack.version),
            h('span', { style: S.ruleSideText }, t('sourcePrefix') + (pack.source || t('sourceBuiltin')) + ' · ' + (pack.ruleCount || 0) + ' ' + t('rulesUnit') + ' · ' + (pack.skillCount || 0) + ' ' + t('skillsUnit')),
            pack.id === active.id ? h('span', { style: S.hint }, t('packActiveNow')) : h('span', { style: S.hint }, t('packViewable'))))),
        /* Trash is a host listing, not this session's memory: the pack list
           page shows it whenever the route is open, including an empty state,
           so a reload still offers 恢复 for everything on disk. */
        h('div', { 'data-testid': 'dsw-pack-trash' },
          h(Section, { id: 'dsw-pack-trash-section', label: t('packTrash'), count: packTrash.length },
            h('div', { style: S.hint }, t('packTrashHint')),
            packTrashError
              ? h('div', { style: { ...S.hint, paddingTop: 8 } }, t('packTrashUnavailable') + '：' + packTrashError)
              : packTrash.length
                ? h('div', { style: { display: 'flex', flexDirection: 'column', paddingTop: 8 } },
                  packTrash.map((row) => h('div', { key: row.name || row.id, style: S.ruleRowV5 },
                    h('div', { style: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 } },
                      h('span', { style: S.ruleTitle }, row.id),
                      h('span', { style: S.mono }, row.at || row.name || '')),
                    h('button', { style: S.linkButton, disabled: busy === 'pack', onClick: () => onRestorePack(row.id) }, t('packRestore')))))
                : h('div', { style: { ...S.hint, paddingTop: 8 } }, t('packTrashEmpty')))))

      const routePackDetail = packDetail && packDetail.id === route.packId ? packDetail : null
      const selectedPack = routePackDetail || packs.find((pack) => pack.id === route.packId) || null
      const selectedIsActive = !!selectedPack && selectedPack.id === active.id
      const detailTabs = [
        ['rules', t('rulesLabel'), selectedPack ? (selectedIsActive ? scopedRules.length : (selectedPack.rules || []).length) : 0],
        ['skills', t('skillsLabel'), selectedPack ? (selectedIsActive ? scopedSkills.length : (selectedPack.skills || []).length) : 0],
        ['presets', t('presetsLabel'), selectedPack ? (selectedIsActive ? presets.length : (selectedPack.presets || []).length) : 0],
        ['templates', t('templatesLabel'), selectedPack ? (selectedIsActive ? templates.length : (selectedPack.templates || []).length) : 0],
      ]
      const readOnlyResource = (label, items, render) => h('section', { style: S.section },
        h('div', { style: S.sectionHead }, h('span', { style: S.sectionLabel }, label), h('span', { style: S.sectionCount }, String(items.length)),
          h('span', { style: S.sectionRight }, t('readonly'))),
        items.length ? h('div', { style: { display: 'flex', flexDirection: 'column' } }, items.map(render))
          : h('div', { style: S.empty }, h('div', { style: S.hint }, t('emptyNone') + label)))
      const nonActiveDetail = selectedPack
        ? packTab === 'rules'
          ? readOnlyResource(t('rulesLabel'), selectedPack.rules || [], (rule) => h('div', { key: rule.id, style: S.ruleRowV5 },
            h('span', { style: S.scopeBadge('workspace') }, t('originPackBadge')), h('div', { style: { minWidth: 0 } }, h('div', { style: S.ruleTitle }, rule.title), h('div', { style: S.ruleText }, rule.text)), h('span', { style: S.mutedBadge }, t('readonly'))))
          : packTab === 'skills'
            ? readOnlyResource(t('skillsLabel'), selectedPack.skills || [], (skill) => h('div', { key: skill.name, style: S.skillRow },
              h('div', { style: S.skillHead }, h('span', { style: S.skillName }, skill.name), h('span', { style: S.skillDesc }, skill.description || ''), h('span', { style: S.mutedBadge }, t('readonly')))))
            : packTab === 'presets'
              ? readOnlyResource(t('presetsLabel'), selectedPack.presets || [], (preset) => h('div', { key: preset.id, style: S.ruleRowV5 }, h('div', { style: S.ruleTitle }, preset.title || preset.id), h('span', { style: S.ruleSideText }, preset.description || ''), h('span', { style: S.mutedBadge }, t('readonly'))))
              : readOnlyResource(t('templatesLabel'), selectedPack.templates || [], (template) => h('div', { key: template.id, style: S.ruleRowV5 }, h('div', { style: S.ruleTitle }, template.title || template.id), h('span', { style: S.ruleSideText }, template.text || ''), h('span', { style: S.mutedBadge }, t('readonly'))))
        : null
      const packDetailPageBody = !route.packId
        ? packListBody
        : packLoading && !selectedPack
          ? h(Loading, { label: t('loadingPack') })
          : (packError && !routePackDetail) || !selectedPack
            ? h('div', { style: S.empty },
              h(ErrorState, { operation: t('opLoadPack'), message: t('packNotFound') + (route.packId || '') + (packError ? '（' + packError + '）' : ''), onRetry: () => setPackReload((n) => n + 1) }),
              h('a', { href: '#/overview', style: S.linkAccent, onClick: (event) => { if (event && event.preventDefault) event.preventDefault(); navigate({ page: 'overview' }) } }, t('backToPacks')))
            : h('div', null,
              h('div', { style: S.sectionHead },
                h('span', { style: S.ruleTitleRow },
                  h('span', { style: S.sectionLabel }, selectedPack.displayName || selectedPack.name || selectedPack.id),
                  selectedIsActive ? h('span', { style: S.badge }, t('packActiveBadge')) : h('span', { style: S.mutedBadge }, t('packInactiveBadge'))),
                h('span', { style: S.sectionRight },
                  h('span', { style: S.mono }, selectedPack.id + ' · v' + selectedPack.version),
                  h('span', null, t('sourcePrefix') + (selectedPack.source || t('sourceBuiltin')) + ' · ' + selectedPack.ruleCount + ' ' + t('rulesUnit') + ' · ' + selectedPack.skillCount + ' ' + t('skillsUnit')))),
              (() => {
                const summary = packSummaryOf(selectedPack.id) || selectedPack
                const writable = packWritable(summary)
                return h('div', { 'data-testid': 'dsw-pack-actions', style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingBottom: 10 } },
                  h('span', { style: S.hint }, writable ? t('packWritableNote') : t('packReadonlyNote')),
                  writable && summary.dir ? h('span', { style: S.mono }, summary.dir) : null,
                  selectedIsActive
                    ? null
                    : h('button', { style: S.smallButton, disabled: busy === 'pack', onClick: () => onPackAction('apply', selectedPack.id) }, t('packSwitch')),
                  writable
                    ? h('button', { style: S.smallButton, disabled: busy === 'pack', onClick: () => setPackEditing({ mode: 'rename', id: selectedPack.id, displayName: selectedPack.displayName || selectedPack.id }) }, t('packRename'))
                    : null,
                  h('button', { style: S.smallButton, disabled: busy === 'pack', onClick: () => onPackAction('duplicate', selectedPack.id) }, t('packDuplicate')),
                  writable
                    ? (packDeleting === selectedPack.id
                      ? h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                        h('span', { style: S.hint }, t('packDeleteHint')),
                        h('button', { style: S.smallButton, disabled: busy === 'pack', onClick: () => onPackAction('delete', selectedPack.id) }, t('packDeleteConfirm')),
                        h('button', { style: S.linkButton, onClick: () => setPackDeleting('') }, t('cancel')))
                      : h('button', { style: S.smallButton, disabled: busy === 'pack', onClick: () => setPackDeleting(selectedPack.id) }, t('packDelete')))
                    : null)
              })(),
              packEditor,
              h('div', { role: 'tablist', 'aria-label': scopedT('packResourcesAria'), style: S.tabs }, detailTabs.map(([key, label, count]) => h('button', { key, role: 'tab', id: 'dsw-pack-tab-' + key, 'aria-controls': 'dsw-pack-panel-' + key, 'aria-selected': packTab === key ? 'true' : 'false', tabIndex: packTab === key ? 0 : -1, style: packTab === key ? { ...S.tab, ...S.tabOn } : S.tab, onClick: () => setPackTab(key) }, label + ' · ' + count))),
              h('div', { role: 'tabpanel', id: 'dsw-pack-panel-' + packTab, 'aria-labelledby': 'dsw-pack-tab-' + packTab }, selectedIsActive ? packDetailBody : nonActiveDetail))

      const DistributionPage = ({ exports: exportHistory, cwd, onExport: exportAction, onCopy: copyAction, result, busy: exportBusy, disabled: exportDisabled, error: exportError, lastMode, historyError, onRetryHistory, revisions: revisionRows, revisionsError, onRestoreRevision }) => {
        const history = Array.isArray(exportHistory) ? exportHistory : []
        /* Newest 20 only: this is a recent-history list, not a full audit log,
           and the panel does not trust the host's ordering. */
        const revisionsList = (Array.isArray(revisionRows) ? revisionRows : [])
          .slice()
          .sort((a, b) => {
            const left = Date.parse(a && a.at)
            const right = Date.parse(b && b.at)
            return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0)
          })
          .slice(0, 20)
        const copyInstall = () => copyAction(installCommand, installCommand)
        const copyArchive = result && result.file ? () => copyAction(result.file, t('copyPath')) : null
        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 18 } },
          h('section', { style: S.section },
            h('div', { style: { ...S.hint, paddingTop: 8 } }, t('exportScopeHint')),
            h('div', { style: { ...S.distPrimaryRow, paddingTop: 14 } },
              h('button', {
                style: exportDisabled ? { ...S.buttonPrimary, ...S.disabled } : S.buttonPrimary,
                onClick: () => exportAction(true), disabled: exportDisabled,
              }, exportBusy === 'scoped' ? t('exporting') : t('exportWithScope')),
              h('button', {
                style: exportDisabled ? { ...S.button, ...S.disabled } : S.button,
                onClick: () => exportAction(false), disabled: exportDisabled,
              }, exportBusy === 'pack' ? t('exporting') : t('exportPackOnly'))),
            h('div', { style: S.installRow },
              h('span', { style: S.hint }, t('installCommandLabel')),
              h('code', { style: S.code }, installCommand),
              h('button', { style: S.linkAccent, onClick: copyInstall }, t('copyCommand'))),
            cwd ? h('div', { style: { ...S.hint, paddingTop: 8 } }, t('currentProject'), h('span', { style: S.mono }, cwd)) : null,
            result
              ? h('div', { style: { ...S.banner('info'), marginTop: 12 } },
                h('div', null, t('exported') + '：', h('span', { style: S.mono }, result.file)),
                h('div', { style: S.hint }, nf(result.files) + ' ' + t('filesUnit') + ' · ' + nf(result.bytes) + ' bytes'),
                copyArchive ? h('button', { style: { ...S.linkAccent, marginTop: 6 }, onClick: copyArchive }, t('copyPath')) : null)
              : null,
            exportError ? h('div', { style: { marginTop: 12 } },
              h(ErrorState, {
                operation: scopedT('opExport'),
                message: exportError,
                onRetry: (lastMode === null || lastMode === undefined) ? undefined : () => exportAction(lastMode),
              })) : null),
          h(Section, { id: 'dsw-distribution-history', label: scopedT('recentExports'), count: history.length },
            historyError
              ? h('div', { style: { paddingBottom: history.length ? 12 : 0 } },
                h(ErrorState, { operation: scopedT('opLoadExportHistory'), message: historyError, onRetry: onRetryHistory }))
              : null,
            history.length
              ? h('div', { style: { display: 'flex', flexDirection: 'column' } }, history.map((item) =>
                h('div', { key: item.file, style: S.ruleRowV5 },
                  h('div', { style: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 } },
                    h('span', { style: S.ruleTitle }, item.file || '—'),
                    h('span', { style: S.hint }, when(item.modifiedAt) || '—')),
                  h('span', { style: S.ruleSideText }, (item.packId || '—') + ' v' + (item.packVersion || '—')),
                  h('span', { style: S.mutedBadge }, nf(item.bytes) + ' bytes'))))
              : !historyError
                ? h('div', { style: S.empty },
                  h('div', { style: S.hint }, scopedT('noExportsYet')),
                  h('button', { style: S.buttonPrimary, disabled: exportDisabled, onClick: () => exportAction(false) }, t('exportPackOnly')))
                : null),
          h(Section, { id: 'dsw-revision-history', label: scopedT('revisionsTitle'), count: revisionsList.length },
            revisionsError
              ? h(ErrorState, { operation: scopedT('revisionsTitle'), message: revisionsError, onRetry: () => setRevisionsReload((n) => n + 1) })
              : revisionsList.length
                ? h('div', { style: { display: 'flex', flexDirection: 'column', paddingTop: 8 } }, revisionsList.map((item) =>
                  h('div', { key: item.id, style: S.ruleRowV5 },
                    h('div', { style: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 } },
                      h('span', { style: S.mono }, item.file || '—'),
                      h('span', { style: S.hint }, when(item.at) + ' · ' + nf(item.bytes) + ' B · ' + String(item.reason || '').replace(/^[^:]+:/, ''))),
                    h('button', { style: S.linkButton, disabled: busy === 'revision', onClick: () => onRestoreRevision(item.id) }, t('revisionRestore'))))
                )
                : h('div', { style: S.empty }, h('div', { style: S.hint }, scopedT('revisionsEmpty')))))
      }

      const DistillPage = ({ onNavigate, onScan, historyError, onRetryHistory }) => {
        const sourceEntries = Object.entries((report && report.sources) || {})
          .filter(([, source]) => source && typeof source === 'object')
        const sourceLabels = { claude: 'Claude Code', codex: 'Codex', dsh: 'DeepSeek Harness', pi: 'Pi' }
        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 18 } },
          h('section', { style: S.section },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 8 } },
              h('span', { style: S.hint }, t('scanHint')),
              h('span', { style: S.chip }, t('localData'))),
            h('div', { style: { ...S.actionsBar, paddingTop: 12 } },
              h('button', { style: busy ? { ...S.buttonPrimary, ...S.disabled } : S.buttonPrimary, disabled: !!busy, onClick: onScan },
                busy === 'distill' ? t('distilling') : t('distill')),
              h('span', { style: S.actionsNote }, latest ? t('lastGenerated') + when(latest.generatedAt) : t('neverScanned'))),
            sourceEntries.length
              ? h('div', { style: { ...S.sourceList, paddingBottom: 0 } }, sourceEntries.map(([key, source]) =>
                h('div', { key, style: S.sourceRow },
                  h('span', { style: S.sourceName }, sourceLabels[key] || key),
                  h('span', { style: S.sourcePath }, source && source.available ? t('sourceAvailable') : t('sourceMissing')))))
              : h('div', { style: S.hint }, t('sourcesAfterScan'))),
          h(Section, { id: 'dsw-distill-review', label: t('suggestionsReview'), count: suggestions.length, right: reviewSectionRight },
            reviewSectionBody),
          h(Section, { id: 'dsw-distill-history', label: t('reportHistory'), count: reports.length },
            historyError
              ? h('div', { style: { paddingBottom: reports.length ? 12 : 0 } },
                h(ErrorState, { operation: t('opLoadHistory'), message: historyError, onRetry: onRetryHistory }))
              : null,
            reports.length
              ? h('div', { style: { display: 'flex', flexDirection: 'column' } }, reports.map((item) =>
                h('div', { key: item.file, style: S.ruleRowV5 },
                  h('div', { style: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 } },
                    h('span', { style: S.ruleTitle }, when(item.generatedAt) || item.file),
                    h('span', { style: S.hint }, item.file)),
                  h('span', { style: S.ruleSideText }, Object.entries(item.sources || {}).filter(([, available]) => available).map(([key]) => sourceLabels[key] || key).join(' · ') || t('noAvailableSources')),
                  h('span', { style: S.mutedBadge }, String(item.suggestionCount || 0) + ' ' + t('suggestionsCountUnit')))))
              : !historyError
                ? h('div', { style: S.empty }, h('div', { style: S.hint }, t('noReportsYet')))
                : null),
          h('a', { href: '#/metrics', style: S.linkAccent, onClick: (event) => { if (event && event.preventDefault) event.preventDefault(); onNavigate({ page: 'metrics' }) } }, t('viewMetrics')))
      }

      const MetricsPage = ({ metrics, onNavigate, onScan }) => {
        const available = metrics && metrics.available
        const metricWindow = metrics && (metrics.window || metrics.scanned || (metrics.generatedAt ? '生成于 ' + when(metrics.generatedAt) : ''))
        const metricCardsPage = (metrics && metrics.metrics || []).slice(0, 4).map((metric) => {
          const delta = metricDelta(metrics, metric)
          return h('div', { key: metric.id, style: S.metricCard },
          h('div', { style: S.metricTop }, h('span', { style: S.metricLabel }, metric.label),
            delta !== null
              ? h('span', {
                style: delta > 0 ? S.deltaUp : S.deltaDown,
                title: metrics.baseline && metrics.baseline.note ? metrics.baseline.note : '',
              }, t('baseline') + ' ' + (delta > 0 ? '+' : '') + delta + '%')
              : null),
          h('div', { style: S.metricValueRow }, h('span', { style: S.metricValue }, metric.value), h('span', { style: S.metricUnit }, metric.unit)),
          h('div', { style: S.metricFormula }, h('strong', null, t('formula')), metric.formula || '—'),
          h('div', { style: S.metricFormula }, h('strong', null, t('denominator')), metric.denominator || '—'),
          metric.window ? h('div', { style: S.hint }, t('window') + metric.window) : null)
        })
        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 18 } },
          h('section', { style: S.section },
            h('div', { style: S.sectionHead },
              h('span', { style: S.sectionLabel }, t('agentMetrics')),
              h('span', { style: S.chip }, t('recomputable'))),
            h('div', { style: { ...S.hint, paddingTop: 8 } }, t('metricsCaveat')),
            metricWindow ? h('div', { style: { ...S.hint, paddingTop: 8 } }, t('window') + metricWindow) : null),
          available
            ? h('div', null,
              h('div', { style: { ...S.filterRow, marginLeft: 0, paddingTop: 12, gap: 2 } },
                h('button', {
                  style: metricTab === 'metrics' ? { ...S.pill, ...S.pillActive } : S.pill,
                  'aria-pressed': metricTab === 'metrics' ? 'true' : 'false',
                  onClick: () => setMetricTab('metrics'),
                }, t('tabMetricsPill')),
                h('button', {
                  style: metricTab === 'sources' ? { ...S.pill, ...S.pillActive } : S.pill,
                  'aria-pressed': metricTab === 'sources' ? 'true' : 'false',
                  onClick: () => setMetricTab('sources'),
                }, t('tabSources'))),
              metricTab === 'metrics'
                ? h('div', null, h('div', { style: S.metricGrid }, metricCardsPage), h('div', { style: S.caveat }, metrics.caveat || t('defaultCaveat')))
                : h('div', { style: S.evidenceGrid }, (metrics.sources || []).map((item) => h('div', { key: item.key, style: S.stat },
                  h('span', { style: S.statLabel }, item.label), h('span', { style: S.statValue }, item.available ? '✓' : '✗'),
                  h('span', { style: S.statSub }, item.available ? t('sourceAvailable') : t('sourceMissing'))))))
            : h('div', null,
              h(EmptyState, {
                noun: t('metricsEmptyNoun'),
                primary: t('metricsEmptyPrimary'), onPrimary: () => onNavigate({ page: 'distill' }),
                source: t('tabSources'), onSource: () => setMetricTab('sources'),
              }),
              h('div', { style: { ...S.hint, paddingTop: 10, textAlign: 'center' } }, t('metricsUnavailable'))))
      }

      /* Skills own their inventory page: a doc-style list (mono 600 name,
         two-line clamped description) with the live count in the header. */
      const skillsBody = scopedSkills.length
        ? h('div', null, scopedSkills.map((skill) => h('div', {
          key: skill.name,
          className: 'dsw-row',
          style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid ' + HAIRLINE },
        },
          h('span', { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
            h('span', { style: S.skillName }, skill.name),
            h('span', { style: S.skillDesc, title: skill.description }, skill.description || '')),
          h('span', { style: skill.enabled === false ? S.mutedBadge : S.scopeBadge('workspace') },
            skill.enabled === false ? t('disabled') : (skill.inPreset ? t('presetCurrent') : t('enabled'))))))
        : h('div', { style: S.empty }, h('div', { style: S.hint }, t('emptyNone') + t('skillsLabel')))

      /* Shared route header: title + optional count/fingerprint chip, one action. */
      const PageHead = ({ id, title, count, chip, action }) => h('div', { style: S.pageHead },
        h('div', { style: S.pageHeadText },
          h('h2', { id, style: S.pageTitle }, title),
          count != null ? h('span', { style: S.pageCount }, count) : null,
          chip || null),
        action || null)

      const pageBody = route.page === 'overview'
        ? h('section', { 'aria-labelledby': 'dsw-overview-title', style: { display: 'flex', flexDirection: 'column', gap: 16 } },
          PageHead({
            id: 'dsw-overview-title',
            title: t('navOverview'),
            chip: h('code', { style: S.fpChip, title: t('fingerprint') }, inj && inj.fingerprint ? inj.fingerprint : '-'),
            action: h('button', { type: 'button', style: S.smallButton, onClick: () => navigate({ page: 'pack' }) }, t('packSwitch') + ' ▾'),
          }),
          h('div', { style: S.statGrid },
            Card({ value: rules.length, label: t('statRules'), href: routeHash('rules'), onClick: () => navigate({ page: 'rules' }) }),
            Card({ value: pendingCount, label: t('statSuggestions'), tone: pendingCount > 0 ? 'danger' : undefined, href: routeHash('distill'), onClick: () => navigate({ page: 'distill' }) }),
            Card({ value: scopedSkills.length, label: t('statSkills'), href: routeHash('skills'), onClick: () => navigate({ page: 'skills' }) })),
          h('div', { role: 'group', 'aria-label': t('quickActions'), style: { display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' } },
            h('span', { style: S.sectionLabel }, t('quickActions')),
            h('button', { type: 'button', style: S.linkButton, onClick: () => navigate({ page: 'rules' }) }, t('quickEditRules')),
            h('button', { type: 'button', style: S.linkButton, onClick: () => navigate({ page: 'pack', packId: active.id }) }, t('quickLoadPreview')),
            h('button', { type: 'button', style: S.linkButton, onClick: onDistill }, t('quickDistill'))))
      : route.page === 'pack'
          ? h('section', { 'aria-labelledby': 'dsw-packs-title' },
            h('h2', { id: 'dsw-packs-title', style: S.pageTitle }, route.packId ? t('pagePackDetail') : t('navRail')), packDetailPageBody)
          : route.page === 'rules'
            ? (() => {
              /* Rules page: scope chips + document-style list. Counts and
                 filtering derive from the existing rule array fields. */
              const ruleCounts = {
                all: scopedRules.length,
                workspace: scopedRules.filter((rule) => rule.enabled !== false && rule.disabledBy !== 'session' && rule.origin !== 'session').length,
                session: scopedRules.filter((rule) => rule.disabledBy === 'session' || rule.origin === 'session').length,
                disabled: scopedRules.filter((rule) => rule.enabled === false).length,
              }
              const scopeChips = [
                ['all', t('all'), ruleCounts.all],
                ['workspace', t('scopeWorkspace'), ruleCounts.workspace],
                ['session', t('scopeSession'), ruleCounts.session],
                ['disabled', t('rulesDisabledNoun'), ruleCounts.disabled],
              ]
              const filteredRules = scopeFilter === 'all'
                ? scopedRules
                : scopeFilter === 'workspace'
                  ? scopedRules.filter((rule) => rule.enabled !== false && rule.disabledBy !== 'session' && rule.origin !== 'session')
                  : scopeFilter === 'session'
                    ? scopedRules.filter((rule) => rule.disabledBy === 'session' || rule.origin === 'session')
                    : scopedRules.filter((rule) => rule.enabled === false)
              const ruleCard = (rule) => h('div', {
                key: rule.id,
                className: 'dsw-row',
                style: { ...S.ruleRowV5, ...(rule.enabled === false ? S.ruleRowOff : null) },
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
                  h('span', { style: S.hint }, rule.text || ''),
                  rule.removed
                    ? h('span', { style: S.overridden }, t('removedTag'))
                    : rule.enabled === false && rule.outsidePreset
                      ? h('span', { style: S.overridden }, t('outsidePreset') + ' · ' + rule.outsidePreset)
                      : rule.enabled === false && rule.disabledBy
                        ? h('span', { style: S.overridden }, t('disabledBy') + ' · ' + (rule.disabledBy === 'session' ? t('scopeSession') : rule.disabledBy === 'project' ? t('project') : t('scopeWorkspace')))
                        : null),
                h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
                  scopeBadge(rule),
                  h('span', { style: S.ruleSideText }, t('severity') + ' ' + (rule.severity === 'high' ? t('severityHigh') : rule.severity === 'low' ? t('severityLow') : t('severityMedium')))),
                h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
                  writeTargetOf(rule)
                    ? (rule.removed
                      ? h('button', { style: S.linkButton, onClick: () => onRestoreRule(rule) }, t('restoreRule'))
                      : h('button', { style: S.linkButton, onClick: () => openRuleEditor(rule) }, t('editRule')))
                    : null,
                  writeTargetOf(rule) && !rule.removed
                    ? h('button', { style: S.linkButton, onClick: () => onRemoveRule(rule) }, t('removeRule'))
                    : null,
                  rule.outsidePreset && scopedPreset
                    ? h('button', { style: S.linkButton, onClick: () => onAddToPreset(rule.id) }, t('addToPreset'))
                    : null))
              return h('section', { 'aria-labelledby': 'dsw-rules-page-title' },
                PageHead({
                  id: 'dsw-rules-page-title',
                  title: t('navRules'),
                  count: filteredRules.length,
                  action: h('button', { type: 'button', style: S.smallButton, onClick: () => setEditing({ id: '', title: '', text: '' }) }, '+ ' + t('newRule')),
                }),
                h('div', { role: 'group', 'aria-label': t('all'), style: { ...S.filterRow, marginLeft: 0, paddingTop: 12, gap: 2 } },
                  scopeChips.map(([key, label, count]) => Chip({
                    label, count,
                    on: scopeFilter === key,
                    onClick: () => setScopeFilter(key),
                  }))),
                editor,
                filteredRules.length
                  ? h('div', null, filteredRules.map(ruleCard))
                  : EmptyState({
                    noun: t('rulesEmptyNoun'),
                    primary: t('rulesEmptyPrimary'), onPrimary: () => setEditing({ id: '', title: '', text: '' }),
                    source: t('rulesEmptySource'), onSource: onDistill,
                  }))
            })()
            : route.page === 'presets'
              ? h('section', { 'aria-labelledby': 'dsw-presets-page-title', style: { display: 'flex', flexDirection: 'column', gap: 16 } },
                PageHead({
                  id: 'dsw-presets-page-title',
                  title: t('navPresets'),
                  count: presets.length,
                  action: h('button', { type: 'button', style: S.smallButton, onClick: () => openPresetEditor(null) }, '+ ' + t('presetNew')),
                }),
                presetsBody)
              : route.page === 'skills'
                ? h('section', { 'aria-labelledby': 'dsw-skills-page-title', style: { display: 'flex', flexDirection: 'column', gap: 16 } },
                  PageHead({
                    id: 'dsw-skills-page-title',
                    title: t('navSkills'),
                    count: scopedSkills.length + ' ' + t('skillsUnit'),
                  }),
                  skillsBody)
                : route.page === 'distill'
                  ? h('section', { 'aria-labelledby': 'dsw-distill-title' },
                    PageHead({ id: 'dsw-distill-title', title: t('distillReview') }),
                    h(DistillPage, { onNavigate: navigate, onScan: onDistill, historyError: reportsError, onRetryHistory: load }))
                  : route.page === 'metrics'
                    ? h('section', { 'aria-labelledby': 'dsw-metrics-title' },
                      PageHead({ id: 'dsw-metrics-title', title: t('pageMetrics') }),
                      h(MetricsPage, { metrics: met, onNavigate: navigate, onScan: onDistill }),
                      /* The old run page survives as the lower half of metrics. */
                      h(Section, { id: 'dsw-run', label: t('pageRun') }, runBody))
                    : h('section', { 'aria-labelledby': 'dsw-distribute-title' },
                PageHead({
                  id: 'dsw-distribute-title',
                  title: t('pageDistribute'),
                  chip: h('span', { style: S.chip }, active.displayName + ' v' + active.version),
                }),
                h(DistributionPage, {
                  exports,
                  cwd: environment.cwd,
                  onExport,
                  onCopy,
                  result: exportResult,
                  busy: exportBusy,
                  disabled: !!exportBusy || !!busy,
                  error: error,
                  lastMode: exportMode,
                  historyError: exportsError,
                  onRetryHistory: load,
                  revisions,
                  revisionsError,
                  onRestoreRevision,
                }))

      const headerNode = h('div', { style: S.header },
        h('div', { style: S.brandRow },
          h('div', { style: { minWidth: 0 } },
            h('h1', { style: S.title }, t('title')),
            h('div', { style: S.statusLine },
              h('span', null,
                t('session') + ' ',
                h('span', { style: S.statusStrong }, session && session.id ? session.id.slice(0, 12) : '-')),
              h('span', { style: S.statusDivider }),
              h('span', null, projectFileText || t('noProjectFile'))))),
        h('div', { style: S.toolbar },
          h('select', {
            style: S.select, value: active.id, disabled: busy === 'apply',
            onChange: (event) => onApply(event.target.value), title: t('packs'),
          }, packs.map((pack) => h('option', { key: pack.id, value: pack.id },
            (pack.displayName || pack.name || pack.id) + '  v' + pack.version))),
          h('button', {
            style: busy ? { ...S.button, ...S.disabled } : S.button,
            onClick: load, disabled: !!busy,
          }, t('refresh'))))

      const footerNode = h('div', { style: S.footer },
        h('span', { style: { whiteSpace: 'nowrap' } }, BUILD),
        h('span', { style: S.footerNote }, t('privacy')),
        h('span', { style: { ...S.mono, ...S.footerMeta } }, 'dsh-workstyle v' + status.plugin.version))

      return shell(pageBody, headerNode, footerNode, true)
    }


    /* --------------------------------- apply -------------------------------- */

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-workstyle: dictionaries')
      const t = ctx.locale.bind(NS)
      scopedT = t

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
