# Đặc tả cải tiến quản lý sân và sơ đồ ghế

Ngày cập nhật: 2026-11-16.

Trạng thái: người dùng đã chốt bố cục demo và yêu cầu triển khai layout + sơ đồ ở local. A/B đã có code local nhưng chưa hoàn tất nghiệm thu tích hợp; thông tin mở rộng/F&B còn là đề xuất cần chốt contract. Kế hoạch công việc và tiêu chí bàn giao xem [venue-implementation-plan.md](venue-implementation-plan.md).

Frontend local: `D:/Luan_document/InternVSF/frontend/vingo-web`, nhánh `test/luannt`.

Backend local: `D:/Luan_document/InternVSF/backend/vingo-backend`. Checkout này có thay đổi chưa commit của người dùng; không chuyển nhánh, ghi đè hoặc trộn các thay đổi đó để làm task UI.

## Cập nhật mới nhất — một trang, bản đồ, AI gửi xe và PDF

Yêu cầu bổ sung ngày 2026-11-16 được mô tả chi tiết trong [venue-map-ai-pdf-requirements.md](venue-map-ai-pdf-requirements.md) và ưu tiên hơn các đoạn cũ về tab/wizard/form địa chỉ:

- Toàn bộ cấu hình trong **một trang/tab**, bỏ chuyển sang bước hoặc tab thứ hai.
- **Nhập SVG xuất từ Figma đặt đầu tiên**; chọn file hợp lệ render preview sân/ghế ngay. Vùng sơ đồ vẫn chỉ gồm canvas và danh sách khu, không có cột Hall/phiên bản.
- Bộ nhập thành phố/quận/địa chỉ thay bằng bản đồ OSM với ô tìm kiếm/gợi ý ở phía trên; chọn điểm hoặc kết quả tìm kiếm. Bỏ ô nhập lat/lng, vẫn lưu tọa độ phía sau.
- Chọn bãi xe trên bản đồ, AI tự soạn hướng dẫn nháp từ dữ kiện có nguồn; có cấu hình LLM cho admin. Giá/giờ/khoảng cách chưa xác minh không được tự bịa.
- Nội quy nhập bằng PDF, giữ file gốc và quy tắc xử lý/trích xuất được chốt ở contract.
- Thông tin sân, gửi xe, PDF và F&B thành các section cùng trang; không còn tab riêng bắt buộc.
- Giữ versioning và quy tắc khóa PUBLISHED ở backend. Preview trước lưu không đồng nghĩa tự phát hành.
- Nominatim công cộng không hỗ trợ mô hình autocomplete này; chọn geocoder OSM có quyền dùng autocomplete hoặc dịch vụ riêng theo tài liệu bổ sung.
- Các yêu cầu mới trên **chỉ được cập nhật vào docs, chưa được triển khai**. Code local hiện tại vẫn phản ánh bản hai vùng với các tab từ vòng trước; ảnh/demo cũ không mô tả đầy đủ yêu cầu mới.

## 1. Yêu cầu và điểm chưa chốt

### Đã được người dùng yêu cầu

- Layout phải phục vụ quản lý: gọn, thấy được thông tin, sơ đồ và bảng khu trong cùng màn desktop.
- Thu nhỏ chỉ hiện zone; ghế chỉ xuất hiện khi zoom đủ gần hoặc mở một zone.
- Lăn chuột để zoom; có thể bấm zone để xem chi tiết ghế.
- Cổng, lối đi và hướng Bắc/Đông/Nam/Tây được định nghĩa trong SVG xuất từ Figma, không vẽ cứng trong UI thật.
- Cụm số liệu Khu / Ghế ngồi / Chỗ đứng cần tách rõ, số lớn dễ đọc. Không đặt chữ Sân thi đấu hoặc Đường chạy điền kinh lên bản vẽ; giữ màu phân biệt.
- Chỉ mặt sân thi đấu hình chữ nhật có màu xanh cỏ, vạch trắng. Vùng oval bao ngoài là đường chạy điền kinh, không tô xanh chung với sân thi đấu.
- Hiển thị địa chỉ, sức chứa và bổ sung thông tin sân hữu ích.
- Có danh sách cơ sở F&B trong sân.
- Một trang cấu hình: SVG đầu tiên, chọn vị trí sân/bãi xe trên bản đồ, AI gửi xe và PDF nội quy; chi tiết theo tài liệu bổ sung mới nhất.
- Giữ công việc ở local để cùng chỉnh và duyệt.

### Đề xuất cần giữ rõ khi triển khai

- Màu đường chạy đỏ gạch là đề xuất của trợ lý; người dùng đã xác nhận chức năng đường chạy nhưng chưa chọn mã màu cụ thể.
- Ngưỡng đổi zone/ghế, vị trí chi tiết ghế và cách bố trí trên tablet sẽ chốt qua bản local.
- Các trường F&B, tiện ích, liên hệ bên dưới là schema đề xuất, chưa có trong API đã kiểm tra.
- V03 chỉ minh họa bố cục. Ảnh còn tô xanh toàn vùng oval và có mã khu minh họa; không dùng ảnh làm nguồn hình học hoặc dữ liệu thật.
- Không tự sửa dữ liệu địa chỉ theo tên sân: hiển thị đúng dữ liệu API. Ví dụ ảnh đang có mã thành phố HN dù tên sân có thể gợi địa danh khác.

