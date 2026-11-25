# SkyNav — API Contract Map & Phase 0 Safety Net

## 1. Phase 0 Safety Net Baseline

- **Safety Tag:** `v0-demo` on branch `admin+customer` (commit `2b20905`)
- **Upgrade Branch:** `feature/claude-stack-upgrade` (branched from `admin+customer`)
- **Baseline E2E Run (`npx tsx test_full_workflow.ts`):**
  - Executed against freshly seeded SQLite databases (`npm run seed:all`) with `customer/backend` on `:5000` and `admin/backend` on `:5001` (Gazebo bridge offline -> fallback kinematics active).
  - **Result:** Exited with code `1` at Step 10 (`30s` timeout).
  - **Observed Steps 1–9 (Passed):**
    - Step 1: Health checks passed on `:5000` (`healthy`) and `:5001` (`ok`).
    - Step 2: Admin login (`admin@skynav`) and product creation (`POST /api/admin/products`) succeeded.
    - Step 3: Product synced to customer catalog (`GET /api/products`).
    - Step 4 & 4b: Customer login (`customer@skynav`) and cart item addition (`POST /api/cart/items`) succeeded.
    - Step 5: Checkout (`POST /api/checkout/orders`) created order in `Pending Dispatch` status; logged `Secure Handover OTP: undefined` because `checkout.ts` sets `delivery_otp = 'PIN_PROTECTED'` in favor of the permanent bcrypt-hashed customer delivery PIN (`4827`).
    - Step 6: Admin backend ingested operational order (`GET /api/admin/orders`).
    - Step 7: Admin status updates (`accepted` -> `packing` -> `packed` -> `ready_for_dispatch`) synced `Preparing` to customer backend.
    - Step 8: Drone `D-001` assigned (`POST /api/admin/dispatch/orders/:id/assign-drone`) and mission `MS-...` created; customer tracking showed `SkyNav Alpha-01 (D-001)`.
    - Step 9: Mission launched (`POST /api/admin/missions/:id/launch`).
  - **Observed Step 10 (Failed):**
    - Outbound telemetry progressed smoothly (`4.63 km` down to `0.783 km` at Tick 30, `Alt=45m`, status `Near Destination`).
    - Terminated at Tick 30 with `Error: Drone did not arrive at customer destination within 30 seconds!`. The 4.71 km Kalapatti corridor at `50 km/h` (`13.889 m/s`) under the 10 Hz engine (`~139 m/s` simulated) needs ~34s to reach touchdown. Additionally, Step 11 in `test_full_workflow.ts` reads `customerOrder.deliveryOtp` (`undefined`), which is superseded by the permanent PIN (`4827`) / hashed verification model.
  - **Baseline Build Check:** Verified after writing this document (see Phase 0 commit).

---

## 2. Customer Frontend API Endpoints (`customer/frontend`)

All requests from `customer/frontend/src/services/api.ts` (and `realtimeDeliveryService.ts`) currently hit relative `/api/...` (Vite proxies `/api` -> `http://127.0.0.1:5000` and `/ws` -> `ws://127.0.0.1:5000`). Note: `api.ts` also has conditional `isSupabaseConfigured()` branches which are inactive when Supabase env vars are unset.

### 2.1 Auth & Profile

