import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CatalogService } from "../catalog/catalog.service";

export interface WishlistItemView {
  id: string;
  productId: string;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
  isInStock: boolean;
  createdAt: string;
}

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: CatalogService,
  ) {}

  async list(userId: string): Promise<WishlistItemView[]> {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          include: { variants: true, images: { orderBy: { position: "asc" }, take: 1 } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const stockByVariantId = await this.catalogService.getStockByVariantId(
      items.flatMap((item) => item.product.variants.map((v) => v.id)),
    );

    return items.map((item) => {
      const activeVariants = item.product.variants.filter((v) => v.isActive);
      const prices = activeVariants.map((v) => Number(v.priceOverride ?? item.product.basePrice));
      const price = prices.length > 0 ? Math.min(...prices) : Number(item.product.basePrice);
      const isInStock = activeVariants.some((v) => (stockByVariantId.get(v.id) ?? 0) > 0);
      const primaryImage = item.product.images[0];

      return {
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        slug: item.product.slug,
        price,
        imageUrl: primaryImage ? `/api/v1/media/${primaryImage.storageKey}` : null,
        isInStock,
        createdAt: item.createdAt.toISOString(),
      };
    });
  }

  async addItem(userId: string, productId: string): Promise<WishlistItemView[]> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      throw new NotFoundException("Product not found");
    }
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
    return this.list(userId);
  }

  async removeItem(userId: string, productId: string): Promise<WishlistItemView[]> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return this.list(userId);
  }
}