## 2. Có thể sửa layout trước không?

**Có. Triển khai theo ba phần độc lập.**

| Phần                  | Làm gì                                                                                          | Phụ thuộc backend                                            | Kết quả có thể duyệt                     |
| --------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| A — Layout            | Header gọn, thông tin hiện có, hai vùng sơ đồ sân / danh sách khu; section thông tin cùng trang | Phần cũ không đổi API; map/AI/PDF cần contract mới           | UI local ghi rõ phạm vi đã nối API       |
| B — Sơ đồ             | Zoom bằng wheel, pan, đổi mức chi tiết, màu sân/đường chạy                                      | Không đổi API nếu SVG đủ định danh; cần kiểm tra SVG thực tế | Tương tác local trên SVG nhiều nghìn ghế |
| C — Thông tin mở rộng | F&B, tiện ích, tiếp cận, liên hệ, audit                                                         | Cần thống nhất contract, lưu trữ, phân quyền                 | Form và API hoạt động, không chỉ mock    |

Ở phần A không hiển thị số F&B bịa đặt, không cho nút Lưu tạo cảm giác dữ liệu mới đã được lưu. Mock F&B để duyệt riêng phải được ghi rõ là dữ liệu minh họa và chỉ bật trong chế độ mock.

## 3. Hiện trạng lúc lập đặc tả và hướng xử lý

| Vị trí                                           | Hiện trạng quan sát                                                                                                                       | Việc cần làm                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/features/admin-catalog/HallLayoutsPage.tsx` | Panel Hall, panel sơ đồ; bảng khu nằm bên dưới; khung map cao cố định 330px; Đổi tên hiện cả khi đã publish                               | Tách vùng dữ liệu, chuyển bảng sang cạnh sơ đồ; bổ sung trạng thái khóa; không mở đổi tên PUBLISHED |
| `src/features/admin-catalog/VenueHalls.tsx`      | Gộp chọn Hall, tạo Hall, sửa sân và xóa sân trong cùng panel                                                                              | Bỏ panel Hall khỏi màn mới; đưa thao tác sân lên header/menu; giữ xác nhận xóa hiện có              |
| `src/features/admin-catalog/VenueDetailPage.tsx` | Bọc HallLayoutsPage                                                                                                                       | Giữ entry point; chỉ đổi nếu cần cấu trúc tab                                                       |
| `src/features/admin-catalog/VenueWizardPage.tsx` | Hai bước thông tin sân và Hall/SVG                                                                                                        | Đồng bộ bố cục, trạng thái, component nhập SVG sau khi màn quản lý được duyệt                       |
| `src/features/admin-catalog/VenuesPage.tsx`      | Danh sách sân, lọc trạng thái dựa trên layout từng Hall                                                                                   | Đồng bộ nhãn và summary, không nhầm số ghế của các phiên bản                                        |
| `src/seatmap/SeatMapView.tsx`                    | Có zoom bằng nút/phím, pan, focus; chưa có wheel; tổng quan vẫn hiện nội dung ghế; bounds toàn cảnh/minimap đang cố định theo một mẫu sân | Bổ sung wheel, mức chi tiết; bounds theo SVG; tách chế độ xem admin khỏi trạng thái bán vé          |
| `src/seatmap/seatmap.css`                        | Override PITCH sang xám; ẩn stripe; mọi path trong PITCH bị áp fill chung                                                                 | Tô đúng phần sân thi đấu, giữ đường chạy riêng; tránh selector quá rộng                             |
| `src/seatmap/geometry.ts`, `svg.ts`              | Có hàm zoom, pan, parse/index SVG, làm sạch SVG                                                                                           | Tái sử dụng; bổ sung logic bounds/mức chi tiết khi cần; giữ sanitizer                               |

`SeatMapView` dùng chung cho buyer, chat và admin. Không thay đổi hành vi chọn ghế của buyer chỉ để phục vụ màn cấu hình sân.

Cập nhật triển khai: màn cấu hình sân hiện dùng `VenueMapView.tsx` và `venueMapGeometry.ts` riêng trong `features/admin-catalog`, với CSS `venue-console.css`. `SeatMapView`/CSS dùng chung của buyer chưa bị thay đổi. Bảng trên mô tả điểm xuất phát, không có nghĩa mọi dòng vẫn chưa làm. Việc còn lại được theo dõi trong kế hoạch triển khai.

## 4. Cấu trúc màn quản lý đề xuất

### 4.1. Header và thông tin tóm tắt

- Breadcrumb: Sân & địa điểm / Tên sân.
- Tên sân cỡ vừa, loại địa điểm và trạng thái cấu hình.
- Hiển thị tóm tắt vị trí đã chọn bằng search/map OSM; không đặt bộ nhập địa chỉ thủ công hoặc input lat/lng. Dữ liệu nguồn/contract theo tài liệu bổ sung.
- Nút Sửa thông tin sân; **Nhập SVG xuất từ Figma** đặt trong section đầu trang và cho preview ngay khi chọn file hợp lệ.
- Xóa sân nằm trong menu thao tác, giữ dialog xác nhận và điều kiện backend.
- Bỏ phần metadata dạng kỹ thuật như `// VENUE · STADIUM · HN` khỏi vị trí thông tin chính; đổi thành nhãn tiếng Việt.
- Summary gọn: số khu; ghế ngồi; chỗ đứng; sức chứa của sơ đồ đang hiển thị. Không thêm chỉ số Hall vào bố cục mới. Phạm vi dữ liệu phải rõ, metadata cấu hình ghi trong phần thông tin chi tiết khi cần.

