/**
 * Public marketplace registry: fetch, validate, cache.
 *
 * The panel never trusts the registry body. Before a byte reaches the client,
 * every entry is checked for a namespaced id, a semver version, a pinned
 * sha256 and an http(s) URL with no fragment of its own (the installer adds
 * `#sha256=` itself). A failed fetch degrades to the last good catalog with
 * `stale: true`; it never turns the panel into a 500.
 *
 * The registry URL is configurable so the same code can serve a private
 * registry later: set `DSH_WORKSTYLE_MARKET_URL` or pass `url` to `readMarket`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { workstyleHome, writeJsonAtomic } from './pack.js'

export const MARKET_SCHEMA = 'dsh-workstyle/market@1'
export const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/iannil/dsh-workstyle/master/market/registry.json'
export const CACHE_TTL_MS = 10 * 60 * 1000

const ID_RE = /^[a-z0-9][a-z0-9-]{0,48}$/
const SHA_RE = /^[0-9a-f]{64}$/i
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const MAX_PACKS = 500
const MAX_REGISTRY_BYTES = 2 * 1024 * 1024
const MAX_URL_LENGTH = 2048

function parseSemver(value) {
  const [core] = String(value).split('+')
  const [numbers, pre = ''] = core.split('-')
  return { numbers: numbers.split('.').map((part) => Number(part) || 0), pre }
}

/**
 * Compare two semver strings. Returns -1, 0 or 1.
 *
 * Prerelease strings are compared lexically after the numeric triple, which is
 * enough for the marketplace: it only needs a stable "is there a newer
 * version" answer, not full semver range resolution.
 */
export function compareSemver(a, b) {
  const left = parseSemver(a)
  const right = parseSemver(b)
  for (let index = 0; index < 3; index += 1) {
    if (left.numbers[index] !== right.numbers[index]) {
      return left.numbers[index] < right.numbers[index] ? -1 : 1
    }
  }
  if (!left.pre && right.pre) return 1
  if (left.pre && !right.pre) return -1
  if (left.pre === right.pre) return 0
  return left.pre < right.pre ? -1 : 1
}

/** True when `available` is a newer semver than `installed`. */
export function canUpdate(installed, available) {
  if (!installed || !available) return false
  return compareSemver(installed, available) < 0
}

export function marketCachePath() {
  return path.join(workstyleHome(), 'market.json')
}

export function defaultMarketUrl() {
  const override = process.env.DSH_WORKSTYLE_MARKET_URL
  return typeof override === 'string' && override.trim() ? override.trim() : DEFAULT_REGISTRY_URL
}

function invalid(field, message) {
  const error = new Error('market registry: ' + field + ' ' + message)
  error.field = field
  return error
}

function text(value, field, max) {
  if (typeof value !== 'string') throw invalid(field, 'must be a string')
  const trimmed = value.trim()
  if (!trimmed) throw invalid(field, 'is required')
  if (trimmed.length > max) throw invalid(field, 'must be at most ' + max + ' characters')
  return trimmed
}

function count(value, field) {
  if (!Number.isInteger(value) || value < 0 || value > 100000) {
    throw invalid(field, 'must be a non-negative integer')
  }
  return value
}

/** Validate one catalog entry and return only the fields the panel may see. */
export function normalizeEntry(entry, index = 0) {
  const at = 'packs[' + index + ']'
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw invalid(at, 'must be an object')
  }
  const id = text(entry.id, at + '.id', 49)
  if (!ID_RE.test(id)) throw invalid(at + '.id', 'must match ' + ID_RE)
  if (!id.includes('-')) throw invalid(at + '.id', 'must be namespaced, e.g. author-pack')

  const version = text(entry.version, at + '.version', 64)
  if (!SEMVER_RE.test(version)) throw invalid(at + '.version', 'must be a semver version')

  const displayName = text(entry.displayName, at + '.displayName', 80)
  const author = text(entry.author, at + '.author', 80)
  const license = text(entry.license, at + '.license', 64)
  const description = text(entry.description, at + '.description', 500)

  const sha256 = text(entry.sha256, at + '.sha256', 64).toLowerCase()
  if (!SHA_RE.test(sha256)) throw invalid(at + '.sha256', 'must be 64 hex characters')

  const rawUrl = text(entry.url, at + '.url', MAX_URL_LENGTH)
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw invalid(at + '.url', 'must be a URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw invalid(at + '.url', 'must use http or https')
  }
  if (parsed.username || parsed.password) throw invalid(at + '.url', 'must not carry credentials')
  if (parsed.hash) throw invalid(at + '.url', 'must not carry a fragment; the installer pins sha256')

  const categories = Array.isArray(entry.categories)
    ? entry.categories.slice(0, 8).map((category, i) => text(category, at + '.categories[' + i + ']', 32))
    : []

  const pack = {
    id,
    version,
    displayName,
    author,
    license,
    description,
    categories,
    rules: count(entry.rules, at + '.rules'),
    skills: count(entry.skills, at + '.skills'),
    sha256,
    url: parsed.toString(),
  }
  if (entry.minPluginVersion != null) {
    const minPluginVersion = text(entry.minPluginVersion, at + '.minPluginVersion', 64)
    if (!SEMVER_RE.test(minPluginVersion)) {
      throw invalid(at + '.minPluginVersion', 'must be a semver version')
    }
    pack.minPluginVersion = minPluginVersion
  }
  return pack
}

