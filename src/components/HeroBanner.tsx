import { useEffect, useState } from 'react'
import { fetchWeather, WeatherData } from '../weather'

interface Props {
  name: string
  now: Date
}

const BUILDING_HEIGHTS = [40, 70, 55, 90, 65, 100, 50, 80, 60, 110, 45, 75, 95, 55, 85, 65, 40, 70]

function Skyline() {
  const barWidth = 1200 / BUILDING_HEIGHTS.length
  return (
    <svg className="hero-skyline" viewBox="0 0 1200 200" preserveAspectRatio="none">
      {BUILDING_HEIGHTS.map((h, i) => (
        <rect key={i} x={i * barWidth} y={200 - h} width={barWidth - 4} height={h} fill="#0a0d12" opacity={0.55} />
      ))}
    </svg>
  )
}

function greetingFor(now: Date): string {
  const h = now.getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HeroBanner({ name, now }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchWeather().then((w) => {
      if (!cancelled) setWeather(w)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="hero-banner">
      <Skyline />
      <div className="hero-content">
        <div className="hero-greeting">
          {greetingFor(now)}, <span>{name}</span>.
        </div>
        <div className="hero-tagline">Same vision. Just a better version of you.</div>
      </div>
      {weather && (
        <div className="hero-weather">
          <span className="hero-weather-icon">{weather.icon}</span>
          <div>
            <div className="hero-weather-temp">{weather.tempC}°C</div>
            <div className="hero-weather-loc">{weather.locationName}</div>
          </div>
        </div>
      )}
    </div>
  )
}