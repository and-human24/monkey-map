import { useEffect, useRef } from 'react'
import type { MindMapData } from '../types'
import { onFileChanged } from './useTauri'

export function useFileWatcher(onUpdate: (data: MindMapData) => void) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    let unlisten: (() => void) | undefined

    onFileChanged((data) => {
      onUpdateRef.current(data)
    }).then((fn) => {
      unlisten = fn
    }).catch((e) => { console.error('File watcher setup failed', e) })

    return () => {
      if (unlisten) unlisten()
    }
  }, [])
}
