/**
 * Vẽ sơ đồ ghế từ SVG layout admin đã nhập (quy ước SVG v1: ZONE__, SEAT__, GATE__, LABEL__).
 * Dùng chung cho: chọn ghế (booking), block SeatMap trong chat, khoá ghế (admin-catalog), xem sơ đồ.
 * Không vẽ sẵn sân bóng: lớp trung tâm (PITCH, STAGE…) chỉ là nền. Xem Figma page 09.
 */
export function SeatMapView({ title = 'Sơ đồ ghế' }: { title?: string }) {
  return <div className="rounded-lg border border-dashed p-4 text-sm">{title}: chưa dựng</div>
}
