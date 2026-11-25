import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../config/env.validation";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  public readonly client: S3Client;
  public readonly bucket: string;

  constructor(@Inject(ConfigService) configService: ConfigService<EnvConfig, true>) {
    const endpoint = configService.get("STORAGE_ENDPOINT", { infer: true });
    const port = configService.get("STORAGE_PORT", { infer: true });
    const useSsl = configService.get("STORAGE_USE_SSL", { infer: true });
    this.bucket = configService.get("STORAGE_BUCKET", { infer: true });

    this.client = new S3Client({
      endpoint: `${useSsl ? "https" : "http"}://${endpoint}:${port}`,
      region: configService.get("STORAGE_REGION", { infer: true }),
      forcePathStyle: true,
      credentials: {
        accessKeyId: configService.get("STORAGE_ACCESS_KEY", { infer: true }),
        secretAccessKey: configService.get("STORAGE_SECRET_KEY", { infer: true }),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    // Non-fatal: product image and proof-of-delivery uploads depend on this,
    // but browsing, checkout, missions, and every other read/write path do
    // not — so an unreachable MinIO/S3 endpoint at startup must not block the
    // whole API from serving traffic. It degrades only the upload endpoints
    // (they'll fail at call time with a clear error), not the entire process.
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Bucket "${this.bucket}" not found — created it`);
      } catch {
        this.logger.warn(
          `Object storage unavailable at startup (bucket "${this.bucket}"): ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }
  }

  /** Used by the readiness probe to report object-storage health without gating readiness on it (see `onModuleInit`). */
  async checkConnection(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
