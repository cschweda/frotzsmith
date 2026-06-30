import { frotzsmith } from '~~/frotzsmith.config'
import {
  type TestScript,
  upsertScript,
  renameScript,
  deleteScript,
  setScriptText,
  nextActiveId,
} from './test-scripts'

const KEY = frotzsmith.storageKeys.scripts

interface Persisted {
  scripts: TestScript[]
  activeId: string
}

let watching = false

/**
 * Named test scripts for the working project. localStorage is the working store
 * (ADR-010); the `.inf` is canonical, scripts are working state. Single project
 * for now — multi-project namespacing is future work.
 */
export function useTestScripts() {
  const scripts = useState<TestScript[]>('frotz:scripts', () => [])
  const activeId = useState<string>('frotz:script-active', () => '')
  const activeScript = computed(() => scripts.value.find(s => s.id === activeId.value))

  function persist() {
    if (!import.meta.client) return
    try {
      const data: Persisted = { scripts: scripts.value, activeId: activeId.value }
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // QuotaExceededError — keep working in memory
    }
  }

  function restore() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const data = JSON.parse(raw) as Persisted
        if (Array.isArray(data.scripts)) scripts.value = data.scripts
        if (typeof data.activeId === 'string') activeId.value = data.activeId
      }
    } catch {
      // corrupt — ignore, start empty
    }
    if (!activeScript.value && scripts.value.length === 0) seedFirst()
    activeId.value = nextActiveId(scripts.value, activeId.value)
  }

  function seedFirst() {
    const first: TestScript = {
      id: newId(),
      name: 'Script 1',
      text: '! One command per line, or separate with periods.\nlook\n',
    }
    scripts.value = [first]
    activeId.value = first.id
  }

  function add(name?: string) {
    const script: TestScript = { id: newId(), name: name || `Script ${scripts.value.length + 1}`, text: '' }
    scripts.value = upsertScript(scripts.value, script)
    activeId.value = script.id
    persist()
  }

  function rename(id: string, name: string) {
    scripts.value = renameScript(scripts.value, id, name)
    persist()
  }

  function remove(id: string) {
    scripts.value = deleteScript(scripts.value, id)
    activeId.value = nextActiveId(scripts.value, activeId.value)
    persist()
  }

  function updateText(id: string, text: string) {
    scripts.value = setScriptText(scripts.value, id, text)
    persist()
  }

  function select(id: string) {
    activeId.value = id
    persist()
  }

  if (import.meta.client && !watching) {
    watching = true
    watch([scripts, activeId], persist, { deep: true })
  }

  return { scripts, activeId, activeScript, add, rename, remove, updateText, select, restore }
}

function newId(): string {
  return import.meta.client && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s_${Math.random().toString(36).slice(2)}`
}
