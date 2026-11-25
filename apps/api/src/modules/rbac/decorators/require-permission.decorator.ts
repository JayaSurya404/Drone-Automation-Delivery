import { SetMetadata } from "@nestjs/common";

export const REQUIRE_PERMISSION_KEY = "require_permission";

/** Declares the `"module.action"` permission a route requires; enforced by `PermissionsGuard`. */
export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
