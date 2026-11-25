import { Injectable, NotFoundException } from "@nestjs/common";
import type { CustomerAddress } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateAddressDto } from "./dto/create-address.dto";
import type { UpdateAddressDto } from "./dto/update-address.dto";

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<CustomerAddress[]> {
    return this.prisma.customerAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async create(userId: string, dto: CreateAddressDto): Promise<CustomerAddress> {
    if (dto.isDefault) {
      await this.prisma.customerAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }
    return this.prisma.customerAddress.create({
      data: { ...dto, userId },
    });
  }

  async update(userId: string, addressId: string, dto: UpdateAddressDto): Promise<CustomerAddress> {
    await this.getOwnedOrThrow(userId, addressId);
    if (dto.isDefault) {
      await this.prisma.customerAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }
    return this.prisma.customerAddress.update({ where: { id: addressId }, data: dto });
  }

  async remove(userId: string, addressId: string): Promise<void> {
    await this.getOwnedOrThrow(userId, addressId);
    await this.prisma.customerAddress.delete({ where: { id: addressId } });
  }

  async getOwnedOrThrow(userId: string, addressId: string): Promise<CustomerAddress> {
    const address = await this.prisma.customerAddress.findUnique({ where: { id: addressId } });
    if (!address || address.userId !== userId) {
      throw new NotFoundException("Address not found");
    }
    return address;
  }
}
