/**
 * Zero-backend source sharing via the URL FRAGMENT.
 *
 * `frotzsmith.com/#src=<deflate+base64url>&lang=i6` — the fragment is never
 * sent to any server (there is none to send it to): the receiving page
 * decodes it client-side and offers the source to the editor. Deflate via
 * fflate (already a dependency for zip extensions).
 *
 * Pure codec — consumed by useShareLink. Decode NEVER throws: share links
 * arrive from the outside world, so garbage must come back as null, not as
 * an exception during page boot.
 */
import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate'

export type ShareLang = 'i6' | 'zil'

/** Cap on the encoded fragment. Well under practical URL limits; a typical
 *  single-file game deflates to a small fraction of this. Beyond it, the
 *  caller tells the author to Save As / export instead. */
export const SHARE_FRAGMENT_MAX_CHARS = 32_000

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** Encode source into a fragment (`src=…&lang=…`), or null when it would
 *  exceed SHARE_FRAGMENT_MAX_CHARS. */
export function encodeShareFragment(source: string, lang: ShareLang): string | null {
  const packed = toBase64Url(deflateSync(strToU8(source), { level: 9 }))
  const frag = `src=${packed}&lang=${lang}`
  return frag.length > SHARE_FRAGMENT_MAX_CHARS ? null : frag
}

/** Decode a fragment (with or without the leading '#'). Null on anything
 *  malformed — wrong params, bad base64, corrupt deflate, unknown lang. */
export function decodeShareFragment(hash: string): { source: string; lang: ShareLang } | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const src = params.get('src')
  const lang = params.get('lang')
  if (!src || (lang !== 'i6' && lang !== 'zil')) return null
  const bytes = fromBase64Url(src)
  if (!bytes) return null
  try {
    return { source: strFromU8(inflateSync(bytes)), lang }
  } catch {
    return null
  }
}
