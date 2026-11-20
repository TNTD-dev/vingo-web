import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { getVenueOverview } from '@/api/generated/endpoints/venue-imports/venue-imports'
import { QueryState } from '@/design/admin/AdminUi'
import { VenueMapView, type VenueGate } from './VenueMapView'

export function VenueOverviewWorkspace({ overviewId }: { overviewId: string }) {
  const [gate, setGate] = useState<VenueGate>()
  const overview = useQuery({
    queryKey: ['venue-overview', overviewId],
    queryFn: ({ signal }) => getVenueOverview(overviewId, { signal }),
  })
  return (
    <QueryState query={overview}>
      {overview.data && (
        <div className="venue-overview-workspace">
          <section className="venue-card venue-canvas-card" aria-label="Overview sân">
            <div className="venue-map-heading">
              <div>
                <h2>Nền v{overview.data.version}</h2>
                <p>Nền tổng thể và cổng của sân.</p>
              </div>
              <span className="venue-chip">Đã khóa</span>
            </div>
            <div className="venue-map-area">
              {overview.data.svg_content ? (
                <VenueMapView
                  svg={overview.data.svg_content}
                  onOverview={() => setGate(undefined)}
                  onZoneClick={() => setGate(undefined)}
                  onSeatClick={() => {}}
                  onGateClick={setGate}
                />
              ) : (
                <p role="status">Overview chưa có nội dung SVG để hiển thị.</p>
              )}
            </div>
            <footer className="venue-map-help">
              Lăn chuột để phóng to · Kéo để di chuyển · Bấm cổng để xem thông tin.
            </footer>
          </section>
          <aside className="venue-card venue-overview-info" aria-label="Thông tin overview">
            <h2>Thông tin overview</h2>
            <dl className="venue-configuration-values">
              <div>
                <dt>Phiên bản nền</dt>
                <dd>v{overview.data.version}</dd>
              </div>
              <div>
                <dt>Vùng khán đài</dt>
                <dd>{overview.data.areas?.length ?? 0}</dd>
              </div>
              <div>
                <dt>Cổng</dt>
                <dd>{overview.data.gates?.length ?? 0}</dd>
              </div>
            </dl>
            <p className="venue-setup-hint">
              Để thay đổi nền hoặc cổng, chỉnh SVG và nhập overview mới cùng layout tương ứng.
            </p>
            <Link className="venue-primary-link" to={`?import=new&overview=${overviewId}`}>
              Thêm layout trên nền này
            </Link>
            {gate && (
              <div className="venue-selection" role="status">
                <strong>Cổng {gate.number}</strong>
                {gate.zone && <p>Khu {gate.zone}</p>}
              </div>
            )}
          </aside>
        </div>
      )}
    </QueryState>
  )
}
