import type { Router } from 'vitepress'
import { nextTick } from 'vue'

/**
 * Cross-fades from one page to the next when the visitor follows a link, through the View
 * Transitions API. Browsers without it, and visitors who prefer reduced motion, keep the
 * instant switch.
 *
 * The transition only starts once the next page is fetched, so the current one is never held
 * frozen during the download: the browser captures it, Vitepress renders the next page, then
 * the browser fades from one to the other.
 */
export function crossFadeNavigation(router: Router) {
  // The first page is the server-rendered one, already on screen: there is nothing to fade
  let ready = false
  let rendered: (() => void) | undefined

  const settle = () => {
    rendered?.()
    rendered = undefined
  }

  const { onAfterPageLoad } = router
  const onAfterRouteChange = router.onAfterRouteChange ?? router.onAfterRouteChanged

  router.onAfterPageLoad = async (href) => {
    await onAfterPageLoad?.(href)
    if (!ready || !('startViewTransition' in document) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    // A previous navigation still running hands over to this one
    settle()
    await new Promise<void>((captured) => {
      document.startViewTransition(() => {
        captured()
        return new Promise<void>((resolve) => {
          rendered = resolve
          // A page that fails to render must not hold the screen
          setTimeout(resolve, 1000)
        })
      })
    })
  }

  router.onAfterRouteChange = async (href) => {
    await onAfterRouteChange?.(href)
    ready = true
    // Vitepress patches the page, and scrolls it, on the next tick
    await nextTick()
    settle()
  }
}
