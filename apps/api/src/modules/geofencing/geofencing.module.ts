import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { UsersModule } from "../users/users.module";
import { GeofencingController } from "./geofencing.controller";
import { GeofencingService } from "./geofencing.service";

@Module({
  imports: [UsersModule, AuditModule],
  controllers: [GeofencingController],
  providers: [GeofencingService],
  exports: [GeofencingService],
})
export class GeofencingModule {}
