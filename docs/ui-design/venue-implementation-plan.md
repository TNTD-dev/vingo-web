# Kế hoạch hoàn thiện quản lý sân và sơ đồ ghế

Ngày lập: 2026-11-16.

Tài liệu yêu cầu: [venue-management-spec.md](venue-management-spec.md).

## Bổ sung phạm vi mới — thực hiện cùng đợt sửa một trang

Người dùng bổ sung: **SVG đầu trang và preview ngay; địa chỉ chọn trên map OSM có search/gợi ý; bãi xe chọn trên map và LLM tự soạn hướng dẫn; nội quy từ PDF; không có tab hoặc bước thứ hai, không có ô nhập tọa độ**.

Chi tiết và tiêu chí mới: [venue-map-ai-pdf-requirements.md](venue-map-ai-pdf-requirements.md).

- U1: hợp nhất một trang + SVG đầu tiên/preview trước lưu.
- U2: chốt nhà cung cấp map/autocomplete/routing, address mapping, parking/LLM và PDF contract.
- U3: triển khai backend/client/lưu trữ và tích hợp LLM.
- U4: nối UI thật, kiểm tra reload và lỗi từng phần.

P1 vẫn là nền tảng viewer cần hoàn tất. P2 được điều chỉnh thành luồng một trang thay vì chỉ đổi nhãn wizard cũ. P3/P4/P5 phải bao gồm dữ liệu maps/parking/AI/PDF bên cạnh F&B, không mặc định các phần mới có thể lưu bằng API cũ.

Code hiện tại chưa triển khai yêu cầu mới này; đây là kế hoạch cập nhật để sửa cùng một phạm vi, chưa phải lệnh khởi chạy provider trả phí hoặc tự thêm thư viện.

## 1. Phạm vi đã được thống nhất

- Người dùng đã chốt bố cục demo: hai vùng Sơ đồ sân / Danh sách khu, không có cột Hall hoặc lịch sử phiên bản.
- Người dùng đã yêu cầu triển khai layout và tương tác sơ đồ vào app thật ở local.
- Màu nền sân/đường chạy, hình học, nhãn, cổng và lối đi lấy từ SVG xuất Figma; UI không tự dựng bốn cổng theo hướng.
- Phần dữ liệu mới về tiện ích, liên hệ và F&B vẫn cần chốt schema/contract trước khi triển khai lưu thật.
- Chỉ commit điều hướng admin `0b95b29` đã được push theo yêu cầu. Kế hoạch này không bao gồm tự push UI sân hoặc tạo PR thay người dùng.

## 2. Mốc hiện tại

| Nhóm                    | Đã có                                                                                                                                                | Chưa hoàn tất                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Điều hướng admin        | Commit `0b95b29` trên `origin/test/luannt`                                                                                                           | PR do người dùng tự tạo                                      |
| Màn quản lý sân         | Header gọn, hai vùng, số liệu tách rõ, tab thông tin, form sửa sân, nhập SVG (có focus preview, chống race condition đọc file), trạng thái nháp/khóa | Nghiệm thu trình duyệt và nối backend thật                   |
| Bộ xem SVG admin        | `VenueMapView`, wheel/pan, ngưỡng hiện ghế, focus khu, click ghế/cổng (gồm `GATE_LABEL__`), bounds theo SVG, fixture nhà hát & ngoài trời            | Người dùng tự kiểm tra trình duyệt nhiều SVG và mobile 360px |
| Nhập/phát hành          | Đã hoàn thiện code P1 và kiểm chứng bằng unit/component test (mock)                                                                                  | Kiểm chứng trên backend local, dữ liệu giữ sau reload        |
| Xuất CSV                | Menu Xuất CSV Khu/Ghế tự đóng sau chọn, đã có unit test gọi đúng operation                                                                           | Người dùng xác nhận tải file/nội dung trên trình duyệt       |
| Wizard và danh sách sân | Giữ code cũ                                                                                                                                          | Đồng bộ nhãn, bố cục, preview và luồng cấu hình (P2/U1)      |
| Thông tin mở rộng / F&B | Đặc tả đề xuất, tab F&B hiện thông báo chưa có API                                                                                                   | Contract, storage, backend, client và UI CRUD thật           |

