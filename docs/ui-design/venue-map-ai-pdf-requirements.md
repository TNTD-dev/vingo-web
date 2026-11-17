# Bổ sung yêu cầu: một màn cấu hình sân, bản đồ, AI gửi xe và PDF nội quy

Ngày: 2026-11-16. Trạng thái: quyết định CP3 và bản contract frontend đã cập nhật; contract backend cần owner duyệt trước migration. Xem [quyết định CP3](venue-cp3-contract-decisions.md).

Tài liệu này bổ sung và ưu tiên hơn các đoạn cũ về nhập địa chỉ thủ công, ô tọa độ, tab Thông tin sân/F&B và wizard hai bước trong [đặc tả](venue-management-spec.md) và [kế hoạch](venue-implementation-plan.md). Các quy tắc SVG, khóa bản PUBLISHED và phân quyền vẫn giữ theo contract đã duyệt.

## 1. Yêu cầu người dùng vừa bổ sung

1. Thay bộ nhập Thành phố / Quận-huyện / Địa chỉ bằng bản đồ JavaScript dùng dữ liệu OpenStreetMap, có search box phía trên và gợi ý khi gõ.
2. Chọn địa điểm sân trực tiếp trên bản đồ hoặc chọn một kết quả tìm kiếm; hiển thị vị trí đã chọn thay vì bắt nhập ba trường địa chỉ thủ công.
3. Chọn vị trí gửi xe trên bản đồ tương tự. Sau khi chọn, AI tự soạn hướng dẫn gửi xe; có cấu hình LLM dành cho admin.
4. Hướng dẫn cần diễn đạt các thông tin như tên đường, khoảng cách đến sân, giá gửi xe khi có dữ liệu.
5. Nội quy nhập bằng file PDF.
6. Đưa khối Nhập SVG xuất từ Figma lên đầu tiên; chọn file xong render ngay sơ đồ sân/ghế để xem trước.
7. Bỏ phần nhập tọa độ bản đồ bằng số khỏi UI. Tọa độ vẫn là dữ liệu lưu phía sau để đặt marker và tính khoảng cách.
8. Toàn bộ làm trong một màn/tab, không phải chuyển sang tab hoặc bước thứ hai.

## 2. Thứ tự bố cục mới

Một trang cuộn có các section theo thứ tự:

| Thứ tự     | Section                | Nội dung                                                                                                   |
| ---------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1          | Nhập SVG xuất từ Figma | Nút chọn file/dropzone, lỗi kiểm tra, preview ngay; sau đó vùng sơ đồ + danh sách khu cạnh nhau            |
| 2          | Thông tin cơ bản       | Tên sân, loại địa điểm, số liệu cấu hình; thông tin chưa có hiển thị rõ                                    |
| 3          | Vị trí sân             | Search box và danh sách gợi ý phía trên bản đồ; marker vị trí sân, địa chỉ kết quả chỉ đọc                 |
| 4          | Gửi xe                 | Cùng ngữ cảnh bản đồ với marker sân và marker bãi xe; giá/giờ/ghi chú đã xác minh và bản nháp hướng dẫn AI |
| 5          | Nội quy                | Upload PDF, trạng thái xử lý, xem file và nội dung trích xuất khi có                                       |
| 6          | Tiện ích / F&B         | Section trong cùng trang khi API sẵn sàng; không có tab riêng bắt buộc                                     |
| Cuối trang | Lưu / phát hành        | Phân biệt lưu thông tin sân, nhập sơ đồ nháp và phát hành; thông báo phần nào đã lưu/chưa lưu              |

- Bỏ thanh tab Sơ đồ sân / Thông tin sân / F&B và wizard Next sang trang thứ hai.
- Có thể dùng anchor hoặc tiêu đề section để định vị trên trang dài; không giấu nội dung bắt buộc sau tab khác.
- Khối SVG đứng trước khối bản đồ địa lý. Hai canvas khác mục đích: sơ đồ chỗ ngồi và bản đồ địa lý, không trộn tọa độ SVG với lat/lng.
- Trên 360px xếp dọc; desktop vùng sơ đồ vẫn có hai cột sơ đồ/danh sách khu. Các section bản đồ phải có chiều cao dùng được, không làm cả trang tràn ngang.
- Có cảnh báo khi rời trang còn thay đổi chưa lưu. Sau lỗi API giữ file/marker/draft đang chỉnh khi có thể và cho retry đúng section.

