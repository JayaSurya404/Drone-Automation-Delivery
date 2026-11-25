import { GetObjectCommand, type GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";
import { StorageService } from "./storage.service";

/**
 * Streams objects out of the object store — publicly readable, no auth.
 * Deliberately for catalog assets ONLY (product images) — Phase 12 fix:
 * proof-of-delivery photos (`deliveries/*` keys) used to be reachable here
 * too, with no ownership check at all; they're now served exclusively
 * through `DeliveryController.getProofOfDeliveryImage()`, which re-runs the
 * same ownership check every other customer delivery read uses. Any
 * `deliveries/*` key is refused here even if guessed/leaked.
 */
@ApiExcludeController()
@Controller("media")
export class MediaController {
  constructor(private readonly storageService: StorageService) {}

  @Get(":key(*)")
  async getObject(@Param("key") key: string, @Res() res: Response): Promise<void> {
    if (key.startsWith("deliveries/")) {
      throw new NotFoundException("Not found");
    }

    let object: GetObjectCommandOutput;
    try {
      object = await this.storageService.client.send(
        new GetObjectCommand({ Bucket: this.storageService.bucket, Key: key }),
      );
    } catch {
      throw new NotFoundException("Not found");
    }

    if (!object.Body) {
      throw new NotFoundException("Not found");
    }

    res.setHeader("Content-Type", object.ContentType ?? "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    (object.Body as NodeJS.ReadableStream).pipe(res);
  }
}