### 4.2. Section Sơ đồ sân đầu trang — chỉ hai vùng

Desktop rộng: hai vùng cùng hàng, không có cột Hall hoặc phiên bản.

| Vùng          | Nội dung                                              | Kích thước gợi ý                  |
| ------------- | ----------------------------------------------------- | --------------------------------- |
| Sơ đồ sân     | Tên sơ đồ, trạng thái khóa, zoom, canvas và chú thích | Co giãn, chiếm phần lớn diện tích |
| Danh sách khu | Tìm/lọc khu, bảng khu, chi tiết khu/ghế               | Khoảng 300–380px                  |

- Toolbar cao khoảng 36–40px, tiêu đề trang khoảng 24–28px; dùng token hệ thống khi triển khai.
- Không render rail Hall, nút Thêm Hall, lịch sử phiên bản hoặc bộ chọn phiên bản. Không thay bằng sidebar thu gọn ở viewport khác.
- Giữ trạng thái DRAFT / PUBLISHED cần cho vận hành: DRAFT có thể đổi tên/phát hành khi hợp lệ; PUBLISHED hiển thị Đã khóa. Không đặt thao tác chỉnh sửa lên bản đã khóa.
- Nút nhập luôn có nhãn **Nhập SVG xuất từ Figma**; phụ đề hướng dẫn xuất file SVG từ Figma theo quy ước Vingo. Không yêu cầu kết nối tài khoản Figma hoặc tự thêm plugin import Figma.
- File từ Figma vẫn phải qua sanitizer, kiểm tra ID zone/seat và giới hạn 10 MiB. Nguồn xuất Figma không đồng nghĩa file hợp lệ.
- Mỗi lần nhập vẫn tạo cấu hình nháp mới theo contract, không ghi đè sơ đồ PUBLISHED hay ảnh hưởng suất đã gắn bản cũ.
- Hall/layout ID được truyền theo ngữ cảnh route hoặc cấu hình đã xác định. Với sân có nhiều Hall mà route chưa chỉ rõ sơ đồ: cần chốt quy tắc chọn cấu hình trước khi nối dữ liệu thật; không âm thầm lấy Hall đầu tiên, không ghép nhiều sơ đồ vào một sân giả.
- Khi ngữ cảnh layout thay đổi, xóa focus khu/ghế cũ và tải đúng dữ liệu; không trộn ID giữa cấu hình.
- Khung sơ đồ dùng chiều cao còn lại trong viewport, có min/max thích hợp thay vì phình theo SVG.
- Bảng khu có cột mã/tên, loại tiếng Việt, sức chứa; mã SVG chuyển vào chi tiết khu thay vì chiếm cột dài.
- Chọn hàng bảng và chọn zone trên canvas phải đồng bộ.
- Xuất CSV dùng hai operation hiện có; có thể gom thành menu Xuất CSV → Khu / Ghế.
- Không làm mới toàn trang khi lọc/search bảng. Phân trang phía UI chỉ phân trang dữ liệu đã tải.
- Giữ loading/error độc lập: lỗi tải SVG không làm mất danh sách khu đã tải được.

### 4.3. Các section thông tin trong cùng trang

- Không dùng tab Thông tin sân hoặc F&B để tách thao tác sang màn thứ hai.
- Dưới section SVG: thông tin cơ bản → vị trí sân bằng map/search → chọn bãi xe và nháp AI → PDF nội quy → tiện ích/F&B khi API sẵn sàng.
- Địa chỉ hiển thị từ kết quả lựa chọn; giá trị lat/lng tồn tại trong data nhưng không là ô nhập UI.
- Chức năng mới về maps, parking/LLM và PDF cần contract và lưu trữ được chốt; không ghi mock thành dữ liệu đã lưu thật.
- Khi lưu phải bảo toàn dữ liệu cũ và cho biết section nào đã lưu/thất bại, không mất file/marker/nháp do lỗi bước khác.

### 4.4. Responsive

- Desktop rộng: hai vùng sơ đồ sân và danh sách khu; thanh điều hướng toàn app chỉ thay đổi bằng chế độ compact có phạm vi rõ ràng, không thu nhỏ toàn bộ typography của các màn khác.
- Laptop hẹp/tablet: sơ đồ và bảng xếp hai hàng khi cần, không buộc chuyển tab; không thêm lại Hall/phiên bản.
- 360px: header/action xuống hàng, nút Nhập SVG xuất từ Figma có thể xuống dòng; sơ đồ có chiều cao dùng được; bảng có scroll nội bộ, không làm tràn toàn trang; không có selector Hall/phiên bản.
- Tránh nhiều thanh cuộn lồng nhau và CTA bị Copilot che. Khi dùng region cuộn riêng, có nhãn và truy cập bằng bàn phím.

## 5. Zoom và mức chi tiết sơ đồ