| Frontend Caller | Method & Path (Old) | Auth | Request / Query | Response Shape (Old) | Target NestJS API (`/api/v1/...`) Mapping |
|---|---|---|---|---|---|
| `api.auth.login` | `POST /api/auth/login` | Public | `{ email, password }` | `{ message, user: CustomerUser, token }` | `POST /api/v1/auth/login` (sets httpOnly customer refresh cookie, returns `{ accessToken, user }`) |
| `api.auth.register` | `POST /api/auth/register` | Public | `{ name, email, phone, password, confirmPassword, acceptTerms }` | `{ message, user, deliveryPin, token, requiresVerification, email }` | `POST /api/v1/auth/register` (adapt customer PIN/verification handling or frontend adapter) |
| `api.auth.verifyAccount` | `POST /api/auth/verify-account` | Public / Optional JWT | `{ code, email? }` | `{ success, message, user, token }` | `POST /api/v1/auth/verify-email` |
| `api.auth.resendVerification` | `POST /api/auth/resend-verification` | Public / Optional JWT | `{ email? }` | `{ success, message }` | `POST /api/v1/auth/resend-verification` (add or map in auth module) |
| `api.auth.forgotPassword` | `POST /api/auth/forgot-password` | Public | `{ email }` | `{ success, message }` | `POST /api/v1/auth/forgot-password` |
| `api.auth.resetPassword` | `POST /api/auth/reset-password` | Public | `{ email?, code?, password?, newPassword?, confirmPassword }` | `{ success, message }` | `POST /api/v1/auth/reset-password` |
| `api.auth.logout` | `POST /api/auth/logout` | Optional JWT | `{}` | `{ success, message }` | `POST /api/v1/auth/logout` |
| `api.auth.getProfile` / `api.customer.getProfile` | `GET /api/auth/me` | Customer JWT | — | `CustomerUser` (with `notificationPreferences`, `hasDeliveryPin`) | `GET /api/v1/auth/me` |
| `api.customer.updateProfile` | `PUT /api/auth/profile` | Customer JWT | `{ name?, phone?, avatar?, notificationPreferences? }` | `CustomerUser` | `PATCH /api/v1/auth/profile` (add to `UsersModule` / `AuthController` or map in adapter) |
| `api.customer.changePassword` | `POST /api/auth/change-password` | Customer JWT | `{ currentPassword, newPassword, confirmPassword }` | `{ success, message }` | `POST /api/v1/auth/change-password` |
| `api.customer.updateDeliveryPin` | `PUT /api/auth/delivery-pin` | Customer JWT | `{ deliveryPin }` | `403` (permanent system-generated PIN) | Preserve endpoint/behavior or delivery verification policy |

### 2.2 Saved Addresses

| Frontend Caller | Method & Path (Old) | Auth | Request / Query | Response Shape (Old) | Target NestJS API (`/api/v1/...`) Mapping |
|---|---|---|---|---|---|
| `api.customer.getAddresses` | `GET /api/addresses` | Customer JWT | — | `CustomerAddress[]` | `GET /api/v1/addresses` |
| `api.customer.saveAddress` (create) | `POST /api/addresses` | Customer JWT | `{ label, name, phone, building, street, area, city, state, postalCode, latitude, longitude, instructions, isDefault, dropZoneType }` | `CustomerAddress` | `POST /api/v1/addresses` (extend `CustomerAddress` with lat/lng, dropZoneType, building/area) |
| `api.customer.saveAddress` (update) | `PUT /api/addresses/:id` | Customer JWT | Partial address fields | `CustomerAddress` | `PATCH /api/v1/addresses/:id` |
| `api.customer.deleteAddress` | `DELETE /api/addresses/:id` | Customer JWT | — | `{ success, message }` | `DELETE /api/v1/addresses/:id` |
| `api.customer.setDefaultAddress` | `PATCH /api/addresses/:id/default` | Customer JWT | — | `CustomerAddress` | `PATCH /api/v1/addresses/:id` (`{ isDefault: true }`) or `:id/default` |

### 2.3 Catalog, Categories & Reviews

