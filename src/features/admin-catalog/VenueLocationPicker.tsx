import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LocationSuggestion, VenueLocationInput } from '@/api/generated/model'
import { reverseGeocodeVenueLocation, suggestVenueLocations } from '@/api/generated/endpoints/venue-setup/venue-setup'
import { ErrorNotice, Field } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'

type Props = {
  label: string
  value?: VenueLocationInput
  venue?: VenueLocationInput
  onChange: (location: VenueLocationInput) => void
  disabled?: boolean
}

export function VenueLocationPicker({ label, value, venue, onChange, disabled }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layers = useRef<L.LayerGroup | null>(null)
  const latest = useRef({ value, venue, onChange, disabled })
  latest.current = { value, venue, onChange, disabled }
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
      if (!controller.signal.aborted) latest.current.onChange({ ...location, source: 'MANUAL_MAP_PIN' })
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause)
    } finally {
      if (!controller.signal.aborted) setPinLoading(false)
    }
  }

  useEffect(() => {
    if (!host.current) return
    const initial = latest.current.value ?? latest.current.venue
    const instance = L.map(host.current).setView(
      initial ? [initial.latitude, initial.longitude] : [21.0207, 105.7649],
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
    function marker(location: VenueLocationInput, isVenue: boolean, draggable: boolean) {
      const icon = L.divIcon({
        className: 'venue-geographic-marker',
        html: `<span class="${isVenue ? 'venue-pin' : 'parking-pin'}">${isVenue ? 'S' : 'P'}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      })
      const pin = L.marker([location.latitude, location.longitude], { icon, draggable: draggable && !disabled }).addTo(
        group,
      )
      // Tooltip text is supplied as a DOM text node, never interpolated as HTML.
      const text = document.createElement('span')
      text.textContent = location.display_address
      pin.bindTooltip(text)
      pin.on('dragend', () => {
        const point = pin.getLatLng()
        void selectPin(point.lat, point.lng)
      })
    }
    if (venue) marker(venue, true, false)
    if (value) {
      marker(value, !venue, true)
      if (venue)
        map.current.fitBounds(
          [
            [venue.latitude, venue.longitude],
            [value.latitude, value.longitude],
          ],
          { padding: [40, 40], maxZoom: 16 },
        )
      else map.current.setView([value.latitude, value.longitude], 16)
    } else if (venue) map.current.setView([venue.latitude, venue.longitude], 15)
  }, [value, venue, disabled])

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
            <li key={result.source_place_id ?? `${result.latitude},${result.longitude}`}>
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
      <p>Bấm bản đồ hoặc kéo ghim để chọn vị trí. {venue && 'S: sân · P: bãi gửi xe.'}</p>
      {pinLoading && <p role="status">Đang lấy địa chỉ của vị trí đã chọn…</p>}
      {value && (
        <p className="venue-selected-address">
          <strong>Đã chọn:</strong> {value.display_address}
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
