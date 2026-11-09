export const meta = {
  name: 'fde-job-run',
  description: 'AI Project Auto-Build Engine — phased orchestration. Scaffolds, analyzes requirements, architects, designs frontend, generates an optional high-fidelity POC, develops, integrates, deploys, and reports.',
  phases: [
    { title: 'Scaffold', detail: 'fde-init-project scaffolding + project-metadata.json' },
    { title: 'Requirements', detail: 'fde-requirements deep requirement decomposition' },
    { title: 'Architect', detail: 'fde-architect blueprint design with architecture patterns' },
    { title: 'Frontend', detail: 'fde-frontend-architect frontend design' },
    { title: 'POC', detail: 'fde-poc high-fidelity clickable prototype (skippable via skip_poc / stoppable via stop_at_poc)' },
    { title: 'Develop', detail: 'deterministic milestone loop (workflow + inspector per milestone)' },
    { title: 'Run Gate', detail: 'QA gate: required build, tests and project-specific coverage; diagnose failures; report missing evidence' },
    { title: 'Integrate', detail: 'integration + agent-browser E2E (load once, degrade for non-UI) & production readiness' },
    { title: 'Deploy', detail: 'deployment configuration generation' },
    { title: 'Report', detail: 'final report generation' },
  ],
}

// ═══════════════════════════════════════════════════════════
//  Pure helpers — mirrored from references/detection-logic.js — keep in sync
//  (Workflow 沙箱禁止 require/import；此处内联。单测守护单一真源。)
// ═══════════════════════════════════════════════════════════

const FRONTEND_SIGNALS = [
  '前端', '界面', '页面', 'ui', 'web app', 'web-app', '小程序', '移动端',
  'dashboard', '仪表盘', '后台管理', '管理后台', 'react', 'vue', 'next.js',
  'nextjs', 'frontend', '网页', '网站',
]
const NO_FRONTEND_SIGNALS = [
  'cli', '命令行', 'library', '库', 'sdk', '脚本', '纯后端', 'api only',
  '纯 api', 'backend only', 'fastapi', 'flask', 'django', 'express', 'spring',
  'gin', 'echo', 'actix', 'rest api', 'api 服务', 'api-server', 'api server',
  '后端接口',
]
const COMPLEX_SIGNALS = [
  '多端', '多模块', '多个角色', '审批', '工作流', 'saas', '多租户',
  '事件驱动', 'bff', '微服务', '跨模块', '多机构', '分销', '权限体系',
]
const SIMPLE_SIGNALS = [
  'crud', '简单', '单个', '工具', '计算器', 'todo', '待办', '脚本',
  '小工具', '单功能', 'single', 'simple', 'library', '库',
]

function detectComplexity(req) {
  const text = String(req || '').toLowerCase()
  const hit = (arr) => arr.some((k) => text.includes(k))
  let has_frontend, fe_reason
  if (hit(NO_FRONTEND_SIGNALS)) { has_frontend = false; fe_reason = '命中无前端信号词' }
  else if (hit(FRONTEND_SIGNALS)) { has_frontend = true; fe_reason = '命中前端信号词' }
  else { has_frontend = true; fe_reason = '无明确信号，保守按含前端处理' }
  let skip_requirements, req_reason
  if (hit(COMPLEX_SIGNALS)) { skip_requirements = false; req_reason = '命中复杂信号词，保留需求分析' }
  else if (hit(SIMPLE_SIGNALS)) { skip_requirements = true; req_reason = '命中简单信号词，跳过需求分析' }
  else { skip_requirements = false; req_reason = '无明确信号，保留需求分析（安全默认）' }
  const skip_frontend = !has_frontend
  let detected_complexity
  if (hit(COMPLEX_SIGNALS)) detected_complexity = 'complex'
  else if (hit(SIMPLE_SIGNALS)) detected_complexity = 'simple'
  else detected_complexity = 'moderate'
  return { detected_complexity, has_frontend, skip_requirements, skip_frontend, complexity_reasoning: `${fe_reason}; ${req_reason}` }
}

function topoSort(milestones) {
  const ids = milestones.map((m) => m.id)
  const idSet = new Set(ids)
  for (const m of milestones) {
    for (const d of m.deps || []) {
      if (!idSet.has(d)) throw new Error(`milestone ${m.id} depends on unknown ${d}`)
    }
  }
  const indeg = {}; const adj = {}
  ids.forEach((id) => { indeg[id] = 0; adj[id] = [] })
  for (const m of milestones) {
    for (const d of m.deps || []) { adj[d].push(m.id); indeg[m.id]++ }
  }
  const queue = ids.filter((id) => indeg[id] === 0)
  const order = []
  while (queue.length) {
    const id = queue.shift(); order.push(id)
    for (const next of adj[id]) { indeg[next]--; if (indeg[next] === 0) queue.push(next) }
  }
  if (order.length !== ids.length) throw new Error('cycle detected in milestone dependency graph')
  return order
}

// ═══════════════════════════════════════════════════════════
//  Skill Protocol: Standard Inter-Skill Communication
// ═══════════════════════════════════════════════════════════
//
// This script implements the standardized skill protocol
// defined in references/skill-protocol.md.
//
// File persistence (job.state.json, project-metadata.json, job.progress.md)
// is HANDLED BY THE SUB-AGENTS, not by this script.
// Each phase agent writes state files to disk for cross-session recovery.
// This script only orchestrates phases in memory.
//
// Key files (written by sub-agents):
//   .agents/job.state.json           — machine-readable project state
//   .agents/job.progress.md          — human-readable append-only log
//   project-metadata.json            — structured metadata bridging init→architect→orchestrator
//   CONTEXT.md                       — project blueprint (architect output)
//   REQUIREMENTS.md                  — requirements analysis (requirements phase)
//   FRONTEND-DESIGN.md               — frontend architecture design (frontend phase)
//   frontend-spec.json               — frontend design tokens (if has_frontend)
//   .agents/progress.json            — orchestrator progress tracker
//
// Protocol flow:
//   fde-init-project  ──►  project-metadata.json  ──►  fde-requirements
//   fde-requirements  ──►  REQUIREMENTS.md  ──►  fde-architect
//   fde-architect  ──►  CONTEXT.md  ──►  fde-frontend-architect
//   fde-frontend-architect  ──►  FRONTEND-DESIGN.md  ──►  fde-orchestrator
//   fde-orchestrator  ──►  .agents/progress.json  ──►  fde-workflow × N
//
// ═══════════════════════════════════════════════════════════