Sau khi hoàn thiện code P1 đã chạy `npm run check` trên code local hiện tại: **402 test / 65 file qua, lint, format, typecheck và build thành công**. Kết quả này thay thế log cũ 392 test, nhưng không thay thế nghiệm thu trình duyệt thủ công của người dùng, kiểm tra file CSV thực tế hay tích hợp backend thật (cổng 8080 chưa chạy khi kiểm tra).

## 3. Nguyên tắc thực hiện

1. Frontend làm tại `D:/Luan_document/InternVSF/frontend/vingo-web`, nhánh `test/luannt` hiện tại; giữ nguyên bản sửa navigation đã push.
2. Backend tại `D:/Luan_document/InternVSF/backend/vingo-backend` đang có staged/unstaged thay đổi khác. Trước P4 phải kiểm tra Git và tách công việc, không stash/reset/đổi nhánh hoặc gom các thay đổi có sẵn một cách tự động.
3. Giữ một đặc tả chuẩn và dùng kế hoạch này để theo dõi tiến độ. Ảnh V01–V03 và demo HTML là tham khảo lịch sử, không phải nguồn dữ liệu sân.
4. Chủ frontend theo CLAUDE.md: Danh phụ trách admin/seatmap, Đức phụ trách hạ tầng; backend catalog thuộc Luân. Khi thực hiện thay đổi liên quan cần phối hợp theo quy định repo. Kế hoạch không tự gửi tin nhắn cho các thành viên.
5. Không thêm thư viện. Gọi API qua client sinh từ contract. Không sửa generated code hoặc bản contract copy ở frontend bằng tay.
6. Không thay đổi booking/payment, không thêm mua đồ ăn, tồn kho F&B, hoàn tiền hoặc đổi ghế.

## 4. Thứ tự và phụ thuộc

| Giai đoạn                          | Phụ thuộc                                     | Kết quả bàn giao                                                                |
| ---------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| P0 — Chuẩn hóa trạng thái          | Không                                         | Tài liệu đúng với code hiện tại, danh sách việc kiểm chứng                      |
| P1 — Hoàn tất màn sơ đồ hiện có    | P0                                            | App local ổn định, nghiệm thu A/B với API hiện có                               |
| P2 — Đồng bộ tạo/sửa/danh sách sân | P1                                            | Một luồng thống nhất từ tạo sân đến nhập/phát hành sơ đồ                        |
| P3 — Chốt thiết kế dữ liệu mới     | Có thể chuẩn bị sau P0, chốt sau khi duyệt UI | Schema và hành vi F&B/thông tin mở rộng đủ cụ thể để làm contract               |
| P4 — Backend và contract           | P3                                            | API đã kiểm tra trên PostgreSQL thật, client được sinh lại                      |
| P5 — UI thông tin mở rộng / F&B    | P4                                            | CRUD thật, reload không mất dữ liệu                                             |
| P6 — Nghiệm thu tổng thể           | P1, P2, P5                                    | Báo cáo test, app local bật cho người dùng kiểm thử, commit có thể review riêng |

Ưu tiên thực tế: hoàn tất P1 rồi P2 trước khi mở rộng backend. Không cần đợi F&B để người dùng kiểm thử sơ đồ.

## 5. P0 — Chuẩn hóa tài liệu và baseline

### Công việc

