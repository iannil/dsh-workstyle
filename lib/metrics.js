/**
 * Proxy metrics for dsh-workstyle.
 *
 * Every number here can be recomputed from the latest distillation report —
 * nothing is inferred. In particular there is no "compliance" metric: the
 * report counts which words appeared in prompts, and that cannot tell whether
 * a rule was followed. Keeping the vocabulary honest matters more than adding
 * a third decimal place.
 *
 * Each metric carries its own `formula` and `denominator`, so the panel can
 * print the working next to the number.
 */
import { readLatestReport, readReports } from './distill.js'

const pct = (part, total) => (total > 0 ? (part / total) * 100 : 0)

function fmtPct(value) {
  return Math.round(value * 10) / 10
}

/**
 * Rule hits: which enabled rules had any of their own keywords appear in the
 * scanned prompts. A rule with no measurement words cannot be hit, and says so
 * rather than being counted as a miss.
 *
 * A rule can carry its own `measures` (keywords); packs that only declare
 * pack-level metrics leave `rule.measures` empty, and those rules are reported
 * as not measurable instead of as misses. The denominator is honest either way.
 */
function ruleHits(rules, hitCounts) {
  const countsByWord = hitCounts && typeof hitCounts === 'object' ? hitCounts : {}
  return rules.map((rule) => {
    const words = Array.isArray(rule.measures) ? rule.measures.filter((word) => typeof word === 'string' && word) : []
    const counts = words
      .map((word) => ({ word, count: Number(countsByWord[word]) || 0 }))
      .filter((hit) => hit.count > 0)
    const measurable = words.length > 0
    return {
      id: rule.id,
      title: rule.title,
      measurable,
      hit: measurable && counts.length > 0,
      hits: counts,
      ...(measurable ? {} : { note: '该规则没有测量词，无法统计命中' }),
    }
  })
}

export function computeMetrics({ rules = [], threshold = 0.4 } = {}) {
  const report = readLatestReport()
  if (!report || !report.sources) {
    return {
      available: false,
      reason: '尚未蒸馏：先运行一次蒸馏，度量才有可复算的底稿。',
      metrics: [],
      rules: rules.map((rule) => ({ id: rule.id, title: rule.title, measurable: false, label: '待测量' })),
    }
  }

  const claude = report.sources.claude || {}
  const dsh = report.sources.dsh || {}
  const codex = report.sources.codex || {}
  const pi = report.sources.pi || {}

  const prompts = Number(claude.prompts) || 0
  const planKeywords = Number(claude.planKeywords) || 0
  const verifyKeywords = Number(claude.verifyKeywords) || 0

  const planRate = pct(planKeywords, prompts)
  const verifyRate = pct(verifyKeywords, prompts)

  const sources = [
    { key: 'claude', label: 'Claude Code', available: !!claude.available },
    { key: 'codex', label: 'Codex', available: !!codex.available },
    { key: 'dsh', label: 'DeepSeek Harness', available: !!dsh.available },
    { key: 'pi', label: 'Pi', available: !!pi.available },
  ]
  const availableSources = sources.filter((item) => item.available).length

  const scanned = [
    prompts ? `Claude Code 共读到 ${prompts} 条 prompt` : '',
    dsh.sampled ? `DSH 最近 ${dsh.sampled} 个会话` : '',
    codex.sessions ? `Codex 本地索引 ${codex.sessions} 个会话` : '',
    pi.sessions ? `Pi ${pi.sessions} 个会话` : '',
  ].filter(Boolean).join('；')

  // Rule hits read the per-keyword counts the distillation recorded while it
  // held the prompts. The report stores numbers only; the text never lands.
  const hits = ruleHits(rules, claude.ruleHits)
  const measurableRules = hits.filter((hit) => hit.measurable)
  const hitCount = measurableRules.filter((hit) => hit.hit).length

  const ruleMetric = {
    id: 'rule-hits',
    label: '规则命中',
    value: String(hitCount),
    unit: '/' + measurableRules.length,
    ratio: pct(hitCount, measurableRules.length),
    formula: '规则命中 = 在扫描语料中出现过至少一个测量词的启用规则数 / 有测量词的启用规则数',
    denominator: '分母只算可测量的规则；没有测量词的规则单独列出，不当作未命中。',
    detail: hits.slice(0, 40),
  }

  const planMetric = {
    id: 'plan-rate',
    label: '先方案率',
    value: String(fmtPct(planRate)),
    unit: '%',
    ratio: planRate,
    formula: `先方案率 = 含方案类关键词的用户 prompt 数 / 读到用户 prompt 总数 = ${planKeywords} / ${prompts}`,
    denominator: '分母是用户 prompt 总数；它说的是「用户在要求方案」，不是「模型给了方案」。',
  }

  const verifyMetric = {
    id: 'verify-rate',
    label: '验证率',
    value: String(fmtPct(verifyRate)),
    unit: '%',
    ratio: verifyRate,
    formula: `验证率 = 含验证类关键词的用户 prompt 数 / 读到用户 prompt 总数 = ${verifyKeywords} / ${prompts}`,
    denominator: '同样只看用户 prompt 侧；不含模型是否真的跑了测试。',
  }

  const coverageMetric = {
    id: 'coverage',
    label: '蒸馏覆盖',
    value: String(availableSources),
    unit: '/' + sources.length,
    ratio: pct(availableSources, sources.length),
    formula: `蒸馏覆盖 = 有可用数据源的来源数 / 配置的来源数 = ${availableSources} / ${sources.length}`,
    denominator: sources.map((item) => item.label + (item.available ? ' ✓' : ' ✗')).join(' · '),
  }

  return {
    available: true,
    generatedAt: report.generatedAt,
    threshold,
    scanned,
    sources,
    metrics: [ruleMetric, planMetric, verifyMetric, coverageMetric],
    rules: hits.map((hit) => ({
      id: hit.id,
      title: hit.title,
      measurable: hit.measurable,
      hit: hit.hit,
      ...(hit.hits && hit.hits.length ? { sample: hit.hits.slice(0, 3).map((h) => h.word + '×' + h.count) } : {}),
      ...(hit.note ? { note: hit.note } : {}),
    })),
    baseline: baseline(),
    caveat: '这些是代理指标：能说明提示里出现过什么，不能说明模型是否遵守规则。',
  }
}

/** Previous report next to the latest one, for a diff rather than a claim. */
function baseline() {
  const reports = readReports(2)
  if (reports.length < 2) return { available: false }
  const [previous, latest] = [reports[1], reports[0]]
  const before = previous && previous.sources ? previous.sources.claude || {} : {}
  const after = latest && latest.sources ? latest.sources.claude || {} : {}
  const rate = (source) => (Number(source.prompts) > 0 ? pct(Number(source.planKeywords) || 0, Number(source.prompts)) : 0)
  const verifyRate = (source) => (Number(source.prompts) > 0 ? pct(Number(source.verifyKeywords) || 0, Number(source.prompts)) : 0)
  return {
    available: true,
    previousAt: previous.generatedAt,
    planRate: { before: fmtPct(rate(before)), after: fmtPct(rate(after)), delta: fmtPct(rate(after) - rate(before)) },
    verifyRate: { before: fmtPct(verifyRate(before)), after: fmtPct(verifyRate(after)), delta: fmtPct(verifyRate(after) - verifyRate(before)) },
    note: '两次报告之间的差值，只说明窗口变了，不说明因果。',
  }
}