// ── Constants ─────────────────────────────────────────────

const MODE = args.mode || 'normal'
const REQUIREMENTS = args.requirements || ''
const PROJECT_NAME = args.projectName || 'unnamed-project'

// ── Complexity Detection (Component 2) ───────────────────
// 启发式检测；显式 args.skip_* 永远优先。

const detected = detectComplexity(REQUIREMENTS)
const skip_requirements = args.skip_requirements != null ? !!args.skip_requirements : detected.skip_requirements
const skip_frontend = args.skip_frontend != null ? !!args.skip_frontend : detected.skip_frontend

// ── POC gating (Phase 3.5) ───────────────────────────────
// POC runs by default when the project has a frontend; skip_poc opts out,
// stop_at_poc halts the pipeline after POC (no orchestrate/run-gate/integrate/deploy).
const skip_poc = args.skip_poc != null ? !!args.skip_poc : false
const stop_at_poc = !!args.stop_at_poc

log(`Complexity: ${detected.detected_complexity} | has_frontend=${detected.has_frontend} | skip_requirements=${skip_requirements} | skip_frontend=${skip_frontend} (${detected.complexity_reasoning})`)

// ── Phase Result Schema ──────────────────────────────────

const PHASE_RESULT = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED'],
    },
    summary: { type: 'string' },
    required_complete: { type: 'boolean' },
    changes: {
      type: 'object',
      properties: {
        files_created: { type: 'number' },
        files_modified: { type: 'number' },
        tests_passed: { type: 'number' },
        tests_total: { type: 'number' },
        commit_hash: { type: 'string' },
        degraded: { type: 'boolean' },
      },
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['warning', 'error'] },
          description: { type: 'string' },
        },
      },
    },
    // recovery field — returned by Phase 0 when existing state is found
    recovery: {
      type: 'object',
      properties: {
        found: { type: 'boolean' },
        last_phase: { type: 'string' },
        phases_done: { type: 'array', items: { type: 'string' } },
        milestones: { type: 'object', additionalProperties: true },
        session_summary: { type: 'string' },
      },
    },
    // report field — returned by Phase 7 with final report text
    report: { type: 'string' },
  },
  required: ['status', 'summary'],
  additionalProperties: true,
}

const MILESTONE_SCHEMA = {
  type: 'object',
  properties: {
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          deps: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
          acceptance: { type: 'string' },
          frontend: { type: 'boolean' },
        },
        required: ['id', 'name', 'deps', 'description'],
      },
    },
  },
  required: ['milestones'],
}

const RUN_GATE_SCHEMA = {
  type: 'object',
  properties: {
    build_ok: { type: 'boolean' },
    test_ok: { type: 'boolean' },
    build_command: { type: 'string' },
    test_command: { type: 'string' },
    output: { type: 'string' },
    coverage_ok: { type: 'boolean' },
    coverage_reason: { type: 'string' },
    diff_coverage: { type: 'number' },
    global_coverage: { type: 'number' },
  },
  required: ['build_ok', 'test_ok', 'coverage_ok', 'coverage_reason'],
}

// ── Helpers ──────────────────────────────────────────────

// Build a Phase context string shared with every agent prompt
function ctx(phase, extra = '') {
  const lines = [
    `Project: "${PROJECT_NAME}"`,
    `Mode: ${MODE}`,
    `Requirements: "${REQUIREMENTS}"`,
    `Phase: ${phase}`,
    'Read and inherit the delegation contract in CONTEXT.md / REQUIREMENTS.md and its checkpoint.session_summary reference when present. Preserve the user-approved scope, acceptance, authorization and stop boundaries in all child prompts. Return DONE only with full required evidence; DONE_WITH_CONCERNS needs required_complete:true for nonblocking concerns.',
    "Preserve existing work and requirements. Inherit the original user intent, constraints and authorization in every nested delegation. Scope changes require a user decision; pause only the affected work. Mode does not expand authorization. Do not hard-reset, silently reduce scope, publish or include unrelated changes in commits. Mark missing required evidence as incomplete.",
  ]
  if (extra) lines.push('', extra)
  return lines.join('\n')
}

// ── Phase Tracking (in-memory only — agents persist to disk) ──

const phasesDone = new Set()

let developmentSummary = ''
let developmentMilestoneState = {}
let runGateResult = null
let recoveredMilestones = {}
const phaseResults = {}

function isDone(phase) {
  return phasesDone.has(phase)
}

// Missing, degraded or contradictory evidence never establishes completion.
function accepted(result) {
  return !!(result && typeof result.summary === 'string' && result.summary.trim()
    && (result.status === 'DONE' || (result.status === 'DONE_WITH_CONCERNS' && result.required_complete === true))
    && result.required_complete !== false && !result.changes?.degraded
    && !(result.issues || []).some(issue => issue.severity === 'error'))
}

function recordPhase(name, result) {
  phaseResults[name] = result || { status: 'BLOCKED', summary: 'No result; required evidence missing.' }
  if (accepted(result)) phasesDone.add(name)
  else phasesDone.delete(name)
  log(`${name}: ${accepted(result) ? result.status : 'INCOMPLETE'} — ${phaseResults[name].summary || 'No usable evidence'}`)
}