- P0.1: Cập nhật đặc tả: bố cục đã chốt; A/B có code local; C còn là đề xuất.
- P0.2: Ghi nhận bộ xem admin là `VenueMapView`, không bắt buộc sửa `SeatMapView` của buyer để đánh dấu kế hoạch hoàn tất.
- P0.3: Kiểm tra diff frontend/backend, giữ riêng navigation đã push, UI chưa commit và tài liệu/demo.
- P0.4: Ghi lại log kiểm tra mới nhất và các bước chưa chạy xong; không đánh dấu checklist nghiệm thu theo việc chỉ có code.

### Hoàn thành khi

- [x] Không còn ghi nhầm toàn bộ UI là chưa triển khai hoặc bố cục chưa chốt.
- [x] Phân biệt rõ đã có code / đã test mock / đã test backend thật / đã push.

## 6. P1 — Hoàn thiện và nghiệm thu màn sơ đồ hiện tại

### P1.1. Context sân và trạng thái dữ liệu

File: `HallLayoutsPage.tsx`, `venueLayoutModel.ts`, `VenueLayoutWorkspace.tsx`.

- Kiểm tra route sân, route cấu hình, layoutId hợp lệ và layoutId không tồn tại.
- Với một cấu hình: mở đúng layout theo route; mặc định bản mới nhất theo quy tắc hiện có và ghi rõ DRAFT/PUBLISHED.
- Với nhiều cấu hình: không tự chọn Hall đầu hoặc cộng sức chứa; hiển thị các link mở đúng sơ đồ khi thiếu context. Không thêm lại cột Hall hoặc dropdown phiên bản.
- Đổi context phải xóa zone/ghế/cổng cũ. Loading không hiện thành số 0 giả; lỗi SVG không làm mất bảng khu đã có.
- Kiểm tra filter khu ngồi/đứng, search không có kết quả và reset trạng thái chi tiết.

### P1.2. Bộ xem SVG

File: `VenueMapView.tsx`, `venueMapGeometry.ts`, `venue-console.css`.

- Xác nhận 6.699 ghế đều ẩn ở tổng quan; cổng, nhãn và lối đi vẫn hiện.
- Bấm khu chỉ mở ghế của khu đó; wheel khi chưa chọn khu hiện ghế theo vùng nhìn và kích thước ghế trên màn hình.
- Thu nhỏ trở về tổng quan, không giữ ghế tí hon hoặc hit target ẩn; nút/phím 0 xóa focus và vừa khung.
- Kiểm tra zoom neo con trỏ, min/max, trackpad delta, pan, pointer capture/cancel, kéo không gây click nhầm.
- Xác nhận xử lý lớp polygon zone che ghế và ghế SVG không có fill/stroke mà không đổi màu mặt sân/đường chạy nguồn.
- Kiểm tra click ghế đọc mã/hàng/số từ API, click cổng lấy ID thật; không tự gán hướng địa lý, mở/đóng cổng hoặc trạng thái bán vé.
- Kiểm tra SVG có transform lồng nhau, viewBox khác mẫu Thiên Trường, nhóm BACKGROUND, sân khấu và khu đứng.
- Xác nhận không chèn lại toàn SVG trên mỗi wheel event; cleanup listener và animation frame khi đóng preview/đổi route.

### P1.3. Preview và thao tác ghi hiện có

File: `HallLayoutsPage.tsx`, có thể tách `VenueSvgImportDialog.tsx` nếu giúp quản lý state rõ hơn.

- Bổ sung focus zone trong preview dialog; hiện tại callback bấm zone ở preview đang để trống.
- Xử lý đổi file liên tiếp, hủy chọn và lỗi đọc file; kết quả đọc file cũ không được ghi đè file chọn sau.
- Kiểm tra file không phải SVG, SVG hỏng, không có zone, quá 10 MiB, tên rỗng và lỗi API.
- Nhập thành công tạo DRAFT mới, chuyển đúng layout, không thay layout đang dùng cho suất cũ.
- Đổi tên DRAFT; PUBLISHED không mở hành động đổi tên. Phát hành phải qua xác nhận, lỗi được giữ trong dialog để sửa/retry.
- Giữ đúng nhãn Nhập SVG xuất từ Figma ở header/dialog/hướng dẫn.
- Kiểm tra CSV Khu/Ghế: file có tên đúng layout, header đúng, dấu tiếng Việt và số dòng phù hợp; đây là bước kiểm tra thực tế cần bổ sung, chưa kết luận code tải CSV có lỗi.

