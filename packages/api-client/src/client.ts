import {
  aiAnalyticsSchema,
  aiDecisionLogListSchema,
  authResponseSchema,
  cartSchema,
  categoryListSchema,
  categorySchema,
  customerAddressListSchema,
  customerAddressSchema,
  dashboardSummarySchema,
  deliveryAnalyticsSchema,
  deliveryDetailSchema,
  deliveryTrackingSchema,
  droneRecommendationListSchema,
  droneSchema,
  fleetAnalyticsSchema,
  fleetOverviewSchema,
  fulfillmentHubSchema,
  geofenceCheckPointResultSchema,
  geofenceListSchema,
  geofenceSchema,
  healthCheckResponseSchema,
  hubWeatherResponseSchema,
  landingZoneEvaluationSchema,
  missionDetailSchema,
  missionSafetyEventListSchema,
  missionSafetySnapshotSchema,
  orderAnalyticsSchema,
  orderDetailSchema,
  paginatedDeliveriesSchema,
  paginatedDronesSchema,
  paginatedInventorySchema,
  paginatedMissionsSchema,
  paginatedOrdersSchema,
  paginatedProductsSchema,
  productDetailSchema,
  publicUserSchema,
  routeIntelligenceObservationSchema,
  safetyAnalyticsSchema,
  simulationRunSchema,
  simulationScenarioSchema,
  swarmDetailSchema,
  swarmPlanSchema,
  swarmSchema,
  telemetrySampleSchema,
  trendPointListSchema,
  variantRecordSchema,
  verificationCodeResponseSchema,
  visionAnalysisSchema,
  wishlistListSchema,
  type AddCartItemRequest,
  type AdjustStockRequest,
  type AddSwarmMemberRequest,
  type AdvanceStatusRequest,
  type AiAnalytics,
  type AiDecisionLogEntry,
  type AnalyticsDateRangeParams,
  type AnalyticsTrendMetric,
  type AnalyzeVisionFrameRequest,
  type AssignDroneRequest,
  type AssignHubRequest,
  type AuthResponse,
  type CancelDeliveryRequest,
  type CancelOrderRequest,
  type Cart,
  type Category,
  type CheckoutRequest,
  type CreateAddressRequest,
  type CreateCategoryRequest,
  type CreateDroneRequest,
  type CreateGeofenceRequest,
  type CreateMissionRequest,
  type CreateProductRequest,
  type CreateSimulationScenarioRequest,
  type CreateSwarmPlanRequest,
  type CreateSwarmRequest,
  type CustomerAddress,
  type DashboardSummary,
  type DeliveryAnalytics,
  type DeliveryDetail,
  type DeliveryTracking,
  type Drone,
  type DroneRecommendation,
  type EvaluateLandingZoneRequest,
  type FleetAnalytics,
  type FleetOverview,
  type ForgotPasswordRequest,
  type FulfillmentHub,
  type Geofence,
  type GeofenceCheckPointResult,
  type HealthCheckResponse,
  type HubWeatherResponse,
  type InventoryItem,
  type LandingZoneEvaluation,
  type LatLng,
  type ListProductsQuery,
  type LoginRequest,
  type MissionDetail,
  type MissionOverrideRequest,
  type MissionSafetyEvent,
  type MissionSafetySnapshot,
  type OrderAnalytics,
  type OrderDetail,
  type PaginatedDeliveries,
  type PaginatedDrones,
  type PaginatedInventory,
  type PaginatedMissions,
  type PaginatedOrders,
  type PaginatedProducts,
  type ProductDetail,
  type PublicUser,
  type RedeliverRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
  type RouteIntelligenceObservation,
  type RouteIntelligenceQuery,
  type SafetyAnalytics,
  type SetMaintenanceRequest,
  type SimulationRun,
  type SimulationScenario,
  type Swarm,
  type SwarmDetail,
  type SwarmPlan,
  type TelemetrySample,
  type TrendPoint,
  type UpdateAddressRequest,
  type UpdateCartItemRequest,
  type UpdateCategoryRequest,
  type UpdateDroneRequest,
  type UpdateGeofenceRequest,
  type VerificationCodeResponse,
  type VerifyDeliveryRequest,
  type UpdateProductRequest,
  type UpdateVariantRequest,
  type VariantInput,
  type VariantRecord,
  type VisionAnalysis,
  type WishlistItem,
} from "@skynav/shared-types";