/** Validate the whole registry document. Throws on the first bad entry. */
export function normalizeRegistry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid('root', 'must be an object')
  if (raw.schema !== MARKET_SCHEMA) throw invalid('schema', 'must be "' + MARKET_SCHEMA + '"')
  if (!Array.isArray(raw.packs)) throw invalid('packs', 'must be an array')
  if (raw.packs.length > MAX_PACKS) throw invalid('packs', 'must contain at most ' + MAX_PACKS + ' entries')
  const seen = new Set()
  const packs = raw.packs.map((entry, index) => {
    const normalized = normalizeEntry(entry, index)
    if (seen.has(normalized.id)) throw invalid('packs[' + index + '].id', 'duplicates "' + normalized.id + '"')
    seen.add(normalized.id)
    return normalized
  })
  return { schema: MARKET_SCHEMA, packs }
}

/** Read the last good catalog, ignoring a missing or corrupt cache file. */
export function readCache() {
  let raw
  try {
    raw = JSON.parse(fs.readFileSync(marketCachePath(), 'utf8'))
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object' || typeof raw.url !== 'string') return null
  if (!Number.isFinite(raw.fetchedAt)) return null
  try {
    return { url: raw.url, fetchedAt: raw.fetchedAt, catalog: normalizeRegistry(raw.catalog) }
  } catch {
    return null
  }
}

export function writeCache({ url, fetchedAt, catalog }) {
  writeJsonAtomic(marketCachePath(), { version: 1, url, fetchedAt, catalog })
}

/** Fetch and validate a registry document. Throws with a readable message. */
export async function fetchCatalog({ url = defaultMarketUrl(), fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('market registry: fetch is unavailable')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let response
    try {
      response = await fetchImpl(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: { accept: 'application/json' },
      })
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('market registry: fetch timed out')
      throw new Error('market registry: fetch failed: ' + (error && error.message ? error.message : String(error)))
    }
    if (!response.ok) throw new Error('market registry: HTTP ' + response.status)
    const body = await response.text()
    if (Buffer.byteLength(body, 'utf8') > MAX_REGISTRY_BYTES) {
      throw new Error('market registry: larger than ' + MAX_REGISTRY_BYTES + ' bytes')
    }
    let raw
    try {
      raw = JSON.parse(body)
    } catch {
      throw new Error('market registry: not valid JSON')
    }
    return normalizeRegistry(raw)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Return a validated catalog plus where it came from.
 *
 * `source` is `network`, `cache` (fresh cache, no fetch) or `none`; `stale`
 * marks a cached catalog served after a failed fetch. This function never
 * throws: a broken registry is reported in `error` and the panel keeps
 * working with the cached catalog (or an empty one).
 */
export async function readMarket(options = {}) {
  const url = typeof options.url === 'string' && options.url.trim() ? options.url.trim() : defaultMarketUrl()
  const now = Number.isFinite(options.now) ? options.now : Date.now()
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const cached = readCache()
  const usable = cached && cached.url === url ? cached : null

  if (!options.force && usable && now - usable.fetchedAt >= 0 && now - usable.fetchedAt <= CACHE_TTL_MS) {
    return { catalog: usable.catalog, source: 'cache', stale: false, fetchedAt: usable.fetchedAt, url }
  }

  try {
    const catalog = await fetchCatalog({ url, fetchImpl, timeoutMs: options.timeoutMs })
    const fetchedAt = now
    writeCache({ url, fetchedAt, catalog })
    return { catalog, source: 'network', stale: false, fetchedAt, url }
  } catch (error) {
    const message = error && error.message ? error.message : String(error)
    if (usable) {
      return { catalog: usable.catalog, source: 'cache', stale: true, fetchedAt: usable.fetchedAt, url, error: message }
    }
    return {
      catalog: { schema: MARKET_SCHEMA, packs: [] },
      source: 'none',
      stale: true,
      fetchedAt: null,
      url,
      error: message,
    }
  }
}
