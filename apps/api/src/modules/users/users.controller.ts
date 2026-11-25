import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { UsersService, type PublicUser } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission("users.read")
  async list(
    @Query() query: ListUsersQueryDto,
  ): Promise<{ users: PublicUser[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { users, total } = await this.usersService.listUsers({
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { users: users.map((user) => this.usersService.toPublicUser(user)), total, page, pageSize };
  }

  @Get(":id")
  @RequirePermission("users.read")
  async findOne(@Param("id") id: string): Promise<PublicUser> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.usersService.toPublicUser(user);
  }

  @Post()
  @RequirePermission("users.create")
  async create(@Body() dto: CreateUserDto): Promise<PublicUser> {
    const user = await this.usersService.createUser(dto);
    return this.usersService.toPublicUser(user);
  }

  @Patch(":id")
  @RequirePermission("users.update")
  async update(@Param("id") id: string, @Body() dto: UpdateUserDto): Promise<PublicUser> {
    const user = await this.usersService.updateUser(id, dto);
    return this.usersService.toPublicUser(user);
  }

  @Delete(":id")
  @RequirePermission("users.delete")
  async deactivate(@Param("id") id: string): Promise<PublicUser> {
    const user = await this.usersService.deactivateUser(id);
    return this.usersService.toPublicUser(user);
  }
}
