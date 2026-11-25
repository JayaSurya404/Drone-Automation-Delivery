import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import type { EnvConfig } from "../../config/env.validation";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RbacModule } from "../rbac/rbac.module";
import { AddressesController } from "./addresses.controller";
import { AddressesService } from "./addresses.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [
    RbacModule,
    AuditModule,
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvConfig, true>) => ({
        secret: configService.get("JWT_ACCESS_SECRET", { infer: true }),
        signOptions: { expiresIn: configService.get("JWT_ACCESS_TTL", { infer: true }) },
      }),
    }),
  ],
  controllers: [AuthController, UsersController, AddressesController],
  providers: [UsersService, AuthService, JwtAuthGuard, AddressesService],
  exports: [UsersService, AuthService, JwtAuthGuard, JwtModule, AddressesService],
})
export class UsersModule {}
