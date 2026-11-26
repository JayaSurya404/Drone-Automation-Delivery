import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Category, Prisma, Product, ProductImage, ProductVariant } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { detectImageType } from "../../common/security/file-upload.util";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../../storage/storage.service";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { ListProductsQueryDto } from "./dto/list-products-query.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";
import type { UpdateVariantDto } from "./dto/update-variant.dto";
import { SEARCH_SERVICE, type SearchService } from "./search/search.types";

type ProductWithRelations = Product & {
  category: Category | null;
  variants: ProductVariant[];
  images: ProductImage[];
};

export interface ProductSummaryView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  categoryId: string | null;
  categoryName: string | null;
  primaryImageUrl: string | null;
  isInStock: boolean;
  createdAt: string;
}

export interface ProductDetailView extends ProductSummaryView {
  images: Array<{ id: string; url: string; altText: string | null; position: number }>;
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    price: number;
    isActive: boolean;
    isInStock: boolean;
  }>;
}

const productWithRelationsInclude = {
  category: true,
  variants: { orderBy: { createdAt: "asc" } },
  images: { orderBy: { position: "asc" } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    @Inject(SEARCH_SERVICE) private readonly searchService: SearchService,
  ) {}

  // --- Categories -----------------------------------------------------

  async listCategoryTree(): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
  }

  async getCategoryBySlug(slug: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category || !category.isActive) {
      throw new NotFoundException("Category not found");
    }
    return category;
  }

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    await this.assertSlugAvailable("category", dto.slug);
    if (dto.parentId) {
      await this.getCategoryOrThrow(dto.parentId);
    }
    return this.prisma.category.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.getCategoryOrThrow(id);
    if (dto.slug) {
      await this.assertSlugAvailable("category", dto.slug, id);
    }
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException("A category cannot be its own parent");
      }
      await this.getCategoryOrThrow(dto.parentId);
    }
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.getCategoryOrThrow(id);
    await this.prisma.category.update({ where: { id }, data: { isActive: false } });
  }

  // --- Products ---------------------------------------------------------

  async listProducts(
    query: ListProductsQueryDto,
  ): Promise<{ products: ProductSummaryView[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    let categoryId: string | undefined;
    if (query.category) {
      const category = await this.prisma.category.findUnique({ where: { slug: query.category } });
      if (!category) {
        return { products: [], total: 0, page, pageSize };
      }
      categoryId = category.id;
    }

    if (query.q) {
      const { productIds, total } = await this.searchService.searchProducts({
        q: query.q,
        categoryId,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        inStockOnly: query.inStockOnly,
        sort: query.sort,
        skip,
        take: pageSize,
      });
      if (productIds.length === 0) {
        return { products: [], total, page, pageSize };
      }
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        include: productWithRelationsInclude,
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      const ordered = productIds.map((id) => byId.get(id)).filter((p): p is ProductWithRelations => !!p);
      const views = await this.toSummaryViews(ordered);
      return { products: views, total, page, pageSize };
    }

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(categoryId ? { categoryId } : {}),
      ...(query.minPrice !== undefined ? { basePrice: { gte: query.minPrice } } : {}),
      ...(query.maxPrice !== undefined ? { basePrice: { lte: query.maxPrice } } : {}),
      ...(query.inStockOnly
        ? { variants: { some: { inventoryItems: { some: { quantityOnHand: { gt: 0 } } } } } }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sort === "price_asc"
        ? { basePrice: "asc" }
        : query.sort === "price_desc"
          ? { basePrice: "desc" }
          : query.sort === "name_asc"
            ? { name: "asc" }
            : { createdAt: "desc" };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productWithRelationsInclude,
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    const views = await this.toSummaryViews(products);
    return { products: views, total, page, pageSize };
  }

  async getProductBySlug(slug: string): Promise<ProductDetailView> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: productWithRelationsInclude,
    });
    if (!product || !product.isActive) {
      throw new NotFoundException("Product not found");
    }
    return this.toDetailView(product);
  }

  async getProductById(id: string): Promise<ProductWithRelations> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productWithRelationsInclude,
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    return product;
  }

  /** Admin lookup by id — unlike getProductBySlug, this also returns inactive (soft-deleted) products. */
  async getProductDetailById(id: string): Promise<ProductDetailView> {
    return this.toDetailView(await this.getProductById(id));
  }

  async createProduct(dto: CreateProductDto): Promise<ProductDetailView> {
    await this.assertSlugAvailable("product", dto.slug);
    if (dto.categoryId) {
      await this.getCategoryOrThrow(dto.categoryId);
    }
    const skus = dto.variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException("Variant SKUs must be unique within a product");
    }
    for (const variant of dto.variants) {
      await this.assertSkuAvailable(variant.sku);
    }

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        basePrice: dto.basePrice,
        currency: dto.currency ?? "USD",
        categoryId: dto.categoryId,
        variants: { create: dto.variants.map((v) => ({ sku: v.sku, name: v.name, priceOverride: v.priceOverride })) },
      },
      include: productWithRelationsInclude,
    });

    // Ensure initial stock record exists at active fulfillment hubs for each created variant
    const activeHubs = await this.prisma.fulfillmentHub.findMany({ where: { isActive: true } });
    for (const variant of product.variants) {
      for (const hub of activeHubs) {
        await this.prisma.inventoryItem.create({
          data: {
            variantId: variant.id,
            hubId: hub.id,
            quantityOnHand: 50,
            lowStockThreshold: 5,
          },
        }).catch(() => {});
      }
    }

    return this.toDetailView(product);
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<ProductDetailView> {
    await this.getProductById(id);
    if (dto.slug) {
      await this.assertSlugAvailable("product", dto.slug, id);
    }
    if (dto.categoryId) {
      await this.getCategoryOrThrow(dto.categoryId);
    }
    const product = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: productWithRelationsInclude,
    });
    return this.toDetailView(product);
  }

  async deleteProduct(id: string): Promise<void> {
    await this.getProductById(id);
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  // --- Variants -----------------------------------------------------------

  async addVariant(productId: string, dto: { sku: string; name: string; priceOverride?: number }): Promise<ProductVariant> {
    await this.getProductById(productId);
    await this.assertSkuAvailable(dto.sku);
    return this.prisma.productVariant.create({
      data: { productId, sku: dto.sku, name: dto.name, priceOverride: dto.priceOverride },
    });
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateVariantDto): Promise<ProductVariant> {
    const variant = await this.getVariantOrThrow(productId, variantId);
    if (dto.sku && dto.sku !== variant.sku) {
      await this.assertSkuAvailable(dto.sku);
    }
    return this.prisma.productVariant.update({ where: { id: variantId }, data: dto });
  }

  async deleteVariant(productId: string, variantId: string): Promise<void> {
    await this.getVariantOrThrow(productId, variantId);
    const remaining = await this.prisma.productVariant.count({ where: { productId, isActive: true } });
    if (remaining <= 1) {
      throw new BadRequestException("A product must have at least one variant");
    }
    await this.prisma.productVariant.update({ where: { id: variantId }, data: { isActive: false } });
  }

  // --- Images ---------------------------------------------------------

  async uploadProductImage(
    productId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    altText?: string,
  ): Promise<{ id: string; url: string; altText: string | null; position: number }> {
    await this.getProductById(productId);

    // Phase 12 fix: never trust the client-supplied `Content-Type` header or
    // filename extension — detect the real format from the file's own
    // magic-number bytes, and derive both the stored content type and the
    // storage-key extension from that detection, never from client input.
    const detected = detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException("Only JPEG, PNG, or WebP image uploads are allowed");
    }

    const storageKey = `products/${productId}/${randomUUID()}.${detected.extension}`;

    await this.storageService.client.send(
      new PutObjectCommand({
        Bucket: this.storageService.bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: detected.mime,
      }),
    );

    const position = await this.prisma.productImage.count({ where: { productId } });
    const image = await this.prisma.productImage.create({
      data: { productId, storageKey, altText, position },
    });

    return { id: image.id, url: this.toMediaUrl(image.storageKey), altText: image.altText, position: image.position };
  }

  async deleteImage(productId: string, imageId: string): Promise<void> {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== productId) {
      throw new NotFoundException("Image not found");
    }
    await this.prisma.productImage.delete({ where: { id: imageId } });
    try {
      await this.storageService.client.send(
        new DeleteObjectCommand({ Bucket: this.storageService.bucket, Key: image.storageKey }),
      );
    } catch {
      // Non-fatal — the DB row (the source of truth for what's "in the catalog") is
      // already gone; an orphaned object in storage is a cheap, safe leftover.
    }
  }

  // --- Mapping helpers -----------------------------------------------------

  private async toSummaryViews(products: ProductWithRelations[]): Promise<ProductSummaryView[]> {
    const stockByVariantId = await this.getStockByVariantId(products.flatMap((p) => p.variants.map((v) => v.id)));
    return products.map((product) => this.toSummaryView(product, stockByVariantId));
  }

  private toSummaryView(product: ProductWithRelations, stockByVariantId: Map<string, number>): ProductSummaryView {
    const activeVariants = product.variants.filter((v) => v.isActive);
    const prices = activeVariants.map((v) => Number(v.priceOverride ?? product.basePrice));
    const price = prices.length > 0 ? Math.min(...prices) : Number(product.basePrice);
    const isInStock = activeVariants.some((v) => (stockByVariantId.get(v.id) ?? 0) > 0);
    const primaryImage = product.images[0];

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price,
      currency: product.currency,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
      primaryImageUrl: primaryImage ? this.toMediaUrl(primaryImage.storageKey) : null,
      isInStock,
      createdAt: product.createdAt.toISOString(),
    };
  }

  private async toDetailView(product: ProductWithRelations): Promise<ProductDetailView> {
    const stockByVariantId = await this.getStockByVariantId(product.variants.map((v) => v.id));
    const summary = this.toSummaryView(product, stockByVariantId);
    return {
      ...summary,
      images: product.images.map((image) => ({
        id: image.id,
        url: this.toMediaUrl(image.storageKey),
        altText: image.altText,
        position: image.position,
      })),
      variants: product.variants
        .filter((v) => v.isActive)
        .map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          price: Number(variant.priceOverride ?? product.basePrice),
          isActive: variant.isActive,
          isInStock: (stockByVariantId.get(variant.id) ?? 0) > 0,
        })),
    };
  }

  /** Sum of quantityOnHand across all hubs, per variant. Public — other modules (e.g. CartModule) reuse this. */
  async getStockByVariantId(variantIds: string[]): Promise<Map<string, number>> {
    if (variantIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.inventoryItem.groupBy({
      by: ["variantId"],
      where: { variantId: { in: variantIds } },
      _sum: { quantityOnHand: true },
    });
    return new Map(rows.map((row) => [row.variantId, row._sum.quantityOnHand ?? 0]));
  }

  private toMediaUrl(storageKey: string): string {
    if (storageKey.startsWith("http://") || storageKey.startsWith("https://") || storageKey.startsWith("/")) {
      return storageKey;
    }
    return `/api/v1/media/${storageKey}`;
  }

  // --- Shared guards -----------------------------------------------------

  private async getCategoryOrThrow(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException("Category not found");
    }
    return category;
  }

  private async getVariantOrThrow(productId: string, variantId: string): Promise<ProductVariant> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== productId) {
      throw new NotFoundException("Variant not found");
    }
    return variant;
  }

  private async assertSlugAvailable(kind: "category" | "product", slug: string, excludeId?: string): Promise<void> {
    const existing =
      kind === "category"
        ? await this.prisma.category.findUnique({ where: { slug } })
        : await this.prisma.product.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`A ${kind} with this slug already exists`);
    }
  }

  private async assertSkuAvailable(sku: string): Promise<void> {
    const existing = await this.prisma.productVariant.findUnique({ where: { sku } });
    if (existing) {
      throw new ConflictException("A variant with this SKU already exists");
    }
  }
}