async function repairPhase(name, result, label, group) {
  if (!accepted(result) && result?.summary?.trim()) {
    result = await agent(ctx(name, `One targeted recovery attempt. Diagnose the failure and preserve the FULL original scope and acceptance criteria. Do not substitute a skeleton or reduced deliverable. If a user decision or external prerequisite is needed, return BLOCKED with the exact next action instead of retrying blindly.
Previous evidence: ${JSON.stringify(result)}
Complete the originally requested phase, verify its required outputs, and return DONE only with all required evidence. Persist the actual status in .agents/job.state.json.`),
      { schema: PHASE_RESULT, label, phase: group })
  }
  recordPhase(name, result)
}

// ═══════════════════════════════════════════════════════════
//  Phase 0 — fde-init-project: recovery check + project scaffold
// ═══════════════════════════════════════════════════════════
//  Detects existing state first (cross-session recovery).
//  Then scaffolds a fresh project or recovers.

phase('Scaffold')
if (!isDone('init')) {
  log(`Phase 0: fde-init-project — checking state & scaffolding`)

  let result = await agent(
    ctx('fde-init-project', `=== ACT AS RECOVERY CHECKER + INIT-PROJECT ===

You have TWO possible entry points. Determine which one applies.

--- ENTRY A: RECOVERY (if job.state.json exists) ---

Check if the file ".agents/job.state.json" exists in the current directory.
  • If YES: Read and parse it. Return the candidate history for a separate validation step with:
    { status: "DONE", summary: "Recovered from job.state.json",
      recovery: { found: true, last_phase: "<last_phase value>", phases_done: [<all phases with DONE status>], session_summary: "<checkpoint.session_summary>" } }
    DO NOT re-scaffold anything.

--- ENTRY B: FRESH PROJECT (if job.state.json does NOT exist) ---

If the state file does NOT exist, start a fresh project:

Step 1 — Write project-metadata.json
Write this file to disk BEFORE generating any project files:
{
  "project": {
    "name": "${PROJECT_NAME}",
    "description": "<one-line summary of requirements>",
    "type": "<api-server | cli-tool | library | web-app | desktop-app | mobile-app | other>",
    "language": "<inferred language>",
    "framework": "<inferred framework>",
    "package_manager": "<pip | cargo | npm | go-mod | maven | ...>",
    "database": "<inferred db or null>",
    "has_frontend": <true | false>,
    "frontend_framework": "<inferred or null>",
    "deployment": { "type": "<local | docker | serverless | cloud-vm>", "ci_cd": "<github-actions | gitlab-ci | manual | none>", "docker": <true | false> },
    "testing": { "framework": "<inferred>", "types": ["unit", "integration"] },
    "license": "MIT",
    "detected_complexity": "${detected.detected_complexity}",
    "has_frontend": ${detected.has_frontend},
    "skip_requirements": ${skip_requirements},
    "skip_frontend": ${skip_frontend},
    "complexity_reasoning": "${detected.complexity_reasoning}",
    "features": ["<feature 1>", "<feature 2>"]
  },
  "progress_file": ".agents/job.state.json",
  "blueprint_file": "CONTEXT.md"
}

Step 2 — Generate project file tree
Use the fde-init-project skill conventions:
  a) Universal structure: docs/, memory/, release/, .gitignore, README.md, LICENSE
  b) Type-specific structure based on language/framework
  c) .claude/settings.json with basic permissions
  d) Runnable entry files with config + logger + lifecycle tracker
  e) CI/CD config if deployment type supports it

Step 3 — Write .agents/job.state.json
Create the .agents/ directory and write job.state.json:
{
  "project": "${PROJECT_NAME}",
  "job_version": "2.0",
  "mode": "${MODE}",
  "phases": { "init": { "status": "DONE" }, "requirements": { "status": "TODO" }, "architect": { "status": "TODO" }, "frontend": { "status": "TODO" }, "poc": { "status": "TODO" }, "development": { "status": "TODO" }, "finalize": { "status": "TODO" }, "deploy": { "status": "TODO" }, "report": { "status": "TODO" } },
  "checkpoint": { "last_phase": "init", "next_action": "start requirements phase", "session_summary": "Project scaffolded" }
}

Step 4 — Write .agents/job.progress.md
Create an append-only progress log with the initial entry.

IMPORTANT: project-metadata.json and job.state.json are REQUIRED for subsequent phases.
Write them to disk as actual files.`),
    { schema: PHASE_RESULT, label: 'fde-init-project', phase: 'Scaffold' }
  )

  if (result?.recovery?.found) {
    const validated = await agent(ctx('recovery', `Validate recovery against current requirements, CONTEXT.md, current code and actual verification evidence. Read .agents/job.state.json and .agents/progress.json. Historical DONE flags alone are not evidence.
Return recovery.phases_done containing only currently validated design/scaffold phases (init, requirements, architect, frontend, poc). Invalidate downstream design phases when their inputs changed. Return recovery.milestones keyed by id, with status DONE, verified:true, nonempty summary and exact current id/name/deps/description/acceptance/frontend for milestones whose full acceptance and review evidence still match current code. Revalidate uncertain evidence without reimplementing verified milestones. Never mark a skipped/degraded milestone as complete. Do not re-scaffold or overwrite existing work. Do not carry forward development, run_gate, finalize, deploy or report completion; this run will derive them again.
Candidate state: ${JSON.stringify(result.recovery)}`),
      { schema: PHASE_RESULT, label: 'recovery-validate', phase: 'Scaffold' })
    if (accepted(validated)) {
      for (const p of validated.recovery?.phases_done || []) {
        if (['init', 'requirements', 'architect', 'frontend', 'poc'].includes(p)) phasesDone.add(p)
      }
      recoveredMilestones = validated.recovery?.milestones || {}
    }
    log(`Recovery validated phases: ${[...phasesDone].join(', ') || 'none'}`)
  } else {
    await repairPhase('init', result, 'fde-init-project-retry', 'Scaffold')
  }
}

// ═══════════════════════════════════════════════════════════
//  Phase 1 — fde-requirements: 需求深度拆解
//  Input:  project-metadata.json (on disk, from Phase 0)
//  Output: REQUIREMENTS.md (需求分析文档)
// ═══════════════════════════════════════════════════════════

