/** The cues Send-to-Play gives, whichever player it fed (frotzplay or Parchment). */

export function feedStopped(fed: number, total: number) {
  useToast().add({
    title: `Send to Play stopped after ${fed} of ${total} commands`,
    description:
      'The game stopped asking for line input (it may have quit, crashed, or opened a menu). ' +
      'Press Play to restart it, then send the script again.',
    color: 'warning',
    icon: 'i-lucide-octagon-pause',
  })
}

export function feedFailed(err: unknown) {
  useToast().add({
    title: 'Send to Play failed',
    description: String(err),
    color: 'error',
    icon: 'i-lucide-octagon-x',
  })
}