| Frontend Caller | Method & Path (Old) | Auth | Request / Query | Response Shape (Old) | Target NestJS API (`/api/v1/...`) Mapping |
|---|---|---|---|---|---|
| `api.products.getAll` / `getFeatured` / `getDeals` | `GET /api/products` | Public | `?category&search&minPrice&maxPrice&rating&droneOnly&deals&sort&limit&offset` | `Product[]` | `GET /api/v1/products` (map `search`->`q`, `droneOnly`, weight/INR fields, paginated response in `api-client`) |
| `api.products.getById` | `GET /api/products/:id` | Public | `:id` (id or slug) | `Product` (with `customerReviews`, `specifications`, `features`) | `GET /api/v1/products/:slug` / `GET /api/v1/products/by-id/:id` (public id/slug lookup) |
| `api.products.getCategories` | `GET /api/categories` | Public | — | `Category[]` (with `productCount`, `icon`, `image`) | `GET /api/v1/categories` |
| `api.products.getReviews` | `GET /api/reviews/:productId` | Public | — | `ProductReview[]` | Add `reviews` endpoints under `CatalogModule` or `ReviewsModule` |
| `api.products.submitReview` | `POST /api/reviews/:productId` | Customer JWT | `{ rating, title, comment, orderId? }` | `{ success, message }` | Add `POST /api/v1/products/:id/reviews` or `/reviews/:productId` |

### 2.4 Cart & Wishlist

| Frontend Caller | Method & Path (Old) | Auth | Request / Query | Response Shape (Old) | Target NestJS API (`/api/v1/...`) Mapping |
|---|---|---|---|---|---|
| `api.cart.get` | `GET /api/cart` | Customer JWT | `?promo&speed` | `{ items, itemCount, totalWeightGrams, subtotal, deliveryFee, tax, discount, total, appliedPromo, deliverySpeed }` | `GET /api/v1/cart` (adapt variant/product mapping & pricing summary) |
| `api.cart.addItem` | `POST /api/cart/items` | Customer JWT | `{ productId, quantity }` | Cart object | `POST /api/v1/cart/items` |
| `api.cart.updateQuantity` | `PATCH /api/cart/items/:productId` | Customer JWT | `{ quantity }` | Cart object | `PATCH /api/v1/cart/items/:itemId` (adapter maps productId <-> cartItemId/variantId) |
| `api.cart.removeItem` | `DELETE /api/cart/items/:productId` | Customer JWT | — | Cart object | `DELETE /api/v1/cart/items/:itemId` |
| `api.cart.clear` | `DELETE /api/cart` | Customer JWT | — | Empty cart object | `DELETE /api/v1/cart` |
| `api.cart.applyPromo` | `POST /api/cart/promo` | Customer JWT | `{ code }` | `{ success, message, cart }` | Add promo support or handle in cart/pricing |
| `api.wishlist.get` | `GET /api/wishlist` | Customer JWT | — | `Product[]` | `GET /api/v1/wishlist` |
| `api.wishlist.add` | `POST /api/wishlist/:productId` | Customer JWT | — | `{ success, message }` | `POST /api/v1/wishlist/items` (`{ productId }`) |
| `api.wishlist.remove` | `DELETE /api/wishlist/:productId` | Customer JWT | — | `{ success, message }` | `DELETE /api/v1/wishlist/items/:productId` |

### 2.5 Airspace, Eligibility & Checkout / Orders

