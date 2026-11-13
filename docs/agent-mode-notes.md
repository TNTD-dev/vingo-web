# Agent mode (buyer): ghi chú triển khai

Phạm vi: `features/agent`, `features/chat`, `blocks/`. Figma page 04 (M1–M6). Copilot admin dùng lại `features/chat` sau.

## Cấu trúc

- `features/chat/ChatPage.tsx`: khung chung (header, dòng hội thoại, ô nhập, mascot, lịch sử). Tuỳ biến bằng `welcome`, `side`, `placeholder`.
- `features/chat/chatReducer.ts`: gom `chat.delta/block/done` + `order.*` thành các `ChatItem`. `chatView.ts`: dòng tool, trạng thái mascot, pill. `useChat.ts`: gửi, duyệt/từ chối, lịch sử.
- `features/agent`: màn chào, panel "Đơn đang làm" (`orderView.ts` suy ra bước), `handoff.ts` (`?q=`, ngữ cảnh từ trang chọn ghế).
- `blocks/payloads.ts`: dạng payload web mong đợi cho từng block (đọc lỏng). Mọi thao tác ghi đi qua `ConfirmAction` → `onDecide` → `confirmAction/rejectAction`.
- `mocks/agent.ts`: kịch bản mock M2→M5 cho `npm run dev:mock`.

## Chỗ thiếu trong contract (cần backend/agent chốt)

1. **Schema payload của block**: `ChatBlock.payload` chỉ là `object`. Web đang giả định (xem `blocks/payloads.ts`): EventList `{events:[{event_id, showtime_id, title, subtitle, image_url, badge:{label,tone}, price_line, recommended, selectable}]}`; SeatMap `{zone_label, row_label, price_label, venue_name, remaining_label, full_map_url, rows:[[{id,label,state}]], suggested:[id]}`; ConfirmAction `{action_id, kind, title, rows:[{label,value,strong}], confirm_label, reject_label, order:{…}}`; PaymentQR `{order_id, order_code, total_amount, expires_at, payment_url, qr_image, status}`; Ticket `{ticket_code, order_code, event_title, date_label, time_label, zone, seat, qr_image, email_masked, status}`; OrderSummary `{order_code, event_title, subtitle, image_url, zone, seats, total_amount, status, expires_at, full_map_url}`.
2. **Không có endpoint liệt kê hội thoại** → lịch sử (M6) chỉ là chỉ mục trong localStorage theo user (id, tiêu đề, đoạn trích, nhãn), tối đa 90 ngày. "Xoá lịch sử" chỉ xoá chỉ mục này. Cần `GET /chat/conversations` (+ xoá) để lịch sử đúng nghĩa "lưu 90 ngày, chỉ chủ xem".
3. **Không có sự kiện bước tool** (SEARCH_EVENTS, CREATE_HOLD…). Web suy ra bước từ loại block và sự kiện `order.*`. Cần sự kiện/field riêng nếu muốn hiện đúng tham số tool (vd `Q=HAGL · 21-22/11`).
4. **Gợi ý trả lời nhanh** (chip dưới tin Vingo, M1b/M5): web đọc `quick_replies: string[]` trong data của `chat.done`. Đề xuất thêm vào contract.
5. **Sự kiện stream thiếu `conversation_id`** (ghi chú: `/me/stream` là của cả người dùng). Web lọc theo `data.conversation_id` nếu có; nếu không có thì mọi tin chat đều vào hội thoại đang mở. Nên thêm `conversation_id` vào `chat.*`.
6. **`confirmAction` không nhận `Idempotency-Key`** (CLAUDE.md yêu cầu cho giữ ghế/thanh toán). Web gọi không kèm key; nếu cần chống bấm đúp ở backend thì thêm tham số vào contract.
7. **Thanh toán**: không hiện QR trong chat. Block `PaymentQR` (giữ tên theo contract) chỉ có số tiền, đếm ngược và nút "Thanh toán qua VNPay" chuyển sang `payment_url` (https) ngay trong tab. Kết quả chỉ chốt qua IPN/querydr; vé về lại hội thoại qua stream. Trang trở về từ VNPay (`/payment/vnpay-return`, của Danh) nên có link quay lại `/vingo`. QR trên block `Ticket` là mã soát vé, vẫn giữ (`qr_image` từ backend).
8. Thứ tự `listMessages` không nêu: web sắp lại theo `created_at` tăng dần.
9. Orval sinh `createConversation`, `sendMessage`, `confirmAction`… dạng query hook (POST); web gọi thẳng hàm `xxx`, không dùng hook.

## Quyết định

- ConfirmAction giữ ghế trong mock nêu rõ "Sau đó: tạo mã QR VNPay" để một lần đồng ý bao cả hai bước như Figma M3→M4 (không có thao tác ghi nào chạy khi chưa bấm). Nếu agent thật tách thanh toán thành ConfirmAction thứ hai thì UI vẫn hiển thị bình thường.
- Mở `/me/stream` xong (`onOpen`) mới gửi `?q=` / ngữ cảnh, để không lỡ phần đầu câu trả lời. `useMeStream` thêm tham số `onOpen` tuỳ chọn (hạ tầng dùng chung, thay đổi nhỏ).
- Layout riêng `AgentLayout` (+ `design/AppNav`) cho `/vingo` thay cho `BuyerLayout`; các trang của Danh không bị đụng. AppNav các link Bóng đá/Concert/Sân khấu hiện cùng trỏ `/events` (chưa có lọc theo loại).
- `qrPattern.ts` chuyển từ `features/landing` sang `design/` để `design/QrCode` dùng chung.
- Trang chọn ghế (Danh) vào Agent mode bằng `navigate('/vingo', { state: { context: { eventTitle, showtimeLabel, zone, seats } } })`. Chưa nối vì không sửa `features/booking`.