phase('Requirements')
if (isDone('init') && !isDone('requirements') && !skip_requirements) {
  log('Phase 1: fde-requirements — deep requirement decomposition')

  let result = await agent(
    ctx('fde-requirements', `=== DEEP REQUIREMENT DECOMPOSITION ===

Read "project-metadata.json" from disk for project context.

Execute the fde-requirements process:
1. Identify all user roles and their core journeys
2. Run event storming — identify key business events
3. Decompose into bounded contexts / modules
4. Build full feature inventory with CRUD matrix
5. Create feature dependency DAG
6. Define state machines for key business objects
7. Write acceptance criteria for each feature

Output: Write REQUIREMENTS.md to project root with ALL sections filled.
Update .agents/job.state.json requirements phase to DONE.
Append to .agents/job.progress.md.

Return structured result with summary.`),
    { schema: PHASE_RESULT, label: 'fde-requirements', phase: 'Requirements' }
  )

  await repairPhase('requirements', result, 'requirements-retry', 'Requirements')
} else if (skip_requirements) {
  log('Phase 1 skipped (simple project)')
}

// ═══════════════════════════════════════════════════════════
//  Phase 2 — fde-architect: 架构蓝图（改进版）
//  Input:  project-metadata.json + REQUIREMENTS.md (on disk)
//  Output: CONTEXT.md (含架构模式 + 部署架构)
// ═══════════════════════════════════════════════════════════

phase('Architect')
if (isDone('init') && (skip_requirements || isDone('requirements')) && !isDone('architect')) {
  log('Phase 2: fde-architect — generating blueprint')

  let result = await agent(
    ctx('fde-architect', `=== GENERATE PROJECT BLUEPRINT ===

Read "project-metadata.json" from disk for technical context.
Read "REQUIREMENTS.md" from disk if it exists (for feature definitions, state machines, role journeys).
Read the existing project file tree.

Generate a complete CONTEXT.md blueprint:
1. System overview, tech stack, architectural red lines
2. Architecture pattern decisions (BFF / Event-Driven / CQRS / Multi-Tenancy / DDD)
   — Reference enterprise-architecture-patterns.md for pattern details
3. Deployment architecture topology diagram
4. Domain glossary (core terms with English names)
5. Core data models (entities, fields, indexes)
6. API contracts (routes, requests, responses, errors)
7. Milestone plan (dependency-ordered, backend and frontend milestones CAN be parallel)
8. Testing strategy, docs convention, deployment plan

Read project-metadata.json has_frontend field. If true, also generate:
- Frontend Design Direction section in CONTEXT.md
- frontend-spec.json with basic design tokens

AFTER generating CONTEXT.md, UPDATE project-metadata.json with architect results.
UPDATE .agents/job.state.json architect phase to "DONE".
APPEND to .agents/job.progress.md.`),
    { schema: PHASE_RESULT, label: 'fde-architect', phase: 'Architect' }
  )

  await repairPhase('architect', result, 'architect-retry', 'Architect')
}

// ═══════════════════════════════════════════════════════════
//  Phase 3 — fde-frontend-architect: 前端详细设计
//  Input:  CONTEXT.md (on disk, from Phase 2)
//  Output: FRONTEND-DESIGN.md (前端设计文档)
// ═══════════════════════════════════════════════════════════

phase('Frontend')
// Phase 3 runs by default for non-simple projects.
// The sub-agent reads CONTEXT.md and detects has_frontend on its own.
// If no frontend, it generates a minimal FRONTEND-DESIGN.md noting no frontend needed.
// Skip via isSimpleProject (passed through args) or explicit args.skip_frontend.

if (isDone('architect') && !isDone('frontend') && !skip_frontend) {
  log('Phase 3: fde-frontend-architect — frontend design')

  let result = await agent(
    ctx('fde-frontend-architect', `=== FRONTEND ARCHITECTURE DESIGN ===

Read "CONTEXT.md" from disk for system architecture, tech stack, and frontend direction.
Read "REQUIREMENTS.md" from disk if it exists (for user roles and journeys).

Execute the fde-frontend-architect process:
1. Portal scope analysis — identify all frontend portals, their tech stacks, devices, users
2. Design token system — shared tokens + portal-specific tokens (colors, fonts, spacing)
3. Page tree & routes — complete page tree per portal with route paths
4. Component hierarchy — UI components → feature components → page components
5. State architecture — global vs local vs server state boundaries
6. UI state machines — loading, empty, error, edge cases for every core page
7. API interaction patterns — data fetching strategy per page
8. Page-level design summary — one-liner per core page

Output: Write FRONTEND-DESIGN.md to project root with ALL sections filled.
Update .agents/job.state.json frontend phase to DONE.
Append to .agents/job.progress.md.

Return structured result.`),
    { schema: PHASE_RESULT, label: 'fde-frontend-architect', phase: 'Frontend' }
  )

  await repairPhase('frontend', result, 'frontend-retry', 'Frontend')
} else {
  log('Phase 3 skipped (no frontend or simple project)')
}

// ═══════════════════════════════════════════════════════════
//  Phase 3.5 — fde-poc: 高保真 POC（可跳过 / 可停留 / 可继续）
//  Input:  REQUIREMENTS.md + FRONTEND-DESIGN.md (+ CONTEXT.md) on disk
//  Output: 可运行前端 POC + .agents/poc.ledger.json + POC-MANIFEST.md + POC-FIDELITY.md
//  Gate:   runs only when project has a frontend and skip_poc is false.
// ═══════════════════════════════════════════════════════════