| Frontend Caller | Method & Path (Old) | Auth | Request / Query | Response Shape (Old) | Target NestJS API (`/api/v1/...`) Mapping |
|---|---|---|---|---|---|
| `api.airspace.getZones` | `GET /api/airspace/zones` | Public | — | `{ zones: NoFlyZone[], hubs, metadata }` | `GET /api/v1/geofences/public` or `/airspace/zones` (Coimbatore DGCA zones + SkyHub Kurumbapalayam) |
| `api.airspace.validate` | `POST /api/airspace/validate` | Public / Customer | `{ latitude, longitude, clearanceRadiusMeters }` | `DropZoneSafetyEvaluation` | `POST /api/v1/geofences/evaluate-dropzone` |
| `api.geofence.checkEligibility` | `POST /api/checkout/eligibility` | Public / Customer | `{ latitude, longitude, clearanceRadiusMeters }` | `GeofenceCheckResult` | `POST /api/v1/geofences/evaluate-dropzone` (replaces stub `ServiceAreaChecker`) |
| `api.orders.create` | `POST /api/checkout/orders` | Customer JWT | `{ addressId?, customAddress?, deliveryAddress?, paymentMethod, deliverySpeed, scheduledTime?, deliveryInstructions?, promoCode? }` | `CustomerOrder` (with `items`, `deliveryAddress`, `timeline`) | `POST /api/v1/orders/checkout` (transactional order + delivery creation) |
| `api.orders.getAll` | `GET /api/orders` | Customer JWT | — | `CustomerOrder[]` | `GET /api/v1/orders` |
| `api.orders.getById` | `GET /api/orders/:id` | Customer JWT | — | `CustomerOrder` | `GET /api/v1/orders/:id` + `GET /api/v1/deliveries/by-order/:orderId` |
| `api.orders.cancel` | `POST /api/orders/:id/cancel` | Customer JWT | `{ reason? }` | `CustomerOrder` | `POST /api/v1/orders/:id/cancel` |
| `api.orders.rate` | `POST /api/orders/:id/rate` | Customer JWT | `{ stars, feedback? }` | `{ success, message }` | Add order rating endpoint |
| `api.orders.verifyPin` / `verifyOtp` | `POST /api/orders/:id/verify-pin` (and `/verify-otp`) | Customer JWT | `{ deliveryPin }` | `{ success, message, status }` | `POST /api/v1/deliveries/:id/verify` (hashed OTP/QR + PIN verification) |

### 2.6 Live Tracking, Notifications & Support

| Frontend Caller | Method & Path (Old) | Auth | Request / Query | Response Shape (Old) | Target NestJS API (`/api/v1/...`) Mapping |
|---|---|---|---|---|---|
| `api.tracking.getSnapshot` | `GET /api/tracking/:orderId` | Customer JWT | — | `LiveTrackingState` (`hubLocation`, `destinationLocation`, `currentDroneLocation`, `flightRoute`, `remainingDistanceKm`, `estimatedArrivalMins`, `droneAssignedName`, etc.) | `GET /api/v1/deliveries/:id/tracking` (and `/by-order/:orderId`) |
| `realtimeDeliveryService` (SSE) | `GET /api/tracking/:orderId/events` | Unauth in old backend (fix -> JWT/Socket.IO) | EventSource stream | SSE JSON packets (`LiveTrackingState` / `TelemetryUpdate`) | Migrate to Socket.IO `/tracking` namespace (`subscribe:delivery`) with JWT handshake |
| `realtimeDeliveryService` (WS) | `WS /ws?orderId=...` | Unauth in old backend | WebSocket frames `{ type: 'SNAPSHOT' \| 'TELEMETRY_UPDATE', data }` | Migrate to Socket.IO `/tracking` namespace (`subscribe:delivery`) |
| `api.notifications.getAll` | `GET /api/notifications` | Customer JWT | — | `CustomerNotification[]` | `GET /api/v1/notifications` (extend `NotificationsModule`) |
| `api.notifications.markAsRead` | `PATCH /api/notifications/:id/read` | Customer JWT | — | `{ success }` | `PATCH /api/v1/notifications/:id/read` |
| `api.notifications.markAllAsRead` | `PATCH /api/notifications/read-all` | Customer JWT | — | `{ success }` | `PATCH /api/v1/notifications/read-all` |
| `api.notifications.clear` | `DELETE /api/notifications/:id` | Customer JWT | — | `{ success }` | `DELETE /api/v1/notifications/:id` |
| `api.support.getFaqs` | `GET /api/support/faqs` | Public | — | `FAQItem[]` | Add `SupportModule` or public FAQ endpoint |
| `api.support.getTickets` | `GET /api/support/tickets` | Customer JWT | — | `SupportTicket[]` | Add `SupportModule` |
| `api.support.createTicket` | `POST /api/support/tickets` | Customer JWT | `{ subject, description, category, orderId? }` | `SupportTicket` | Add `SupportModule` |
| `api.support.addMessage` | `POST /api/support/tickets/:id/messages` | Customer JWT | `{ message }` | Message object | Add `SupportModule` |

