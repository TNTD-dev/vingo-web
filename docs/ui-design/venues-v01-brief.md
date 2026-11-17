# Sân & sơ đồ ghế — bản đề xuất V01

Ngày: 2026-11-16
Trạng thái: Chờ cùng người dùng chỉnh sửa và chốt thiết kế; chưa sửa UI chức năng.
Công cụ: imagegen tích hợp (không dùng CLI/API fallback).

## Phạm vi màn hình

1. Danh sách sân và trạng thái sẵn sàng.
2. Tạo / sửa thông tin sân.
3. Chọn / thêm hall và nhập SVG thành bản nháp.
4. Xem hall, phiên bản sơ đồ, khu và ghế; đổi tên bản nháp, xuất CSV.
5. Xác nhận phát hành và giải thích khóa phiên bản.
6. Hoàn tất, chuyển sang tạo sự kiện.

## Nguyên tắc

- Giữ nền xám, sidebar tối và xanh lime của Vingo hiện có.
- Sân → Hall → Phiên bản sơ đồ; nhập SVG, không thiết kế ghế tự do.
- Thao tác nhập bản nháp và phát hành là hai bước riêng.
- Các số liệu 12 địa điểm, 8 khu, 2.400 ghế là dữ liệu minh họa, không phải dữ liệu thật.
- Điều khiển zoom/fit, bảng khu bên cạnh và checklist là đề xuất UX cần đối chiếu khả năng component khi triển khai.
- Loading, rỗng, SVG không hợp lệ, trùng tên hall và lỗi phát hành sẽ được bổ sung khi chốt màn chính.

## Prompt đã dùng

