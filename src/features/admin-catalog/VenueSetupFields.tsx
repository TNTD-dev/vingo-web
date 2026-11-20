import type { VenueImportDraft, VenueInput } from '@/api/generated/model'
import { Field } from '@/design/admin/AdminUi'

import { cities } from './catalog'

type Props = {
  draft: VenueImportDraft
  onChange: (draft: VenueImportDraft) => void
  pending: boolean
}

/** Thông tin sân theo schema v2: địa chỉ, thành phố, quận, toạ độ và nội quy. Không còn bãi xe hay tra cứu địa điểm. */
export function VenueSetupFields({ draft, onChange, pending }: Props) {
  const venue: VenueInput = draft.venue ?? {}
  const set = (patch: Partial<VenueInput>) => onChange({ ...draft, venue: { ...venue, ...patch } })
  const number = (value: string) => (value === '' ? undefined : Number(value))
  return (
    <div className="venue-setup-sections">
      <section className="venue-setup-section">
        <h3>Vị trí sân</h3>
        <div className="venue-setup-fields">
          <Field label="Địa chỉ *">
            <input
              required
              maxLength={500}
              disabled={pending}
              value={venue.address ?? ''}
              onChange={(e) => set({ address: e.target.value })}
            />
          </Field>
          <Field label="Thành phố *">
            <select
              disabled={pending}
              value={venue.city ?? ''}
              onChange={(e) => set({ city: e.target.value as VenueInput['city'] })}
            >
              <option value="">Chọn thành phố</option>
              {Object.entries(cities).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quận/huyện">
            <input
              maxLength={200}
              disabled={pending}
              value={venue.district ?? ''}
              onChange={(e) => set({ district: e.target.value })}
            />
          </Field>
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
      </section>
      <section className="venue-setup-section">
        <h3>Nội quy sân</h3>
        <Field label="Nội quy công khai">
          <textarea
            rows={6}
            maxLength={50000}
            disabled={pending}
            value={venue.rules ?? ''}
            onChange={(e) => set({ rules: e.target.value })}
          />
        </Field>
      </section>
    </div>
  )
}