### 5.1. Chế độ tổng quan

- Hiện hình zone, nhãn, ranh giới, sân bóng, đường chạy và các thành phần nền hợp lệ.
- Ẩn hình ghế và vùng tương tác của ghế. Không chỉ giảm opacity vì ghế ẩn vẫn có thể bắt click.
- Không ẩn cả group CONTENT một cách mù quáng: group có thể chứa cổng, nhãn hoặc lối đi cần giữ.
- Khi cần, tạo chế độ hiển thị admin riêng; không dùng nhãn AVAILABLE/HELD/SOLD để mô tả cấu hình sân.

### 5.2. Zoom bằng wheel và nút

- Wheel chỉ được xử lý khi con trỏ nằm trên canvas. Ngăn scroll mặc định trong vùng zoom bằng listener có `passive: false`; ngoài canvas trang vẫn cuộn bình thường.
- Neo điểm zoom vào vị trí con trỏ sau khi chuyển đúng sang tọa độ SVG, tính cả letterbox, viewBox và transform.
- Chuẩn hóa deltaMode của wheel; trackpad không nhảy zoom quá mạnh; giới hạn min/max theo geometry.
- Hủy animation đang chạy khi wheel/pan trực tiếp để khung nhìn không bị giật ngược.
- Có nút +, −, Vừa khung, chỉ báo zoom; giữ hỗ trợ bàn phím +/−/0 và mũi tên.
- Vừa khung đưa về toàn cảnh và xóa focus khu; có thể có thêm nút Vừa khu nếu cần nhưng tên phải phân biệt.
- Kéo để pan, không nhận click nhầm sau khi kéo; hỗ trợ pointer capture/cancel để không mắc trạng thái drag.

### 5.3. Hiện ghế theo zoom hoặc mở zone

- Bấm zone/hàng bảng sẽ fit vào zone đó và hiện ghế của zone; khu đứng chỉ hiện thông tin sức chứa.
- Zoom gần bằng wheel phải hiện ghế trong vùng nhìn thấy dù người dùng chưa bấm zone.
- Ngưỡng dựa trên kích thước ghế/zone thực trên màn hình; dùng hai ngưỡng vào/ra để tránh nhấp nháy ở ranh giới.
- Dữ liệu ghế chỉ tải cho khu cần xem; cache theo layoutId + zoneId, reset đúng khi đổi phiên bản.
- Nếu dữ liệu chi tiết ghế chưa tải xong, có trạng thái tải; không suy diễn thành ghế bị khóa/bán hết.
- Khi thu nhỏ xuống ngưỡng tổng quan, ẩn ghế, kết thúc chi tiết ghế và khôi phục khả năng chọn zone. Có thể giữ hàng khu đang chọn để người dùng không mất ngữ cảnh.
- Bấm ghế ở màn quản lý cấu hình chỉ mở mã, hàng, số và loại nếu API có; không giữ ghế, không bán vé, không thay đổi trạng thái booking.
- Không chèn lại hàng nghìn node SVG vào mỗi wheel event. Dùng requestAnimationFrame, ref và cập nhật theo lần đổi mức chi tiết; cleanup listener/animation khi unmount.

### 5.4. Sân thi đấu và đường chạy

- Chỉ hình chữ nhật mặt sân xanh cỏ, stripe xanh khác sắc độ nếu SVG có; vạch biên/giữa sân/khu phạt đền trắng.
- Đường chạy là vành bao quanh sân, đề xuất đỏ gạch với vạch phân làn sáng; không đổi thành xanh theo selector chung.
- Lối đi, khán đài và PITCH_SIDE không mặc định được coi là sân bóng hoặc đường chạy.
- SVG hiện có nhóm PITCH, pitch_infield, pitch_stripe và các path đường kẻ; phải xác định đúng ranh giới hình thi đấu từ SVG thực tế trước khi đổi màu.
- Không sửa tọa độ, scale hay vị trí ghế để khớp ảnh AI. Nếu SVG thiếu lớp đường chạy/định danh thì cần xác nhận quy ước hoặc sửa asset nguồn; không tự đoán bằng màu fill gốc.
- Chỉ áp cách tô sân bóng cho STADIUM có cấu trúc tương ứng; THEATER giữ STAGE và OUTDOOR không bị vẽ thêm sân bóng.
- Màu khai báo bằng token, ưu tiên scope admin trước để kiểm tra hồi quy trên component dùng chung.

### 5.5. Cổng ra/vào, lối đi và hướng — nguồn từ SVG Figma

**Quyết định đã được người dùng xác nhận:** bản thật lấy cổng từ SVG xuất từ Figma. Bốn cổng Bắc/Đông/Nam/Tây do JavaScript vẽ trong demo chỉ phục vụ duyệt bố cục, không phải cấu trúc cố định cho mọi sân.

