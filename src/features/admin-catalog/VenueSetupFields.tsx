import { findNearbyParking } from '@/api/generated/endpoints/venue-setup/venue-setup'
import { OpeningHoursFields } from './OpeningHoursFields'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ParkingSetupDraft, VenueImportDraft, VenueImportSession } from '@/api/generated/model'
import { generateImportParkingGuidance } from '@/api/generated/endpoints/venue-setup/venue-setup'
import { Field, ErrorNotice } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { VenueLocationPicker } from './VenueLocationPicker'

type Props = {
  draft: VenueImportDraft
  sessionId: string
  onChange: (draft: VenueImportDraft) => void
  save: () => Promise<VenueImportSession>
  accept: (session: VenueImportSession) => void
  run: (work: () => Promise<void>) => void
  pending: boolean
}

export function VenueSetupFields({ draft, sessionId, onChange, save, accept, run, pending }: Props) {
  const [error, setError] = useState<unknown>()
  const [parkingIndex, setParkingIndex] = useState<number | null>(null)
  const generated = useRef(new Set<string>())
  const parking = draft.parking_locations ?? []
  const location = draft.venue?.location
  const nearby = useQuery({
    queryKey: ['nearby-parking', location?.latitude, location?.longitude],
    queryFn: ({ signal }) =>
      findNearbyParking({ lat: location!.latitude, lng: location!.longitude, limit: 10 }, { signal }),
    enabled: !!location,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  function changeParking(index: number, patch: Partial<ParkingSetupDraft>, inputsChanged = true) {
    onChange({
      ...draft,
      parking_locations: parking.map((p, i) =>
        i === index
          ? {
              ...p,
              ...patch,
              ...(inputsChanged
                ? {
                    guidance_approved: false,
                    guidance_text: undefined,
                    guidance_input_hash: undefined,
                    route_distance_meters: undefined,
                    route_duration_seconds: undefined,
                  }
                : {}),
            }
          : p,
      ),
    })
  }
  function generate(index: number) {
    run(async () => {
      setError(undefined)
      const saved = await save()
      accept(await generateImportParkingGuidance(sessionId, { revision: saved.revision!, parking_index: index }))
    })
  }
  // Automatically generate once per stable set of parking facts, never while dragging/typing.
  const fingerprint = location
    ? JSON.stringify({
        location,
        parking: parking.map(
          ({ name, location, price_status, price_vnd, price_unit, vehicle_type, opening_hours, admin_notes }) => ({
            name,
            location,
            price_status,
            price_vnd,
            price_unit,
            vehicle_type,
            opening_hours,
            admin_notes,
          }),
        ),
      })
    : ''
  useEffect(() => {
    if (pending || !location || !parking.length) return
    const index = parking.findIndex((p) => !p.guidance_text)
    if (index < 0) return
    const key = `${index}:${fingerprint}`
    if (generated.current.has(key)) return
    const timer = setTimeout(() => {
      generated.current.add(key)
      generate(index)
    }, 1500)
    return () => clearTimeout(timer)
  }, [fingerprint, pending, parking.map((p) => p.guidance_text ?? '').join('|')])

  return (
    <div className="venue-setup-sections">
      <VenueLocationPicker
        label="Vị trí sân *"
        value={location}
        disabled={pending}
        onChange={(value) => {
          onChange({
            ...draft,
            venue: {
              ...draft.venue,
              location: value,
              address: value.display_address,
              city: value.city_code ?? undefined,
              lat: value.latitude,
              lng: value.longitude,
            },
            parking_locations: parking.map((p) => ({
              ...p,
              guidance_approved: false,
              guidance_text: undefined,
              guidance_input_hash: undefined,
              route_distance_meters: undefined,
              route_duration_seconds: undefined,
            })),
          })
        }}
      />
      <section className="venue-setup-section">
        <h3>Gửi xe</h3>
        {location && (
          <section className="grid gap-2" aria-label="Bãi gửi xe gần sân">
            {nearby.isFetching && <p role="status">Đang tìm bãi gửi xe trong 3 km…</p>}
            {nearby.isError && (
              <>
                <ErrorNotice error={nearby.error} />
                <Button variant="outline" onClick={() => void nearby.refetch()}>
                  Tìm lại bãi gửi xe
                </Button>
              </>
            )}
            {nearby.isSuccess && !nearby.data.data.length && <p>Chưa tìm thấy bãi gửi xe trên bản đồ quanh sân.</p>}
            <ul className="grid gap-2">
              {nearby.data?.data.map(({ label, straight_line_meters, ...point }) => {
                const alreadyAdded = parking.some(
                  ({ location: saved }) =>
                    (point.source_place_id && saved.source_place_id === point.source_place_id) ||
                    (saved.latitude === point.latitude && saved.longitude === point.longitude),
                )
                return (
                  <li
                    key={point.source_place_id ?? `${point.latitude},${point.longitude}`}
                    className="venue-parking-card"
                  >
                    <strong>{label}</strong>
                    <p>
                      {point.display_address} · {straight_line_meters} m đường chim bay
                    </p>
                    <p>Giá và giờ hoạt động chưa xác minh.</p>
                    <Button
                      variant="outline"
                      disabled={pending || alreadyAdded || parking.length >= 20}
                      onClick={() => {
                        onChange({
                          ...draft,
                          parking_locations: [
                            ...parking,
                            {
                              name: label,
                              location: point,
                              is_primary: !parking.length,
                              price_status: 'UNVERIFIED',
                            },
                          ],
                        })
                      }}
                    >
                      {alreadyAdded ? 'Đã thêm' : 'Thêm bãi xe'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <p>Chọn tối đa 20 bãi trong 3 km quanh sân. Giá chưa xác minh không có nghĩa là miễn phí.</p>
        {parking.map((p, index) => (
          <article className="venue-parking-card" key={index}>
            <div className="venue-inline-actions">
              <strong>
                {p.name} {p.is_primary ? '· Bãi chính' : ''}
              </strong>
              <Button
                variant="outline"
                onClick={() => {
                  setParkingIndex(parkingIndex === index ? null : index)
                }}
              >
                {parkingIndex === index ? 'Đóng bản đồ bãi' : 'Chọn lại vị trí'}
              </Button>
              <Button
                variant="outline"
                disabled={!!p.is_primary}
                onClick={() =>
                  onChange({
                    ...draft,
                    parking_locations: parking.map((lot, i) => ({ ...lot, is_primary: i === index })),
                  })
                }
              >
                Đặt bãi chính
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const next = parking.filter((_, i) => i !== index)
                  if (p.is_primary && next.length) next[0] = { ...next[0], is_primary: true }
                  onChange({ ...draft, parking_locations: next })
                  setParkingIndex(null)
                }}
              >
                Bỏ bãi
              </Button>
            </div>
            <p>{p.location.display_address}</p>
            {parkingIndex === index && (
              <VenueLocationPicker
                label="Vị trí bãi xe"
                venue={location}
                value={p.location}
                disabled={pending}
                onChange={(value) => changeParking(index, { location: value })}
              />
            )}
            <div className="venue-setup-fields">
              <Field label="Tên bãi">
                <input
                  value={p.name}
                  maxLength={200}
                  onChange={(e) => changeParking(index, { name: e.target.value })}
                />
              </Field>
              <Field label="Giá gửi xe">
                <select
                  value={p.price_status}
                  onChange={(e) =>
                    changeParking(index, {
                      price_status: e.target.value as ParkingSetupDraft['price_status'],
                      price_vnd: undefined,
                      price_unit: undefined,
                    })
                  }
                >
                  <option value="UNVERIFIED">Chưa xác minh</option>
                  <option value="VERIFIED">Đã xác minh</option>
                </select>
              </Field>
              {p.price_status === 'VERIFIED' && (
                <>
                  <Field label="Giá (VND)">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={p.price_vnd ?? ''}
                      onChange={(e) =>
                        changeParking(index, { price_vnd: e.target.value === '' ? undefined : Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Đơn vị giá">
                    <select
                      value={p.price_unit ?? ''}
                      onChange={(e) =>
                        changeParking(index, { price_unit: e.target.value as ParkingSetupDraft['price_unit'] })
                      }
                    >
                      <option value="">Chọn đơn vị</option>
                      <option value="PER_ENTRY">Theo lượt</option>
                      <option value="PER_HOUR">Theo giờ</option>
                      <option value="PER_DAY">Theo ngày</option>
                    </select>
                  </Field>
                </>
              )}
              <Field label="Phương tiện">
                <select
                  value={p.vehicle_type ?? 'MOTORBIKE'}
                  onChange={(e) =>
                    changeParking(index, { vehicle_type: e.target.value as ParkingSetupDraft['vehicle_type'] })
                  }
                >
                  <option value="MOTORBIKE">Xe máy</option>
                  <option value="CAR">Ô tô</option>
                  <option value="BICYCLE">Xe đạp</option>
                  <option value="OTHER">Khác</option>
                </select>
              </Field>
              <OpeningHoursFields
                label="Giờ hoạt động bãi"
                value={p.opening_hours}
                onChange={(hours) => changeParking(index, { opening_hours: hours })}
              />
              <Field label="Ghi chú đã xác minh">
                <textarea
                  maxLength={2000}
                  value={p.admin_notes ?? ''}
                  onChange={(e) => changeParking(index, { admin_notes: e.target.value })}
                />
              </Field>
            </div>
            {p.straight_line_meters !== undefined && (
              <p>
                Đường chim bay: khoảng {p.straight_line_meters} m ·{' '}
                {p.route_distance_meters != null
                  ? `Lộ trình đi bộ: ${p.route_distance_meters} m`
                  : 'Chưa có lộ trình đi bộ'}
              </p>
            )}
            <Field label="Hướng dẫn gửi xe (bản nháp)">
              <textarea
                maxLength={5000}
                rows={5}
                value={p.guidance_text ?? ''}
                onChange={(e) =>
                  changeParking(index, { guidance_text: e.target.value, guidance_approved: false }, false)
                }
              />
            </Field>
            <div className="venue-inline-actions">
              <Button variant="outline" onClick={() => generate(index)}>
                Tạo lại hướng dẫn AI
              </Button>
              <label>
                <input
                  type="checkbox"
                  checked={!!p.guidance_approved}
                  disabled={!p.guidance_text?.trim()}
                  onChange={(e) => changeParking(index, { guidance_approved: e.target.checked }, false)}
                />{' '}
                Đã rà soát, duyệt hướng dẫn
              </label>
            </div>
          </article>
        ))}
        {location ? (
          <>
            <Button variant="outline" disabled={parking.length >= 20} onClick={() => setParkingIndex(parking.length)}>
              Thêm bãi gửi xe trên bản đồ
            </Button>
            {parkingIndex === parking.length && (
              <VenueLocationPicker
                label="Tìm hoặc chọn bãi gửi xe"
                venue={location}
                disabled={pending}
                onChange={(value) => {
                  onChange({
                    ...draft,
                    parking_locations: [
                      ...parking,
                      {
                        name: value.display_address.split(',')[0],
                        location: value,
                        is_primary: !parking.length,
                        price_status: 'UNVERIFIED',
                        vehicle_type: 'MOTORBIKE',
                      },
                    ],
                  })
                  setParkingIndex(null)
                }}
              />
            )}
          </>
        ) : (
          <p>Chọn vị trí sân trước để thêm bãi gửi xe.</p>
        )}
      </section>
      <section className="venue-setup-section">
        <h3>Nội quy sân</h3>
        <Field label="Nội quy công khai">
          <textarea
            rows={6}
            maxLength={50000}
            value={draft.venue?.info?.rules ?? ''}
            onChange={(e) =>
              onChange({ ...draft, venue: { ...draft.venue, info: { ...draft.venue?.info, rules: e.target.value } } })
            }
          />
        </Field>
        <ErrorNotice error={error} />
      </section>
    </div>
  )
}
