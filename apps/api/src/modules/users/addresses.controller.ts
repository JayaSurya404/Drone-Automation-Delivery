import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type { CustomerAddress } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AddressesService } from "./addresses.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { CreateAddressDto } from "./dto/create-address.dto";
import { UpdateAddressDto } from "./dto/update-address.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Controller("addresses")
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<CustomerAddress[]> {
    return this.addressesService.list(user.sub);
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAddressDto): Promise<CustomerAddress> {
    return this.addressesService.create(user.sub, dto);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<CustomerAddress> {
    return this.addressesService.update(user.sub, id, dto);
  }

  @Delete(":id")
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<{ success: true }> {
    await this.addressesService.remove(user.sub, id);
    return { success: true };
  }
}