phase('POC')
const runPoc = !skip_frontend && !skip_poc
if (runPoc && isDone('frontend') && !isDone('poc')) {
  log('Phase 3.5: fde-poc — high-fidelity clickable prototype')

  let result = await agent(
    ctx('fde-poc', `=== HIGH-FIDELITY POC GENERATION ===

Read "REQUIREMENTS.md" and "FRONTEND-DESIGN.md" from disk (and "CONTEXT.md" if present for data models/contracts).

Build a runnable, PURE-FRONTEND, EVOLUTIONARY POC:
1. Identify the industry from REQUIREMENTS.md; apply skills/fde-poc/references/industry-patterns.md conventions.
2. Scaffold the frontend using FRONTEND-DESIGN.md tech stack (default Vite + React if unspecified); wire design tokens, routing, and a swappable mock-adapter seam (src/mocks/, per mock-layer-guide.md).
3. Build a coverage ledger ".agents/poc.ledger.json" enumerating every page/component/state/flow (coverage_status=planned).
4. Implement every page with ALL UI states (loading/empty/error/normal/edge) + mock data + interactions; loop-until-dry with a coverage critic until the ledger is dry.
5. Wire cross-page flows, mock auth/roles, in-memory persistence, realistic seed data. Build + dev-server start MUST pass.
6. Write "POC-MANIFEST.md" (pages/components/routes/mock-endpoints + mock→real evolution map) and "POC-FIDELITY.md" (per-asset 真实交互 / mock 数据 / 占位未实现).
Label payment / third-party / pure-server logic as 占位未实现 — never fake real external services.

Update ".agents/job.state.json" poc phase to DONE. Append to ".agents/job.progress.md".
Return structured result.`),
    { schema: PHASE_RESULT, label: 'fde-poc', phase: 'POC' }
  )

  await repairPhase('poc', result, 'poc-retry', 'POC')

  if (stop_at_poc) {
    log('stop_at_poc=true — halting after POC; skipping develop/run-gate/integrate/deploy, proceeding to report.')
  }
} else {
  log(`Phase 3.5 skipped (skip_poc=${skip_poc}, has_frontend=${!skip_frontend})`)
}

// ═══════════════════════════════════════════════════════════
//  Phase 4 — fde-orchestrator: 多功能编排开发（增强版）
//  Input:  CONTEXT.md + FRONTEND-DESIGN.md + project-metadata.json (on disk)
//  Output: .agents/progress.json + completed code

phase('Develop')
if (isDone('architect') && (skip_frontend || isDone('frontend')) && (!runPoc || isDone('poc')) && !isDone('development') && !stop_at_poc) {
  log('Phase 4: extracting milestone DAG from CONTEXT.md')

  const extracted = await agent(
    ctx('milestone-extract', `=== EXTRACT MILESTONE DAG ===
Read "CONTEXT.md" from disk. Extract the milestone/feature list as structured data.
- id: as written in CONTEXT.md (M1, M2, ...)
- name: milestone name
- deps: ids this milestone depends on (empty array if none)
- description: copy the milestone scope from CONTEXT.md
- acceptance: key acceptance points if present (empty string otherwise)
- frontend: true if this milestone is primarily frontend work
If CONTEXT.md has no milestone section, return a single milestone:
  [{id:"M1", name:"implement-all", deps:[], description:"implement the whole project per CONTEXT.md", acceptance:"build and tests pass", frontend:false}]
If "POC-MANIFEST.md" exists on disk, the frontend POC is the starting point — frontend milestones should EVOLVE the POC's mock layer into real implementation (swap the mock adapter per the evolution map) rather than rebuild pages from scratch.
Return ONLY the structured milestones.`),
    { schema: MILESTONE_SCHEMA, label: 'milestone-extract', phase: 'Develop' }
  )

  const milestones = extracted?.milestones || []
  let order = []
  try {
    if (!milestones.length || new Set(milestones.map(m => m.id)).size !== milestones.length) throw new Error('missing or duplicate milestones')
    order = topoSort(milestones)
  } catch (e) {
    log(`Phase 4: invalid milestone DAG (${e.message}); development remains incomplete`)
  }
  const byId = {}
  milestones.forEach((m) => { byId[m.id] = m })

  const milestoneState = {}
  milestones.forEach(({ id }) => { milestoneState[id] = { status: 'TODO', rebuild_count: 0, degraded: false, skipped: false } })
  const MAX_RETRY = 1

  function cascadeSkip(blockedId) {
    for (const m of milestones) {
      if ((m.deps || []).includes(blockedId) && milestoneState[m.id].status === 'TODO') {
        milestoneState[m.id].status = 'SKIPPED'
        milestoneState[m.id].skipped = true
        milestoneState[m.id].skip_reason = `upstream ${blockedId} blocked/skipped`
        log(`Phase 4: cascade-skip ${m.id} (depends on ${blockedId})`)
        cascadeSkip(m.id)
      }
    }
  }

  for (const id of order) {
    const ms = milestoneState[id]
    if (ms.status === 'SKIPPED') continue
    const m = byId[id]
    const saved = recoveredMilestones[id]
    if (saved?.status === 'DONE' && saved.verified === true && saved.summary?.trim()
      && ['id', 'name', 'deps', 'description', 'acceptance', 'frontend'].every(key => JSON.stringify(saved[key]) === JSON.stringify(m[key]))) {
      ms.status = 'DONE'
      ms.summary = saved.summary
      log(`Phase 4: milestone ${id} already verified; preserving completed work`)
      continue
    }
    ms.status = 'IN_PROGRESS'
    log(`Phase 4: milestone ${id} (${m.name}) — start`)

    let res = await agent(
      ctx('fde-workflow', `=== EXECUTE MILESTONE ${id}: ${m.name} ===
Read "CONTEXT.md" from disk for the blueprint.
If this is a frontend milestone and "POC-MANIFEST.md" exists, build on the existing POC: replace mock-adapter calls with real implementations per the manifest's evolution map instead of rewriting the UI.
Implement milestone ${id} "${m.name}":
Description: ${m.description}
Acceptance: ${m.acceptance || '(per CONTEXT.md)'}
Follow fde-workflow: generate code + tests, run tests. Commit only if explicitly authorized, selecting reviewed task files.
Update .agents/job.state.json development.features.${id} and append to .agents/job.progress.md.
Return structured result.`),
      { schema: PHASE_RESULT, label: `workflow-${id}`, phase: 'Develop' }
    )

    if (!accepted(res) && res?.summary?.trim() && ms.rebuild_count < MAX_RETRY) {
      ms.rebuild_count++
      log(`Phase 4: milestone ${id} incomplete — one targeted recovery within the original scope`)
      res = await agent(
        ctx('fde-workflow', `=== RETRY MILESTONE ${id}: ${m.name} ===
Diagnose the failure; fix supported causes within the FULL original scope. If blocked by a decision/prerequisite, return BLOCKED with next action. Do not shrink acceptance or blindly repeat.
Previous result: ${JSON.stringify(res)}
Description: ${m.description}
Acceptance: ${m.acceptance || '(per CONTEXT.md)'}
Update .agents/job.state.json and job.progress.md. Return structured result.`),
        { schema: PHASE_RESULT, label: `workflow-${id}-retry`, phase: 'Develop' }
      )
    }

    if (!accepted(res)) {
      ms.status = 'BLOCKED'
      ms.summary = res?.summary || 'Implementation evidence missing'
      cascadeSkip(id)
    } else {
      const inspectPrompt = ctx('fde-inspector', `=== VERIFY MILESTONE ${id}: ${m.name} ===
Read CONTEXT.md and inspect the CURRENT code and test evidence for the FULL milestone scope.
Description: ${m.description}
Acceptance: ${m.acceptance || '(per CONTEXT.md)'}
Check architecture drift, correctness and required acceptance evidence. Return DONE only if all required checks pass. DONE_WITH_CONCERNS requires required_complete:true and only nonblocking concerns; otherwise BLOCKED. Missing evidence is incomplete.`)
      let insp = await agent(inspectPrompt, { schema: PHASE_RESULT, label: `inspector-${id}`, phase: 'Develop' })
      if (!accepted(insp) && insp?.summary?.trim() && ms.rebuild_count < MAX_RETRY) {
        ms.rebuild_count++
        const fix = await agent(ctx('fde-workflow', `=== FIX MILESTONE ${id} per inspector ===
Re-read CONTEXT.md and fix the diagnosed issues in milestone ${id} "${m.name}" within the original scope.
Description: ${m.description}
Acceptance: ${m.acceptance || '(per CONTEXT.md)'}
Inspector evidence: ${JSON.stringify(insp)}
Return the actual repair outcome. Do not declare acceptance; a fresh inspector must verify it.`),
          { schema: PHASE_RESULT, label: `workflow-${id}-fix`, phase: 'Develop' })
        // Even a partial repair needs review; a missing/blocked repair cannot establish completion.
        const recheck = await agent(inspectPrompt + `\nRepair result: ${JSON.stringify(fix)}`, { schema: PHASE_RESULT, label: `inspector-${id}-recheck`, phase: 'Develop' })
        insp = accepted(fix) ? recheck : fix
      }
      ms.status = accepted(insp) ? 'DONE' : 'BLOCKED'
      ms.summary = insp?.summary || 'Review evidence missing'
      if (ms.status !== 'DONE') cascadeSkip(id)
      log(`Phase 4: milestone ${id} ${ms.status}`)
    }
  }

  developmentSummary = milestones.map((m) => `${m.id}:${milestoneState[m.id].status}`).join(', ')
  developmentMilestoneState = milestoneState
  recordPhase('development', { status: order.length > 0 && order.every(id => milestoneState[id].status === 'DONE') ? 'DONE' : 'BLOCKED', summary: developmentSummary || 'Milestone plan unavailable' })
}

