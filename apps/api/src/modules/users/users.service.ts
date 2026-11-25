import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, User } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";

export type UserWithRoles = Prisma.UserGetPayload<{ include: { roles: { include: { role: true } } } }>;

export interface PublicUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  roles: string[];
  createdAt: string;
}

const userWithRolesInclude = { roles: { include: { role: true } } } satisfies Prisma.UserInclude;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    return argon2.verify(passwordHash, password);
  }

  async findByEmail(email: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: userWithRolesInclude,
    });
  }

  async findById(id: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({ where: { id }, include: userWithRolesInclude });
  }

  async createUser(input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    roleNames: string[];
  }): Promise<UserWithRoles> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await this.hashPassword(input.password);

    return this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        roles: {
          create: input.roleNames.map((roleName) => ({
            role: { connect: { name: roleName } },
          })),
        },
      },
      include: userWithRolesInclude,
    });
  }

  async listUsers(params: { skip: number; take: number }): Promise<{ users: UserWithRoles[]; total: number }> {
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        include: userWithRolesInclude,
        orderBy: { createdAt: "desc" },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.user.count(),
    ]);
    return { users, total };
  }

  async updateUser(
    id: string,
    input: { firstName?: string; lastName?: string; isActive?: boolean; roleNames?: string[] },
  ): Promise<UserWithRoles> {
    await this.getOrThrow(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        isActive: input.isActive,
        ...(input.roleNames
          ? {
              roles: {
                deleteMany: {},
                create: input.roleNames.map((roleName) => ({
                  role: { connect: { name: roleName } },
                })),
              },
            }
          : {}),
      },
      include: userWithRolesInclude,
    });
  }

  /** Soft-delete: deactivates the account and revokes every active session. */
  async deactivateUser(id: string): Promise<UserWithRoles> {
    await this.getOrThrow(id);

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { isActive: false },
        include: userWithRolesInclude,
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return user;
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  toPublicUser(user: UserWithRoles): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      roles: user.roles.map((userRole) => userRole.role.name),
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async getOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }
}
