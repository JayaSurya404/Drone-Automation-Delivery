import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CatalogService } from "../catalog/catalog.service";
import type { AddCartItemDto } from "./dto/add-cart-item.dto";
import type { UpdateCartItemDto } from "./dto/update-cart-item.dto";

export interface CartItemView {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string | null;
  isInStock: boolean;
}

export interface CartView {
  id: string;
  items: CartItemView[];
  subtotal: number;
  itemCount: number;
}

const cartInclude = {
  items: {
    include: {
      variant: true,
      product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: CatalogService,
  ) {}

  async getCart(userId: string): Promise<CartView> {
    const cart = await this.ensureCart(userId);
    return this.toView(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartView> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { product: true },
    });
    if (!variant || !variant.isActive || !variant.product.isActive) {
      throw new NotFoundException("Product variant not found");
    }

    const cart = await this.ensureCart(userId);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: dto.variantId } },
    });

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: Math.min(existing.quantity + dto.quantity, 99) },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, productId: variant.productId, variantId: dto.variantId, quantity: dto.quantity },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto): Promise<CartView> {
    const item = await this.getOwnedItem(userId, itemId);
    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity: dto.quantity } });
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    const item = await this.getOwnedItem(userId, itemId);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<CartView> {
    const cart = await this.ensureCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }

  private async ensureCart(userId: string): Promise<CartWithItems> {
    const existing = await this.prisma.cart.findUnique({ where: { userId }, include: cartInclude });
    if (existing) {
      return existing;
    }
    return this.prisma.cart.create({ data: { userId }, include: cartInclude });
  }

  private async getOwnedItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId }, include: { cart: true } });
    if (!item || item.cart.userId !== userId) {
      throw new NotFoundException("Cart item not found");
    }
    return item;
  }

  private async toView(cart: CartWithItems): Promise<CartView> {
    const stockByVariantId = await this.catalogService.getStockByVariantId(cart.items.map((item) => item.variantId));

    const items: CartItemView[] = cart.items.map((item) => {
      const unitPrice = Number(item.variant.priceOverride ?? item.product.basePrice);
      const primaryImage = item.product.images[0];
      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.product.name,
        productSlug: item.product.slug,
        variantName: item.variant.name,
        sku: item.variant.sku,
        unitPrice,
        quantity: item.quantity,
        lineTotal: unitPrice * item.quantity,
        imageUrl: primaryImage ? `/api/v1/media/${primaryImage.storageKey}` : null,
        isInStock: (stockByVariantId.get(item.variantId) ?? 0) > 0,
      };
    });

    return {
      id: cart.id,
      items,
      subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }
}