// ═══════════════════════════════════════════════════════════
//  Phase 4.5 — Run Gate: hard "does it build & test" gate (Component 4)
//  Agent-driven (Workflow 沙箱禁止直接 Bash)。失败强制修复循环；
//  修不动标 DOES_NOT_RUN，report 头条如实反映。

phase('Run Gate')
if (isDone('development') && !isDone('run_gate') && !stop_at_poc) {
  log('Phase 4.5: run gate — build + test must pass')

  const MAX_FIX = MODE === 'normal' ? 2 : 1
  let gate = null
  let attempts = 0

  while (attempts <= MAX_FIX) {
    attempts++
    gate = await agent(
      ctx('run-gate', `=== RUN GATE: BUILD + TEST ===
Read "project-metadata.json" for language/framework.
Determine build & test commands:
  1. Prefer project-native config: Makefile, package.json "scripts", pyproject.toml, Cargo.toml, go.mod.
  2. Fallback map (if none found):
     python/fastapi/flask -> build: "pip install -e .",   test: "pytest -q"
     node/typescript      -> build: "npm run build --if-present", test: "npm test --if-present"
     rust                 -> build: "cargo build",         test: "cargo test"
     go                   -> build: "go build ./...",       test: "go test ./..."
Run the applicable required commands via Bash. Capture full output. An absent script or --if-present no-op is not verification. If a step is legitimately inapplicable, explain the alternative evidence; missing required evidence must not return true.
Return build_ok, test_ok, the commands used, and combined output (last ~2000 chars).
=== COVERAGE GATE (fde-qa ②③) ===
Use fde-qa to select risk-relevant checks and the project's explicit coverage policy.
Measure branch coverage only where supported and required; never substitute line coverage silently.
Use the confirmed change range, including relevant new files. Whole-file coverage is not diff coverage.
Do not impose a universal percentage, fixed test count or a new ratchet policy.
Reuse a comparable existing baseline only if project policy requires it.
Return coverage_ok=true only when the applicable policy is satisfied, or when no numerical policy
applies and the selected risk-relevant checks have passed. Explain that in coverage_reason.
If required evidence is missing or a policy fails, return coverage_ok=false with the reason.
Do not invent numerical coverage for an unavailable metric.
Verification only; do not modify code during this check.`),
      { schema: RUN_GATE_SCHEMA, label: 'run-gate', phase: 'Run Gate' }
    )

    if (gate && gate.build_ok === true && gate.test_ok === true && (gate.coverage_ok === true)) break
    if (attempts > MAX_FIX || !gate) break
    log(`Phase 4.5: run gate failed (attempt ${attempts}) — fix attempt ${attempts}`)
    const fix = await agent(
      ctx('run-gate-fix', `=== FIX BUILD/TEST FAILURES ===
The run gate did not pass. Diagnose whether this is a product defect, missing evidence, test defect or environment failure. Fix only supported causes within the authorized scope; preserve existing work and requirements.
Last failure output:
${(gate && gate.output) || '(no output)'}
Coverage policy: ${(gate && gate.coverage_reason) || '(not reported)'}
Do NOT skip required checks, delete valid tests, hard-reset or shrink requirements to pass. Commit only if already authorized, selecting reviewed task files. Append actual progress and unresolved evidence to .agents/job.progress.md.`),
      { schema: PHASE_RESULT, label: 'run-gate-fix', phase: 'Run Gate' }
    )
    const review = await agent(ctx('fde-inspector', `Review CURRENT run-gate repair changes against the original scope, CONTEXT.md and full milestone acceptance. Verify affected behavior and architecture; missing evidence is BLOCKED. Repair result: ${JSON.stringify(fix)}`),
      { schema: PHASE_RESULT, label: 'inspector-run-gate-fix', phase: 'Run Gate' })
    if (!accepted(fix) || !accepted(review)) {
      phasesDone.delete('development')
      phaseResults.development = { status: 'BLOCKED', summary: 'Run-gate repair lacks passing implementation/review evidence.' }
      break
    }
  }

  const passed = !!(gate && gate.build_ok === true && gate.test_ok === true && (gate.coverage_ok === true))
  runGateResult = {
    status: passed ? 'PASS' : 'DOES_NOT_RUN',
    attempts,
    build_command: (gate && gate.build_command) || '',
    test_command: (gate && gate.test_command) || '',
    last_error: passed ? null : ((gate && gate.output) || (gate && gate.coverage_reason) || 'unknown'),
    coverage_reason: (gate && gate.coverage_reason) || '',
  }
  log(`Phase 4.5: run gate ${passed ? 'PASS' : 'DOES_NOT_RUN'} after ${attempts} attempt(s)`)

  await agent(
    ctx('persist', `Update ".agents/job.state.json": set phases.run_gate = ${JSON.stringify({ status: runGateResult.status, attempts: runGateResult.attempts })}. Do not change any other fields.`),
    { schema: PHASE_RESULT, label: 'persist-run-gate', phase: 'Run Gate' }
  )
  if (passed) phasesDone.add('run_gate')
}

