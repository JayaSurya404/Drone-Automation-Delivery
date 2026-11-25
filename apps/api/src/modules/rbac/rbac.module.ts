import { Module } from "@nestjs/common";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RbacService } from "./rbac.service";

@Module({
  providers: [RbacService, PermissionsGuard],
  exports: [RbacService, PermissionsGuard],
})
export class RbacModule {}
