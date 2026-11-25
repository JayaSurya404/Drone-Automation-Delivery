import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type { Category } from "@prisma/client";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { CatalogService } from "./catalog.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async list(): Promise<Category[]> {
    return this.catalogService.listCategoryTree();
  }

  @Get(":slug")
  async findOne(@Param("slug") slug: string): Promise<Category> {
    return this.catalogService.getCategoryBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("catalog.create")
  async create(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.catalogService.createCategory(dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("catalog.update")
  async update(@Param("id") id: string, @Body() dto: UpdateCategoryDto): Promise<Category> {
    return this.catalogService.updateCategory(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("catalog.delete")
  async remove(@Param("id") id: string): Promise<{ deleted: true }> {
    await this.catalogService.deleteCategory(id);
    return { deleted: true };
  }
}