// ═══════════════════════════════════════════════════════════
//  Phase 5 — Integration: required acceptance with bounded repair

phase('Integrate')
if (isDone('development') && isDone('run_gate') && !isDone('finalize') && !stop_at_poc) {
  log('Phase 5: integration testing')

  const integrationPrompt = ctx('integration', `=== RUN INTEGRATION TESTS ===

Read project-metadata.json for project type and testing config.

1. Build/compile check — run the project build command
2. Run ALL tests — run the project test command
3. If server/web app: run production readiness checklist
4. Document ALL failures
5. Required failures or missing evidence must return BLOCKED; list exact failing checks and diagnostics. DONE means every required check passed. DONE_WITH_CONCERNS is only for nonblocking concerns with required_complete:true.

UPDATE job.state.json finalize phase status.
APPEND to job.progress.md.

Return structured results with pass/fail per check, and any issues.

=== E2E ACCEPTANCE (fde-qa ④, load once) ===
Drive key user journeys end-to-end. If the project has a UI, use the agent-browser skill
(start server, script navigate/fill/click/assert, screenshot to .agents/qa-e2e/).
If NO UI (pure API/CLI/library), degrade per fde-qa references/e2e-playbook.md:
API -> HTTP black-box CRUD + error paths; CLI -> subcommand e2e; library -> skip and note.
Record E2E pass/fail and applicability with evidence. Missing required E2E evidence is incomplete. Verification only; do not edit implementation.`)
  let result = await agent(integrationPrompt,
    { schema: PHASE_RESULT, label: 'integration', phase: 'Integrate' }
  )

  if (!accepted(result) && result?.summary?.trim()) {
    const fix = await agent(ctx('integration-fix', `Repair the diagnosed integration failures within the original scope. Do not weaken required checks. Stop with precise blockers if external prerequisites or a scope decision are needed.
Failure evidence: ${JSON.stringify(result)}
Run relevant regression checks and return the actual repair result.`),
      { schema: PHASE_RESULT, label: 'integration-fix', phase: 'Integrate' })
    const recheck = await agent(integrationPrompt + `\nRepair result: ${JSON.stringify(fix)}\nRe-run all affected required checks against the current code, including build/tests and run-gate coverage policy; previous results may be stale.`,
      { schema: PHASE_RESULT, label: 'integration-recheck', phase: 'Integrate' })
    const review = await agent(ctx('fde-inspector', `Review CURRENT integration repair changes against the original scope, CONTEXT.md and full milestone acceptance. Verify affected behavior and architecture; missing evidence is BLOCKED. Repair result: ${JSON.stringify(fix)}`),
      { schema: PHASE_RESULT, label: 'inspector-integration-fix', phase: 'Integrate' })
    result = !accepted(fix) ? fix : (!accepted(review) ? review : recheck)
    if (!accepted(fix) || !accepted(review)) {
      phasesDone.delete('development')
      phaseResults.development = { status: 'BLOCKED', summary: 'Integration repair lacks passing implementation/review evidence.' }
    }
    // Integration repairs change code after the run gate. Its old PASS is no longer authoritative.
    phasesDone.delete('run_gate')
    runGateResult = { status: 'DOES_NOT_RUN', last_error: 'Integration repair requires fresh run-gate evidence.' }
    const gate = await agent(ctx('run-gate', 'Re-run required build, tests and project coverage policy on the CURRENT code after integration repair. Verification only. Missing evidence is false. Return build_ok, test_ok, coverage_ok, coverage_reason and output.'),
      { schema: RUN_GATE_SCHEMA, label: 'run-gate-after-integration', phase: 'Integrate' })
    if (gate?.build_ok === true && gate?.test_ok === true && gate?.coverage_ok === true) {
      phasesDone.add('run_gate')
      runGateResult = { status: 'PASS', coverage_reason: gate.coverage_reason }
    }
  }
  recordPhase('finalize', result)
}

