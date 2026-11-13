# Vấn đề còn tồn đọng — vingo-web (buyer: B1, B2, B3)

Ghi lại các điểm cần hỏi backend, báo nhóm, hoặc khác Figma. Cập nhật khi xử lý xong thì gạch bỏ hoặc xoá dòng.

## 1. Cần backend (đổi contract trước, theo CLAUDE.md mục 3)

| # | Vấn đề | Ảnh hưởng | Đề xuất |
| - | ------ | --------- | ------- |
| 1 | **Người mua chưa có API lấy SVG sơ đồ ghế.** Chỉ có `GET /admin/seat-layouts/{layout_id}/svg` (module `catalog`, tag Admin Catalog, cần quyền admin). `getSeatmap` chỉ trả ghế (x, y), hạng giá, trạng thái; không có hình khu, sân, cổng. | Màn chọn ghế B3/B3b chỉ chạy với `npm run dev:mock`. Backend thật sẽ hiện "Sơ đồ chưa sẵn sàng". | Module `search` thêm endpoint công khai cạnh `getSeatmap`, ví dụ `GET /showtimes/{showtime_id}/seatmap.svg` (suất đã có `seat_layout_id`). Có endpoint thì chỉ sửa thân hàm `loadSeatLayoutSvg` trong `src/seatmap/svgSource.ts`. |
| 2 | **Quy ước ghép khu API ↔ khu trong SVG chưa được chốt.** Web đang giả định tên khu trong `availability`/`seatmap` là `A1` hoặc `A1-T1` (hàm `sameZone` trong `src/seatmap/svg.ts`). Hợp đồng chưa nói tên khu = mã khu. | Sai quy ước thì không tô được khu và không chọn được ghế. | Backend xác nhận, hoặc thêm trường mã khu (`code`) vào khu trong `getSeatmap` và `getAvailability`. |
| 3 | `getAvailability` không trả loại khu (SEATED/STANDING) và sức chứa. | B2 không hiện nhãn SEATED/STANDING; tooltip B3 không có "còn X / tổng Y ghế". Web tự suy loại khu từ id trong SVG. | Thêm `kind`, `capacity` vào khu trong availability. |
| 4 | API tìm sự kiện không có: tổng số kết quả, số đếm theo thể loại, nhiều thể loại cùng lúc, trạng thái "sắp hết vé", lọc "chỉ còn vé". | B1 chỉ chọn được một thể loại, không có số đếm cạnh thể loại, không có "128 sự kiện", không có badge "SẮP HẾT VÉ"; "chỉ hiện còn vé" lọc ngay trên máy theo trang đã tải. | Thêm các trường/tham số tương ứng nếu muốn giống Figma. |
| 5 | Chưa có API yêu thích sự kiện. | Nút trái tim ở B2 đang bị khoá. | Thêm API hoặc bỏ nút khỏi thiết kế. |
| 6 | Orval sinh `useHoldSeats` thành `useQuery` (do cấu hình `useQuery: true` cho mọi operation, kể cả POST). | Phải gọi hàm `holdSeats(...)` bằng `useMutation` thủ công. | Cân nhắc cấu hình Orval sinh `useMutation` cho POST/PUT/DELETE. |

## 2. Cần báo nhóm (file thuộc hạ tầng dùng chung của Đức)

- `src/app/layouts.tsx` (`BuyerLayout`) và `src/app/AppNav.tsx` (mới).
- `src/index.css`: thêm token `--vg-tier-1..4`, `--vg-map-sold` (màu hạng vé trên sơ đồ, lấy từ chú giải Figma B3).
- `src/design/`: thêm `Logo.tsx`, `StatusBadge.tsx`, thư mục `icons/` (xuất từ Figma).
- `src/lib/time.ts`: thêm các hàm giờ Việt Nam (`formatEventDateTime`, `formatTimeRange`, `showtimeDayBox`, `formatShortDateTime`…).

## 3. Khác Figma (có chủ đích)

