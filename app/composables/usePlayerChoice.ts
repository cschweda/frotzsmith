import { safeGetItem, safeSetItem } from '@frotzinc/nuxt-base/utils/safe-storage'

/**
 * Which player the Play tab uses: frotzplay (the default) or Parchment, kept
 * while frotzplay settles in (frotzlens docs/16 §4). Remembered per browser.
 */
export type PlayerChoice = 'frotzplay' | 'parchment'

export const PLAYER_KEY = 'frotzsmith:player'

export function readPlayerChoice(raw: string | null): PlayerChoice {
  return raw === 'parchment' ? 'parchment' : 'frotzplay'
}

export function usePlayerChoice() {
  const player = useState<PlayerChoice>('frotz:player', () => readPlayerChoice(safeGetItem(PLAYER_KEY)))
  function setPlayer(p: PlayerChoice) {
    player.value = p
    safeSetItem(PLAYER_KEY, p)
  }
  return { player, setPlayer }
}
