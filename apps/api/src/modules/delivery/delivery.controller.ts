import { GetObjectCommand, type GetObjectCommandOutput } from "@aws-sdk/client-s3";
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { MAX_UPLOAD_SIZE_BYTES } from "../../common/security/file-upload.util";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { StorageService } from "../../storage/storage.service";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CurrentUser } from "../users/decorators/current-user.decorator";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { AdvanceStatusDto } from "./dto/advance-status.dto";
import { AssignHubDto } from "./dto/assign-hub.dto";
import { CancelDeliveryDto } from "./dto/cancel-delivery.dto";
import { ListDeliveriesQueryDto } from "./dto/list-deliveries-query.dto";
import { ProofOfDeliveryDto } from "./dto/proof-of-delivery.dto";
import { RedeliverDto } from "./dto/redeliver.dto";
import { VerifyDeliveryDto } from "./dto/verify-delivery.dto";
import { DeliveryService } from "./delivery.service";

@Controller("deliveries")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  @RequirePermission("orders.read_own")
  async listOwn(@CurrentUser() user: AuthenticatedUser, @Query() query: ListDeliveriesQueryDto) {
    return this.deliveryService.listOwnDeliveries(user.sub, query);
  }

  @Get("admin")
  @RequirePermission("delivery.read")
  async listAll(@Query() query: ListDeliveriesQueryDto) {
    return this.deliveryService.listAllDeliveries(query);
  }

  @Get("by-order/:orderId")
  async getByOrder(@CurrentUser() user: AuthenticatedUser, @Param("orderId") orderId: string) {
    return this.deliveryService.getByOrderId(orderId, user);
  }

  @Get(":id")
  async getOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.deliveryService.getDeliveryForViewer(id, user);
  }

  @Get(":id/tracking")
  async getTracking(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.deliveryService.getTrackingSnapshot(id, user);
  }

  @Get(":id/verification-code")
  async getVerificationCode(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.deliveryService.getVerificationCode(id, user);
  }

  @Post(":id/verify")
  async verify(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: VerifyDeliveryDto) {
    return this.deliveryService.verify(id, dto, user);
  }

  @Post(":id/assign-hub")
  @RequirePermission("delivery.assign")
  async assignHub(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: AssignHubDto) {
    return this.deliveryService.assignHub(id, dto, user);
  }

  @Post(":id/unassign-hub")
  @RequirePermission("delivery.assign")
  async unassignHub(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.deliveryService.unassignHub(id, user);
  }

  @Post(":id/advance")
  @RequirePermission("delivery.update")
  async advance(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: AdvanceStatusDto) {
    return this.deliveryService.advanceStatus(id, dto, user);
  }

  @Post(":id/redeliver")
  @RequirePermission("delivery.update")
  async redeliver(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: RedeliverDto) {
    return this.deliveryService.redeliver(id, dto, user);
  }

  @Post(":id/return-to-hub")
  @RequirePermission("delivery.update")
  async returnToHub(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: AdvanceStatusDto) {
    return this.deliveryService.markReturnedToHub(id, user, dto.note);
  }

  @Post(":id/cancel")
  @RequirePermission("delivery.cancel")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: CancelDeliveryDto) {
    return this.deliveryService.cancel(id, dto, user);
  }

  @Post(":id/proof-of-delivery")
  @RequirePermission("delivery.update")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } }))
  async uploadProofOfDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ProofOfDeliveryDto,
  ) {
    return this.deliveryService.uploadProofOfDeliveryImage(id, file, dto.recipientNote, user);
  }

  /**
   * Phase 12 fix — no `@RequirePermission` here, deliberately: matches the
   * same ownership-checked-in-the-service pattern `getByOrderId`/`getOne`/
   * `getTracking` already use (staff via `delivery.read` OR the owning
   * customer via `orders.read_own`, see `DeliveryService.canView()`), not a
   * single fixed permission. Replaces the previous fully public,
   * unauthenticated `/api/v1/media/<key>` URL this photo used to be served
   * through.
   */
  @Get(":id/proof-of-delivery/image")
  async getProofOfDeliveryImage(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Res() res: Response): Promise<void> {
    const storageKey = await this.deliveryService.getProofOfDeliveryStorageKey(id, user);

    let object: GetObjectCommandOutput;
    try {
      object = await this.storageService.client.send(new GetObjectCommand({ Bucket: this.storageService.bucket, Key: storageKey }));
    } catch {
      throw new NotFoundException("Not found");
    }
    if (!object.Body) {
      throw new NotFoundException("Not found");
    }

    res.setHeader("Content-Type", object.ContentType ?? "application/octet-stream");
    // Never publicly cached — unlike product images, this is a
    // per-viewer-authorized read.
    res.setHeader("Cache-Control", "private, no-store");
    (object.Body as NodeJS.ReadableStream).pipe(res);
  }
}