**B1 · Khám phá sự kiện**
- Khoảng ngày tự chọn bằng lịch tự viết (`RangeCalendar`, không thêm thư viện); lọc theo `from`/`to` trên URL, loại trừ với các chip Hôm nay/Cuối tuần/Tháng sau.
- Công tắc "Chỉ hiện còn vé" làm cỡ chuẩn 46px; trong Figma nó bị kéo dài hết hàng (nhiều khả năng lỗi auto-layout).
- Giá hiện "120.000 ₫" (có khoảng trắng) vì phải dùng `formatVnd()`; Figma ghi "120.000₫".

**B2 · Chi tiết sự kiện**
- Tab nav sáng theo thể loại của sự kiện đang xem (đã sửa, AppNav đọc `useGetEvent` dùng chung cache với trang).
- Dòng giải đấu chỉ hiện khi sự kiện bóng đá có đủ `home_team`, `away_team` trong `attributes`.
- Đoạn giới thiệu có thể xuống 3 dòng thay vì 2 khi thanh cuộn chiếm chỗ (chưa kiểm tra ở trình duyệt thật).
- Thẻ "Hạng vé & khu" gom theo hạng giá (sân thật có hàng chục khu nhưng chỉ vài hạng).

**B3 · Chọn khu / B3b · Chọn ghế**
- Bỏ dòng "Phí dịch vụ 0₫" (API không có trường này).
- Tooltip khu không có "/ 353 ghế" (xem mục 1.3).
- Chưa có tooltip khi rê vào từng ghế.
- "Tạm tính" là số cộng chỉ để hiển thị trước; số tiền thật lấy từ `total_amount` của đơn sau khi giữ ghế (CLAUDE.md mục 5).
- Khu đứng không chọn chung với ghế ngồi trong cùng một đơn (API: gửi đúng một trong hai dạng).
- Chọn ghế bằng bàn phím chưa làm: bản đồ hỗ trợ phím +/−/0 và mũi tên để di chuyển, nhưng chưa chọn từng ghế bằng phím. Lối thay thế là "Để Vingo chọn giúp".
- Ghế đôi (`pair_seat_id`) và ghế xe lăn đã có logic nhưng chưa có hiển thị riêng, chưa thử với dữ liệu thật.

## 4. Kỹ thuật cần lưu ý

- **`npm run check` đỏ ở bước `format:check`:** git trên máy bật `core.autocrlf=true` nên Prettier báo mọi file lệch xuống dòng (lỗi có sẵn từ trước). Bỏ qua lỗi xuống dòng thì mọi file đạt. Cách sửa gọn: thêm `.gitattributes` với `* text=auto eol=lf` (cấu hình chung của repo, cần báo nhóm).
- **File SVG sân Thiên Trường ~700KB** (`src/mocks/seatmaps/thien-truong.svg`) nằm trong repo để chạy mock; chỉ được nạp khi `VITE_USE_MOCK=true`. Nên kiểm tra bản build production không kéo nó vào bundle chính.
- **SVG do admin tải lên** được làm sạch bằng `sanitizeSvg` tự viết (`src/seatmap/svg.ts`, có test), không dùng thư viện. Nếu sau này thêm DOMPurify thì cân nhắc thay.
- Mock SVG được ghép từ 53 lớp xuất từ Figma (frame "SVG gốc · Thiên Trường", page 09) và đã đánh số lại id `mask` bị trùng. Nếu thiết kế Figma đổi, phải xuất lại.
- Bản dev dùng `.env.local` (`VITE_USE_MOCK=true`, `VITE_MOCK_ROLE=ADMIN`, không commit). Đổi sang `BUYER` để thử phía người mua. Preview dùng `D:\AI_Vin\vingo\.claude\launch.json`.
- Tài khoản Figma MCP phải có quyền edit trên file thì mới đọc được thiết kế (đã gặp lỗi này lúc đầu).

## 5. Chưa làm