### P1.4. Layout và accessibility

File: `venue-console.css`, `AdminLayout.tsx`, các component venue.

- Desktop/laptop thấy đồng thời map và bảng; map không phình theo chiều cao SVG; Copilot không che nút.
- 360px: không tràn ngang toàn trang; cụm số liệu, nút nhập dài và bộ lọc dùng được; map đủ diện tích.
- Tab/focus theo thứ tự hợp lý, tên accessible cho điều khiển, trạng thái chọn khu không chỉ phân biệt bằng màu.
- Thử bàn phím +/−/0/mũi tên và quay về toàn cảnh từ inspector.
- Rà soát hồi quy sidebar/Copilot ở các route khác vì `AdminLayout` dùng chung.

### Kiểm tra và đầu ra P1

- Test helper và component cạnh file; bổ sung case lỗi/đổi context/preview và lớp zone che ghế khi cần.
- Chạy `npm run check` trên đúng code cuối; không dùng log cũ thay thế.
- Browser: desktop, laptop, 360px; SVG sân bóng lớn, SVG nhà hát và SVG ngoài trời có nguồn hợp lệ hoặc fixture kiểm thử ghi rõ.
- Bật frontend với backend local qua `API_PROXY_TARGET`; nếu backend chưa chạy hoặc thiếu dữ liệu, báo đúng điều kiện thay vì coi mock là tích hợp thật.
- Với backend thật: import → DRAFT → rename → publish → reload; kiểm tra độc lập sơ đồ đã gắn suất cũ.
- Bàn giao URL local, chế độ mock/thật, danh sách thao tác đã thử và giới hạn còn lại.

**Cổng nghiệm thu P1:** full check xanh, browser flow chính qua, CSV đã xác minh và backend thật được kiểm chứng hoặc được ghi rõ là còn chặn nghiệm thu tích hợp.

## 7. P2 — Đồng bộ danh sách và wizard tạo/sửa sân

### Công việc theo file

| File                  | Việc cần làm                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `VenueWizardPage.tsx` | Bỏ Next/hai bước; SVG đầu trang và preview ngay, các section thông tin/map/gửi xe/PDF cùng trang; dùng viewer admin cho preview |
| `VenuesPage.tsx`      | Đồng bộ CTA, trạng thái sẵn sàng/thiếu sơ đồ; mở đúng màn quản lý, giữ nguyên bộ lọc và pagination hiện có                      |
| `CatalogForms.tsx`    | Thay form địa chỉ/lat-lng bằng map picker, nội quy bằng PDF; giữ geodata và info legacy khi cập nhật                            |
| `VenueHalls.tsx`      | Xác minh còn nơi dùng hay không; chỉ bỏ code nếu không còn consumer và không mất thao tác cần thiết                             |
| `VenueActions.tsx`    | Dùng cùng quy tắc sửa/xóa và bảo toàn dữ liệu; giữ xác nhận xóa hiện có                                                         |

### Luồng một trang cho sân mới

