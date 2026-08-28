import type { Kysely } from "kysely";
import type { Database } from "../../infrastructure/db/schema.js";
import type { UserRole } from "@skynav/contracts";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrgMembershipRecord {
  organization_id: string;
  organization_name: string;
  user_id: string;
  role: UserRole;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_token_id: string | null;
  created_at: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUserById(id: string): Promise<UserRecord | undefined>;
  createUser(params: { id: string; email: string; name: string; password_hash: string }): Promise<UserRecord>;
  createOrganization(params: { id: string; name: string }): Promise<{ id: string; name: string }>;
  findOrganizationById(id: string): Promise<{ id: string; name: string } | undefined>;
  addUserToOrganization(params: { organization_id: string; user_id: string; role: UserRole }): Promise<void>;
  getUserMemberships(userId: string): Promise<OrgMembershipRecord[]>;
  getUserMembershipInOrg(userId: string, orgId: string): Promise<OrgMembershipRecord | undefined>;
  createRefreshToken(params: {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
  }): Promise<RefreshTokenRecord>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | undefined>;
  revokeRefreshToken(tokenId: string, replacedByTokenId?: string): Promise<void>;
  revokeAllUserRefreshTokens(userId: string): Promise<void>;
}

export function createAuthRepository(db: Kysely<Database>): AuthRepository {
  return {
    async findUserByEmail(email: string) {
      return await db
        .selectFrom("users")
        .selectAll()
        .where("email", "=", email.toLowerCase().trim())
        .executeTakeFirst();
    },

    async findUserById(id: string) {
      return await db
        .selectFrom("users")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
    },

    async createUser(params) {
      const result = await db
        .insertInto("users")
        .values({
          id: params.id,
          email: params.email.toLowerCase().trim(),
          name: params.name.trim(),
          password_hash: params.password_hash
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return result;
    },

    async createOrganization(params) {
      return await db
        .insertInto("organizations")
        .values({
          id: params.id,
          name: params.name.trim()
        })
        .returning(["id", "name"])
        .executeTakeFirstOrThrow();
    },

    async findOrganizationById(id: string) {
      return await db
        .selectFrom("organizations")
        .select(["id", "name"])
        .where("id", "=", id)
        .executeTakeFirst();
    },

    async addUserToOrganization(params) {
      await db
        .insertInto("organization_members")
        .values({
          organization_id: params.organization_id,
          user_id: params.user_id,
          role: params.role
        })
        .execute();
    },

    async getUserMemberships(userId: string) {
      const rows = await db
        .selectFrom("organization_members")
        .innerJoin("organizations", "organizations.id", "organization_members.organization_id")
        .select([
          "organization_members.organization_id",
          "organizations.name as organization_name",
          "organization_members.user_id",
          "organization_members.role"
        ])
        .where("organization_members.user_id", "=", userId)
        .execute();

      return rows.map((r) => ({
        organization_id: r.organization_id,
        organization_name: r.organization_name,
        user_id: r.user_id,
        role: r.role as UserRole
      }));
    },

    async getUserMembershipInOrg(userId: string, orgId: string) {
      const row = await db
        .selectFrom("organization_members")
        .innerJoin("organizations", "organizations.id", "organization_members.organization_id")
        .select([
          "organization_members.organization_id",
          "organizations.name as organization_name",
          "organization_members.user_id",
          "organization_members.role"
        ])
        .where("organization_members.user_id", "=", userId)
        .where("organization_members.organization_id", "=", orgId)
        .executeTakeFirst();

      if (!row) return undefined;
      return {
        organization_id: row.organization_id,
        organization_name: row.organization_name,
        user_id: row.user_id,
        role: row.role as UserRole
      };
    },

    async createRefreshToken(params) {
      return await db
        .insertInto("refresh_tokens")
        .values({
          id: params.id,
          user_id: params.user_id,
          token_hash: params.token_hash,
          expires_at: params.expires_at.toISOString(),
          revoked_at: null,
          replaced_by_token_id: null
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async findRefreshTokenByHash(tokenHash: string) {
      return await db
        .selectFrom("refresh_tokens")
        .selectAll()
        .where("token_hash", "=", tokenHash)
        .executeTakeFirst();
    },

    async revokeRefreshToken(tokenId: string, replacedByTokenId?: string) {
      await db
        .updateTable("refresh_tokens")
        .set({
          revoked_at: new Date().toISOString(),
          replaced_by_token_id: replacedByTokenId ?? null
        })
        .where("id", "=", tokenId)
        .execute();
    },

    async revokeAllUserRefreshTokens(userId: string) {
      await db
        .updateTable("refresh_tokens")
        .set({
          revoked_at: new Date().toISOString()
        })
        .where("user_id", "=", userId)
        .where("revoked_at", "is", null)
        .execute();
    }
  };
}