## 3. Nhập SVG đầu trang và render tức thì

- Khi chọn file hợp lệ: đọc file, sanitize và kiểm tra quy ước ID; render preview ngay ở section đầu, không đợi lưu sân hay gọi API nhập.
- Preview dùng cùng viewer admin: wheel zoom, pan, tổng quan zone-only, mở khu hiện ghế, màu/cổng theo SVG nguồn.
- Dữ liệu summary preview đọc từ SVG và ghi rõ Chưa lưu; không trộn với số liệu của layout đã lưu trong API.
- Chọn file chỉ thay preview, không tự tạo layout PUBLISHED. Nhập thành bản nháp vẫn là thao tác lưu riêng theo contract.
- Sân mới chưa có venueId/Hall kỹ thuật vẫn được preview. Khi lưu, điều phối create venue → cấu hình kỹ thuật cần thiết → import layout; không giữ transaction DB xuyên các lần gọi dịch vụ ngoài.
- Nếu một bước lưu lỗi: hiển thị tài nguyên nào đã tạo, tài nguyên nào chưa lưu; retry không được tạo trùng sân/Hall/layout do remount.
- Giới hạn SVG 10 MiB theo contract hiện có; giữ ID, hình học, màu và cổng của file Figma. Không thay sanitizer bằng việc tin nguồn Figma.
- Bản đã phát hành không bị ghi đè; nhập file mới tạo bản nháp mới. Luồng một trang không có nghĩa bỏ bước xác nhận phát hành.

## 4. Bản đồ vị trí sân

### 4.1. Tương tác

- Chọn Leaflet 1.x stable làm renderer, dùng Geoapify OSM Carto raster tiles. Chưa thêm dependency trong CP3; thêm khi triển khai UI theo quy định repo.
- Search box tìm tên địa điểm/địa chỉ, danh sách gợi ý có tên và vùng hành chính để tránh chọn nhầm kết quả trùng tên.
- Khi chọn gợi ý: map fly/fit tới kết quả, đặt marker và cập nhật địa chỉ kết quả. Không liên tục nhảy bản đồ chỉ vì có một response mới khi người dùng chưa chọn.
- Cho bấm bản đồ hoặc kéo marker để chọn chính xác; reverse geocode sau khi kết thúc lựa chọn, không gọi cho mọi pixel khi kéo.
- Đề xuất debounce 300–500ms, tối thiểu 3 ký tự, hủy request cũ và chỉ nhận response của query mới nhất. Các ngưỡng phải tuân theo nhà cung cấp được chọn, không dùng debounce để lách chính sách API.
- Có loading, không có kết quả, lỗi dịch vụ và retry; lỗi geocoder không làm mất vị trí đã lưu.
- Không tự xin GPS trình duyệt. Nếu sau này thêm Vị trí của tôi thì là tính năng riêng có quyền truy cập vị trí rõ ràng.
- Không còn input lat/lng hoặc form Thành phố / Quận-huyện / Địa chỉ để admin gõ trực tiếp. Hiển thị nhãn địa chỉ được chọn ở dạng tóm tắt để kiểm tra.

### 4.2. Dữ liệu và tương thích contract

- Lưu tọa độ số trong dữ liệu dù đã bỏ ô nhập tọa độ trên UI; giới hạn lat/lng hợp lệ và quy tắc bắt buộc do backend kiểm tra.
- Contract chuẩn hóa location thành display_address, latitude/longitude, CityCode nullable, administrative_area[], source và source_place_id; API vẫn trả alias legacy address/city/district/lat/lng.
- Không giả định dữ liệu hành chính Việt Nam lúc nào cũng có district. Không hardcode đọc một trường duy nhất từ mọi geocoder.
- Contract hiện tại yêu cầu city với enum giới hạn. Kết quả ngoài các mã được hỗ trợ không được tự gán thành HCM/HN/DN để lưu cho qua; phải thống nhất mở rộng/mapping contract trước.
- Dữ liệu sân cũ còn dùng address/city/district/lat/lng phải có chiến lược đọc và chuyển đổi; không xóa các giá trị cũ chỉ vì thay form.

### 4.3. Nhà cung cấp OSM và chính sách đã kiểm tra

OpenStreetMap là nguồn dữ liệu bản đồ; renderer, tile server, search/reverse geocoder và routing là các thành phần riêng.