| Thành phần               | Trách nhiệm Figma / SVG                                   | Trách nhiệm UI                                                     |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------ |
| Cổng                     | Vị trí, hình dạng, mã định danh và nhãn cổng theo thực tế | Đọc, hiển thị; focus/tooltip hoặc thông tin khi bấm nếu có dữ liệu |
| Lối đi                   | Hình học, lối nối cổng với khu và nhãn cần thiết          | Giữ đúng tọa độ và khả năng nhìn thấy qua các mức zoom             |
| Hướng                    | Nhãn hoặc ký hiệu phương hướng được xác nhận trong bản vẽ | Hiển thị theo bản vẽ; không tự suy ra phía trên là Bắc             |
| Sân thi đấu / đường chạy | Hình học, màu nền, vạch và ranh giới lớp                  | Tôn trọng dữ liệu SVG; không ghi đè cả vùng oval thành màu xanh    |
| Trạng thái tương tác     | Không phải dữ liệu tĩnh từ Figma                          | Hover, focus, highlight khu/cổng, zoom và pan                      |

#### Quy ước hiện có đã kiểm tra trong source

- `src/seatmap/svg.ts` nhận ID cổng theo mẫu `GATE__<...>__<số>`.
- `indexSvg()` đang gắn cổng với khu thông qua ancestor `CONTENT__<mã khu>`; ví dụ cổng `GATE__A1-T1__01` đặt trong `CONTENT__A1-T1`.
- Parser hiện trả danh mục số cổng theo khu; **chưa cung cấp thuộc tính hướng địa lý hoặc mô hình liên kết đầy đủ cổng → lối đi → nhiều khu**.
- Tên Cổng Bắc/Đông/Nam/Tây là nhãn hiển thị, không được coi là enum hướng mà parser đã hiểu. Không tự thay ID bằng `GATE__NORTH` vì không khớp quy ước hiện tại.
- Cổng chung cho nhiều khu hoặc nằm ngoài CONTENT cần thống nhất bổ sung quy ước và parser trước khi dùng tính năng tra cứu; bản vẽ nền hiển thị được không có nghĩa UI đã index được cổng đó.

#### Quy tắc khi triển khai

1. Số lượng, vị trí cổng phải theo từng SVG; không bắt buộc mỗi sân có đúng bốn cổng.
2. Mã cổng phải duy nhất trong SVG. Đổi hướng hoặc tên cổng trong Figma không được tự ý phá liên kết ID đang được hệ thống dùng.
3. Giữ vị trí cổng/lối đi khi zoom, pan và đổi mức chi tiết. Ẩn ghế không đồng nghĩa ẩn cổng hoặc đường đi.
4. Không suy ra phương hướng từ tọa độ màn hình, tên sân, màu fill hoặc số thứ tự cổng. Nếu bản vẽ không có hướng được xác nhận thì không tự thêm nhãn hướng.
5. UI có thể tạo lớp tương tác cho cổng từ phần tử SVG được nhận diện, nhưng không tự tạo cổng mới hay đặt lại tọa độ cho đẹp bố cục.
6. Bản demo có thể hiện thông tin minh họa khi bấm cổng. Bản thật chỉ hiện nội dung có nguồn, không suy diễn khả năng tiếp cận xe lăn, đường thoát hiểm hoặc tình trạng mở cổng từ hình vẽ.
7. Nếu cần metadata như hướng, loại lối vào/ra, trạng thái vận hành hoặc liên kết API, phải định nghĩa schema, sanitizer allowlist, parser và contract tương ứng trước; không tự thêm thuộc tính rồi mặc định hệ thống đã đọc được.
8. Kiểm thử SVG xuất thực tế từ Figma: giữ ID sau export, group/transform, nhãn và lớp cổng không bị sanitizer loại bỏ hoặc làm sai vị trí.

#### Khác biệt giữa demo và bản thật

- `venue-layout-demo.html`: bốn cổng/lối đi được tạo bằng code để thử bố cục và gắn nhãn minh họa.
- UI sản phẩm sau khi triển khai: đọc cổng/lối đi trong SVG đã nhập; không mang danh sách tọa độ và mảng bốn hướng từ demo vào component thật.
- Bố cục demo đã được chốt và người dùng đã yêu cầu triển khai A/B ở local. Schema dữ liệu mới và nghiệm thu tổng thể vẫn chưa hoàn tất; việc chốt bố cục không thay thế duyệt contract/API.

## 6. Nguồn dữ liệu và sức chứa

| Thông tin                                | Nguồn đã có                                         | Xử lý                                                                                           |
| ---------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Tên, loại, địa chỉ, city, district       | Venue                                               | Hiển thị ngay; loại/city có nhãn tiếng Việt                                                     |
| Tọa độ                                   | Venue.lat/lng                                       | Mở link bản đồ hợp lệ, không nhúng bản đồ nếu chưa cần                                          |
| Giờ mở cửa, gửi xe, nội quy (dữ liệu cũ) | Venue.info.opening_hours / parking / rules          | Tiếp tục đọc dữ liệu cũ; gửi xe AI và PDF nội quy theo yêu cầu mới, không tự xóa dữ liệu legacy |
| Hall                                     | Venue.halls                                         | Quan hệ kỹ thuật, không tạo selector Hall trong layout mới                                      |
| Phiên bản, DRAFT/PUBLISHED, published_at | SeatLayout                                          | Hiển thị trạng thái cấu hình và ngày khi cần; không tạo lịch sử/dropdown phiên bản              |
| Số khu, số ghế                           | SeatLayout.zone_count / seat_count; layout detail   | Ghi rõ phạm vi và trạng thái, không tự hardcode 27/6.699                                        |
| Sức chứa chỗ đứng                        | zones.kind + capacity                               | Tổng các zone STANDING trong đúng một layout                                                    |
| Tổng sức chứa cấu hình                   | Tổng zones.capacity trong một layout                | Bao gồm ngồi/đứng; không đánh đồng seat_count với tổng capacity                                 |
| Tiện ích, tiếp cận, F&B, liên hệ quản lý | Chưa thấy schema tường minh trong Venue đã kiểm tra | Phần C                                                                                          |
| Người/thời gian sửa sân                  | Chưa thấy trong Venue                               | Chỉ hiện khi có nguồn audit/API, không lấy giờ máy                                              |

