import { useCallback, useRef, useState } from 'react'

export function useResizable(defaultWidth: number, minWidth = 200) {
  const [width, setWidth] = useState(defaultWidth)
  const dragging = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = true
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    const maxWidth = window.innerWidth * 0.8
    const newWidth = window.innerWidth - e.clientX
    setWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)))
  }, [minWidth])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  return { width, onPointerDown, onPointerMove, onPointerUp }
}
