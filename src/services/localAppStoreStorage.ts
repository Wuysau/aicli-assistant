import { recentRecordsSeed } from '../mock/recentRecords'
import type {
  LocalAppStore,
  RecentRecord,
  RecentSearchKeyword,
  RecentSearchSource,
  ScenarioId,
  TemplateActivity,
  TemplateFilterState,
  TemplateSortMode,
  UserPreferences,
} from '../types'

const STORAGE_KEY = 'aicli-assistant/local-store/v1'
const LEGACY_RECORDS_KEY = 'aicli-assistant/recent-records/v0.2'
const MAX_RECORDS = 12
const MAX_SEARCH_KEYWORDS = 8

const defaultTemplateLibraryFilter: TemplateFilterState = {
  query: '',
  category: 'all',
  environment: 'all',
}

const defaultPreferences: UserPreferences = {
  preferredShell: 'powershell',
  environment: 'windows-local',
  taskType: 'generate-command',
  selectedTemplateId: 'port-occupancy',
  templateLibraryFilter: defaultTemplateLibraryFilter,
  templateLibrarySortMode: 'default',
}

const canUseStorage = () => typeof window !== 'undefined' && 'localStorage' in window

const cloneSeedRecords = (): RecentRecord[] => recentRecordsSeed.map((record) => ({ ...record }))

const createDefaultStore = (recentRecords = cloneSeedRecords()): LocalAppStore => ({
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  recentRecords,
  templateActivities: [],
  recentSearchKeywords: [],
  preferences: defaultPreferences,
})

const saveStore = (store: LocalAppStore): LocalAppStore => {
  const nextStore: LocalAppStore = {
    ...store,
    updatedAt: new Date().toISOString(),
  }

  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore))
  }

  return nextStore
}

const normalizeTemplateActivities = (
  value: unknown,
): TemplateActivity[] => (Array.isArray(value) ? (value as TemplateActivity[]) : [])

const normalizeRecentRecords = (value: unknown): RecentRecord[] =>
  Array.isArray(value) ? (value as RecentRecord[]) : cloneSeedRecords()

const normalizeRecentSearches = (value: unknown): RecentSearchKeyword[] =>
  Array.isArray(value) ? (value as RecentSearchKeyword[]) : []

const normalizePreferences = (value: unknown): UserPreferences => {
  const candidate = (value ?? {}) as Partial<UserPreferences>

  return {
    preferredShell: candidate.preferredShell ?? defaultPreferences.preferredShell,
    environment: candidate.environment ?? defaultPreferences.environment,
    taskType: candidate.taskType ?? defaultPreferences.taskType,
    selectedTemplateId:
      candidate.selectedTemplateId ?? defaultPreferences.selectedTemplateId,
    templateLibraryFilter: {
      query:
        candidate.templateLibraryFilter?.query ??
        defaultPreferences.templateLibraryFilter.query,
      category:
        candidate.templateLibraryFilter?.category ??
        defaultPreferences.templateLibraryFilter.category,
      environment:
        candidate.templateLibraryFilter?.environment ??
        defaultPreferences.templateLibraryFilter.environment,
    },
    templateLibrarySortMode:
      candidate.templateLibrarySortMode ?? defaultPreferences.templateLibrarySortMode,
  }
}

const migrateLegacyRecentRecords = (): RecentRecord[] | undefined => {
  if (!canUseStorage()) {
    return undefined
  }

  const legacyRaw = window.localStorage.getItem(LEGACY_RECORDS_KEY)

  if (!legacyRaw) {
    return undefined
  }

  try {
    const parsed = JSON.parse(legacyRaw)
    return Array.isArray(parsed) && parsed.length > 0
      ? (parsed as RecentRecord[])
      : undefined
  } catch {
    return undefined
  }
}

export const loadLocalAppStore = (): LocalAppStore => {
  if (!canUseStorage()) {
    return createDefaultStore()
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    const migratedRecords = migrateLegacyRecentRecords()
    return saveStore(createDefaultStore(migratedRecords ?? cloneSeedRecords()))
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalAppStore>

    if (parsed.schemaVersion !== 1) {
      const migratedRecords = migrateLegacyRecentRecords()
      return saveStore(createDefaultStore(migratedRecords ?? cloneSeedRecords()))
    }

    return saveStore({
      schemaVersion: 1,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      recentRecords: normalizeRecentRecords(parsed.recentRecords),
      templateActivities: normalizeTemplateActivities(parsed.templateActivities),
      recentSearchKeywords: normalizeRecentSearches(parsed.recentSearchKeywords),
      preferences: normalizePreferences(parsed.preferences),
    })
  } catch {
    const migratedRecords = migrateLegacyRecentRecords()
    return saveStore(createDefaultStore(migratedRecords ?? cloneSeedRecords()))
  }
}

