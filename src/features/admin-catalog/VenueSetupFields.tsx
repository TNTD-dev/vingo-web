import { MapPin, ScrollText } from 'lucide-react'
import type { VenueImportDraft, VenueInput } from '@/api/generated/model'
import { Field } from '@/design/admin/AdminUi'

import { VenueLocationPicker } from './VenueLocationPicker'

type Props = {
  draft: VenueImportDraft
  onChange: (draft: VenueImportDraft) => void
  pending: boolean
}

/** Thông tin sân theo schema v2: địa chỉ, thành phố, quận, toạ độ và nội quy. */
export function VenueSetupFields({ draft, onChange, pending }: Props) {
  const venue: VenueInput = draft.venue ?? {}
  const set = (patch: Partial<VenueInput>) => onChange({ ...draft, venue: { ...venue, ...patch } })
  const number = (value: string) => (value === '' ? undefined : Number(value))
  return (
    <div className="venue-setup-sections">
      <section className="venue-setup-section rounded-xl border border-line p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-agent text-ink">
            <MapPin className="size-5" aria-hidden />
          </span>
          <div>
            <h3>Vị trí sân</h3>
            <p className="text-sm text-ink-secondary">Tìm địa điểm hoặc chọn trên bản đồ, rồi kiểm tra lại địa chỉ.</p>
          </div>
        </div>
        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <VenueLocationPicker
            label="Tìm vị trí sân"
            value={venue}
            disabled={pending}
            onChange={({ address, city, district, lat, lng }) =>
              set({ address, city: city ?? '', district: district ?? '', lat, lng })
            }
          />
          <div className="grid min-w-0 gap-4 rounded-xl bg-canvas p-4">
            <h4 className="text-sm font-semibold">Địa chỉ hiển thị</h4>
            <div className="venue-setup-fields">
              <div className="venue-setup-full-width">
                <Field label="Địa chỉ *">
                  <input
                    required
                    maxLength={500}
                    disabled={pending}
                    value={venue.address ?? ''}
                    onChange={(e) => set({ address: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Thành phố *">
                <input
                  required
                  maxLength={100}
                  disabled={pending}
                  value={venue.city ?? ''}
                  onChange={(e) => set({ city: e.target.value })}
                />
              </Field>
              <Field label="Quận/huyện">
                <input
                  maxLength={200}
                  disabled={pending}
                  value={venue.district ?? ''}
                  onChange={(e) => set({ district: e.target.value })}
                />
              </Field>
            </div>
            <details className="rounded-lg border border-line bg-surface px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">Tọa độ bản đồ</summary>
              <div className="venue-setup-fields mt-3">
                <Field label="Vĩ độ">
                  <input
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    disabled={pending}
                    value={venue.lat ?? ''}
                    onChange={(e) => set({ lat: number(e.target.value) })}
                  />
                </Field>
                <Field label="Kinh độ">
                  <input
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    disabled={pending}
                    value={venue.lng ?? ''}
                    onChange={(e) => set({ lng: number(e.target.value) })}
                  />
                </Field>
              </div>
            </details>
          </div>
        </div>
      </section>
      <section className="venue-setup-section rounded-xl border border-line p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas text-ink">
            <ScrollText className="size-5" aria-hidden />
          </span>
          <div>
            <h3>Nội quy sân</h3>
            <p className="text-sm text-ink-secondary">Không bắt buộc. Khách mua vé có thể đọc nội quy này.</p>
          </div>
        </div>
        <Field label="Nội quy công khai">
          <textarea
            className="resize-y"
            rows={4}
            maxLength={50000}
            placeholder="Ví dụ: Có mặt trước giờ mở cửa 30 phút."
            disabled={pending}
            value={venue.rules ?? ''}
            onChange={(e) => set({ rules: e.target.value })}
          />
        </Field>
      </section>
    </div>
  )
}
