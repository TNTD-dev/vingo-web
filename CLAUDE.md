# CLAUDE.md — vingo-web

Quy tắc bắt buộc khi viết code trong repo. Đọc hết trước khi sửa file. Hướng dẫn chạy: [README.md](README.md).
Kế hoạch dự án: Confluence "Vingo – Kế hoạch dự án". Thiết kế hệ thống: `vingo-backend/docs/architecture.html`.
Khi code và tài liệu mâu thuẫn, hỏi lại, không tự đoán.

## 1. Dự án

Giao diện web của Vingo: đặt vé sự kiện qua chat (buyer), Admin Copilot + dashboard (admin), trang soát vé.
Chỉ làm web responsive (dùng được trên điện thoại), không làm app mobile. Chủ repo: Đức.

React 19 + Vite + TypeScript, React Router, TanStack Query, Orval (client + mock MSW), Tailwind v4 + shadcn/ui,
`@microsoft/fetch-event-source`, Sentry. Test: Vitest + Testing Library. Lint: oxlint. Format: Prettier.

## 2. Lệnh

```bash
npm ci                 # cài + sinh client (postinstall chạy orval)
npm run dev            # http://localhost:3000, proxy /api → backend :8080
npm run dev:mock       # không cần backend: mock MSW sinh từ contract
npm run generate       # sinh lại client sau khi đổi contract
npm run contract:sync  # tải contract theo CONTRACT_VERSION
npm run check          # lint + format + typecheck + test + build
```

Luôn chạy `npm run check` trước khi báo xong việc. Không báo xong khi còn đỏ.

## 3. Contract

- `contracts/vingo-openapi.yaml` là bản copy từ `vingo-backend`, ghim bởi `CONTRACT_VERSION`. Không sửa tay; đổi API thì PR vào backend trước.
- **Chỉ gọi API qua client sinh** trong `src/api/generated` (hook `useXxx` hoặc hàm `xxx`). Không tự gõ URL, không tự khai báo type cho dữ liệu API.
- Không sửa, không commit `src/api/generated`.
- Ngoại lệ duy nhất: SSE `/me/stream` (`src/realtime`) và link điều hướng trình duyệt (`/auth/google`).
- API chưa xong thì dùng mock (`npm run dev:mock`). API lên staging thì bỏ mock trong ngày.

## 4. Cấu trúc

```
src/
├── app/         App (providers), router, layouts
├── api/         http.ts (mutator Orval), problem.ts (ApiError), idempotency.ts, generated/ (sinh)
├── auth/        token store, AuthProvider, useAuth, RequireAuth
├── realtime/    useMeStream (SSE /me/stream)
├── mocks/       MSW cho dev:mock
├── design/      ui/ (shadcn), component dùng chung
├── lib/         money, time, cn
├── features/    auth/ chat/ buyer/ checkin/ admin/ dashboard/ — mỗi màn một file *Page.tsx
└── blocks/      block trong chat, mỗi ChatBlockType một component, đăng ký ở registry.tsx
```

- Page export default, route lazy-load ở `app/router.tsx`.
- `features/*` không import lẫn nhau, trừ `chat/ChatPage` dùng chung cho buyer và admin.
- Component dùng chung ≥ 2 feature → chuyển vào `design/`.
- Thêm component shadcn: `npx shadcn@latest add <tên>` (vào `src/design/ui`). Sau khi thêm, kiểm tra import `cn` trỏ `@/lib/cn`.

## 5. Quy tắc nghiệp vụ phía web

- **Trang return VNPay chỉ hiển thị.** Không đổi trạng thái đơn ở đây; chờ `order.paid` trên `/me/stream` hoặc đọc lại đơn.
- **Không tin số tiền phía client.** Hiển thị `total_amount` từ API, không tự cộng giá để gửi lên.
- Giữ ghế, tạo thanh toán, resolve-review: gửi header `Idempotency-Key` từ `newIdempotencyKey()`. Một key cho một lần bấm; retry thì dùng lại key đó.
- Thao tác ghi do agent đề xuất (giữ ghế, thanh toán, tạo sự kiện…) luôn hiện `ConfirmAction` để người dùng xác nhận.
- Xử lý lỗi theo `error.code` (`isApiError(e, 'SEAT_TAKEN')`), không theo chuỗi `detail`.
- Không có hoàn tiền, không đổi ghế. Không làm UI cho tính năng này.

## 6. Auth và bảo mật

- Access token chỉ nằm trong bộ nhớ (`tokenStore`). Không lưu token vào `localStorage`/`sessionStorage`/cookie đọc được bằng JS.
- Refresh: `http.ts` tự refresh một lần khi gặp 401. Không tự gọi `/auth/refresh` ở nơi khác.
- `/admin/**` bọc `RequireAuth allow="ADMIN"`; trang của buyer bọc `RequireAuth`. Guard chỉ để UX, backend mới là nơi chặn quyền.
- Biến `VITE_*` bị nhúng vào bundle: không đặt bí mật.
- Không log token, mật khẩu, OTP, số điện thoại đầy đủ (kể cả `console.log` khi debug).

## 7. Realtime

- Dùng `useMeStream(handler)`. Không mở `EventSource` (không gửi được Bearer).
- Mở stream trước rồi mới tải trạng thái bằng REST. Sự kiện có thể trùng; đã khử trùng theo `id`.

## 8. Hiển thị

- Tiền: `formatVnd()`. Giờ: `formatDateTime()` (API trả UTC, hiển thị giờ Việt Nam). Không tự format.
- Màu, bo góc, font lấy từ token trong `src/index.css`. Không hard-code mã màu trong component.
- Rộng tối thiểu 360px. Mọi màn kiểm tra ở 360px và desktop.

## 9. Test

- Logic (format, reducer, guard, xử lý lỗi) có test Vitest cạnh file: `foo.ts` → `foo.test.ts`.
- Tên test mô tả hành vi.
- Không tắt, skip hay xoá test để build xanh.

## 10. Code style

- Tên biến, hàm, component bằng tiếng Anh; comment và commit message tiếng Việt.
- Import qua alias `@/`. Không dùng `any`.
- Không thêm thư viện mới khi chưa hỏi.

## 11. Git

- Nhánh mặc định cho PR: `develop`. Mỗi task một nhánh, sống không quá 1 ngày, PR nhỏ.
- Không commit `.env`, `src/api/generated`, `dist`.