// ═══════════════════════════════════════════════════════════
//  Phase 6 — Deploy: 部署配置 (non-blocking)

phase('Deploy')
if (isDone('architect') && !isDone('deploy') && !stop_at_poc) {
  log('Phase 6: deployment configuration')

  const result = await agent(
    ctx('deploy', `=== GENERATE DEPLOYMENT CONFIG ===

Read CONTEXT.md "Deployment Plan" section.
Read project-metadata.json for deployment type.

1. Docker — if applicable: generate Dockerfile + .dockerignore
2. docker-compose — if multiple services
3. CI/CD — if applicable: generate .github/workflows/deploy.yml
4. Environment — generate .env.example with all required env vars

If blueprint says "local only": skip generation, report "deploy not needed".

UPDATE job.state.json deploy phase status.
APPEND to job.progress.md.`),
    { schema: PHASE_RESULT, label: 'deploy-config', phase: 'Deploy' }
  )

  recordPhase('deploy', result)
}

// ═══════════════════════════════════════════════════════════
//  Phase 7 — Report: 最终报告

const requiredPhases = ['init', ...(skip_requirements ? [] : ['requirements']), 'architect', ...(skip_frontend ? [] : ['frontend']), ...(runPoc ? ['poc'] : []), ...(!stop_at_poc ? ['development', 'run_gate', 'finalize', 'deploy'] : [])]
const missingPhases = requiredPhases.filter(p => !isDone(p))
if (stop_at_poc && !runPoc) missingPhases.push('poc (stop_at_poc requires an enabled frontend POC)')
const goalStatus = missingPhases.length ? 'INCOMPLETE' : (stop_at_poc ? 'POC_ONLY' : 'DONE')
const stateSnapshot = Object.fromEntries(requiredPhases.map(p => [p, { status: isDone(p) ? (p === 'run_gate' ? 'PASS' : 'DONE') : (p === 'run_gate' ? 'DOES_NOT_RUN' : 'BLOCKED'), ...(p === 'development' && Object.keys(developmentMilestoneState).length ? { features: developmentMilestoneState } : {}), summary: phaseResults[p]?.summary || (isDone(p) ? 'Verified in this run or recovery validation' : 'Required evidence missing') }]))
await agent(ctx('persist', `Persist this authoritative phase snapshot into .agents/job.state.json, merging fields without deleting existing feature history, verification evidence or the delegation-contract reference in checkpoint.session_summary: ${JSON.stringify(stateSnapshot)}. Append the current outcome to checkpoint.session_summary: ${JSON.stringify(`Goal status: ${goalStatus}; incomplete phases: ${missingPhases.join(', ')}`)}. Preserve checkpoint authorization, attempted remedies and delegation references. Set checkpoint.next_action to the first unresolved prerequisite/check and its concrete next step (or requested POC handoff/full completion only when supported). Append actual results to job.progress.md. Do not convert missing/skipped work to DONE.`),
  { schema: PHASE_RESULT, label: 'persist-job-outcome', phase: 'Report' })

phase('Report')
if (!isDone('report')) {
  log('Phase 7: generating final report')

  const result = await agent(
    ctx('report', `=== GENERATE FINAL REPORT ===
AUTHORITATIVE GOAL STATUS: ${goalStatus}. Incomplete phases: ${missingPhases.join(', ') || 'none'}.
Current phase results: ${JSON.stringify(stateSnapshot)}
Workflow execution ending does not mean the user goal is complete. Never claim completion unless GOAL STATUS is DONE. POC_ONLY means only the prototype stage was requested to stop; the full project remains unfinished.
RUN GATE STATUS: ${runGateResult ? runGateResult.status : 'unknown'}.
If status is DOES_NOT_RUN, the FIRST line of your report MUST be exactly:
  ⚠️ DOES_NOT_RUN — required run-gate verification did not pass.
Distinguish confirmed failures from missing evidence; do not assert the whole project is unrunnable without evidence.
Do NOT claim the project is complete in that case.

Development milestone summary: ${developmentSummary || '(not available)'}.

Read .agents/job.state.json for full phase status.
Read project-metadata.json for milestone definitions.
Read .agents/progress.json for feature-level results (if exists).

Generate a comprehensive markdown report covering:
1. OVERALL STATUS — summary per phase
2. MILESTONE TABLE — id, name, status, degraded?, rebuild count, tests
3. FILE CHANGES — total files created/modified
4. TEST RESULTS — total tests, passed, failed
5. DEPLOYMENT — distinguish config generated, artifact published, downstream upgraded, and live version verified. Do not publish unless authorized; use fde-release when available for requested releases.
6. GLOSSARY AUDIT — total terms, any consistency issues
7. KNOWN ISSUES — skipped features, unresolved integration problems
8. DEGRADATION LOG — any milestones that were degraded/skipped
9. NEXT STEPS — recommended follow-up work

Return the report text in the "report" field of the result.`),
    { schema: PHASE_RESULT, label: 'final-report', phase: 'Report' }
  )

  recordPhase('report', result)

  // If report text was returned, show it
  if (result?.report) {
    log('--- FINAL REPORT ---')
    log(result.report)
  }
}

// ═══════════════════════════════════════════════════════════
//  Completion

if (!isDone('report')) missingPhases.push('report')
log(`Verified phases: ${[...phasesDone].join(', ')}`)
log(`Workflow ended. Goal status: ${missingPhases.length ? 'INCOMPLETE' : goalStatus}. Mode: ${MODE}. Incomplete phases: ${missingPhases.join(', ') || 'none'}.`)
