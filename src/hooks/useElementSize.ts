import { useEffect, useRef, useState } from 'react'

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const fit = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    fit()
    return () => observer.disconnect()
  }, [])
  return { ref, size }
}