export interface ApiClientOptions {
  baseUrl: string;
  clientType?: "customer" | "admin";
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly clientType?: "customer" | "admin";
  private accessToken: string | null = null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.clientType = options.clientType;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /** For the Phase 7 `useSocket` hook — Socket.IO's `auth` option accepts a function re-evaluated on every (re)connect, so this always hands the socket the current in-memory token, including after a silent refresh. */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /** For the Phase 7 `useSocket` hook to build a WebSocket namespace URL (`${getBaseUrl()}/tracking`) — Socket.IO negotiates its own transport upgrade from a plain http(s) URL. */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  async getHealth(): Promise<HealthCheckResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new ApiError(`Health check failed with status ${response.status}`, response.status);
    }
    return healthCheckResponseSchema.parse(await response.json());
  }

  async register(input: RegisterRequest): Promise<AuthResponse> {
    return this.postAuth("/api/v1/auth/register", input);
  }

  async login(input: LoginRequest): Promise<AuthResponse> {
    return this.postAuth("/api/v1/auth/login", input);
  }

  /** Uses the httpOnly refresh cookie; resolves to null if there's no valid session. */
  async refresh(): Promise<AuthResponse | null> {
    const headers: Record<string, string> = {};
    if (this.clientType) {
      headers["x-client-app"] = this.clientType;
    }
    const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers,
      credentials: "include",
    });
    if (!response.ok) {
      return null;
    }
    const body = await this.unwrap(response);
    const parsed = authResponseSchema.parse(body);
    this.accessToken = parsed.accessToken;
    return parsed;
  }

  async logout(): Promise<void> {
    const headers: Record<string, string> = {};
    if (this.clientType) {
      headers["x-client-app"] = this.clientType;
    }
    await fetch(`${this.baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers,
      credentials: "include",
    });
    this.accessToken = null;
  }

  /** Phase 12 hardening — ends every session for the current user, not just this device. */
  async logoutAll(): Promise<void> {
    await this.authorizedFetch("/api/v1/auth/logout-all", { method: "POST" });
    this.accessToken = null;
  }

  async forgotPassword(input: ForgotPasswordRequest): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new ApiError("Request failed", response.status);
    }
  }

  async resetPassword(input: ResetPasswordRequest): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(body?.error?.message ?? "Reset failed", response.status);
    }
  }

  async verifyEmail(token: string): Promise<void> {
    // Phase 12 fix: POST-with-body, not a token-bearing query string — see
    // the API's own doc comment on this endpoint for why.
    const response = await fetch(`${this.baseUrl}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(body?.error?.message ?? "Verification failed", response.status);
    }
  }

  async me(): Promise<PublicUser> {
    const response = await this.authorizedFetch("/api/v1/auth/me");
    return publicUserSchema.parse(await this.unwrap(response));
  }

  async listUsers(params: { page?: number; pageSize?: number } = {}): Promise<{
    users: PublicUser[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    const response = await this.authorizedFetch(`/api/v1/users?${query.toString()}`);
    const body = (await this.unwrap(response)) as {
      users: unknown[];
      total: number;
      page: number;
      pageSize: number;
    };
    return { ...body, users: body.users.map((u) => publicUserSchema.parse(u)) };
  }

  // --- Catalog (public) -----------------------------------------------

  async listCategories(): Promise<Category[]> {
    const response = await this.authorizedFetch("/api/v1/categories");
    return categoryListSchema.parse(await this.unwrap(response));
  }

  async getCategory(slug: string): Promise<Category> {
    const response = await this.authorizedFetch(`/api/v1/categories/${encodeURIComponent(slug)}`);
    return categorySchema.parse(await this.unwrap(response));
  }

  async listProducts(query: ListProductsQuery = {}): Promise<PaginatedProducts> {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.categorySlug) params.set("category", query.categorySlug);
    if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
    if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
    if (query.inStockOnly) params.set("inStockOnly", "true");
    if (query.sort) params.set("sort", query.sort);
    if (query.page) params.set("page", String(query.page));
    if (query.pageSize) params.set("pageSize", String(query.pageSize));

    const response = await this.authorizedFetch(`/api/v1/products?${params.toString()}`);
    return paginatedProductsSchema.parse(await this.unwrap(response));
  }

  async getProduct(slug: string): Promise<ProductDetail> {
    const response = await this.authorizedFetch(`/api/v1/products/${encodeURIComponent(slug)}`);
    return productDetailSchema.parse(await this.unwrap(response));
  }

  /** Admin lookup by id (requires catalog.read) — also returns inactive/soft-deleted products. */
  async getProductById(id: string): Promise<ProductDetail> {
    const response = await this.authorizedFetch(`/api/v1/products/by-id/${id}`);
    return productDetailSchema.parse(await this.unwrap(response));
  }

  // --- Catalog admin (Catalog Manager / Super Admin) ---------------------

  async createCategory(input: CreateCategoryRequest): Promise<Category> {
    const response = await this.authorizedFetch("/api/v1/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return categorySchema.parse(await this.unwrap(response));
  }

  async updateCategory(id: string, input: UpdateCategoryRequest): Promise<Category> {
    const response = await this.authorizedFetch(`/api/v1/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return categorySchema.parse(await this.unwrap(response));
  }

  async deleteCategory(id: string): Promise<void> {
    await this.authorizedFetch(`/api/v1/categories/${id}`, { method: "DELETE" });
  }

  async createProduct(input: CreateProductRequest): Promise<ProductDetail> {
    const response = await this.authorizedFetch("/api/v1/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return productDetailSchema.parse(await this.unwrap(response));
  }

  async updateProduct(id: string, input: UpdateProductRequest): Promise<ProductDetail> {
    const response = await this.authorizedFetch(`/api/v1/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return productDetailSchema.parse(await this.unwrap(response));
  }

  async deleteProduct(id: string): Promise<void> {
    await this.authorizedFetch(`/api/v1/products/${id}`, { method: "DELETE" });
  }

  async addVariant(productId: string, input: VariantInput): Promise<VariantRecord> {
    const response = await this.authorizedFetch(`/api/v1/products/${productId}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return variantRecordSchema.parse(await this.unwrap(response));
  }

  async updateVariant(productId: string, variantId: string, input: UpdateVariantRequest): Promise<VariantRecord> {
    const response = await this.authorizedFetch(`/api/v1/products/${productId}/variants/${variantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return variantRecordSchema.parse(await this.unwrap(response));
  }

  async deleteVariant(productId: string, variantId: string): Promise<void> {
    await this.authorizedFetch(`/api/v1/products/${productId}/variants/${variantId}`, { method: "DELETE" });
  }

  async uploadProductImage(productId: string, file: File): Promise<{ id: string; url: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await this.authorizedFetch(`/api/v1/products/${productId}/images`, {
      method: "POST",
      body: formData,
    });
    return (await this.unwrap(response)) as { id: string; url: string };
  }

  async deleteProductImage(productId: string, imageId: string): Promise<void> {
    await this.authorizedFetch(`/api/v1/products/${productId}/images/${imageId}`, { method: "DELETE" });
  }

  // --- Inventory admin (Catalog Manager / Super Admin) --------------------

  async listInventory(params: { hubId?: string; lowStockOnly?: boolean; page?: number; pageSize?: number } = {}): Promise<PaginatedInventory> {
    const query = new URLSearchParams();
    if (params.hubId) query.set("hubId", params.hubId);
    if (params.lowStockOnly) query.set("lowStockOnly", "true");
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    const response = await this.authorizedFetch(`/api/v1/inventory?${query.toString()}`);
    return paginatedInventorySchema.parse(await this.unwrap(response));
  }

  async listHubs(): Promise<FulfillmentHub[]> {
    const response = await this.authorizedFetch("/api/v1/hubs");
    return fulfillmentHubSchema.array().parse(await this.unwrap(response));
  }

  async adjustStock(inventoryItemId: string, input: AdjustStockRequest): Promise<InventoryItem> {
    const response = await this.authorizedFetch(`/api/v1/inventory/${inventoryItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await this.unwrap(response)) as InventoryItem;
  }

  // --- Cart (authenticated) --------------------------------------------

  async getCart(): Promise<Cart> {
    const response = await this.authorizedFetch("/api/v1/cart");
    return cartSchema.parse(await this.unwrap(response));
  }

  async addCartItem(input: AddCartItemRequest): Promise<Cart> {
    const response = await this.authorizedFetch("/api/v1/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return cartSchema.parse(await this.unwrap(response));
  }

  async updateCartItem(itemId: string, input: UpdateCartItemRequest): Promise<Cart> {
    const response = await this.authorizedFetch(`/api/v1/cart/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return cartSchema.parse(await this.unwrap(response));
  }

  async removeCartItem(itemId: string): Promise<Cart> {
    const response = await this.authorizedFetch(`/api/v1/cart/items/${itemId}`, { method: "DELETE" });
    return cartSchema.parse(await this.unwrap(response));
  }

  async clearCart(): Promise<Cart> {
    const response = await this.authorizedFetch("/api/v1/cart", { method: "DELETE" });
    return cartSchema.parse(await this.unwrap(response));
  }

  // --- Wishlist (authenticated) -----------------------------------------

  async getWishlist(): Promise<WishlistItem[]> {
    const response = await this.authorizedFetch("/api/v1/wishlist");
    return wishlistListSchema.parse(await this.unwrap(response));
  }

  async addWishlistItem(productId: string): Promise<WishlistItem[]> {
    const response = await this.authorizedFetch("/api/v1/wishlist/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    return wishlistListSchema.parse(await this.unwrap(response));
  }

  async removeWishlistItem(productId: string): Promise<WishlistItem[]> {
    const response = await this.authorizedFetch(`/api/v1/wishlist/items/${productId}`, { method: "DELETE" });
    return wishlistListSchema.parse(await this.unwrap(response));
  }

  // --- Addresses (authenticated) ----------------------------------------

  async listAddresses(): Promise<CustomerAddress[]> {
    const response = await this.authorizedFetch("/api/v1/addresses");
    return customerAddressListSchema.parse(await this.unwrap(response));
  }

  async createAddress(input: CreateAddressRequest): Promise<CustomerAddress> {
    const response = await this.authorizedFetch("/api/v1/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return customerAddressSchema.parse(await this.unwrap(response));
  }

  async updateAddress(addressId: string, input: UpdateAddressRequest): Promise<CustomerAddress> {
    const response = await this.authorizedFetch(`/api/v1/addresses/${addressId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return customerAddressSchema.parse(await this.unwrap(response));
  }

  async deleteAddress(addressId: string): Promise<void> {
    await this.authorizedFetch(`/api/v1/addresses/${addressId}`, { method: "DELETE" });
  }

  // --- Checkout / Orders (authenticated) ---------------------------------

  async checkout(input: CheckoutRequest): Promise<OrderDetail> {
    const response = await this.authorizedFetch("/api/v1/orders/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return orderDetailSchema.parse(await this.unwrap(response));
  }

  async listOrders(params: { page?: number; pageSize?: number } = {}): Promise<PaginatedOrders> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    const response = await this.authorizedFetch(`/api/v1/orders?${query.toString()}`);
    return paginatedOrdersSchema.parse(await this.unwrap(response));
  }

  async getOrder(orderId: string): Promise<OrderDetail> {
    const response = await this.authorizedFetch(`/api/v1/orders/${orderId}`);
    return orderDetailSchema.parse(await this.unwrap(response));
  }

  async cancelOrder(orderId: string, input: CancelOrderRequest = {}): Promise<OrderDetail> {
    const response = await this.authorizedFetch(`/api/v1/orders/${orderId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return orderDetailSchema.parse(await this.unwrap(response));
  }

  // --- Orders admin (Order/Support Agent / Super Admin) ------------------

  async listAdminOrders(
    params: { status?: string; userId?: string; page?: number; pageSize?: number } = {},
  ): Promise<PaginatedOrders> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.userId) query.set("userId", params.userId);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    const response = await this.authorizedFetch(`/api/v1/orders/admin?${query.toString()}`);
    return paginatedOrdersSchema.parse(await this.unwrap(response));
  }

  // --- Deliveries (authenticated) ----------------------------------------

  async listOwnDeliveries(params: { page?: number; pageSize?: number } = {}): Promise<PaginatedDeliveries> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    const response = await this.authorizedFetch(`/api/v1/deliveries?${query.toString()}`);
    return paginatedDeliveriesSchema.parse(await this.unwrap(response));
  }

  async getDelivery(deliveryId: string): Promise<DeliveryDetail> {
    const response = await this.authorizedFetch(`/api/v1/deliveries/${deliveryId}`);
    return deliveryDetailSchema.parse(await this.unwrap(response));
  }

  async getDeliveryByOrderId(orderId: string): Promise<DeliveryDetail> {
    const response = await this.authorizedFetch(`/api/v1/deliveries/by-order/${orderId}`);
    return deliveryDetailSchema.parse(await this.unwrap(response));
  }

  async getDeliveryTracking(deliveryId: string): Promise<DeliveryTracking> {
    const response = await this.authorizedFetch(`/api/v1/deliveries/${deliveryId}/tracking`);
    return deliveryTrackingSchema.parse(await this.unwrap(response));
  }

  async getDeliveryVerificationCode(deliveryId: string): Promise<VerificationCodeResponse> {
    const response = await this.authorizedFetch(`/api/v1/deliveries/${deliveryId}/verification-code`);
    return verificationCodeResponseSchema.parse(await this.unwrap(response));
  }

  async verifyDelivery(deliveryId: string, input: VerifyDeliveryRequest): Promise<DeliveryDetail> {
    const response = await this.authorizedFetch(`/api/v1/deliveries/${deliveryId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return deliveryDetailSchema.parse(await this.unwrap(response));
  }

  // --- Deliveries admin (Delivery Coordinator / Super Admin) -------------

  async listAllDeliveries(
    params: { status?: string; hubId?: string; page?: number; pageSize?: number } = {},
  ): Promise<PaginatedDeliveries> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.hubId) query.set("hubId", params.hubId);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    const response = await this.authorizedFetch(`/api/v1/deliveries/admin?${query.toString()}`);
    return paginatedDeliveriesSchema.parse(await this.unwrap(response));
  }

  async assignDeliveryHub(deliveryId: string, input: AssignHubRequest): Promise<DeliveryDetail> {
    const response = await this.authorizedFetch(`/api/v1/deliveries/${deliveryId}/assign-hub`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return deliveryDetailSchema.parse(await this.unwrap(response));
  }

  async unassignDeliveryHub(deliveryId: string): Promise<DeliveryDetail> {
    const response = await this.authorizedFetch(`/api/v1/deliveries/${deliveryId}/unassign-hub`, { method: "POST" });
    return deliveryDetailSchema.parse(await this.unwrap(response));
  }

  async advanceDeliveryStatus(deliveryId: string, input: AdvanceStatusRequest = {}): Promise<DeliveryDetail> {
    const response = await this.authorizedFetch(`/api/v1/deliveries/${deliveryId}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return deliveryDetailSchema.parse(await this.unwrap(response));
  }

  async redeliverDelivery(deliveryId: string, input: RedeliverRequest = {}): Promise<DeliveryDetail> {
    const response = await this.authorizedFetch(`/api/v1/deliveries/${deliveryId}/redeliver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return deliveryDetailSchema.parse(await this.unwrap(response));
  }

  async returnDeliveryToHub(deliveryId: string, note?: string): Promise<DeliveryDetail> {
    const response = await this.authorizedFetch(`/api/v1/deliveries/${deliveryId}/return-to-hub`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    return deliveryDetailSchema.parse(await this.unwrap(response));
  }

  async cancelDelivery(deliveryId: string, input: CancelDeliveryRequest = {}): Promise<DeliveryDetail> {
    const response = await this.authorizedFetch(`/api/v1/deliveries/${deliveryId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return deliveryDetailSchema.parse(await this.unwrap(response));
  }

  async uploadProofOfDelivery(deliveryId: string, file: File, recipientNote?: string): Promise<DeliveryDetail> {
    const formData = new FormData();
    formData.append("file", file);
    if (recipientNote) formData.append("recipientNote", recipientNote);
    const response = await this.authorizedFetch(`/api/v1/deliveries/${deliveryId}/proof-of-delivery`, {
      method: "POST",
      body: formData,
    });
    return deliveryDetailSchema.parse(await this.unwrap(response));
  }

  // --- Drones/Fleet admin (Fleet Manager / Super Admin) -------------------

  async listDrones(params: { status?: string; hubId?: string; availableOnly?: boolean; page?: number; pageSize?: number } = {}): Promise<PaginatedDrones> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.hubId) query.set("hubId", params.hubId);
    if (params.availableOnly) query.set("availableOnly", "true");
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    const response = await this.authorizedFetch(`/api/v1/drones?${query.toString()}`);
    return paginatedDronesSchema.parse(await this.unwrap(response));
  }

  async getFleetOverview(): Promise<FleetOverview> {
    const response = await this.authorizedFetch("/api/v1/drones/fleet-overview");
    return fleetOverviewSchema.parse(await this.unwrap(response));
  }

  async listAvailableDrones(hubId?: string): Promise<Drone[]> {
    const query = hubId ? `?hubId=${encodeURIComponent(hubId)}` : "";
    const response = await this.authorizedFetch(`/api/v1/drones/available${query}`);
    return droneSchema.array().parse(await this.unwrap(response));
  }

  async getDrone(droneId: string): Promise<Drone> {
    const response = await this.authorizedFetch(`/api/v1/drones/${droneId}`);
    return droneSchema.parse(await this.unwrap(response));
  }

  async registerDrone(input: CreateDroneRequest): Promise<Drone> {
    const response = await this.authorizedFetch("/api/v1/drones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return droneSchema.parse(await this.unwrap(response));
  }

  async updateDrone(droneId: string, input: UpdateDroneRequest): Promise<Drone> {
    const response = await this.authorizedFetch(`/api/v1/drones/${droneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return droneSchema.parse(await this.unwrap(response));
  }

  async setDroneMaintenance(droneId: string, input: SetMaintenanceRequest): Promise<Drone> {
    const response = await this.authorizedFetch(`/api/v1/drones/${droneId}/maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return droneSchema.parse(await this.unwrap(response));
  }

  async removeDrone(droneId: string): Promise<void> {
    await this.authorizedFetch(`/api/v1/drones/${droneId}`, { method: "DELETE" });
  }

  // --- Missions admin (Delivery Coordinator / Fleet Manager / Drone Operator) ---

  async listMissions(
    params: { status?: string; safetyState?: string; droneId?: string; page?: number; pageSize?: number } = {},
  ): Promise<PaginatedMissions> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.safetyState) query.set("safetyState", params.safetyState);
    if (params.droneId) query.set("droneId", params.droneId);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    const response = await this.authorizedFetch(`/api/v1/missions?${query.toString()}`);
    return paginatedMissionsSchema.parse(await this.unwrap(response));
  }

  async getMission(missionId: string): Promise<MissionDetail> {
    const response = await this.authorizedFetch(`/api/v1/missions/${missionId}`);
    return missionDetailSchema.parse(await this.unwrap(response));
  }

  async getMissionByDelivery(deliveryId: string): Promise<MissionDetail> {
    const response = await this.authorizedFetch(`/api/v1/missions/by-delivery/${deliveryId}`);
    return missionDetailSchema.parse(await this.unwrap(response));
  }

  async createMission(input: CreateMissionRequest): Promise<MissionDetail> {
    const response = await this.authorizedFetch("/api/v1/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return missionDetailSchema.parse(await this.unwrap(response));
  }

  async assignMissionDrone(missionId: string, input: AssignDroneRequest): Promise<MissionDetail> {
    const response = await this.authorizedFetch(`/api/v1/missions/${missionId}/assign-drone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return missionDetailSchema.parse(await this.unwrap(response));
  }

  async unassignMissionDrone(missionId: string): Promise<MissionDetail> {
    const response = await this.authorizedFetch(`/api/v1/missions/${missionId}/unassign-drone`, { method: "POST" });
    return missionDetailSchema.parse(await this.unwrap(response));
  }

  async startMission(missionId: string): Promise<MissionDetail> {
    const response = await this.authorizedFetch(`/api/v1/missions/${missionId}/start`, { method: "POST" });
    return missionDetailSchema.parse(await this.unwrap(response));
  }

  async progressMission(missionId: string): Promise<MissionDetail> {
    const response = await this.authorizedFetch(`/api/v1/missions/${missionId}/progress`, { method: "POST" });
    return missionDetailSchema.parse(await this.unwrap(response));
  }

  async overrideMission(missionId: string, input: MissionOverrideRequest): Promise<MissionDetail> {
    const response = await this.authorizedFetch(`/api/v1/missions/${missionId}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return missionDetailSchema.parse(await this.unwrap(response));
  }

  // --- Safety: weather + geofencing (Phase 8) -----------------------------

  async getMissionSafety(missionId: string): Promise<MissionSafetySnapshot> {
    const response = await this.authorizedFetch(`/api/v1/missions/${missionId}/safety`);
    return missionSafetySnapshotSchema.parse(await this.unwrap(response));
  }

  async recheckMissionSafety(missionId: string): Promise<MissionDetail> {
    const response = await this.authorizedFetch(`/api/v1/missions/${missionId}/safety/recheck`, { method: "POST" });
    return missionDetailSchema.parse(await this.unwrap(response));
  }

  async listSafetyEvents(limit = 50): Promise<MissionSafetyEvent[]> {
    const response = await this.authorizedFetch(`/api/v1/missions/safety-events?limit=${limit}`);
    return missionSafetyEventListSchema.parse(await this.unwrap(response));
  }

  // --- AI intelligence (Phase 9) -------------------------------------------

  async getMissionAiDecisions(missionId: string, limit = 50): Promise<AiDecisionLogEntry[]> {
    const response = await this.authorizedFetch(`/api/v1/missions/${missionId}/ai?limit=${limit}`);
    return aiDecisionLogListSchema.parse(await this.unwrap(response));
  }

  async getMissionDroneRecommendations(missionId: string): Promise<DroneRecommendation[]> {
    const response = await this.authorizedFetch(`/api/v1/missions/${missionId}/ai/drone-recommendations`);
    return droneRecommendationListSchema.parse(await this.unwrap(response));
  }

  async approveMission(missionId: string): Promise<MissionDetail> {
    const response = await this.authorizedFetch(`/api/v1/missions/${missionId}/approve`, { method: "POST" });
    return missionDetailSchema.parse(await this.unwrap(response));
  }

  // --- Analytics (Phase 10) -------------------------------------------------

  private buildAnalyticsQuery(params: AnalyticsDateRangeParams = {}): string {
    const query = new URLSearchParams();
    if (params.preset) query.set("preset", params.preset);
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    const qs = query.toString();
    return qs ? `?${qs}` : "";
  }

  async getAnalyticsDashboard(params: AnalyticsDateRangeParams = {}): Promise<DashboardSummary> {
    const response = await this.authorizedFetch(`/api/v1/analytics/dashboard${this.buildAnalyticsQuery(params)}`);
    return dashboardSummarySchema.parse(await this.unwrap(response));
  }

  async getOrderAnalytics(params: AnalyticsDateRangeParams = {}): Promise<OrderAnalytics> {
    const response = await this.authorizedFetch(`/api/v1/analytics/orders${this.buildAnalyticsQuery(params)}`);
    return orderAnalyticsSchema.parse(await this.unwrap(response));
  }

  async getDeliveryAnalytics(params: AnalyticsDateRangeParams = {}): Promise<DeliveryAnalytics> {
    const response = await this.authorizedFetch(`/api/v1/analytics/deliveries${this.buildAnalyticsQuery(params)}`);
    return deliveryAnalyticsSchema.parse(await this.unwrap(response));
  }

  async getFleetAnalytics(params: AnalyticsDateRangeParams = {}): Promise<FleetAnalytics> {
    const response = await this.authorizedFetch(`/api/v1/analytics/fleet${this.buildAnalyticsQuery(params)}`);
    return fleetAnalyticsSchema.parse(await this.unwrap(response));
  }

  async getSafetyAnalytics(params: AnalyticsDateRangeParams = {}): Promise<SafetyAnalytics> {
    const response = await this.authorizedFetch(`/api/v1/analytics/safety${this.buildAnalyticsQuery(params)}`);
    return safetyAnalyticsSchema.parse(await this.unwrap(response));
  }

  async getAiAnalytics(params: AnalyticsDateRangeParams = {}): Promise<AiAnalytics> {
    const response = await this.authorizedFetch(`/api/v1/analytics/ai${this.buildAnalyticsQuery(params)}`);
    return aiAnalyticsSchema.parse(await this.unwrap(response));
  }

  async getAnalyticsTrends(metric: AnalyticsTrendMetric, params: AnalyticsDateRangeParams = {}): Promise<TrendPoint[]> {
    const base = this.buildAnalyticsQuery(params);
    const separator = base ? "&" : "?";
    const response = await this.authorizedFetch(`/api/v1/analytics/trends${base}${separator}metric=${metric}`);
    return trendPointListSchema.parse(await this.unwrap(response));
  }

  // --- Advanced Drone Intelligence (Phase 11) -------------------------------

  async analyzeVisionFrame(input: AnalyzeVisionFrameRequest): Promise<VisionAnalysis> {
    const response = await this.authorizedFetch("/api/v1/vision/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return visionAnalysisSchema.parse(await this.unwrap(response));
  }

  async listVisionAnalyses(limit?: number): Promise<VisionAnalysis[]> {
    const qs = limit ? `?limit=${limit}` : "";
    const response = await this.authorizedFetch(`/api/v1/vision/analyses${qs}`);
    return visionAnalysisSchema.array().parse(await this.unwrap(response));
  }

  async getVisionAnalysis(id: string): Promise<VisionAnalysis> {
    const response = await this.authorizedFetch(`/api/v1/vision/analyses/${id}`);
    return visionAnalysisSchema.parse(await this.unwrap(response));
  }

  async evaluateLandingZone(input: EvaluateLandingZoneRequest): Promise<LandingZoneEvaluation> {
    const response = await this.authorizedFetch("/api/v1/vision/landing-zones/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return landingZoneEvaluationSchema.parse(await this.unwrap(response));
  }

  async listLandingZoneEvaluations(limit?: number): Promise<LandingZoneEvaluation[]> {
    const qs = limit ? `?limit=${limit}` : "";
    const response = await this.authorizedFetch(`/api/v1/vision/landing-zones${qs}`);
    return landingZoneEvaluationSchema.array().parse(await this.unwrap(response));
  }

  async createSwarm(input: CreateSwarmRequest): Promise<SwarmDetail> {
    const response = await this.authorizedFetch("/api/v1/swarms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return swarmDetailSchema.parse(await this.unwrap(response));
  }

  async listSwarms(): Promise<Swarm[]> {
    const response = await this.authorizedFetch("/api/v1/swarms");
    return swarmSchema.array().parse(await this.unwrap(response));
  }

  async getSwarm(id: string): Promise<SwarmDetail> {
    const response = await this.authorizedFetch(`/api/v1/swarms/${id}`);
    return swarmDetailSchema.parse(await this.unwrap(response));
  }

  async addSwarmMember(swarmId: string, input: AddSwarmMemberRequest): Promise<SwarmDetail> {
    const response = await this.authorizedFetch(`/api/v1/swarms/${swarmId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return swarmDetailSchema.parse(await this.unwrap(response));
  }

  async removeSwarmMember(swarmId: string, droneId: string): Promise<SwarmDetail> {
    const response = await this.authorizedFetch(`/api/v1/swarms/${swarmId}/members/${droneId}`, { method: "DELETE" });
    return swarmDetailSchema.parse(await this.unwrap(response));
  }

  async disbandSwarm(swarmId: string): Promise<void> {
    await this.authorizedFetch(`/api/v1/swarms/${swarmId}/disband`, { method: "POST" });
  }

  async createSwarmPlan(swarmId: string, input: CreateSwarmPlanRequest): Promise<SwarmPlan> {
    const response = await this.authorizedFetch(`/api/v1/swarms/${swarmId}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return swarmPlanSchema.parse(await this.unwrap(response));
  }

  async listSwarmPlans(swarmId: string): Promise<SwarmPlan[]> {
    const response = await this.authorizedFetch(`/api/v1/swarms/${swarmId}/plans`);
    return swarmPlanSchema.array().parse(await this.unwrap(response));
  }

  async getSwarmPlan(planId: string): Promise<SwarmPlan> {
    const response = await this.authorizedFetch(`/api/v1/swarms/plans/${planId}`);
    return swarmPlanSchema.parse(await this.unwrap(response));
  }

  async reassignSwarmTask(planId: string, assignmentId: string, droneId: string): Promise<SwarmPlan> {
    const response = await this.authorizedFetch(`/api/v1/swarms/plans/${planId}/assignments/${assignmentId}/reassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ droneId }),
    });
    return swarmPlanSchema.parse(await this.unwrap(response));
  }

  async createSimulationScenario(input: CreateSimulationScenarioRequest): Promise<SimulationScenario> {
    const response = await this.authorizedFetch("/api/v1/simulations/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return simulationScenarioSchema.parse(await this.unwrap(response));
  }

  async listSimulationScenarios(): Promise<SimulationScenario[]> {
    const response = await this.authorizedFetch("/api/v1/simulations/scenarios");
    return simulationScenarioSchema.array().parse(await this.unwrap(response));
  }

  async getSimulationScenario(id: string): Promise<SimulationScenario> {
    const response = await this.authorizedFetch(`/api/v1/simulations/scenarios/${id}`);
    return simulationScenarioSchema.parse(await this.unwrap(response));
  }

  async runSimulation(scenarioId: string): Promise<SimulationRun> {
    const response = await this.authorizedFetch(`/api/v1/simulations/scenarios/${scenarioId}/run`, { method: "POST" });
    return simulationRunSchema.parse(await this.unwrap(response));
  }

  async listSimulationRuns(scenarioId: string): Promise<SimulationRun[]> {
    const response = await this.authorizedFetch(`/api/v1/simulations/scenarios/${scenarioId}/runs`);
    return simulationRunSchema.array().parse(await this.unwrap(response));
  }

  async getSimulationRun(runId: string): Promise<SimulationRun> {
    const response = await this.authorizedFetch(`/api/v1/simulations/runs/${runId}`);
    return simulationRunSchema.parse(await this.unwrap(response));
  }

  async getRouteIntelligence(query: RouteIntelligenceQuery): Promise<RouteIntelligenceObservation> {
    const qs = new URLSearchParams({
      originLat: String(query.originLat),
      originLng: String(query.originLng),
      destinationLat: String(query.destinationLat),
      destinationLng: String(query.destinationLng),
    });
    const response = await this.authorizedFetch(`/api/v1/route-intelligence?${qs.toString()}`);
    return routeIntelligenceObservationSchema.parse(await this.unwrap(response));
  }

  async getHubWeather(hubId: string): Promise<HubWeatherResponse> {
    const response = await this.authorizedFetch(`/api/v1/weather/hubs/${hubId}`);
    return hubWeatherResponseSchema.parse(await this.unwrap(response));
  }

  async listGeofences(params: { type?: string; isActive?: boolean } = {}): Promise<Geofence[]> {
    const query = new URLSearchParams();
    if (params.type) query.set("type", params.type);
    if (params.isActive !== undefined) query.set("isActive", String(params.isActive));
    const response = await this.authorizedFetch(`/api/v1/geofences?${query.toString()}`);
    return geofenceListSchema.parse(await this.unwrap(response));
  }

  async getGeofence(id: string): Promise<Geofence> {
    const response = await this.authorizedFetch(`/api/v1/geofences/${id}`);
    return geofenceSchema.parse(await this.unwrap(response));
  }

  async createGeofence(input: CreateGeofenceRequest): Promise<Geofence> {
    const response = await this.authorizedFetch("/api/v1/geofences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return geofenceSchema.parse(await this.unwrap(response));
  }

  async updateGeofence(id: string, input: UpdateGeofenceRequest): Promise<Geofence> {
    const response = await this.authorizedFetch(`/api/v1/geofences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return geofenceSchema.parse(await this.unwrap(response));
  }

  async deleteGeofence(id: string): Promise<void> {
    await this.authorizedFetch(`/api/v1/geofences/${id}`, { method: "DELETE" });
  }

  async checkGeofencePoint(point: LatLng): Promise<GeofenceCheckPointResult> {
    const response = await this.authorizedFetch("/api/v1/geofences/check-point", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(point),
    });
    return geofenceCheckPointResultSchema.parse(await this.unwrap(response));
  }

  // --- Telemetry (polled, admin) ------------------------------------------

  async getLatestTelemetry(droneId: string): Promise<TelemetrySample | null> {
    const response = await this.authorizedFetch(`/api/v1/telemetry/drones/${droneId}/latest`);
    const body = await this.unwrap(response);
    return body ? telemetrySampleSchema.parse(body) : null;
  }

  async getTelemetryHistory(droneId: string, limit = 100): Promise<TelemetrySample[]> {
    const response = await this.authorizedFetch(`/api/v1/telemetry/drones/${droneId}/history?limit=${limit}`);
    return telemetrySampleSchema.array().parse(await this.unwrap(response));
  }

  private async authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, credentials: "include" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(body?.error?.message ?? `Request failed with status ${response.status}`, response.status);
    }
    return response;
  }

  private async postAuth(path: string, body: unknown): Promise<AuthResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.clientType) {
      headers["x-client-app"] = this.clientType;
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new ApiError(errorBody?.error?.message ?? "Request failed", response.status);
    }
    const parsed = authResponseSchema.parse(await this.unwrap(response));
    this.accessToken = parsed.accessToken;
    return parsed;
  }

  private async unwrap(response: Response): Promise<unknown> {
    const json = (await response.json()) as { success: boolean; data: unknown };
    return json.data;
  }
}
