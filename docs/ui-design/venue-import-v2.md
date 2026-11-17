# Nhập sân v2 — frontend mục 1.4

Phạm vi hiện tại theo yêu cầu triển khai mục 1.4 trong
`vingo-backend/docs/admin-completion-checklist.md` và `venue-import-api.md`.
Luồng này thay thế phương án nhập một SVG gộp và tạo hall của UI trước đây.

## Giao diện

- `/admin/venues/new`: tạo phiên nháp, upload nền, nhập tên/loại layout và nhiều
  SVG chi tiết, kiểm tra mapping/hình học, thông tin sân, xem lại và lưu.
- URL `?session=...` mở lại nháp phía server. Lưu nháp hoặc chuyển bước sẽ lưu
  metadata; tệp được giữ ngay sau upload. Thông tin chưa lưu có cảnh báo khi rời
  trang hoặc reload. Access token không được ghi vào browser storage.
- `/admin/venues/:venueId/setup`: sửa thông tin sân, chọn layout theo tên, loại,
  version và trạng thái; xem khu/ghế, đổi tên nháp, xuất CSV và phát hành.
- `?import=new` thêm layout vào cùng sân. `?layout=...` chọn đúng layout; ID sai
  không âm thầm mở cấu hình khác. Layout legacy chỉ đọc/xuất, không phát hành
  hoặc gắn vào suất mới. Không còn route hall trong router.
- Showtime chọn sân rồi layout v2 đã phát hành. Đổi sân xóa lựa chọn layout.
- Giá vé được cấu hình theo sự kiện; màn quản lý hình học sân không sửa giá.

## Lưu và lỗi

Chỉ gọi client Orval sinh. Contract được đồng bộ theo phần venue/import/layout/
showtime từ backend, giữ các bổ sung location, auth, ticket và API khác đang có
trong frontend. Chạy `npm run generate` khi cần sinh lại client; không commit
`src/api/generated`.

Mọi mutation dùng revision mới nhất trong response, không tự tăng. 409 có nút
tải lại phiên từ server, ghi rõ sẽ bỏ thay đổi cục bộ. Preview dùng SVG đã được
server làm sạch; không render bytes nguồn. Vẫn lọc SVG ở frontend, hỗ trợ use
nội bộ và chặn href bên ngoài.

Complete kiểm tra lại hình học trước khi ghi. Nếu phản hồi complete bị mất,
UI đọc lại kết quả phiên để phục hồi; retry tiếp tục cùng session, không tạo
lại sân/layout. Nháp hoàn tất mở lại sẽ dẫn đến đúng IDs đã lưu.

## Kiểm tra và giới hạn nghiệm thu

`npm run check` đạt: lint, format, typecheck, 67 file test / 400 test và build.
Lint còn cảnh báo, không có lỗi.

Test frontend bao phủ upload nhiều file và revision tăng không tuần tự, giữ
metadata khi quay lại, mở lại nháp, mapping lỗi và kiểm tra lại sau khi đổi,
giới hạn file, conflict, retry và complete mất phản hồi, đổi sân xóa layout,
SVG use/href và bật/tắt lớp.

Đã kiểm tra trình duyệt ở desktop và 360px với MSW: upload nền/chi tiết,
preview, thông tin, reload mở lại nháp, hoàn tất và phát hành. Không có tràn
ngang ở màn mapping 360px. Fixture tối thiểu nằm trong `fixtures/`.

Mock có lưu phiên nhập trong `localStorage` dưới key
`vingo-mock-venue-imports-v2`; đây là dữ liệu demo, không chứa token. Mock chỉ
kiểm tra luồng/revision và một số lỗi cấu trúc; collision hình học, ownership,
TTL/quota và tính nguyên tử phải nghiệm thu với backend thật.

Chưa nghiệm thu tích hợp backend local/staging: `mvnw verify` bị chặn compile
ở phần Google Places/Gemini trong `VenuePlaceLookupService`. Không thay đổi,
loại bỏ hoặc skip phần backend đó trong lần triển khai UI này. Mục 1.5 và
triển khai môi trường khác vẫn còn cần thực hiện.
