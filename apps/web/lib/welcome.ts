const dismissalKey = 'ade.welcome.dismissed'

type WelcomeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Reads the welcome preference safely when browser storage is unavailable. */
export function shouldShowWelcome(storage: () => WelcomeStorage): boolean {
  try {
    return storage().getItem(dismissalKey) !== '1'
  } catch {
    return true
  }
}

/** Persists an opt-out only when the visitor disables future welcome popups. */
export function dismissWelcome(
  storage: () => WelcomeStorage,
  showAgain: boolean
): void {
  try {
    if (showAgain) storage().removeItem(dismissalKey)
    else storage().setItem(dismissalKey, '1')
  } catch {
    // Storage can be blocked; dismissal still applies for this page load.
  }
}
