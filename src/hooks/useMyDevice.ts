import { useCallback, useEffect, useState } from 'react'
import { DeviceDoc } from '../types'
import { HEARTBEAT_INTERVAL_MS } from '../devicePresence'

const LS_KEY = 'joelhq-my-device-id'

interface BatteryManager {
  level: number
  addEventListener: (type: string, cb: () => void) => void
  removeEventListener: (type: string, cb: () => void) => void
}
type NavigatorWithBattery = Navigator & { getBattery?: () => Promise<BatteryManager> }

export function useMyDevice(
  devices: DeviceDoc[],
  updateDevice: (id: string, patch: Partial<DeviceDoc>) => Promise<void>,
) {
  const [myDeviceId, setMyDeviceId] = useState<string | null>(() => localStorage.getItem(LS_KEY))

  const bind = useCallback((id: string) => {
    localStorage.setItem(LS_KEY, id)
    setMyDeviceId(id)
  }, [])

  const unbind = useCallback(() => {
    localStorage.removeItem(LS_KEY)
    setMyDeviceId(null)
  }, [])

  useEffect(() => {
    if (!myDeviceId) return
    const deviceId = myDeviceId
    let cancelled = false

    async function beat() {
      const patch: Partial<DeviceDoc> = { lastSeen: Date.now() }

      const nav = navigator as NavigatorWithBattery
      if (nav.getBattery) {
        try {
          const battery = await nav.getBattery()
          if (!cancelled) patch.battery = Math.round(battery.level * 100)
        } catch {
          /* Battery API not actually available here — leave battery untouched. */
        }
      }

      if (!cancelled) updateDevice(deviceId, patch)
    }

    beat()
    const intervalId = setInterval(beat, HEARTBEAT_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [myDeviceId, updateDevice])

  const myDevice = devices.find((d) => d.id === myDeviceId) ?? null
  return { myDeviceId, myDevice, bind, unbind }
}