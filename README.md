# vingo-web

Giao diện web của **Vingo** — đặt vé sự kiện bằng cách chat với AI. Người mua chat để tìm sự kiện, chọn ghế, thanh toán VNPay và nhận vé QR; admin dùng dashboard để quản lý sân, sự kiện, đơn và xem báo cáo; nhân viên soát vé quét QR tại cổng.

| Repo                                                       | Vai trò                                               |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| [vingo-backend](https://github.com/TNTD-dev/vingo-backend) | REST API + SSE, giữ contract gốc `vingo-openapi.yaml` |
| [vingo-agent](https://github.com/TNTD-dev/vingo-agent)     | AI agent cho buyer và admin                           |
| **vingo-web** (repo này)                                   | Toàn bộ giao diện                                     |

> Trạng thái: **khung dự án**. Đủ route, client API, auth, realtime, mock; các màn đang là placeholder chờ thiết kế.

## Mục lục

- [Yêu cầu](#yêu-cầu)
- [Chạy nhanh](#chạy-nhanh)
- [Biến môi trường](#biến-môi-trường)
- [Lệnh](#lệnh)
- [Contract và client sinh tự động](#contract-và-client-sinh-tự-động)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Màn hình và route](#màn-hình-và-route)
- [Đăng nhập và phiên](#đăng-nhập-và-phiên)
- [Realtime (SSE)](#realtime-sse)
- [Chat và block](#chat-và-block)
- [Thiết kế giao diện](#thiết-kế-giao-diện)
- [Test và CI](#test-và-ci)
- [Quy ước](#quy-ước)

## Yêu cầu

- Node.js ≥ 24 và npm
- Để chạy với backend thật: repo `vingo-backend` chạy ở `localhost:8080` (xem README của backend)

## Chạy nhanh

**Không cần backend** — toàn bộ API được giả bằng mock sinh từ contract:

```bash
npm ci
npm run dev:mock
```

Mở http://localhost:3000. Đã đăng nhập sẵn bằng user giả vai trò ADMIN (vào được mọi màn); muốn xem như người mua thì chạy `VITE_MOCK_ROLE=BUYER npm run dev:mock`. Dữ liệu còn lại là ngẫu nhiên theo schema, chỉ để dựng UI.

**Với backend local:**

```bash
# trong vingo-backend
docker compose -f deploy/compose.dev.yaml up -d
./mvnw spring-boot:run -Dspring-boot.run.profiles=api,local

# trong vingo-web
cp .env.example .env
npm run dev
```

Vite proxy chuyển `/api/*` sang `http://localhost:8080`, nên trình duyệt chỉ thấy một origin (`localhost:3000`). Cổng 3000 khớp với `AUTH_FRONTEND_RETURN_URL` mặc định của backend (`http://localhost:3000/auth/google`) — đổi cổng thì phải đổi cả biến này bên backend, nếu không refresh bằng cookie sẽ bị 403.

## Biến môi trường

| Biến               | Mặc định                | Ý nghĩa                                                        |
| ------------------ | ----------------------- | -------------------------------------------------------------- |
| `VITE_API_BASE`    | `/api/v1`               | Base path của API                                              |
| `API_PROXY_TARGET` | `http://localhost:8080` | Backend mà Vite proxy tới khi `npm run dev` (không vào bundle) |
| `VITE_USE_MOCK`    | `false`                 | `true` = dùng mock MSW thay backend                            |
| `VITE_MOCK_ROLE`   | `ADMIN`                 | Vai trò user giả khi dùng mock (`ADMIN` hoặc `BUYER`)          |
| `VITE_SENTRY_DSN`  | trống                   | Có giá trị thì bật Sentry                                      |

Mọi biến `VITE_*` bị nhúng vào bundle gửi xuống trình duyệt — **không đặt bí mật vào đó**.

## Lệnh

| Lệnh                              | Việc                                                      |
| --------------------------------- | --------------------------------------------------------- |
| `npm run dev`                     | Dev server ở cổng 3000, proxy tới backend                 |
| `npm run dev:mock`                | Dev server dùng mock, không cần backend                   |
| `npm run contract:sync`           | Lấy `vingo-openapi.yaml` theo `CONTRACT_VERSION`          |
| `npm run generate`                | Sinh lại client + mock từ contract (tự chạy sau `npm ci`) |
| `npm run lint`                    | oxlint                                                    |
| `npm run format` / `format:check` | Prettier (kèm sắp xếp class Tailwind)                     |
| `npm run typecheck`               | `tsc -b`                                                  |
| `npm test` / `test:watch`         | Vitest                                                    |
| `npm run build`                   | Build production vào `dist/`                              |
| `npm run check`                   | Chạy tất cả bước CI — chạy trước khi mở PR                |

## Contract và client sinh tự động

Backend giữ contract gốc. Repo này ghim một phiên bản và sinh client từ đó:

```
vingo-backend/contracts/vingo-openapi.yaml
        │  npm run contract:sync  (theo CONTRACT_VERSION)
        ▼
contracts/vingo-openapi.yaml        ← commit trong repo này
        │  npm run generate  (Orval)
        ▼
src/api/generated/
  ├── model/                        ← type cho mọi schema
  └── endpoints/<tag>/
        ├── <tag>.ts                ← hàm fetch + hook TanStack Query
        └── <tag>.msw.ts / .faker.ts← mock cho dev:mock
```

- `CONTRACT_VERSION` = `local` → copy từ `../vingo-backend` (đặt `BACKEND_DIR` nếu repo nằm chỗ khác). Khi backend bắt đầu gắn tag `contract-vX.Y.Z`, ghi tag vào file này; script sẽ tải từ GitHub Release (cần `gh` đã đăng nhập).
- `src/api/generated` không commit và không sửa tay.
- Mọi request đi qua `src/api/http.ts`: gắn base path và Bearer, tự refresh khi 401, ném `ApiError` khi lỗi.

Gọi API trong component:

```tsx
import { useListMyOrders } from '@/api/generated/endpoints/booking/booking'
import { isApiError } from '@/api/problem'

const orders = useListMyOrders({ limit: 20 })

// lỗi xử lý theo code trong ProblemDetail, không theo chuỗi
if (isApiError(err, 'SEAT_TAKEN')) {
  /* gợi ý ghế khác */
}
```

Thao tác cần `Idempotency-Key` (giữ ghế, tạo thanh toán, resolve-review): tạo bằng `newIdempotencyKey()` trong `src/api/idempotency.ts`, một key cho một lần bấm, retry thì dùng lại.

## Cấu trúc thư mục

```
vingo-web/
├── CONTRACT_VERSION
├── contracts/vingo-openapi.yaml
├── scripts/sync-contract.sh
├── orval.config.ts
├── components.json              cấu hình shadcn/ui
├── public/mockServiceWorker.js  service worker của MSW
└── src/
    ├── main.tsx                 bật mock / Sentry rồi render App
    ├── index.css                Tailwind + token thiết kế
    ├── app/                     App (providers), router, layouts
    ├── api/                     http.ts, problem.ts, idempotency.ts, generated/
    ├── auth/                    token store, AuthProvider, RequireAuth
    ├── realtime/                useMeStream (SSE), khử trùng sự kiện
    ├── mocks/                   MSW: handler Orval + mock SSE
    ├── design/                  ui/ (shadcn), brand/ (logo, mascot), Placeholder, spinner
    ├── seatmap/                 SeatMapView: sơ đồ ghế vẽ từ SVG admin nhập
    ├── lib/                     money (VND), time (giờ VN), cn
    ├── features/
    │   ├── landing/             trang giới thiệu
    │   ├── auth/                đăng nhập, đăng ký, OTP, quên mật khẩu, callback Google
    │   ├── booking/             sự kiện, chọn ghế, thanh toán, kết quả thanh toán
    │   ├── account/             đơn, vé, hồ sơ, bảo mật tài khoản
    │   ├── agent/               Vingo agent mode cho buyer
    │   ├── checkin/             soát vé
    │   ├── admin-dashboard/     tổng quan, báo cáo
    │   ├── admin-catalog/       sân, sơ đồ ghế, sự kiện, suất, khoá ghế
    │   ├── admin-ops/           đơn, xử lý đơn lỗi, vé, nhật ký
    └── chat/                   khung chat buyer
    └── blocks/                  block hiển thị trong chat + registry
```

## Màn hình và route

| Route                                                                   | Màn                               | Quyền                          | API chính                                    |
| ----------------------------------------------------------------------- | --------------------------------- | ------------------------------ | -------------------------------------------- |
| `/login` `/register` `/verify-otp` `/forgot-password` `/reset-password` | Đăng nhập, đăng ký                | public                         | `login`, `register`, `verifyOtp`…            |
| `/auth/google`                                                          | Nhận kết quả Google login         | public                         | `refreshToken`                               |
| `/`                                                                     | Landing                           | public                         | —                                            |
| `/vingo`                                                                | Vingo agent mode                  | public (gửi tin cần đăng nhập) | `sendMessage`, `/me/stream`                  |
| `/events`, `/events/:eventId`                                           | Sự kiện                           | public                         | `searchEvents`, `getEvent`                   |
| `/events/:eventId/showtimes/:showtimeId/seats`                          | Chọn ghế                          | public (giữ ghế cần đăng nhập) | `getSeatmap`, `getAvailability`, `holdSeats` |
| `/orders`, `/orders/:orderId`                                           | Đơn của tôi                       | BUYER                          | `listMyOrders`, `getOrder`                   |
| `/orders/:orderId/checkout`                                             | Thanh toán                        | BUYER                          | `getOrder`, `createPayment`, `cancelOrder`   |
| `/payment/vnpay-return`                                                 | Kết quả thanh toán (chỉ hiển thị) | BUYER                          | `getOrder`                                   |
| `/tickets`, `/tickets/:ticketId`                                        | Vé của tôi                        | BUYER                          | `listMyTickets`, `getTicketQr`               |
| `/me`                                                                   | Hồ sơ                             | BUYER                          | `getMe`, `getBuyerProfile`                   |
| `/me/security`                                                          | Bảo mật tài khoản                 | BUYER                          | `getMe`, `updateMe`, `deleteMe`, `logout`    |
| `/checkin`                                                              | Soát vé                           | đăng nhập                      | `checkIn`                                    |
| `/admin`                                                                | Tổng quan                         | ADMIN                          | `queryMetric`, `adminListOrders`             |
| `/admin/reports`                                                        | Báo cáo                           | ADMIN                          | `queryMetric`                                |
| `/admin/venues[/:venueId]`, `/admin/halls/:hallId/layouts`              | Sân, sơ đồ ghế                    | ADMIN                          | `listVenues`, `importSeatLayoutSvg`…         |
| `/admin/events[/:eventId]`                                              | Sự kiện                           | ADMIN                          | `createEvent`, `putPriceTiers`…              |
| `/admin/showtimes/:showtimeId/seats`                                    | Khoá/mở ghế                       | ADMIN                          | `getSeatmap`, `blockSeats`, `unblockSeats`   |
| `/admin/orders[/:orderId]`                                              | Đơn, xử lý đơn lỗi                | ADMIN                          | `adminListOrders`, `resolveReview`           |
| `/admin/tickets`                                                        | Vé                                | ADMIN                          | `adminListTickets`, `voidTicket`             |
| `/admin/audit-logs`                                                     | Nhật ký thao tác                  | ADMIN                          | `listAuditLogs`                              |

Mỗi màn hiện dùng `<Placeholder>` ghi tên các operation sẽ gọi; các màn danh sách/chi tiết đã gọi API thật và in JSON thô để kiểm tra dây nối. Thay bằng UI thật khi có thiết kế. Thêm màn mới: tạo `features/<nhóm>/XxxPage.tsx` (export default) và khai báo trong `src/app/router.tsx`.

## Đăng nhập và phiên

- Access token (JWT 15 phút) chỉ giữ **trong bộ nhớ**, không lưu `localStorage`.
- Gặp 401, `http.ts` gọi `POST /auth/refresh` đúng một lần (gộp các request đồng thời) rồi gọi lại.
- **Google login:** backend đặt cookie refresh HttpOnly rồi chuyển về `/auth/google?google_login=…`; web đổi cookie lấy access token. Tải lại trang vẫn giữ phiên.
- **Mật khẩu:** `/auth/login` hiện trả `refresh_token` trong JSON, không đặt cookie → web giữ trong bộ nhớ, **tải lại trang là mất phiên**. Cần backend đặt cookie refresh cho cả login mật khẩu (giống Google) để giữ phiên.
- `RequireAuth` / `RequireAuth allow="ADMIN"` chỉ để điều hướng; backend mới là nơi chặn quyền.

## Realtime (SSE)

`useMeStream(handler)` mở `GET /me/stream`:

- Dùng `@microsoft/fetch-event-source` vì `EventSource` không gửi được header `Authorization`.
- Nối lại kèm `Last-Event-ID`; server phát lại 5 phút gần nhất nên sự kiện có thể trùng → khử trùng theo `id`.
- Stream đóng khi token hết hạn → tự refresh rồi nối lại.
- `order.*`, `payment.failed` → invalidate query đơn; `ticket.issued` → invalidate query vé; `chat.*` → chuyển cho handler.

## Chat và block

Gửi tin: `POST /chat/conversations/{id}/messages` trả 202; câu trả lời về qua `/me/stream` dưới dạng `chat.delta` (chữ), `chat.block` (block UI), `chat.done`.

Mỗi `ChatBlockType` trong contract có một component trong `src/blocks/`, đăng ký ở `registry.tsx`: `SeatMap`, `OrderSummary`, `PaymentQR`, `Ticket`, `ConfirmAction`, `StatCards`, `Chart`, `EventList`. Contract thêm type mới thì TypeScript báo thiếu ở registry. Thao tác trên block (ví dụ chọn ghế) gửi lại agent qua `block_event` của `sendMessage`.

## Thiết kế giao diện

- Tailwind v4 + [shadcn/ui](https://ui.shadcn.com). Component nằm trong `src/design/ui`, là code của repo — sửa thoải mái.
- Thêm component: `npx shadcn@latest add <tên>`. Sau khi thêm, kiểm tra dòng import `cn` trỏ `@/lib/cn`.
- Thiết kế: Figma "Vingo Web — UI/UX" (https://www.figma.com/design/wLd7IVrkjHUi4EkEJgUEYf). Token màu, bo góc, font, bóng, kiểu chữ (`type-*`) đã nhập vào `src/index.css`; đổi ở Figma trước rồi cập nhật file này.
- Logo và 7 trạng thái mascot Vingo ở `src/design/brand` (SVG xuất từ Figma).
- Hỗ trợ màn hình từ 360px.

## Test và CI

- Vitest + Testing Library, file test nằm cạnh code (`*.test.ts(x)`).
- Đã có test cho: mutator `http` (Bearer, refresh khi 401, `ApiError` mang `code`), guard phân quyền, khử trùng SSE, format tiền/giờ, registry block.
- GitHub Actions (`.github/workflows/ci.yml`) chạy `npm ci` → lint → format → typecheck → test → build cho mọi PR.

## Quy ước

Quy tắc chi tiết cho người và AI agent: [CLAUDE.md](CLAUDE.md). Tóm tắt:

- Chỉ gọi API qua client sinh từ contract; đổi API thì PR vào `vingo-backend` trước.
- Trang return VNPay chỉ hiển thị, không đổi trạng thái đơn.
- Tiền là số nguyên VND, hiển thị bằng `formatVnd`; giờ API là UTC, hiển thị bằng `formatDateTime`.
- Comment và commit message tiếng Việt; tên trong code tiếng Anh.
- PR vào `develop`, nhánh ngắn, PR nhỏ. Chạy `npm run check` trước khi mở PR.