- [Nominatim công cộng](https://operations.osmfoundation.org/policies/nominatim/) không cho autocomplete theo lần gõ; giới hạn tổng ứng dụng tối đa 1 request/giây. Vì vậy không dùng public endpoint này để thực hiện yêu cầu gợi ý real-time.
- Chọn dịch vụ dựa trên OSM cho phép autocomplete hoặc triển khai geocoder riêng. Nhà cung cấp, giới hạn và cache là cấu hình cần chốt trước khi code tích hợp.
- Nếu dùng [tile OSMF công cộng](https://operations.osmfoundation.org/policies/tiles/), giữ attribution hiển thị, tuân thủ cache/Referer và không tải hàng loạt/offline. Không coi tile công cộng là dịch vụ có SLA.
- Chọn Geoapify cho tiles, address autocomplete, reverse geocoding và routing. Autocomplete/reverse/routing proxy qua backend; tile key giới hạn origin/referrer, xem là public key và không dùng cho API secret. Giữ Geoapify và OpenStreetMap attribution; không dùng Nominatim public cho typeahead.
- API geocoding/routing phía app đi qua client sinh từ contract khi được proxy qua backend; tile tải trực tiếp theo cơ chế renderer là tài nguyên bản đồ, không tự dùng fetch API nghiệp vụ ngoài client.

## 5. Chọn bãi gửi xe và AI soạn hướng dẫn

### 5.1. Chọn và xác minh dữ liệu bãi xe

- Marker sân và bãi xe có icon/nhãn khác nhau; bãi xe không được làm thay vị trí sân.
- Tìm/chọn bãi xe hoặc đặt marker như phần vị trí sân. Chốt số lượng bãi xe trong schema; ưu tiên mô hình hỗ trợ nhiều bãi với một bãi chính.
- Các thông tin đầu vào: tên bãi, địa chỉ/tên đường từ nguồn, vị trí, giờ hoạt động, loại phương tiện, giá đã xác minh và ghi chú admin.
- Giá tiền không có dữ liệu thì để Chưa xác minh; không có nghĩa miễn phí. Nếu nhập giá phải rõ đơn vị VND, theo lượt/giờ/ngày và loại phương tiện.
- Không giả định OSM luôn có giá gửi xe, giờ hoạt động hoặc POI bãi xe đầy đủ. Admin có thể chọn điểm và bổ sung dữ kiện xác minh.
- Khoảng cách cần ghi rõ cách tính: đường chim bay là xấp xỉ, không diễn đạt thành quãng đường đi bộ. Quãng đường/lộ trình đi thực tế cần routing provider phù hợp.
- Điểm đích định tuyến có thể là cổng sân nếu đã có tọa độ địa lý được xác nhận; tọa độ cổng trong SVG không tự chuyển thành lat/lng.

### 5.2. Cấu hình LLM phía server

- CP3 chốt gọi HTTP từ backend qua `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`; timeout 30 giây, output tối đa 700 tokens, rate limit 5 yêu cầu/ADMIN/phút và prompt version `parking-guidance-v1`. Provenance bản nháp gồm provider/model/prompt version/input revision/người tạo/thời điểm. Không tạo bảng hoặc màn quản trị cấu hình LLM; URL/model/credential thật do người dùng cung cấp khi tích hợp.
- Credential chỉ ở biến môi trường/secret store backend. Timeout, giới hạn output và rate limit thuộc cấu hình server, không nhận từ browser; không gửi secret trong request/response.
- LLM call thực hiện ngoài transaction đang giữ lock. Không gửi toàn bộ hồ sơ admin, token hoặc file không cần thiết vào prompt.
- Khi nhận thông tin API, chọn adapter phù hợp repo; không tự cài SDK/provider trong giai đoạn chốt contract.

### 5.3. Luồng tự sinh hướng dẫn

1. Admin chọn sân và bãi xe; reverse geocode/route đã trả đủ dữ liệu hoặc được đánh dấu thiếu.
2. Tự yêu cầu sinh bản nháp một lần cho bộ dữ kiện đã ổn định; không gọi LLM trong mỗi bước kéo marker/từng ký tự tìm kiếm. Gộp/hủy response cũ theo request ID.
3. Server đưa dữ kiện có nguồn vào prompt có cấu trúc: tên đường, điểm sân/bãi, khoảng cách và loại khoảng cách, giá/giờ đã xác minh, thông tin còn thiếu.
4. AI chỉ diễn đạt dữ kiện; không tự bịa tên đường, giá, thời gian đi bộ hoặc tính hợp pháp của bãi xe. Không có giá thì ghi chưa xác minh hoặc bỏ khỏi bản hướng dẫn.
5. UI hiện nháp để admin đọc, sửa và lưu; có nút Tạo lại và trạng thái sinh/lỗi. Không tự công khai hướng dẫn ngay khi model trả lời.
6. Khi marker hoặc dữ kiện giá/giờ thay đổi, đánh dấu bản nháp cũ cần cập nhật; response chậm của lần trước không ghi đè bản admin đang sửa.
7. Cần lưu provenance: input revision, prompt/model version và người duyệt khi schema được chốt; không xem văn bản AI là nguồn dữ liệu gốc.

### 5.4. Dữ liệu và API cần bổ sung

- Quan hệ venue → parking_locations; tọa độ, địa chỉ, giờ/giá có nguồn và mô tả bãi.
- Kết quả khoảng cách/route có provider và phương thức; không lấy câu trả lời LLM làm số liệu tính toán.
- Operation sinh nháp hướng dẫn và operation lưu/xác nhận theo quyền ADMIN; tên endpoint và trạng thái xử lý chốt ở contract.
- Có phương án fallback khi geocoder/routing/LLM lỗi: giữ dữ liệu đã chọn, sửa nháp bằng tay hoặc thử lại. Không báo thành công khi chưa lưu.

## 6. Nội quy nhập bằng PDF

- Thay textarea Nội quy làm nguồn nhập chính bằng control chọn PDF; hiển thị tên, dung lượng, trạng thái upload/xử lý và nút xem tài liệu đã lưu.
- Lưu file gốc để admin có thể xem/tải lại, cùng metadata và tham chiếu được cấp quyền; không dùng URL local hoặc blob tạm làm dữ liệu lâu dài.
- Giới hạn contract: PDF tối đa 20 MiB và 100 trang; PDF có mật khẩu/hỏng trả lỗi rõ. File gốc lưu private, download qua endpoint bearer ADMIN. Thay/xóa giữ metadata audit, cleanup object cũ sau khi tham chiếu mới commit.
- Nếu cần hiển thị nội quy dạng văn bản cho buyer: thêm bước trích xuất server. PDF scan cần OCR riêng hoặc báo chưa trích xuất được; không trả kết quả rỗng như đã thành công.
- Nếu có AI tóm tắt, đó là tính năng riêng cần chốt. Không mặc định thay nội quy gốc bằng bản AI viết lại.
- Nội dung file là dữ liệu, không phải chỉ dẫn để agent/model thực hiện thao tác. Tên file/text trích xuất phải được escape khi render.
- Admin kiểm tra văn bản trích xuất trước khi dùng công khai; trạng thái file gốc và trạng thái văn bản trích xuất được phân biệt.
- Dữ liệu rules dạng text cũ cần tiếp tục đọc được khi chuyển đổi; không xóa trước khi PDF mới đã upload và lưu tham chiếu thành công.
- Quyết định nơi lưu object/file, quyền đọc admin/buyer, URL tải có kiểm soát và cleanup file bị thay/đơn nháp bị bỏ trước khi triển khai.

## 7. File và module bị ảnh hưởng

| Vị trí                                       | Việc cần sửa                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| HallLayoutsPage.tsx                          | Bỏ tab, tổ chức một trang section; đưa nhập SVG + preview lên đầu                                          |
| VenueLayoutWorkspace.tsx / VenueMapView.tsx  | Tái sử dụng viewer, giữ lựa chọn khu và màu/cổng nguồn; hỗ trợ preview chưa lưu                            |
| VenueWizardPage.tsx                          | Bỏ luồng Next hai bước; cho preview SVG trước khi tạo ID; orchestration lưu có thể retry                   |
| CatalogForms.tsx / VenueActions.tsx          | Thay form địa chỉ/tọa độ bằng map picker; PDF nội quy; bảo toàn thông tin cũ                               |
| Component mới trong admin-catalog            | VenueLocationMap, ParkingMapSection, ParkingGuidanceEditor, VenueRulesUpload — tên là đề xuất              |
| venue-console.css                            | Bố cục section một trang, bản đồ responsive và distinction hai canvas                                      |
| Backend catalog / shared integration phù hợp | Geocoder/routing adapter, lưu bãi xe, sinh nháp, PDF upload/storage/extraction; đối chiếu ranh giới module |
| Contract gốc và migration                    | Address schema, parking, PDF reference/status, AI draft/config; client sinh lại sau contract               |
| Mock và test                                 | Response chậm/lỗi, click marker, request race, PDF scan/hỏng, LLM thiếu dữ kiện và retry từng bước lưu     |

## 8. Chia giai đoạn để sửa cùng một phạm vi

### U1 — UI một trang và SVG đầu tiên

- Hợp nhất các tab/step, giữ viewer và bảng khu đã có.
- Preview ngay khi chọn file; chưa lưu không phát hành tự động.
- Tạo điểm tích hợp map/PDF/AI rõ ràng; chế độ mock phải gắn nhãn, không giả làm dữ liệu đã lưu thật.

### U2 — Chốt nhà cung cấp và contract

- Chọn renderer/dependency, geocoder cho phép autocomplete, tile và routing; kiểm tra key, attribution, quota và backend adapter.
- Chốt provider, mapping địa chỉ/CityCode, schema parking, giá, PDF limit/storage, operation AI draft/provenance và quyền; xem [quyết định CP3](venue-cp3-contract-decisions.md).
- Sửa contract gốc đúng quy trình review của repo; không thêm URL API tay trong frontend.

### U3 — Backend và client

- Migration mới, service/controller/adapter theo contract; gọi dịch vụ ngoài không giữ DB lock.
- Upload PDF và giữ metadata/file gốc; xử lý trích xuất/OCR theo phạm vi đã chốt.
- AI chỉ sinh nháp có dữ kiện, có revision và chống response cũ ghi đè.
- Kiểm tra quyền ADMIN, dữ liệu đầu vào, lỗi phụ thuộc, retry và `./mvnw verify`.

### U4 — Nối UI thật và nghiệm thu

- Nối map search/reverse geocode/pin, chọn bãi, tự sinh hướng dẫn nháp và upload PDF.
- Reload đọc lại đúng marker, file và hướng dẫn đã duyệt; không mất cấu hình sơ đồ.
- Chạy frontend check và kiểm thử browser desktop/360px; kiểm luồng nhiều dịch vụ lỗi từng phần.
- Chỉ push theo nhóm thay đổi người dùng chọn. Đây chưa phải yêu cầu bắt đầu code hoặc bật provider trả phí.

## 9. Tiêu chí nghiệm thu bổ sung

- [ ] Một trang/tab duy nhất, không phải bấm Next hoặc tab thứ hai để hoàn tất cấu hình.
- [ ] Khối SVG là section đầu; file hợp lệ render ngay, số liệu preview ghi rõ chưa lưu.
- [ ] Không có input thành phố/quận/địa chỉ thủ công và ô lat/lng; vị trí được chọn từ search/map và lưu được dữ liệu chuẩn.
- [ ] Gợi ý search cập nhật đúng query mới nhất, chọn gợi ý mới di chuyển map; click/drag marker reverse geocode đúng điểm.
- [ ] Attribution không bị che; geocoder được chọn cho phép autocomplete, không dùng Nominatim công cộng làm typeahead.
- [ ] Marker bãi xe và sân độc lập; route/distance có loại đo, không đồng nhất khoảng cách đường thẳng với quãng đường đi bộ.
- [ ] Giá chưa xác minh không bị AI đổi thành giá cụ thể hoặc miễn phí; văn bản chỉ là nháp cho tới khi admin lưu/duyệt.
- [ ] Đổi marker/dữ kiện không bị response LLM cũ ghi đè bản mới hoặc nội dung admin đang sửa.
- [ ] PDF lưu được file gốc và mở lại sau reload; lỗi/scan/mật khẩu/giới hạn file được xử lý đúng trạng thái.
- [ ] File/nháp/thông tin đã lưu không bị mất khi bước khác lỗi; retry không tạo trùng sân hoặc sơ đồ.
- [ ] Secret LLM/provider không xuất hiện trong bundle, response UI hoặc log nhạy cảm.

## 10. Nguồn kỹ thuật đã đối chiếu

- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) — đối chiếu 2026-11-16; chỉ áp dụng endpoint công cộng do OSMF vận hành, không đánh đồng với mọi nhà cung cấp geocoder.
- [OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) — đối chiếu 2026-11-16; xác nhận lại khi chọn nhà cung cấp thật.
