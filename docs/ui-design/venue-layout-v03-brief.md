# Quản lý sơ đồ — V03: zoom theo mức chi tiết

Ngày: 2026-11-16
Trạng thái: Đề xuất hình ảnh, chờ duyệt trước khi triển khai local.
Công cụ: imagegen tích hợp, sửa tiếp từ V02.

## Yêu cầu người dùng đã bổ sung

- Mặt sân bóng xanh cỏ, đường kẻ trắng; phân biệt với khán đài.
- Tổng quan chỉ hiển thị zone, không render dày đặc từng ghế.
- Lăn chuột zoom, neo vị trí dưới con trỏ; kéo để pan.
- Zoom đủ gần hoặc bấm vào zone thì hiện chi tiết ghế trong vùng đang xem.
- Zoom lùi về tổng quan thì ẩn ghế. Có + / −, vừa khung và chỉ báo zoom.
- Click ghế ở trang cấu hình dùng để xem thông tin; bản PUBLISHED không sửa hình học.

## Gợi ý kỹ thuật cho bước triển khai sau khi chốt

- Đổi mức chi tiết theo kích thước ghế/zone trên màn hình, không hardcode một phần trăm cho mọi SVG.
- Dùng hai ngưỡng vào/ra chế độ ghế để tránh nhấp nháy khi zoom gần ngưỡng.
- Chỉ chặn cuộn trang khi con trỏ đang trong canvas và đang tương tác zoom.
- Lọc hit testing theo chế độ để ghế ẩn không vô tình nhận click.
- Tôn trọng bố cục SVG gốc; cần kiểm tra quy ước group/id cho pitch, zone và seats trước khi đổi màu hoặc ẩn ghế.
- Dải ba bước dưới hình chỉ là chú giải cho bản review, không mặc định đưa vào sản phẩm.

## Prompt

```text
undefined
```
