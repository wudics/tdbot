import { useEffect, useRef, type RefObject } from 'react'

export function useAutoScroll(
  ref: RefObject<HTMLElement | null>,
  deps: any[],
  threshold = 300
) {
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (rafRef.current !== null) return

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
        el.scrollTop = el.scrollHeight
      }
    })

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, deps)
}