Sức chứa của venue chưa có một trường chuẩn trong contract hiện tại. Phần A hiển thị `Sức chứa sơ đồ đang hiển thị`; ngữ cảnh Hall/layout được giữ trong dữ liệu và phần thông tin kỹ thuật, không dựng panel Hall/phiên bản. Nếu cần tổng toàn sân, phải chọn đúng một layout PUBLISHED của mỗi Hall theo quy tắc đã thống nhất và kiểm tra các Hall có chồng lặp không. Không cộng mọi phiên bản hay suy ra sức chứa pháp lý/an toàn từ sơ đồ bán vé.

## 7. Thông tin sân mở rộng — đề xuất

| Nhóm             | Trường                                     | Quy tắc dự kiến                                                 |
| ---------------- | ------------------------------------------ | --------------------------------------------------------------- |
| Tiếp cận         | Mô tả cổng vào, lối tiếp cận xe lăn        | Chuỗi mô tả có giới hạn; không tự suy ra từ loại ghế WHEELCHAIR |
| Tiện ích         | Nhà vệ sinh, mái che, gửi xe, quầy dịch vụ | Phân biệt Không có / Có / Chưa cập nhật                         |
| Hướng dẫn        | Quy định vật dụng, lưu ý vào sân           | Có thể dùng info.rules hiện có nếu đúng nghĩa                   |
| Liên hệ vận hành | Tên người/bộ phận, điện thoại/email nội bộ | Chỉ ADMIN; không đưa vào API public hoặc UI buyer theo mặc định |
| Audit            | Người sửa, ngày sửa                        | Sinh từ backend, chỉ đọc                                        |

Không tự thêm key vào `info` chỉ vì input đang là object mở: cần định nghĩa schema, validation, quyền đọc và ý nghĩa trước khi lưu.

## 8. Cơ sở F&B trong sân — đề xuất dữ liệu

### 8.1. Các trường

| Trường đề xuất          | Bắt buộc     | Ý nghĩa / validation cần thống nhất                                                                      |
| ----------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| id                      | Backend sinh | Định danh ổn định cho từng cơ sở                                                                         |
| venue_id                | Có           | Sân sở hữu; lấy từ route/use case được phân quyền                                                        |
| hall_id                 | Không        | Chỉ nhận Hall thuộc venue; null nghĩa phục vụ chung                                                      |
| zone_code / zone_id     | Không        | Chỉ thêm liên kết thật nếu thống nhất phạm vi version; không mặc định gắn cứng vào zoneId của một layout |
| name                    | Có           | Tên quầy/cơ sở, trim, đề xuất tối đa 200 ký tự                                                           |
| category                | Có           | Đề xuất BEVERAGE / FOOD / CONVENIENCE / OTHER; cần chốt enum và nhãn                                     |
| location_description    | Có           | Ví dụ Khán đài A, tầng 1, gần cổng A2; đề xuất tối đa 500 ký tự                                          |
| operating_mode          | Có           | Đề xuất EVENT_BASED / FIXED_HOURS                                                                        |
| opening_hours           | Theo mode    | Chuỗi hướng dẫn giờ hoạt động, không giả lập đang mở theo đồng hồ khi chưa có lịch chuẩn                 |
| status                  | Có           | Đề xuất ACTIVE / TEMPORARILY_CLOSED; nghĩa đang khai thác, không khẳng định đang mở ngay lúc này         |
| description             | Không        | Mặt hàng chính, lưu ý phục vụ; đề xuất tối đa 2.000 ký tự                                                |
| updated_at / updated_by | Backend sinh | Phục vụ quản lý nếu contract có                                                                          |

Liên kết F&B với zone phải xử lý khi nhập phiên bản SVG mới: mã khu có thể đổi hoặc biến mất. Bản đầu ưu tiên Hall + mô tả vị trí, không hứa định vị quầy trên map khi chưa có dữ liệu vị trí.

### 8.2. UI và thao tác

- Mục Cơ sở F&B thành section trong cùng trang cấu hình sân; bảng gồm tên, loại hình, Hall/vị trí, giờ phục vụ, trạng thái và menu thao tác.
- Tìm theo tên/vị trí, lọc Hall/loại/trạng thái. Các bộ lọc dùng đúng phạm vi dữ liệu đã tải; nếu API phân trang thì không lọc cục bộ rồi tuyên bố kết quả toàn bộ.
- Form Thêm/Sửa có nhãn rõ, thông báo lỗi cạnh trường và trạng thái đang lưu; ngăn submit lặp.
- Tóm tắt dùng `6 cơ sở · 4 đang khai thác`, tránh dùng `4 đang mở` nếu không có lịch hoạt động theo thời gian thực.
- Loading, lỗi tải, danh sách rỗng và không có kết quả lọc là bốn trạng thái khác nhau.
- Xóa cần chốt soft-delete hay hard-delete, ràng buộc và audit trước khi có nút hoạt động; dialog nêu chính xác khả năng khôi phục. Không giả định xóa là reversible.
- Không thêm menu món, tồn kho, đặt đồ ăn, thanh toán hoặc hoàn tiền trong phạm vi này.