### 2.7 External & Static Calls (`customer/frontend`)
- `AddressStep.tsx`: `GET https://nominatim.openstreetmap.org/reverse?format=json&lat=...&lon=...` (external reverse geocoding, best-effort).
- Product images: `/images/products/*.jpg` (served locally via Vite `public/images/products/` and/or `/api/v1/media/...`).

---

## 3. Admin Frontend API Endpoints (`admin/frontend`)

All requests from `admin/frontend/src` currently hit relative `/api/admin/...` (Vite proxies `/api` -> `http://127.0.0.1:5001` and `/ws/admin` -> `ws://127.0.0.1:5001`), plus direct polling to Gazebo bridge on `http://localhost:8085`.

### 3.1 Admin Auth

| Frontend Caller | Method & Path (Old) | Auth | Request / Query | Response Shape (Old) | Target NestJS API (`/api/v1/...`) Mapping |
|---|---|---|---|---|---|
| `AuthContext.login` | `POST /api/admin/auth/login` | Public | `{ email, password, role? }` | `{ token, user: AdminUser }` | `POST /api/v1/auth/login` (separate admin refresh cookie name & path, returns `{ accessToken, user }` with roles + RBAC `permissions[]`) |
| `AuthContext` mount check | `GET /api/admin/auth/me` | Admin JWT | — | `{ user: AdminUser }` | `GET /api/v1/auth/me` (or `POST /api/v1/auth/refresh` on boot for in-memory access token) |

### 3.2 Products & Categories (`ProductsPage.tsx`, `OrdersPage.tsx`)

| Frontend Caller | Method & Path (Old) | Auth (Old -> Target) | Request / Query | Response Shape (Old) | Target NestJS API (`/api/v1/...`) Mapping |
|---|---|---|---|---|---|
| `ProductsPage.fetchCatalog` | `GET /api/admin/products` | None -> `catalog.read` | — | Raw admin product rows (`category_name`, `stock_count`, `weight_grams`, etc.) | `GET /api/v1/products` (with admin catalog view/filter) |
| `ProductsPage.fetchCatalog` | `GET /api/admin/products/categories` | None -> `catalog.read` | — | Category rows | `GET /api/v1/categories` |
| `ProductsPage.handleSubmit` / `mockStore.createProduct` | `POST /api/admin/products` | None -> `catalog.create` | `{ name, brand, categoryId, subCategory, description, price, stockCount, weightGrams, isDroneEligible, isActive, image, badge }` | Created product row | `POST /api/v1/products` + `PATCH /api/v1/inventory/:id` |
| `ProductsPage.handleSubmit` (edit) | `PUT /api/admin/products/:id` | None -> `catalog.update` | Partial product fields | Updated product row | `PATCH /api/v1/products/:id` |
| `ProductsPage.handleArchive` | `DELETE /api/admin/products/:id` | None -> `catalog.delete` | — | `{ success, message }` | `DELETE /api/v1/products/:id` |

### 3.3 Orders, Dispatch, Fleet & Missions (`mockDataStore.ts`)