export const updateUserPreferences = (
  store: LocalAppStore,
  partial: Partial<UserPreferences>,
): LocalAppStore =>
  saveStore({
    ...store,
    preferences: {
      ...store.preferences,
      ...partial,
      templateLibraryFilter: partial.templateLibraryFilter
        ? {
            ...store.preferences.templateLibraryFilter,
            ...partial.templateLibraryFilter,
          }
        : store.preferences.templateLibraryFilter,
    },
  })

export const persistRecentRecord = (
  store: LocalAppStore,
  record: RecentRecord,
): LocalAppStore =>
  saveStore({
    ...store,
    recentRecords: [record, ...store.recentRecords.filter((item) => item.id !== record.id)].slice(
      0,
      MAX_RECORDS,
    ),
  })

export const removeRecentRecord = (
  store: LocalAppStore,
  recordId: string,
): LocalAppStore =>
  saveStore({
    ...store,
    recentRecords: store.recentRecords.filter((record) => record.id !== recordId),
  })

export const recordTemplateActivity = (
  store: LocalAppStore,
  scenarioId: ScenarioId,
  action: 'matched' | 'used',
): LocalAppStore => {
  const now = new Date().toISOString()
  const activityMap = new Map(
    store.templateActivities.map((item) => [item.scenarioId, item] as const),
  )
  const current = activityMap.get(scenarioId) ?? {
    scenarioId,
    usageCount: 0,
    matchCount: 0,
  }

  const nextActivity: TemplateActivity =
    action === 'used'
      ? {
          ...current,
          usageCount: current.usageCount + 1,
          matchCount: current.matchCount + 1,
          lastUsedAt: now,
          lastMatchedAt: now,
        }
      : {
          ...current,
          matchCount: current.matchCount + 1,
          lastMatchedAt: now,
        }

  activityMap.set(scenarioId, nextActivity)

  return saveStore({
    ...store,
    templateActivities: Array.from(activityMap.values()),
  })
}

export const recordRecentSearch = (
  store: LocalAppStore,
  query: string,
  source: RecentSearchSource,
): LocalAppStore => {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return store
  }

  const nextEntry: RecentSearchKeyword = {
    id: `search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query: normalizedQuery,
    source,
    createdAt: new Date().toISOString(),
  }

  return saveStore({
    ...store,
    recentSearchKeywords: [
      nextEntry,
      ...store.recentSearchKeywords.filter(
        (item) => !(item.query === normalizedQuery && item.source === source),
      ),
    ].slice(0, MAX_SEARCH_KEYWORDS),
  })
}

export const getRecentTemplateIds = (
  store: LocalAppStore,
  limit = 4,
): ScenarioId[] =>
  [...store.templateActivities]
    .sort((left, right) =>
      (right.lastUsedAt ?? right.lastMatchedAt ?? '').localeCompare(
        left.lastUsedAt ?? left.lastMatchedAt ?? '',
      ),
    )
    .slice(0, limit)
    .map((item) => item.scenarioId)

export const getFrequentTemplateIds = (
  store: LocalAppStore,
  limit = 4,
): ScenarioId[] =>
  [...store.templateActivities]
    .sort((left, right) => {
      if (right.usageCount !== left.usageCount) {
        return right.usageCount - left.usageCount
      }

      return (right.lastUsedAt ?? '').localeCompare(left.lastUsedAt ?? '')
    })
    .slice(0, limit)
    .map((item) => item.scenarioId)

export const sortTemplatesByMode = <T extends { id: ScenarioId }>(
  templates: T[],
  activities: TemplateActivity[],
  mode: TemplateSortMode,
): T[] => {
  if (mode === 'default') {
    return templates
  }

  const activityMap = new Map(activities.map((item) => [item.scenarioId, item] as const))

  return [...templates].sort((left, right) => {
    const leftActivity = activityMap.get(left.id)
    const rightActivity = activityMap.get(right.id)

    if (mode === 'recent') {
      const leftTime = leftActivity?.lastUsedAt ?? leftActivity?.lastMatchedAt ?? ''
      const rightTime = rightActivity?.lastUsedAt ?? rightActivity?.lastMatchedAt ?? ''
      return rightTime.localeCompare(leftTime)
    }

    const leftScore = (leftActivity?.usageCount ?? 0) * 10 + (leftActivity?.matchCount ?? 0)
    const rightScore = (rightActivity?.usageCount ?? 0) * 10 + (rightActivity?.matchCount ?? 0)

    return rightScore - leftScore
  })
}