### 8.3. Backend và contract

1. Thiết kế trong module catalog (chủ Luân); xác nhận với chủ frontend Danh/Đức khi thay đổi module/hạ tầng theo CLAUDE.md.
2. Đề xuất resource F&B của venue dưới nhóm API admin; tên route/operation chưa chốt, không tự thêm endpoint vào controller trước contract.
3. PR contract trong `vingo-backend/contracts/vingo-openapi.yaml` theo quy định Đức duyệt: schema, request/response, quyền ADMIN, phân trang, validation, ví dụ lỗi và quy tắc xóa.
4. Quyết định bảng riêng hay cấu trúc info dựa trên yêu cầu CRUD, lọc, audit; khuyến nghị bảng riêng khi cần quản lý từng cơ sở. Đây là đề xuất, chưa phải migration đã duyệt.
5. Nếu bảng riêng: migration mới, UUID theo quy ước dự án, FK venue/Hall, CHECK enum và giới hạn hợp lệ; xác định hành vi xóa venue/Hall, không cascade mất dữ liệu ngoài ý muốn.
6. Backend kiểm tra Hall thuộc sân, quyền ADMIN, dữ liệu hợp lệ; trả ProblemDetail với code đúng contract. Không tin quan hệ venue/Hall chỉ vì UI đã lọc.
7. Đồng bộ contract frontend qua workflow/version ghim; sinh client bằng Orval. Không sửa tay bản copy contract hoặc generated client.
8. Xác định dữ liệu nào có thể công khai cho buyer; danh bạ liên hệ nội bộ và audit không được tự đi theo response public.

## 9. Danh sách file dự kiến thay đổi

| File/nhóm                                                             | Phần           | Nội dung                                                                                                                        |
| --------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| HallLayoutsPage.tsx, VenueHalls.tsx, VenueDetailPage.tsx              | A              | Cấu trúc trang, scope state Hall/layout/zone, giữ mutation hiện có                                                              |
| Component mới trong features/admin-catalog                            | A/C            | VenueSummary, VenueInfoPanel, LayoutToolbar, ZoneTable/ZoneInspector, bảng và form F&B; tên cuối cùng theo phạm vi dùng thực tế |
| design/admin/admin.css hoặc stylesheet riêng cho venue                | A              | CSS scope màn sân; ưu tiên riêng thay vì đổi mọi admin page                                                                     |
| app/AdminLayout.tsx, AdminUi.tsx                                      | A, chỉ nếu cần | Chế độ compact có opt-in; phải kiểm tra ảnh hưởng các màn còn lại                                                               |
| VenueWizardPage.tsx, CatalogForms.tsx, VenuesPage.tsx                 | Sau A          | Đồng bộ form/nhãn và luồng trở lại danh sách                                                                                    |
| VenueMapView.tsx, venueMapGeometry.ts; seatmap/svg.ts khi thật sự cần | B              | Viewer admin riêng: wheel, detail mode, bounds, hit testing; giữ màu SVG nguồn, không sửa buyer chỉ để phục vụ admin            |
| src/index.css                                                         | B, nếu cần     | Token pitch, track, line theo hệ thống màu                                                                                      |
| mocks/adminCatalog.ts, adminFixtures.ts và fixture SVG                | A/B/C          | Dữ liệu kiểm thử và trạng thái mới; không thay production data                                                                  |
| Test cạnh helper/component được sửa                                   | A/B/C          | Kiểm chứng các hành vi bên dưới                                                                                                 |
| Backend catalog, contracts, migration, integration tests              | C              | Chỉ làm sau khi chốt contract; không sửa generated Java                                                                         |

## 10. Thứ tự triển khai và bàn giao

Các bước dưới là phân kỳ chức năng ban đầu. Để biết trạng thái hiện tại, việc còn thiếu và cổng nghiệm thu từng giai đoạn, xem [kế hoạch chi tiết](venue-implementation-plan.md). Yêu cầu mới một trang/maps/AI/PDF được chia U1–U4 trong [tài liệu bổ sung](venue-map-ai-pdf-requirements.md); phần đó thay thế luồng tab và wizard hai bước trước đây.

### A — Layout có thể bắt đầu trước

1. Giữ API/route hiện có, tách header và summary từ dữ liệu thật.
2. Tạo bố cục hai vùng Sơ đồ sân — Danh sách khu, toolbar, trạng thái khóa và empty/error; gỡ cột Hall/phiên bản.
3. Hợp nhất thông tin sân thành section cùng trang; giữ thao tác sửa sân, Nhập SVG xuất từ Figma, phát hành bản nháp và CSV; không đặt Thêm Hall trong màn mới.
4. Xử lý 360px và laptop, kiểm tra focus/tab order.
5. Duyệt local bố cục trước khi mở rộng dữ liệu.

### B — Sơ đồ