```text
Use case: ui-mockup
Asset type: ONE high resolution design review contact sheet, six desktop web app screens arranged exactly in 2 columns by 3 rows. Output a large portrait image around 3072x3840 or the largest supported resolution, sharp readable Vietnamese typography. This is a V1 redesign proposal for the EXISTING Vingo venue and seat layout management module, not a generic dashboard.
Primary request: A polished, practical Vietnamese SaaS admin interface storyboard for joint design review before coding. Six full, flat front-on desktop UI screenshots, evenly sized with generous gutters, each labelled outside its frame with a large numbered Vietnamese screen caption. No devices, perspective, presentation shadows, hands or photography. Design review board heading "VINGO · SÂN & SƠ ĐỒ GHẾ" and small subtitle "Đề xuất UI · V01".
Existing product visual language: warm neutral gray canvas #f0f0f0, white panels, charcoal #1a1a1a sidebar, raised charcoal #242424, lime #c6f24e accent. Black clean sans-serif type, large medium-weight page titles, tiny monospaced metadata, subtle borders and 16–20px rounded white cards. Calm operational admin design, minimal shadows, strong hierarchy, plenty of whitespace, crisp thin line icons. Use simple lowercase text wordmark "vingo" plus ADMIN in sidebar, no invented mascot/logo. Consistent left sidebar in every screen with "Tổng quan", "Báo cáo", highlighted "Sân & sơ đồ ghế", "Sự kiện", "Đơn hàng", "Vé", "Check-in". User "Luân" at bottom.
Use the same fictional/demo venue consistently: "Sân vận động Thiên Trường". Visible demo labels/data only, no real private data. Structure: venue contains Halls; each Hall has versions of imported SVG seat layouts. Draft is editable by renaming; published versions are locked and creating a NEW imported SVG version is required for geometry changes. No freehand seat designer, no drag-seat tools, no invented AI generation, no pricing, payment, refunds or ticket inventory in this venue module.

PANEL 01 caption "01 · Danh sách sân"
Page title "Sân & địa điểm", short subtitle "Quản lý địa điểm, hall và sơ đồ ghế". Right primary charcoal button with lime plus "Thêm sân". Compact count summary "12 địa điểm", "8 sẵn sàng", "4 cần thiết lập". Toolbar search "Tìm tên sân, địa chỉ..." and dropdowns "Thành phố", "Loại địa điểm", "Trạng thái". Two-column card grid of four venues: Thiên Trường ready, Thống Nhất ready, Nhà hát Hòa Bình draft, Công viên ngoài trời missing layout. Elegant diagram-like stadium/theater cover illustrations in monochrome with lime accents, NOT photographs. Each card has city, hall count, seat count and explicit status chips "Sẵn sàng", "Sơ đồ nháp", "Thiếu sơ đồ"; link "Quản lý sân". Missing card CTA "Thiết lập sơ đồ". No charts.

PANEL 02 caption "02 · Tạo / sửa thông tin sân"
Breadcrumb "Sân & địa điểm / Tạo sân". Page title "Tạo sân mới". Horizontal TWO-STEP progress "1 Thông tin sân" active, "2 Hall & sơ đồ ghế" upcoming. Main left form white card, right narrower setup checklist card. Form sections: "Loại địa điểm" with 3 selectable icon cards "Sân vận động", "Nhà hát", "Ngoài trời"; "Tên sân" filled Thiên Trường, city dropdown "Thành phố", "Quận / huyện", full width "Địa chỉ". Collapsible optional "Thông tin cho người mua" with opening hours, parking, rules summary. Optional maps link field "Liên kết Google Maps". Right checklist titled "Để sân sẵn sàng" lists Thông tin sân, Thêm hall, Nhập SVG, Phát hành. Fixed bottom action strip "Lưu và thoát" secondary and "Tiếp: Hall & sơ đồ" primary. Do not clutter with decorative maps.

PANEL 03 caption "03 · Hall & nhập sơ đồ"
Same two-step progress with step 2 active. Page "Hall & sơ đồ ghế". Left compact Hall list, "Khán đài chính" selected, "Nhà thi đấu", "+ Thêm hall". Main two-column panel: SVG upload dropzone on the left with icon, "Nhập sơ đồ SVG", "Kéo thả hoặc chọn tệp", "SVG · Tối đa 10 MiB", button "Chọn tệp SVG", name field "Tên phiên bản"; on right a spacious preview of a stadium seating diagram with a rectangular football pitch in center, labelled surrounding colored sections A1,A2,B1,B2,C1,C2,D1,D2 and many small seat dots. Uploaded file "thien-truong-v2.svg". Below preview simple import check result "8 khu được nhận diện", "2.400 ghế", status "Sẵn sàng nhập". Bottom primary "Nhập sơ đồ nháp". Show contextual helper link "Xem quy ước SVG". Import is distinct from publishing.

PANEL 04 caption "04 · Quản lý hall & phiên bản"
Page heading Thiên Trường, breadcrumb, city metadata. Header "Sửa thông tin sân" secondary and "Nhập SVG mới" primary. Left Hall list with hall counts and "+ Thêm hall". Main canvas large white panel, top version selector "Sơ đồ v2 · Bản nháp", compact "Đổi tên", "Tải CSV" secondary menu, "Phát hành" primary. Stadium SVG preview occupies most screen, distinct pastel sections lime, pale purple, pale blue and neutral outlines, green pitch; zoom +/− and fit controls, no editing tools. Right compact inspector "Khu A1", "Ghế ngồi", "12 hàng", "300 ghế"; small table beneath preview with columns "Mã khu", "Loại", "Sức chứa", 3 rows. Small version history area "v2 · Bản nháp" and "v1 · Đã phát hành". Clear note "Bản đã phát hành được khóa. Nhập SVG mới để tạo phiên bản tiếp theo." No sold/held seat status in venue configuration.

PANEL 05 caption "05 · Xác nhận phát hành"
Same screen dimmed behind a large centered accessible dialog, crisp typography. Dialog title "Phát hành sơ đồ v2?", summary "Khán đài chính · Thiên Trường", compact stats "8 khu" and "2.400 ghế". Neutral/lime callout "Sau khi phát hành, sơ đồ sẽ được khóa." Text "Muốn thay đổi ghế, hãy nhập SVG thành phiên bản mới." Additional small copy "Suất diễn đang dùng phiên bản cũ không bị ảnh hưởng." Secondary "Quay lại" and primary charcoal "Phát hành sơ đồ". No misleading irreversible financial wording.

PANEL 06 caption "06 · Hoàn tất & sẵn sàng"
Page title "Sân đã sẵn sàng", small lime success check inside rounded square, subtitle Thiên Trường. Main polished completion panel with four clean summary cells "2 Hall", "v2 Sơ đồ", "8 Khu", "2.400 Ghế". Below a compact read-only mini seat map preview with green/neutral sections. Status chip "Đã phát hành". Two strong clear CTAs "Tạo sự kiện tại sân này" primary and "Về danh sách sân" secondary. Supporting note "Có thể chọn sân và sơ đồ này khi tạo suất diễn."

Constraints: All six screens share exact visual system, layout, typography and venue naming. Fully within frame, no cropping. Vietnamese labels rendered accurately; concise, readable text over tiny filler paragraphs. Buttons and form fields must look shippable. No generic analytics, gradients, glassmorphism, neon glow, unrealistic 3D, extra feature promises. This is a collaborative proposal, not an implemented screenshot.
```