- Layout admin (`AdminLayout`) và toàn bộ màn admin D1–D15, C1–C6 (phiên khác đang làm).
- Agent mode M1–M6 (`features/agent`, thuộc Đức).
- Mascot "Live" theo bộ Figma page 07: hiện dùng `design/Mascot.tsx` (SVG tĩnh + chuyển động CSS nhẹ theo trạng thái, tắt khi `prefers-reduced-motion`).

## 6. Buyer B4–B17 (làm sau B3)

Đã làm: B4 thanh toán (+ B4b hộp chờ VNPay, B13a hết hạn giữ ghế dạng hộp thoại), B5 thành công, B6 vé của tôi, B7 đơn hàng, B8 đăng nhập + bước OTP (`/verify-otp`), B9 hồ sơ, B10 chi tiết đơn, B11 vé & QR toàn màn (nền tối), B12 trở về VNPay, B13b chưa thành công, B13c suất hết vé (ở trang chi tiết sự kiện), B14 đăng ký, B15 quên/đặt lại mật khẩu (một trang hai bước; `/reset-password` chuyển về `/forgot-password`), B16 thông báo (chuông trên AppNav), B17 tài khoản & bảo mật.

Khác Figma / cần backend:
- **Ảnh QR vé**: backend trả ảnh (`GET /tickets/{id}/qr.png`, cần Bearer). `api/http.ts` được thêm nhánh trả `Blob` khi `Content-Type` là image; mock trả SVG giả không quét được.
- **B4b**: không có QR thanh toán (không có API trả mã QR VNPay, chỉ có `payment_url`); hộp thoại có nút "Mở cổng VNPay".
- **Trang trở về VNPay** đọc `order_id`, `vnp_ResponseCode`, `vnp_TxnRef` trên URL. Hợp đồng chưa nói backend chuyển hướng kèm `order_id` hay không; cần xác nhận.
- **B10**: không có khối "Lần thanh toán" (đơn không kèm danh sách thanh toán), không có dòng "Phí dịch vụ".
- **B9**: không có ngày sinh, thành phố, thống kê "vé đã mua" (API hồ sơ chỉ có họ tên, SĐT, email). Menu trái của B17 chỉ có 2 mục có route thật.
- **B17**: không có danh sách phiên đăng nhập/thiết bị, không đổi email, không liên kết Google (chưa có API); đổi mật khẩu dùng `updateMe`.
- **B16**: chưa có API thông báo. Thông báo suy ra từ các đơn gần đây (đã phát hành, sắp hết hạn, hết hạn, đang xem xét); trạng thái "đã đọc" lưu ở `localStorage` (chỉ id, không dữ liệu nhạy cảm). Chip "Đơn & vé" bỏ vì trùng "Tất cả".
- **B8**: "Ghi nhớ đăng nhập" bỏ (không có API). Bước OTP chỉ gặp sau đăng ký (đăng nhập không đòi OTP trong hợp đồng).
- **B13a "Giữ lại N ghế"** chỉ có với đơn ghế ngồi (đơn khu đứng không có `zone_id` trong `Order`).
- **Ảnh nền đăng nhập** `design/brand/auth-stadium.png` nặng 1,7 MB, nên nén/chuyển WebP.
- Mock có sẵn 5 đơn mẫu (`mocks/orders.ts`) và vé tương ứng (`mocks/tickets.ts`).

Hạ tầng dùng chung đã sửa thêm (cần báo nhóm): `api/http.ts` (nhánh Blob), `app/layouts.tsx` (AuthLayout hai cột, nền tối cho B11), `app/AppNav.tsx` + `app/NotificationsMenu.tsx` (chuông), `index.css` (keyframes mascot), `design/` (`ArrowButton`, `Mascot`, `OtpInput`, `ticket/TicketCard`), `lib/` (`time`, `mask`, `ics`, `validate`, `useNow`).

Chưa đối chiếu pixel ở 360px cho các màn mới; B8/B14/B15 mới xem được khung (chưa chạy luồng với backend thật).
