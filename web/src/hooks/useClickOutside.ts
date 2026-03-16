import { useEffect, type RefObject } from 'react'

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  active: boolean,
  ignoreSelector: string,
) {
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (ref.current && !ref.current.contains(target) && !target.closest(ignoreSelector)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onClose, active, ignoreSelector])
}
