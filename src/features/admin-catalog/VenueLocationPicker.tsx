import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LocationSuggestion, VenueInput } from '@/api/generated/model'
import { reverseGeocodeVenueLocation, suggestVenueLocations } from '@/api/generated/endpoints/venue-setup/venue-setup'
import { ErrorNotice, Field } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'

type Props = {
  label: string
  value?: VenueInput
  onChange: (location: LocationSuggestion) => void
  disabled?: boolean
}

export function VenueLocationPicker({ label, value, onChange, disabled }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layers = useRef<L.LayerGroup | null>(null)
  const latest = useRef({ value, onChange, disabled })
  latest.current = { value, onChange, disabled }
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [retry, setRetry] = useState(0)
  const reverseRequest = useRef<AbortController | null>(null)
  const [pinLoading, setPinLoading] = useState(false)

  async function selectPin(lat: number, lng: number) {
    if (latest.current.disabled) return
    reverseRequest.current?.abort()
    const controller = new AbortController()
    reverseRequest.current = controller
    setPinLoading(true)
    setError(undefined)
    try {
      const location = await reverseGeocodeVenueLocation({ lat, lng }, { signal: controller.signal })
      if (!controller.signal.aborted) latest.current.onChange(location)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause)
    } finally {
      if (!controller.signal.aborted) setPinLoading(false)
    }
  }

  useEffect(() => {
    if (!host.current) return
    const initial = latest.current.value
    const instance = L.map(host.current).setView(
      initial?.lat != null && initial.lng != null ? [initial.lat, initial.lng] : [21.0207, 105.7649],
      15,
    )
    const key = import.meta.env.VITE_GEOAPIFY_TILE_KEY
    L.tileLayer(
      key
        ? `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(key)}`
        : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: `${key ? '<a href="https://www.geoapify.com/">Powered by Geoapify</a> | ' : ''}<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>`,
      },
    ).addTo(instance)
    map.current = instance
    layers.current = L.layerGroup().addTo(instance)
    instance.on('click', (e: L.LeafletMouseEvent) => {
      void selectPin(e.latlng.lat, e.latlng.lng)
    })
    const observer = new ResizeObserver(() => instance.invalidateSize())
    observer.observe(host.current)
    return () => {
      reverseRequest.current?.abort()
      observer.disconnect()
      instance.remove()
      map.current = null
      layers.current = null
    }
  }, [])

  useEffect(() => {
    if (!map.current || !layers.current) return
    const group = layers.current
    group.clearLayers()
    if (value?.lat == null || value.lng == null) return
    const icon = L.divIcon({
      className: 'venue-geographic-marker',
      html: '<span class="venue-pin">S</span>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    })
    const pin = L.marker([value.lat, value.lng], { icon, draggable: !disabled }).addTo(group)
    const text = document.createElement('span')
    text.textContent = value.address ?? ''
    pin.bindTooltip(text)
    pin.on('dragend', () => {
      const point = pin.getLatLng()
      void selectPin(point.lat, point.lng)
    })
    map.current.setView([value.lat, value.lng], 16)
  }, [value, disabled])

  useEffect(() => {
    setResults([])
    if (query.trim().length < 3) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      void suggestVenueLocations({ q: query.trim(), limit: 5 }, { signal: controller.signal })
        .then((response) => {
          if (!controller.signal.aborted) {
            setResults(response.data)
            setError(undefined)
          }
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setError(cause)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, retry])

  return (
    <section className="venue-location-picker">
      <Field label={label}>
        <input
          value={query}
          maxLength={200}
          disabled={disabled}
          placeholder="Tìm tên địa điểm hoặc địa chỉ (ít nhất 3 ký tự)"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
          autoComplete="off"
        />
      </Field>
      {loading && <p role="status">Đang tìm địa chỉ…</p>}
      {!loading && query.trim().length >= 3 && results.length === 0 && !error && (
        <p>Không có kết quả. Bạn có thể chọn trực tiếp trên bản đồ.</p>
      )}
      {results.length > 0 && (
        <ul className="venue-location-results" aria-label="Địa chỉ gợi ý">
          {results.map((result) => (
            <li key={`${result.lat},${result.lng}:${result.label}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  reverseRequest.current?.abort()
                  setPinLoading(false)
                  onChange(result)
                  setResults([])
                  setQuery('')
                }}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div ref={host} className="venue-geographic-map" aria-label={`${label} trên bản đồ`} />
      <p>Bấm bản đồ hoặc kéo ghim để chọn vị trí.</p>
      {pinLoading && <p role="status">Đang lấy địa chỉ của vị trí đã chọn…</p>}
      {value?.address && (
        <p className="venue-selected-address">
          <strong>Đã chọn:</strong> {value.address}
        </p>
      )}
      <ErrorNotice error={error} />
      {!!error && (
        <Button type="button" variant="outline" onClick={() => setRetry((n) => n + 1)}>
          Thử tìm lại
        </Button>
      )}
    </section>
  )
}
