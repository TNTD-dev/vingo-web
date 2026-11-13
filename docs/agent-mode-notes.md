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

---

# Admin Copilot: ghi chú triển khai

Phạm vi: `features/copilot`, dùng lại `features/chat` (ChatPage) và `blocks/`. Figma page 05 (C1–C6). Route `/admin/copilot`, chỉ ADMIN.

## Cấu trúc

- `features/copilot/CopilotPage.tsx`: lắp `ChatPage agent="admin"` với `CopilotWelcome` (C1), `TaskPanel` "Việc đang làm" (C2–C5, `taskView.ts` suy ra từ block), `CopilotHistoryPanel` (C6, `copilotHistory.ts`: kết quả phiên + bộ lọc).
- `blocks/`: `StatCards`, `Chart` (C2) làm thật; ba dạng mở rộng chọn bằng `payload.view`: `review_table` (`ReviewTable`, C3), `showtime_form` (`ShowtimeForm`, C4), `seat_lock` (`SeatLock`, C5). Logic thuần ở `adminPayloads.ts`, `reviewState.ts`, `formState.ts`.
- `app/layouts.tsx`: `CopilotLayout` (thanh `design/AdminNav`, không sidebar), nút `CopilotLauncher` ở góc `AdminLayout`; `app/copilotShortcut.ts`: ⌘J / Ctrl+J vào Copilot (từ Copilot bấm lại để quay về `/admin`).
- `mocks/copilot.ts`: kịch bản C2–C5 cho `dev:mock`. Nhận hội thoại tạo từ trang `/admin/copilot` (đọc referrer, vì `createConversation` không có tham số agent), còn lại để mock buyer.

## Quy ước web ↔ agent (giả định, cần chốt)

- Mọi thao tác ghi (`RESOLVE_REVIEW`, `CREATE_SHOWTIME`, `BLOCK_SEATS`…) chỉ chạy qua `ConfirmAction` → `confirmAction(action_id)`. Bảng, form, sơ đồ khoá ghế không tự gọi API.
- `confirmAction` không nhận body nên chỉnh sửa của admin đi qua `sendMessage.block_event`: `review.change {decisions:[{order_id, action}]}`, `showtime.edit {fields:{key: value}}`, `seatmap.select {mode:'block', seats:[id]}`. Agent trả `ConfirmAction` mới; web đánh dấu mọi ConfirmAction đang chờ là `expired` (reducer `supersede`) và khoá ConfirmAction cùng tin cho tới khi admin bấm "Cập nhật", để không duyệt nhầm bản cũ.
- Bảng duyệt chỉ có "Phát hành vé" và "Để sau". Đề xuất `REFUND` hay giá trị lạ đều bị đọc thành "Để sau" và không được chọn (CLAUDE.md §5).
- Khoá ghế: ghế đã bán/đang giữ không chạm được và bị loại khỏi đề xuất ban đầu của agent.
- Payload thêm cho ConfirmAction (Copilot, tuỳ chọn): `task_title`, `summary_rows:[{label,value}]`, `admin_url` (chỉ nhận `/admin/...`). StatCards/Chart: `task_title`, `admin_url`, `source` (hiện ở dòng tool, vd `REVENUE · FROM=05/11 · GROUP_BY=ZONE`).
  - StatCards `{cards:[{label, value_label | value+unit, delta:{label,tone}, compare}]}`; Chart `{title, unit_label, categories:[{label, values:[kỳ trước…kỳ này], tone}]}`; ReviewTable `{orders:[{order_id, code, reason, check:{label,tone}, proposal, selected, status_label, status_tone, tickets}]}`; ShowtimeForm `{title, status_label, fields:[{key,label,value,by_agent}], price_title, prices:[{key,label,value,changed}]}`; SeatLock dùng payload SeatMap + `row_names`, `selected`.

## Chỗ thiếu trong contract (cần backend/agent chốt)

1. **Block type**: chỉ có 8 `ChatBlockType`; bảng duyệt đơn, form suất, khoá ghế phải đi bằng `payload.view` trên block sẵn có (`OrderSummary`, `EventList`, `SeatMap` trong mock). Đề xuất thêm type riêng hoặc `Table`/`Form`.
2. **`confirmAction` không có body / `Idempotency-Key`**: duyệt hàng loạt `resolve-review` cần một key cho mỗi đơn (contract §Idempotency) nhưng web không truyền được; agent phải tự sinh key. Cần xác nhận cách làm.
3. **Không có endpoint liệt kê hội thoại**: lịch sử Copilot lưu localStorage (cùng cơ chế buyer, khoá `admin`). "Kết quả phiên" (đã thực thi / chờ duyệt / từ chối / chỉ đọc) suy ra từ trạng thái ConfirmAction phía web, chưa phản ánh việc duyệt ở thiết bị khác hay do backend hết hạn. Cần `GET /chat/conversations` kèm kết quả. Liên kết "Mở audit" → `/admin/audit-logs`; `AuditLog.via_agent` đã có nên nối được theo thời điểm, chưa có `conversation_id` để nối chính xác.
4. **Không có sự kiện bước tool** (GET_METRICS, LIST_ORDERS, RESOLVE_REVIEW…): các bước ở panel "Việc đang làm" là mẫu cố định theo `kind` của ConfirmAction (hoặc loại block), không phải thông tin thật từ agent.
5. **"Cần chú ý hôm nay" (C1)**: chỉ đếm được đơn NEEDS_REVIEW (`adminListOrders`, tối đa 50). "Hết vé khu D", "23 quét lỗi cổng 3" cần endpoint tổng hợp (cảnh báo vận hành) nên chưa hiển thị.
6. **Link "Mở màn quản trị tương ứng"**: tới trang danh sách (`/admin/orders`, `/admin/events`, `/admin/reports`), chưa lọc sẵn NEEDS_REVIEW hay mở đúng sơ đồ ghế của suất vì chưa biết tham số lọc của màn Danh. Agent có thể gửi `admin_url` cụ thể (vd `/admin/showtimes/:id/seats`).
7. `createConversation` không có tham số `agent` (theo vai trò token) nên mock phải đoán qua referrer.

## Quyết định và chỗ lệch Figma

- Màn Copilot nằm ngoài `AdminLayout` (không sidebar, giống Figma C1); các màn quản trị vẫn dùng sidebar cũ, chỉ thêm nút mở Copilot ở góc. Công tắc "Quản trị | Copilot" nằm ở `AdminNav` (chưa có ở các màn quản trị vì thuộc phần của Danh).
- C3: Figma cho đề xuất "Hoàn tiền thủ công" cho đơn lệch số tiền; web chỉ có "Để sau" (không làm UI hoàn tiền).
- C1: header (Lịch sử/Mới) ẩn ở màn chào như Figma, nên chưa mở lịch sử được trước khi gửi tin đầu. Không có mascot nổi cạnh ô nhập (Figma admin không có).
- Trên điện thoại: logo thu còn biểu tượng (ẩn chữ vingo và nhãn ADMIN), pill "Việc đang làm" thu còn trạng thái + mũi tên.
- Ghế đang giữ cũng không khoá được (Figma chỉ nêu "đã bán"); giữ cho an toàn vì ghế đang giữ thuộc một đơn chờ thanh toán.
- Ô viền lime biến mất khi admin sửa ô đó (ô thành của admin).
- Màu thanh trạng thái `StatusPill` thêm tone `danger` (dùng cho "ĐÃ TỪ CHỐI", cột đỏ ở biểu đồ dùng `bg-danger`).