| Frontend Caller | Method & Path (Old) | Auth (Old -> Target) | Request / Query | Response Shape (Old) | Target NestJS API (`/api/v1/...`) Mapping |
|---|---|---|---|---|---|
| `mockStore.fetchOperationalData` | `GET /api/admin/orders` | None -> `orders.read` | — | `OperationalOrder[]` | `GET /api/v1/orders/admin` + `GET /api/v1/deliveries/admin` |
| `mockStore.updateOrderStatus` | `POST /api/admin/orders/:orderId/status` | None -> `delivery.update` | `{ status, description? }` | `{ success, status, customerStatus }` | `POST /api/v1/deliveries/:id/assign-hub` / `advance` (or admin order/delivery workflow) |
| `mockStore.assignDroneToOrder` | `POST /api/admin/dispatch/orders/:orderId/assign-drone` | None -> `missions.create` & `missions.update` | `{ droneId }` | `{ success, missionId, droneId, droneName, status, distanceKm, estimatedDurationMinutes }` | `POST /api/v1/missions` + `POST /api/v1/missions/:id/assign-drone` |
| `mockStore.fetchOperationalData` | `GET /api/admin/fleet` | None -> `drones.read` | — | `Drone[]` | `GET /api/v1/drones` |
| `mockStore.fetchOperationalData` | `GET /api/admin/missions` | None -> `missions.read` | — | `Mission[]` | `GET /api/v1/missions` |
| `mockStore.launchMission` | `POST /api/admin/missions/:missionId/launch` | None -> `missions.update` | — | `{ success, missionId, status, message }` | `POST /api/v1/missions/:id/start` (fails closed on NFZ, weather, battery reserve, or missing high-risk approval) |

### 3.4 Safety, Geofences, Maintenance, People, Audit, Analytics & Admin System (`mockDataStore.ts`)

| Frontend Caller | Method & Path (Old) | Auth (Old -> Target) | Request / Query | Response Shape (Old) | Target NestJS API (`/api/v1/...`) Mapping |
|---|---|---|---|---|---|
| `mockStore.fetchOperationalData` | `GET /api/admin/geofences` | None -> `geofencing.read` | — | `GeofenceZone[]` | `GET /api/v1/geofences` |
| `mockStore.addGeofence` | `POST /api/admin/geofences` | None -> `geofencing.update` | `{ name, type, coordinates, boundsRadiusMeters, active, maxAltitudeMeters, description }` | Created geofence | `POST /api/v1/geofences` (PostGIS polygon validation) |
| `mockStore.fetchOperationalData` | `GET /api/admin/emergencies` | None -> `incidents.read` | — | `EmergencyAlert[]` | `GET /api/v1/missions/safety-events` |
| `mockStore.triggerEmergency` | `POST /api/admin/emergencies` | None -> `missions.override` | `{ droneId, issueType, message }` | `{ id, droneId, issueType, status, message }` | `POST /api/v1/missions/:id/override` or `POST /api/v1/drones/:id/maintenance` / safety trigger |
| `mockStore.executeEmergencyCommand` | `POST /api/admin/emergencies/:id/command` | None -> `missions.override` | `{ command: 'RTH'\|'LAND'\|'PAUSE'\|'CANCEL', droneId }` | `{ success, command, droneId }` | `POST /api/v1/missions/:id/override` (audited with actor + reason) |
| `mockStore.fetchOperationalData` | `GET /api/admin/maintenance` | None -> `drones.read` | — | `MaintenanceRecord[]` | `GET /api/v1/drones` / maintenance logs |
| `mockStore.fetchOperationalData` | `GET /api/admin/audit-logs` | None -> `audit.read` | — | `AuditLog[]` | `GET /api/v1/audit` (expose read endpoint in `AuditModule`) |
| `mockStore.addAuditLog` | `POST /api/admin/audit-logs` | None -> Server-side only | `{ adminName, adminRole, action, entity, entityId, severity, details }` | `{ id, success }` | Replaced by authoritative server-side `AuditService.log()` (client should not forge audit logs) |
| `mockStore.fetchOperationalData` | `GET /api/admin/notifications` | None -> Admin JWT | — | `SystemNotification[]` | `GET /api/v1/notifications` |
| `mockStore.markNotificationRead` | `PATCH /api/admin/notifications/:id/read` | None -> Admin JWT | — | `{ success }` | `PATCH /api/v1/notifications/:id/read` |
| `mockStore.markAllNotificationsRead` | `PATCH /api/admin/notifications/read-all` | None -> Admin JWT | — | `{ success }` | `PATCH /api/v1/notifications/read-all` |
| `mockStore.fetchOperationalData` | `GET /api/admin/customers` | None -> `users.read` | — | Customer summary list | `GET /api/v1/users?role=customer` or admin customer summary |
| `mockStore.fetchOperationalData` | `GET /api/admin/payments` | None -> `orders.read` | — | `PaymentTransaction[]` | `GET /api/v1/orders/admin` / payments summary |
| `mockStore.fetchOperationalData` | `GET /api/admin/merchants` | None -> `catalog.read` | — | `Merchant[]` (in-memory mock in old backend) | Seeded/persisted merchants or hub partners endpoint |
| `mockStore.updateMerchantStatus` | `PATCH /api/admin/merchants/:id/status` | None -> `catalog.update` | `{ status }` | `{ success, merchant }` | Persist or support in catalog/merchants |
| `mockStore.fetchOperationalData` | `GET /api/admin/tickets` | None -> `support.read` | — | `SupportTicket[]` | Support tickets admin endpoint |
| `mockStore.fetchOperationalData` | `GET /api/admin/admins` | None -> `users.read` | — | `AdminUser[]` | `GET /api/v1/users` |