1. Chốt cách xác định pitch/track/zone/content từ SVG thật.
2. Sửa màu đúng lớp và bounds phù hợp từng SVG, thay hardcode bounds toàn cảnh/minimap.
3. Thêm wheel/pan, đổi mức chi tiết và đồng bộ zone/ghế với inspector.
4. Kiểm tra bằng SVG khoảng 6.699 ghế và các SVG khác; không dùng ảnh mock làm SVG nguồn.

### C — Dữ liệu mở rộng

1. Chốt trường thông tin sân và schema F&B, quyền public/admin và quy tắc xóa.
2. Contract → migration/service/controller → integration tests → sinh client → UI → kiểm tra local với backend thật.
3. Duyệt hành vi lưu thực tế; dữ liệu mock phải được tách rõ.

Commit chia theo A, B, C để dễ review. Theo yêu cầu hiện tại chỉ giữ local; không tự push hoặc deploy.

## 11. Tiêu chí nghiệm thu

### Layout và dữ liệu

- [ ] Màn desktop chỉ có hai vùng sơ đồ sân và danh sách khu; nhìn thấy các hàng đầu bảng cùng sơ đồ, không phải cuộn qua map để tìm bảng.
- [ ] Địa chỉ và sức chứa hiện đúng scope; không cộng trùng phiên bản; giá trị chưa có hiển thị Chưa cập nhật.
- [ ] Không có cột/tab Hall, lịch sử phiên bản hoặc dropdown phiên bản ở desktop và mobile; thay ngữ cảnh layout không giữ zone/ghế cũ.
- [ ] DRAFT có đổi tên/phát hành; PUBLISHED khóa chỉnh sửa; nhập mới không làm thay đổi phiên bản đã dùng cho suất.
- [ ] Nhãn Nhập SVG xuất từ Figma xuất hiện đúng; SVG sai quy ước/quá 10 MiB và API lỗi được hiển thị đúng; không mất dữ liệu form khi lỗi.
- [ ] CSV xuất đúng layout và loại Khu/Ghế; không thay chức năng đang có.
- [ ] 360px không tràn toàn trang; nút quan trọng không bị che; tương tác dùng được bằng bàn phím.

### Sơ đồ

- [ ] Tổng quan không hiện ghế; wheel/bấm zone mở chi tiết; zoom lùi trở lại zone-only.
- [ ] Zoom neo đúng con trỏ, có giới hạn; pan không gây click nhầm, pointercancel không mắc kéo.
- [ ] Chọn zone trên map/bảng đồng bộ, ghế ẩn không nhận click; STANDING không hiển thị ghế giả.
- [ ] Chỉ sân thi đấu xanh; đường chạy riêng; THEATER/OUTDOOR không bị tô sai.
- [ ] Cổng và lối đi lấy từ SVG Figma, không hardcode bốn hướng; SVG không có hướng không bị UI tự gắn hướng.
- [ ] Cổng giữ đúng vị trí sau zoom/pan; ẩn ghế không làm mất cổng/lối đi; ID và liên kết khu được kiểm chứng qua export và sanitize.
- [ ] Không có chữ Sân thi đấu / Đường chạy điền kinh trên mặt bản vẽ; số liệu Khu / Ghế ngồi / Chỗ đứng dễ phân biệt.
- [ ] UI cấu hình không gọi hold/payment hoặc sửa tồn kho ghế.
- [ ] Không tụt tương tác rõ rệt với sơ đồ nhiều nghìn ghế; không chèn lại toàn SVG mỗi wheel event; reduced motion và cleanup hoạt động.
- [ ] Regression buyer/chọn ghế/chat/check-in liên quan component dùng chung không bị đổi hành vi.

### F&B và backend khi làm C

- [ ] Thêm/sửa có lưu thật, reload đọc lại đúng; Hall khác sân bị backend từ chối.
- [ ] Loading/error/empty/filter-empty khác nhau; trạng thái cơ sở không bị hiểu thành giờ mở thực tế.
- [ ] Quy tắc xóa và khả năng khôi phục được xác định; không có nút xóa giả.
- [ ] BUYER không gọi API quản trị F&B; dữ liệu liên hệ nội bộ không lọt response public.
- [ ] Backend `./mvnw verify`, integration/ModularityTest và kiểm tra Swagger theo CLAUDE.md khi có sửa backend.

Sau mỗi phần sửa frontend chạy `npm run check` (lint, format, typecheck, test, build), kiểm trình duyệt desktop/360px. Ghi rõ kiểm bằng mock hay backend thật, không dùng test mock làm bằng chứng API thật đã hoạt động.

## 12. Tài liệu và hình tham khảo

- [V01 — tổng quan sáu màn](venues-v01.png).
- [V02 — bố cục quản lý](venue-layout-v02.png).
- [V03 — đề xuất zone-only](venue-layout-v03.png).
- [Brief V03](venue-layout-v03-brief.md).

Thứ tự ưu tiên khi triển khai: yêu cầu người dùng mới nhất → contract/nghiệp vụ đã duyệt → code thực tế → ảnh minh họa. Riêng bất đồng giữa contract và tài liệu thiết kế phải làm rõ theo CLAUDE.md, không lấy ảnh AI để thay đổi quy tắc nghiệp vụ.