1. Chọn SVG ở đầu trang → sanitize/check ID → preview ngay, chưa cần venueId và chưa tạo PUBLISHED.
2. Điền tên/loại sân; search/chọn vị trí sân và bãi xe trên map; không nhập tọa độ hoặc chuyển sang bước thứ hai.
3. Khi vị trí bãi xe ổn định, tạo nháp hướng dẫn AI từ dữ kiện có nguồn để admin kiểm tra; upload PDF nội quy trong cùng trang.
4. Khi lưu: create/update venue → xác định cấu hình kỹ thuật cần cho import → lưu layout nháp/parking/file/nháp đã duyệt theo contract. Mỗi phần có trạng thái và retry, tránh tạo trùng.
5. Nếu backend chưa tạo cấu hình kỹ thuật cho sân mới, đối chiếu cách tạo Hall mặc định qua API hiện có; đây là xử lý nội bộ, không đưa cột Hall trở lại giao diện.
6. Phát hành SVG vẫn cần xác nhận và giữ versioning; không gộp upload preview với tự phát hành.
7. Dữ liệu nhiều Hall cũ được bảo toàn và cần context rõ, không tự chọn Hall đầu hoặc ghép nhiều sơ đồ thành một.

Map/autocomplete, parking/LLM, PDF và mapping địa chỉ cần U2/U3 trước khi lưu thật. Với P2/U1 chỉ dựng UI, gắn rõ chế độ mock và không báo các phần chưa có API là đã lưu.

### Hoàn thành khi

- [ ] Tạo sân mới và sân thiếu sơ đồ đi được trọn luồng, không có trang cụt.
- [ ] Không còn nhãn cũ gây hiểu nhầm; SVG đứng đầu, không có panel Hall/phiên bản hoặc wizard/tab thứ hai.
- [ ] Không có ô nhập lat/lng hoặc bộ nhập thành phố/quận/địa chỉ thủ công; vị trí chọn trên map theo contract mới.
- [ ] Form sửa không làm mất tọa độ, info hoặc liên kết layout.
- [ ] Unit/component test, `npm run check`, desktop/360px và smoke với backend thật qua.

## 8. P3 — Chốt schema thông tin sân và F&B

Đầu ra là bảng trường, enum, quyền đọc/ghi, validation, hành vi xóa và ví dụ request/response để duyệt contract. Chưa thêm endpoint trong giai đoạn này.

### Thông tin sân

- Giữ tương thích dữ liệu cũ, nhưng UI địa chỉ chuyển sang map picker; lat/lng ẩn khỏi form. Schema địa chỉ phải xử lý CityCode và kết quả geocoder theo U2.
- Thêm parking location, nguồn giá/khoảng cách, bản nháp LLM và PDF reference/status theo tài liệu bổ sung; gửi xe/nội quy không chỉ là textarea cũ.
- Chốt thêm: cổng/hướng dẫn tiếp cận ở dạng mô tả, tiện ích, liên hệ vận hành nội bộ, metadata cập nhật do backend sinh.
- Tiện ích phân biệt Có / Không / Chưa cập nhật; không dùng dữ liệu ghế WHEELCHAIR để tự kết luận có lối xe lăn.
- Phân biệt thông tin người mua được xem và liên hệ quản lý/audit chỉ ADMIN.
- Sức chứa là tổng cấu hình đang xem; sức chứa pháp lý/toàn sân nếu cần phải là một yêu cầu riêng, không lấy tổng mọi version.

### F&B

- Trường đề xuất: tên, loại hình, mô tả vị trí, liên kết sân/Hall tùy chọn, chế độ giờ phục vụ, giờ phục vụ, trạng thái khai thác và mô tả.
- Mã cổng/zone chỉ liên kết thật khi có quy tắc sống qua việc nhập version mới; bản đầu ưu tiên vị trí mô tả.
- Chốt soft-delete/hard-delete, quyền, audit và ràng buộc khi xóa sân hoặc Hall; không mặc định cascade.
- Chốt enum category và status; Đang khai thác không đồng nghĩa đang mở ngay lúc này.
- Quyết định cách lưu: ưu tiên bảng riêng nếu cần CRUD/lọc từng cơ sở; chỉ dùng info mở nếu đã định nghĩa schema và bảo toàn dữ liệu.
- Chốt phân trang, search, filter và sort; bộ lọc toàn danh sách phải do API hỗ trợ hoặc tải đủ dữ liệu đúng contract.