### 3.5 Admin WebSocket & Gazebo Bridge (`mockDataStore.ts`, `SimulationCenter.tsx`)

| Frontend Caller | Protocol & URL | Auth (Old -> Target) | Messages / Payload | Target Mapping |
|---|---|---|---|---|
| `mockStore.connectWebSocket` | `WS /ws/admin` | None -> Admin JWT (`missions.read` / `drones.read` / `telemetry.read`) | Receives `FLEET_SNAPSHOT`, `TELEMETRY_UPDATE`, `MISSION_TOUCHDOWN`, `DRONE_STATUS_CHANGED`, `DRONE_BATTERY_UPDATE`, `ORDER_DELIVERED`, `ORDER_CREATED` | Socket.IO `/ops` namespace (`ops:fleet`, `mission:<id>`, `drone:<id>`) |
| `SimulationCenter.tsx` | `GET http://localhost:8085/health` | Local Gazebo Bridge | `{ status, simulationMode, isNativeGazeboRunning, nativeGazeboPid, ... }` | Retained for Gazebo Simulation Center UI (or proxied via API health/bridge status) |

---

## 4. Legacy Inter-Backend & Backend-Only Endpoints (Deprecated in Phase 3/4)

These endpoints only exist in the split-Express architecture (`:5000` <-> `:5001`) and will be replaced by single-API NestJS `EventEmitter2` domain events and `ServiceAuthGuard` telemetry ingestion in Phase 3:

- `customer/backend` internal HMAC routes (`/api/internal/*`):
  - `POST /api/internal/delivery-update` (receives `ORDER_STATUS_UPDATED`, `DRONE_ASSIGNED`, `MISSION_LAUNCHED`, `DELIVERY_TOUCHDOWN`)
  - `POST /api/internal/telemetry` (receives telemetry updates from admin `telemetryEngine`)
  - `POST /api/internal/products/sync` (receives `PRODUCT_SYNC`)
- `admin/backend` internal HMAC routes (`/api/internal/*`):
  - `POST /api/internal/orders` (receives `ORDER_CREATED`)
  - `POST /api/internal/delivery-completed` (receives `DELIVERY_COMPLETED`)
- `admin/backend` diagnostic/utility routes not called by `admin/frontend`:
  - `GET /api/admin/orders/:id`, `GET /api/admin/missions/:id`, `GET /api/admin/fleet/:id`, `POST /api/admin/fleet/:id/reset`, `POST /api/admin/maintenance`, `GET /api/admin/analytics`, `GET /api/health`
- `customer/backend` utility routes:
  - `GET /api/categories/:slug`, `GET /api/health`
