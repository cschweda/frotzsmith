/**
 * Shared type-aware Worker mock for worker-client tests (useZilfWasm,
 * useI6Wasm). Listeners are registered per event type — like the real
 * Worker — so an `error` listener never sees `message` events.
 */
import { vi } from 'vitest'

/** What a mock Worker does in response to a posted compile request. */
export type WorkerBehavior =
  | 'reply-error' // posts back a structured { error } message (boot failed in-worker)
  | 'reply-result' // posts back { result: opts.result } (successful compile payload)
  | 'error-event' // fires an `error` event (worker script failed to load/parse)
  | 'messageerror-event' // fires a `messageerror` event (deserialization failure)
  | 'silent' // never responds at all (stalled download / hung boot)

export interface MockWorkerInstance {
  posted: unknown[]
  terminate: ReturnType<typeof vi.fn>
  addEventListener: (type: string, fn: (e: { data?: unknown; message?: string }) => void) => void
  removeEventListener: (type: string, fn: (e: { data?: unknown; message?: string }) => void) => void
  postMessage: (msg: { requestId?: number }) => void
}

export function makeWorkerSpy(behavior: WorkerBehavior, opts: { result?: unknown } = {}) {
  type Listener = (e: { data?: unknown; message?: string }) => void
  const instances: MockWorkerInstance[] = []
  const spy = vi.fn().mockImplementation(() => {
    const listeners = new Map<string, Set<Listener>>()
    const of = (type: string) => [...(listeners.get(type) ?? [])]
    const inst: MockWorkerInstance = {
      posted: [],
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type)!.add(fn)
      },
      removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
      terminate: vi.fn(),
      postMessage(msg: { requestId?: number }) {
        inst.posted.push(msg)
        queueMicrotask(() => {
          if (behavior === 'reply-error') {
            for (const fn of of('message')) fn({ data: { error: 'boot failed (test env)', requestId: msg.requestId } })
          } else if (behavior === 'reply-result') {
            for (const fn of of('message')) fn({ data: { result: opts.result, requestId: msg.requestId } })
          } else if (behavior === 'error-event') {
            for (const fn of of('error')) fn({ message: 'worker script failed (test env)' })
          } else if (behavior === 'messageerror-event') {
            for (const fn of of('messageerror')) fn({ data: null })
          }
          // 'silent' — no response.
        })
      },
    }
    instances.push(inst)
    return inst
  })
  return { spy, instances }
}
