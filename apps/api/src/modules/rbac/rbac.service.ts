import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves the deduplicated `"module.action"` permission set granted by a set of role names. */
  async resolvePermissions(roleNames: string[]): Promise<string[]> {
    if (roleNames.length === 0) {
      return [];
    }

    const roles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
      include: { permissions: { include: { permission: true } } },
    });

    const permissions = new Set<string>();
    for (const role of roles) {
      for (const rolePermission of role.permissions) {
        permissions.add(`${rolePermission.permission.module}.${rolePermission.permission.action}`);
      }
    }

    return [...permissions].sort();
  }
}
