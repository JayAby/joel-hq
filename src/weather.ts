export interface WeatherData {
  tempC: number
  label: string
  icon: string
  locationName: string
}

const WEATHER_CODE_META: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mostly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫️' },
  48: { label: 'Fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Heavy drizzle', icon: '🌧️' },
  61: { label: 'Light rain', icon: '🌧️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  71: { label: 'Light snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '🌨️' },
  75: { label: 'Heavy snow', icon: '❄️' },
  80: { label: 'Rain showers', icon: '🌦️' },
  81: { label: 'Rain showers', icon: '🌧️' },
  82: { label: 'Violent showers', icon: '⛈️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm', icon: '⛈️' },
  99: { label: 'Thunderstorm', icon: '⛈️' },
}

function metaFor(code: number) {
  return WEATHER_CODE_META[code] ?? { label: 'Weather', icon: '🌡️' }
}

async function fetchByCoords(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`,
    )
    const data = await weatherRes.json()
    const code = data?.current?.weather_code
    const temp = data?.current?.temperature_2m
    if (typeof temp !== 'number') return null
    const meta = metaFor(code)
    return { tempC: Math.round(temp), label: meta.label, icon: meta.icon, locationName: 'Your location' }
  } catch {
    return null
  }
}

export async function fetchWeather(fallbackCity = 'London'): Promise<WeatherData | null> {
  const coords = await new Promise<GeolocationPosition | null>((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { timeout: 5000, maximumAge: 10 * 60 * 1000 },
    )
  })

  if (coords) {
    const result = await fetchByCoords(coords.coords.latitude, coords.coords.longitude)
    if (result) return result
  }

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(fallbackCity)}&count=1`,
    )
    const geoData = await geoRes.json()
    const place = geoData?.results?.[0]
    if (!place) return null
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code`,
    )
    const data = await weatherRes.json()
    const code = data?.current?.weather_code
    const temp = data?.current?.temperature_2m
    if (typeof temp !== 'number') return null
    const meta = metaFor(code)
    return { tempC: Math.round(temp), label: meta.label, icon: meta.icon, locationName: place.name }
  } catch {
    return null
  }
}