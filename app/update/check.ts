import { type Ref, ref } from 'vue'
import { UPDATE_READY } from './flow'

// Check for updates: a check the author asks for, now. It asks the service worker's registration
// to look for a new version (`registration.update()`, the worker's own request for `/sw.js`, and
// nothing else). What it finds goes to the update offer the app already has, which never reloads
// by itself. (Desktop updater checks come back in milestone 3.)

/** The part of a `ServiceWorkerRegistration` the check uses. */
export interface RegistrationLike {
  update(): Promise<unknown>
  readonly waiting: unknown
  readonly installing: (EventTarget & { readonly state: string }) | null
}

export interface CheckDeps {
  /** `navigator.serviceWorker`, or null where there is none. */
  serviceWorker?: { getRegistration(): Promise<RegistrationLike | undefined> } | null
  /** Whether the app is holding an offer already (a new version is waiting). */
  offered(): boolean
  /** How long a new worker the check found may take to install before the check gives up. */
  installMs?: number
}

/**
 * `fetching`: a new version was found and is downloading, so the check says so while it waits.
 * `ready`: a new version is waiting. `unavailable`: this copy can't check (no service worker).
 */
export type CheckStatus =
  | 'idle'
  | 'checking'
  | 'fetching'
  | 'latest'
  | 'ready'
  | 'unavailable'
  | 'error'

export interface CheckState {
  status: CheckStatus
}

/** How long a found update may take to install: it is the app's own files. */
export const INSTALL_MS = 60_000

/** Resolves with the worker's state once it has installed, failed (`redundant`), or `timeout`. */
function settled(
  worker: EventTarget & { readonly state: string },
  ms: number,
): Promise<'installed' | 'redundant' | 'timeout'> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const look = () => {
      if (
        worker.state === 'installed' ||
        worker.state === 'activating' ||
        worker.state === 'activated'
      ) {
        done('installed')
      } else if (worker.state === 'redundant') done('redundant')
    }
    const done = (result: 'installed' | 'redundant' | 'timeout') => {
      clearTimeout(timer)
      worker.removeEventListener('statechange', look)
      resolve(result)
    }
    worker.addEventListener('statechange', look)
    timer = setTimeout(() => done('timeout'), ms)
    look()
  })
}

/** How long a reload waits for the server's newest worker before it takes the one waiting. */
export const NEWEST_MS = 5000

/**
 * Before Reload lets a new version take over: asks the server for its worker, and waits for a
 * newer one it finds to install, so the version taken is the newest. Each deploy's worker
 * differs, so the one that was waiting when the offer appeared may be out of date already;
 * reloading into it would only have the reloaded page find the newer one and offer it again, as
 * if Reload did nothing. Waits `ms` at most, in all (finding the registration too), and never
 * rejects: offline, or slow, the waiting version is taken.
 */
export async function fetchNewest(
  getRegistration: () => Promise<RegistrationLike | undefined>,
  ms = NEWEST_MS,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms)
  })
  const look = async () => {
    try {
      const registration = await getRegistration()
      if (!registration) return
      await registration.update()
      const installing = registration.installing
      if (installing) await settled(installing, ms)
    } catch {
      // Offline, or the server didn't answer: the waiting version it is.
    }
  }
  try {
    await Promise.race([look(), deadline])
  } finally {
    clearTimeout(timer)
  }
}

/** How often a long-lived tab asks the server for a new version: hourly. */
export const POLL_MS = 60 * 60 * 1000

/**
 * Asks for a new version every `ms`, so a tab left open for days still learns of a deploy (and of
 * the FROTZSMITH_SW_KILL worker, docs/06-security.md §9.1). A new worker it finds installs and
 * waits, and the page's registration raises the offer (`needRefresh`); this never reloads and
 * never applies anything. A failed check (offline, the server down) is skipped quietly until the
 * next one. Returns a function that stops it.
 */
export function startUpdatePolling(
  getRegistration: () => Promise<Pick<RegistrationLike, 'update'> | undefined>,
  {
    ms = POLL_MS,
    every = (fn: () => void, delay: number) => setInterval(fn, delay),
    stop = (id: ReturnType<typeof setInterval>) => clearInterval(id),
  }: {
    ms?: number
    every?: (fn: () => void, delay: number) => ReturnType<typeof setInterval>
    stop?: (id: ReturnType<typeof setInterval>) => void
  } = {},
): () => void {
  const id = every(() => {
    void (async () => {
      try {
        await (await getRegistration())?.update()
      } catch {
        // Offline, or the server didn't answer: the next poll tries again.
      }
    })()
  }, ms)
  return () => stop(id)
}

async function check(deps: CheckDeps, report: (state: CheckState) => void): Promise<CheckState> {
  if (deps.offered()) return { status: 'ready' }
  if (!deps.serviceWorker) return { status: 'unavailable' }
  let registration: RegistrationLike | undefined
  try {
    registration = await deps.serviceWorker.getRegistration()
  } catch {
    registration = undefined
  }
  if (!registration) return { status: 'unavailable' }
  try {
    await registration.update()
  } catch {
    // Offline, or the server didn't answer.
    return { status: 'error' }
  }
  if (registration.waiting) return { status: 'ready' }
  const installing = registration.installing
  if (installing) {
    report({ status: 'fetching' })
    const result = await settled(installing, deps.installMs ?? INSTALL_MS)
    if (result === 'installed') return { status: 'ready' }
    if (result === 'timeout') return { status: 'error' }
  }
  return { status: 'latest' }
}

/** A check and what it has said. A run while one is under way is that one. */
export function createUpdateCheck(deps: CheckDeps): {
  state: Ref<CheckState>
  run(): Promise<CheckState>
} {
  const state = ref<CheckState>({ status: 'idle' })
  let running: Promise<CheckState> | null = null
  function run(): Promise<CheckState> {
    if (running) return running
    state.value = { status: 'checking' }
    running = check(deps, (now) => {
      state.value = now
    }).then((result) => {
      state.value = result
      running = null
      return result
    })
    return running
  }
  return { state, run }
}

/** What the check says. */
export function checkMessage(state: CheckState, version: string): string {
  switch (state.status) {
    case 'idle':
      return ''
    case 'checking':
      return 'Checking for updates…'
    case 'fetching':
      return 'Getting the newest version…'
    case 'latest':
      return `Frotzsmith ${version} is the newest version.`
    case 'ready':
      return UPDATE_READY
    case 'unavailable':
      return 'This copy can’t check for updates.'
    case 'error':
      return 'Couldn’t check for updates — are you offline?'
  }
}
