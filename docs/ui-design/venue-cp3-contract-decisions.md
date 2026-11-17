# CP3 — Quyết định dữ liệu và OpenAPI cho quản lý sân

Ngày: 2026-11-16. Trạng thái: quyết định và contract đề xuất đã cập nhật trong cả hai checkout; cần PR review/approve của owner contract trước migration.

Tài liệu này chốt các điểm mở của U2. Contract nguồn sự thật là `vingo-backend/contracts/vingo-openapi.yaml`; bản frontend đồng bộ sau khi contract backend được duyệt theo [README](../../README.md#contract-và-client-sinh-tự-động).

## Quyết định

| Hạng mục         | Quyết định                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Map renderer     | Leaflet 1.x stable, hiển thị raster tiles; chưa thêm dependency trong CP3.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Tiles            | Geoapify OSM Carto raster tiles. Dùng project key riêng giới hạn HTTP referrer/origin; key tile là public credential trong trình duyệt, không phải secret. Hiện attribution `Powered by Geoapify` và `© OpenStreetMap contributors`; nếu chọn style khác cần bổ sung attribution theo Geoapify.                                                                                                                                                                                             |
| Geocoder         | Geoapify Address Autocomplete, reverse geocoding qua backend proxy. Không gọi Nominatim public để typeahead. Query tối thiểu 3 ký tự, debounce 300–500 ms, tối đa 10 kết quả, nhận response mới nhất.                                                                                                                                                                                                                                                                                       |
| Routing          | Geoapify Routing API, mode WALKING từ bãi gửi xe tới điểm sân. Luôn phân biệt đường chim bay (tính local) và lộ trình (provider); lộ trình có thể null. Backend proxy giữ API key và cache theo tọa độ/revision.                                                                                                                                                                                                                                                                            |
| CityCode         | Giữ enum hiện tại `[HCM, HN, DN]` cho bộ lọc sự kiện. Chỉ map địa chỉ vào một trong ba mã khi Geoapify xác định chắc chắn; địa phương khác/mơ hồ lưu `city=null`, giữ tên địa giới tự do và tọa độ. Không gán mặc định thành HCM.                                                                                                                                                                                                                                                           |
| Địa chỉ cũ       | Không bỏ/đổi tên `address`, `city`, `district`, `lat`, `lng`. Response `location` dựng từ trường chuẩn nếu có, nếu chưa có thì fallback từ các cột cũ. Migration backfill `source=LEGACY`, giữ nguyên raw value, không gọi geocoder để tự sửa dữ liệu. Dual-write các alias trong giai đoạn tương thích.                                                                                                                                                                                    |
| Parking          | Bảng `parking_locations`, một Venue có nhiều record hoạt động trong bán kính 3 km đường chim bay. Bãi đầu tiên thành primary; tối đa một primary. `price_status=UNVERIFIED` không có giá/đơn vị; `VERIFIED` bắt buộc `price_vnd >= 0` và `price_unit` (`PER_ENTRY`, `PER_HOUR`, `PER_DAY`). Xóa mềm; không cho xóa bãi primary khi còn bãi khác cho tới khi admin chọn primary thay thế.                                                                                                    |
| Khoảng cách      | Lưu straight-line meters cùng route meters/duration, mode, provider, timestamp và `input_revision`. Tọa độ thay đổi làm route cũ stale. Sinh hướng dẫn đảm bảo route đúng revision trước khi gọi LLM.                                                                                                                                                                                                                                                                                       |
| LLM              | CP3 không tạo bảng/cấu hình admin hoặc endpoint quản trị LLM. Gọi HTTP từ backend theo `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`; người dùng sẽ cung cấp endpoint/credential khi tích hợp. Timeout 30 giây, tối đa 700 output tokens, 5 yêu cầu/ADMIN/phút, prompt version `parking-guidance-v1`. Mỗi draft lưu provider, model, prompt version, input revision, generated_by/time và trạng thái DRAFT/APPROVED. Chỉ bản APPROVED mới public. API key không ở request/response/log/bundle. |
| PDF nội quy      | Tối đa 20 MiB, 100 trang, kiểm MIME và PDF signature. Lưu object gốc trong private bucket. Download qua endpoint yêu cầu ADMIN, không phát URL object công khai. Trích xuất native text trước; nếu dưới 100 ký tự không whitespace thì OCR Vietnamese + English bất đồng bộ. Trả tối đa 250,000 ký tự kèm cờ truncated. PDF có mật khẩu/hỏng trả lỗi rõ; OCR lỗi là `OCR_FAILED`, không coi text rỗng là thành công. ADMIN rà soát rồi mới copy text đã duyệt vào `info.rules` public.      |
| Tiện ích/liên hệ | `facilities` dùng `YES/NO/UNKNOWN` (UNKNOWN hiển thị “Chưa cập nhật”). Liên hệ vận hành lưu riêng và chỉ qua endpoint ADMIN; không có field đó trong `Venue` response.                                                                                                                                                                                                                                                                                                                      |
| F&B              | Bảng riêng `venue_food_facilities`, FK `hall_id` nullable nhưng backend xác nhận Hall thuộc đúng Venue. `FIXED_HOURS` cần giờ mô tả; `EVENT_BASED` không giả lập giờ đang mở. Cursor pagination server-side; filter `q`, `hall_id`, `category`, `operating_mode`, `status`. Xóa mềm, mặc định list loại record đã xóa; giữ metadata/audit, không có restore trong contract CP3.                                                                                                             |

## Ánh xạ địa chỉ và dữ liệu cũ

Contract mới thêm `Venue.location` gồm `display_address`, `latitude`, `longitude`, `city_code`, `administrative_area[]`, `source`, `source_place_id`. Đây là representation API, không buộc phải tạo JSON column mới. Migration ít thay đổi nhất:

- Giữ `address/city/district/lat/lng` làm alias tương thích và nguồn fallback cho record cũ.
- Bổ sung `administrative_area` (JSONB hoặc cột tương đương), `location_source`, `source_place_id`; nếu DB hiện không cho `city` null thì nới nullable.
- Khi ghi `location`, ánh xạ `display_address → address`, `latitude → lat`, `longitude → lng`, `city_code → city`, và giữ district cũ nếu trong geocoder có cấp DISTRICT; lưu đầy đủ danh sách cấp trong `administrative_area`.
- Backfill record cũ bằng các giá trị đang có, gắn `source=LEGACY`, không suy ra mã vùng mới từ chuỗi tự do. Giữ dữ liệu raw và không xóa các key `info.rules`/`info.parking`.
- Khi có bãi parking mới, `parking_locations` là nguồn chính; chỉ dùng `info.parking` như fallback khi venue chưa có record parking.

## Bảng/quan hệ đề xuất cho migration

- `venues`: các cột cũ; thêm địa giới/source metadata; thêm `facilities` (JSONB/embedded fields) nếu chưa có. `city` nullable cho ngoài enum.
- `venue_operations_contacts`: 1:1 với venue, chứa department/name/phone/email/notes. Không join vào DTO public.
- `parking_locations`: UUID, venue FK, tên, address, lat/lng, địa giới/source/place id, primary, price status/value/unit, vehicle type, hours, admin notes, input revision, route summary, timestamps, deleted_at. CHECK nhất quán giá; service transaction đảm bảo luôn có một primary nếu còn parking active; unique partial index cho tối đa một primary active.
- `parking_guidance_versions`: FK parking, revision/current flag, body, state, input revision, provider/model/prompt version, generated_by/time, approved_by/time. Một version current; giữ bản cũ để provenance khi regenerate.
- `venue_rules_documents`: venue FK, version, private object key, filename, SHA-256, size/page count, extraction status/text, uploader/time, deleted_at. Chỉ metadata hiện tại được trả; object cũ cleanup sau commit khi thay/xóa.
- `venue_food_facilities`: UUID, venue FK, nullable hall FK, fields theo `FoodFacility`, timestamps, deleted_at. Index theo venue/created_at/id và partial index không xóa mềm. Public DTO chỉ trả thông tin cơ sở và trạng thái; ADMIN DTO cũng không có contact nội bộ.

Mọi FK Hall phải kiểm tra cùng Venue ở service/DB; xóa Hall/venue không cascade mất thông tin vận hành. Xóa venue tiếp tục theo soft-delete contract hiện hành; việc dọn storage/object làm qua cleanup sau commit.

## OpenAPI đã chốt

Contract thêm:

- Admin autocomplete/reverse geocode proxy.
- CRUD parking, route estimate, sinh nháp và lưu/duyệt guidance; public chỉ đọc parking đã active và guidance đã APPROVED.
- CRUD tiện ích; endpoint liên hệ nội bộ ADMIN-only.
- CRUD danh sách F&B ADMIN phân trang/filter, soft delete; public read chỉ trả cơ sở chưa xóa mềm và trạng thái ACTIVE/TEMPORARILY_CLOSED.
- Upload/read/download/delete PDF, duyệt text để cập nhật field rules public cũ.
- Schemas location, facilities, contact, parking, guidance provenance, F&B, PDF metadata và ProblemDetail error codes.

Admin operations yêu cầu bearer và role ADMIN (`x-required-role: ADMIN`). API key Geoapify và LLM là cấu hình phía server; key map tiles riêng được giới hạn domain/origin và attribution hiển thị. Base URL/model/key của LLM chưa có giá trị triển khai vì người dùng sẽ cung cấp API sau; contract đã chốt adapter HTTP, timeout, output limit, rate limit và prompt version, không làm màn cài đặt LLM trong CP3.

## Kiểm tra nguồn kỹ thuật

- Geoapify có endpoint Address Autocomplete riêng, nên không dùng Nominatim public cho typeahead: [Address Autocomplete API](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/).
- Geoapify Routing API hỗ trợ lộ trình: [Routing API](https://apidocs.geoapify.com/docs/routing/).
- Geoapify cung cấp OSM raster tiles cho Leaflet và ghi rõ attribution cần thiết: [Map tiles and attribution](https://apidocs.geoapify.com/docs/maps/).
- Leaflet 1.9.4 được liệt kê là stable trong docs hiện hành: [Leaflet API reference](https://leafletjs.com/reference/).

## Gate và phần tiếp theo

- Contract nguồn backend và bản mirror frontend đã cập nhật; schema không sinh migration tự động.
- Thay đổi backend được tách thành branch/PR theo CLAUDE.md; owner contract (Đức) cần review/approve trước khi viết migration/backend.
- Chưa chạy `orval` hoặc sửa generated client; phải làm sau khi contract backend được duyệt và đồng bộ phiên bản.
