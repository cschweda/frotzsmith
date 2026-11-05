/** A message the Play iframe (public/play/index.html) posts up to the IDE. */
export interface PlayMessage {
  source?: string
  type?: string
  value?: unknown
  name?: unknown
  text?: unknown
}

/**
 * The instruction-source boundary for messages from the Play iframe: accept
 * only one that comes from OUR origin, from the play iframe's own window (not
 * another frame or window of ours), and is tagged by our play page. Returns
 * its data, or null to ignore it. The data is still untrusted — callers treat
 * values as text, never as code.
 */
export function acceptPlayMessage(
  e: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  frame: Window | null | undefined,
  origin: string,
): PlayMessage | null {
  if (e.origin !== origin) return null
  if (!frame || e.source !== frame) return null
  const data = e.data as PlayMessage | null
  if (!data || typeof data !== 'object' || data.source !== 'frotzsmith-play') return null
  return data
}