**Cổng nghiệm thu P3:** các lựa chọn dữ liệu có quyết định cụ thể; contract không chứa route/field mơ hồ; tuân thủ quy trình review của repo trước khi đổi API.

## 9. P4 — Contract, backend và tích hợp dữ liệu mới

### P4.1. Chuẩn bị checkout

- Kiểm tra lại Git của backend; tạo hoặc dùng checkout phù hợp chỉ chứa thay đổi task này khi cần, bảo toàn thay đổi auth/profile có sẵn.
- Đọc kiến trúc và CLAUDE.md của backend trước khi sửa; không trộn module khác hoặc thêm thư viện.

### P4.2. Contract trước

- Sửa contract gốc bằng PR đúng quy trình; mô tả schema/operation, quyền ADMIN, ví dụ lỗi và quy tắc dữ liệu.
- F&B dự kiến có list/create/update/delete theo sân; tên route cuối cùng quyết định trong contract, không coi danh sách này là endpoint đã tồn tại.
- Quy định lỗi validation, not found, không có quyền và quan hệ Hall không thuộc sân; chỉ dùng code đã khai báo hoặc bổ sung code đúng quy trình.

### P4.3. Dữ liệu và nghiệp vụ

- Migration mới: định danh, FK, CHECK và index theo cách truy vấn đã chốt; không sửa migration đã merge.
- Use case trong catalog service, transaction tại service; kiểm tra quyền/quan hệ phía server.
- Controller implements interface sinh; không trả lỗi tự dựng khác ProblemDetail.
- Không đưa thông tin liên hệ nội bộ vào response public hoặc log body nhạy cảm.
- Xử lý cập nhật/xóa nhất quán, không để frontend giả lập thành công.

### P4.4. Kiểm chứng

- Integration tests trên PostgreSQL thật: CRUD thành công, validation, ADMIN/BUYER, Hall khác sân, xóa và quan hệ dữ liệu.
- Chạy `./mvnw verify`, kiểm Modulith, migration và Swagger theo quy định repo.
- Đồng bộ version contract frontend qua workflow hiện có; chạy generate, không commit generated client.

**Cổng nghiệm thu P4:** contract và implementation khớp; backend checks qua; client dùng được với backend local.

## 10. P5 — UI thông tin mở rộng và F&B thật

### UI thông tin sân

- Nhóm tiện ích/tiếp cận và liên hệ theo quyền, có trạng thái Chưa cập nhật.
- Form dùng type sinh, validation hợp contract, bảo toàn trường chưa sửa.
- Lưu thành công → invalidate đúng query → đọc lại; lỗi giữ nguyên form và giá trị đã nhập.

### UI F&B

- Danh sách cơ sở gồm tên, loại, vị trí, giờ phục vụ, trạng thái và thao tác.
- Thêm/Sửa bằng form, Xóa theo semantics đã chốt; không có nút chỉ báo thành công mà chưa gọi API.
- Search/filter đồng bộ API và cursor; đổi filter reset cursor, không lọc cục bộ một trang rồi hiển thị là kết quả toàn sân.
- Loading / lỗi / chưa có cơ sở / không có kết quả lọc là các trạng thái riêng.
- Summary hiển thị số thực; dùng Đang khai thác thay vì khẳng định giờ mở thực tế.
- Giữ an toàn thao tác submit lặp; xử lý 401/403 và quyền; không lộ contact nội bộ ra buyer.
- Test reload sau tạo/sửa/xóa, đổi sân, lỗi API và conflict dữ liệu.

**Cổng nghiệm thu P5:** CRUD lưu thật, dữ liệu đúng sau reload, bộ lọc/phân trang hoạt động, `npm run check` và browser checks qua.

## 11. P6 — Kiểm tra tổng thể và mở local cho người dùng

