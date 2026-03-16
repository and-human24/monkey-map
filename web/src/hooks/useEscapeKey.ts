import { useEffect } from 'react'

export function useEscapeKey(onEscape: () => void, onFallback?: () => void, isEditing?: boolean) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing && onFallback) { onFallback(); return }
        onEscape()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onEscape, onFallback, isEditing])
}
