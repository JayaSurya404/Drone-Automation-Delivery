import { FileInterceptor } from "@nestjs/platform-express";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { MAX_UPLOAD_SIZE_BYTES } from "../../common/security/file-upload.util";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { CatalogService, type ProductDetailView, type ProductSummaryView } from "./catalog.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { ListProductsQueryDto } from "./dto/list-products-query.dto";
import { ProductVariantInputDto } from "./dto/product-variant-input.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { UpdateVariantDto } from "./dto/update-variant.dto";

@Controller("products")
export class ProductsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async list(
    @Query() query: ListProductsQueryDto,
  ): Promise<{ products: ProductSummaryView[]; total: number; page: number; pageSize: number }> {
    return this.catalogService.listProducts(query);
  }

  /** Admin lookup by id (also returns inactive/soft-deleted products) — must be registered before the `:slug` route below. */
  @Get("by-id/:id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("catalog.read")
  async findOneById(@Param("id") id: string): Promise<ProductDetailView> {
    return this.catalogService.getProductDetailById(id);
  }

  @Get(":slug")
  async findOne(@Param("slug") slug: string): Promise<ProductDetailView> {
    return this.catalogService.getProductBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("catalog.create")
  async create(@Body() dto: CreateProductDto): Promise<ProductDetailView> {
    return this.catalogService.createProduct(dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("catalog.update")
  async update(@Param("id") id: string, @Body() dto: UpdateProductDto): Promise<ProductDetailView> {
    return this.catalogService.updateProduct(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("catalog.delete")
  async remove(@Param("id") id: string): Promise<{ deleted: true }> {
    await this.catalogService.deleteProduct(id);
    return { deleted: true };
  }

  @Post(":id/variants")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("catalog.create")
  async addVariant(@Param("id") id: string, @Body() dto: ProductVariantInputDto) {
    return this.catalogService.addVariant(id, dto);
  }

  @Patch(":id/variants/:variantId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("catalog.update")
  async updateVariant(
    @Param("id") id: string,
    @Param("variantId") variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.catalogService.updateVariant(id, variantId, dto);
  }

  @Delete(":id/variants/:variantId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("catalog.delete")
  async removeVariant(@Param("id") id: string, @Param("variantId") variantId: string): Promise<{ deleted: true }> {
    await this.catalogService.deleteVariant(id, variantId);
    return { deleted: true };
  }

  @Post(":id/images")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("catalog.create")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } }))
  async uploadImage(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.catalogService.uploadProductImage(id, file, file.originalname);
  }

  @Delete(":id/images/:imageId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("catalog.delete")
  async removeImage(@Param("id") id: string, @Param("imageId") imageId: string): Promise<{ deleted: true }> {
    await this.catalogService.deleteImage(id, imageId);
    return { deleted: true };
  }
}
