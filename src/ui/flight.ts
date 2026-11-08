import { useEffect, useRef, useState } from 'react'
import type { Projectile } from '../combat/state'
import { RULES } from '../combat/collision'
import type { Settings } from './shared'
export function useFlight(
  flight: Projectile | null,
  settings: Settings,
  resolve: () => void,
) {
  const [u, setU] = useState(0),
    done = useRef(resolve)
  done.current = resolve
  const config = useRef(settings)
  config.current = settings
  useEffect(() => {
    setU(0)
    if (!flight) return
    let frame = 0,
      distance = 0,
      previous = 0
    function tick(t: number) {
      if (previous && !document.hidden)
        distance += ((t - previous) / 1000) * RULES.speed * config.current.speed
      previous = t
      if (config.current.reduce || distance >= flight!.hit.u) {
        setU(flight!.hit.u)
        done.current()
        return
      }
      setU(distance)
      frame = requestAnimationFrame(tick)
    }
    function visible() {
      previous = 0
    }
    document.addEventListener('visibilitychange', visible)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [flight])
  return flight ? { ...flight, u: Math.min(flight.hit.u, u) } : null
}