| Nhóm kiểm tra | Tình huống tối thiểu                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Auth          | ADMIN vào đúng màn, BUYER không gọi API admin; navigation đã push vẫn hoạt động                  |
| Sân           | Tạo/sửa, địa chỉ/bản đồ, missing data, một/nhiều cấu hình, reload                                |
| Sơ đồ         | SVG hợp lệ/lỗi/quá dung lượng, draft/publish/locked, version cũ gắn suất không đổi               |
| Viewer        | Tổng quan/chi tiết, wheel/pan/keyboard, cổng từ nguồn, standing, transform, nhiều kích thước SVG |
| CSV           | Đúng file, layout, loại dữ liệu, UTF-8 và số dòng                                                |
| F&B           | CRUD, filter/pagination, quyền, thông tin nội bộ, reload                                         |
| Responsive    | Desktop, laptop/tablet, 360px; không tràn/che CTA, focus/tab order                               |
| Hồi quy       | Các route admin khác, buyer SeatMapView, chat và luồng chọn ghế liên quan                        |

- Chạy đúng các bộ kiểm tra cho repo đã sửa, ghi commit/hash hoặc diff được kiểm chứng.
- Báo rõ API thật hay mock, dữ liệu fixture hay dữ liệu backend; không dùng kết quả mock làm bằng chứng server đã hoạt động.
- Bật dịch vụ local ở port đã thống nhất. Frontend proxy tới backend cùng origin theo cấu hình auth; không tự đổi Origin/cookie để vượt kiểm tra.
- Bàn giao link mở màn, thao tác test đề nghị, giới hạn còn lại và cách khởi động lại.

## 12. Chia commit và review đề xuất

| Commit đề xuất                                        | Nội dung đi cùng nhau                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `fix(admin): hoàn thiện quản lý sơ đồ sân`            | Page/workspace/actions/model, bộ xem admin, geometry, CSS compact có scope và test liên quan; không tách file làm page không build được |
| `fix(admin): đồng bộ luồng tạo sân và nhập SVG Figma` | Wizard, danh sách, form và test P2                                                                                                      |
| `docs: cập nhật đặc tả và kế hoạch quản lý sân`       | Đặc tả/kế hoạch và ghi nhận nghiệm thu; ảnh/demo tùy người dùng quyết định đưa lên Git                                                  |
| Backend contract                                      | PR contract theo quy trình repo, tách khỏi thay đổi auth/profile đang có                                                                |
| Backend implementation                                | Migration/catalog/tests theo contract được chốt                                                                                         |
| Frontend thông tin mới/F&B                            | Client integration, form/list và tests; không chứa generated files                                                                      |

Các message trên là đề xuất, không phải commit đã tạo. Chỉ commit/push theo phạm vi người dùng chọn. PR điều hướng admin và công việc sân không được mô tả lẫn với nhau.

## 13. Các điểm cần quyết định trước phần dữ liệu mới

- Nhà cung cấp geocoding hỗ trợ autocomplete, tile/routing và thư viện map; không dùng Nominatim công cộng cho typeahead.
- Mapping địa chỉ sang contract, nhiều bãi xe, nguồn giá/giờ và loại khoảng cách.
- Provider/model LLM admin, ngân sách/timeouts và việc duyệt hướng dẫn nháp.
- Giới hạn PDF, lưu file, trích xuất/OCR, quyền xem và xử lý file cũ.

- Trường tiện ích/tiếp cận/liên hệ nào thực sự cần trong bản đầu, trường nào chỉ ADMIN được xem.
- Enum F&B, giới hạn chuỗi và định nghĩa giờ phục vụ.
- Soft-delete hay hard-delete và audit.
- Có cần liên kết F&B tới zone/cổng hay chỉ Hall + mô tả vị trí ở bản đầu.
- Cách lưu trữ F&B và quy tắc tổng sức chứa toàn sân nếu có nhu cầu ngoài sức chứa sơ đồ.

Những điểm này không chặn việc hoàn tất P1/P2 bằng API hiện có. Không cần hỏi lại về bố cục hai vùng đã được người dùng chốt.
