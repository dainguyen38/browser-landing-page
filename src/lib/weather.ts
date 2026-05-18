import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from 'lucide-react'

export type WeatherCurrent = {
  temperature: number
  apparentTemperature: number
  humidity: number
  windSpeed: number
  weatherCode: number
  isDay: boolean
  high: number
  low: number
  fetchedAt: string
}

export type GeocodeResult = {
  id: number
  name: string
  country?: string
  admin1?: string
  latitude: number
  longitude: number
}

const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search'

export async function fetchCurrentWeather(
  latitude: number,
  longitude: number,
  unit: 'celsius' | 'fahrenheit' = 'celsius',
  windUnit: 'kmh' | 'mph' = 'kmh',
): Promise<WeatherCurrent> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min',
    temperature_unit: unit,
    wind_speed_unit: windUnit,
    timezone: 'auto',
    forecast_days: '1',
  })
  const res = await fetch(`${FORECAST}?${params.toString()}`)
  if (!res.ok) throw new Error(`weather: ${res.status}`)
  const data = await res.json()
  return {
    temperature: data.current.temperature_2m,
    apparentTemperature: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    weatherCode: data.current.weather_code,
    isDay: data.current.is_day === 1,
    high: data.daily.temperature_2m_max?.[0] ?? data.current.temperature_2m,
    low: data.daily.temperature_2m_min?.[0] ?? data.current.temperature_2m,
    fetchedAt: new Date().toISOString(),
  }
}

export async function searchLocation(name: string, language = 'en'): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    name,
    count: '6',
    language,
    format: 'json',
  })
  const res = await fetch(`${GEOCODE}?${params.toString()}`)
  if (!res.ok) throw new Error(`geocode: ${res.status}`)
  const data = await res.json()
  return (data.results ?? []) as GeocodeResult[]
}

type CodeInfo = {
  icon: LucideIcon
  labelEn: string
  labelVi: string
}

const CODES: Record<number, CodeInfo> = {
  0: { icon: Sun, labelEn: 'Clear sky', labelVi: 'Trời quang' },
  1: { icon: Sun, labelEn: 'Mainly clear', labelVi: 'Hầu như quang' },
  2: { icon: CloudSun, labelEn: 'Partly cloudy', labelVi: 'Có mây rải rác' },
  3: { icon: Cloud, labelEn: 'Overcast', labelVi: 'Trời nhiều mây' },
  45: { icon: CloudFog, labelEn: 'Fog', labelVi: 'Sương mù' },
  48: { icon: CloudFog, labelEn: 'Rime fog', labelVi: 'Sương muối' },
  51: { icon: CloudDrizzle, labelEn: 'Light drizzle', labelVi: 'Mưa phùn nhẹ' },
  53: { icon: CloudDrizzle, labelEn: 'Drizzle', labelVi: 'Mưa phùn' },
  55: { icon: CloudDrizzle, labelEn: 'Dense drizzle', labelVi: 'Mưa phùn dày' },
  56: { icon: CloudDrizzle, labelEn: 'Freezing drizzle', labelVi: 'Mưa phùn lạnh' },
  57: { icon: CloudDrizzle, labelEn: 'Freezing drizzle', labelVi: 'Mưa phùn lạnh' },
  61: { icon: CloudRain, labelEn: 'Light rain', labelVi: 'Mưa nhẹ' },
  63: { icon: CloudRain, labelEn: 'Rain', labelVi: 'Mưa' },
  65: { icon: CloudRain, labelEn: 'Heavy rain', labelVi: 'Mưa to' },
  66: { icon: CloudRain, labelEn: 'Freezing rain', labelVi: 'Mưa lạnh' },
  67: { icon: CloudRain, labelEn: 'Freezing rain', labelVi: 'Mưa lạnh' },
  71: { icon: CloudSnow, labelEn: 'Light snow', labelVi: 'Tuyết nhẹ' },
  73: { icon: CloudSnow, labelEn: 'Snow', labelVi: 'Tuyết' },
  75: { icon: CloudSnow, labelEn: 'Heavy snow', labelVi: 'Tuyết dày' },
  77: { icon: CloudSnow, labelEn: 'Snow grains', labelVi: 'Tuyết hạt' },
  80: { icon: CloudRain, labelEn: 'Rain showers', labelVi: 'Mưa rào' },
  81: { icon: CloudRain, labelEn: 'Rain showers', labelVi: 'Mưa rào' },
  82: { icon: CloudRain, labelEn: 'Violent showers', labelVi: 'Mưa rào lớn' },
  85: { icon: CloudSnow, labelEn: 'Snow showers', labelVi: 'Tuyết rào' },
  86: { icon: CloudSnow, labelEn: 'Heavy snow showers', labelVi: 'Tuyết rào dày' },
  95: { icon: CloudLightning, labelEn: 'Thunderstorm', labelVi: 'Giông' },
  96: { icon: CloudLightning, labelEn: 'Thunderstorm w/ hail', labelVi: 'Giông có mưa đá' },
  99: { icon: CloudLightning, labelEn: 'Severe thunderstorm', labelVi: 'Giông lớn' },
}

const FALLBACK: CodeInfo = { icon: Cloud, labelEn: 'Unknown', labelVi: 'Không rõ' }

export function describeCode(code: number, locale: 'vi' | 'en'): { icon: LucideIcon; label: string } {
  const info = CODES[code] ?? FALLBACK
  return { icon: info.icon, label: locale === 'vi' ? info.labelVi : info.labelEn }
}
