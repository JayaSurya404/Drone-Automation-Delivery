import type {
  AuthRepository,
  UserRecord,
  OrgMembershipRecord,
  RefreshTokenRecord
} from "../auth.repository.js";
import type { UserRole } from "@skynav/contracts";

export function createMockAuthRepository(): AuthRepository {
  const users: UserRecord[] = [];
  const organizations: { id: string; name: string }[] = [];
  const memberships: { organization_id: string; user_id: string; role: UserRole }[] = [];
  const refreshTokens: RefreshTokenRecord[] = [];

  return {
    async findUserByEmail(email: string) {
      return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    },

    async findUserById(id: string) {
      return users.find((u) => u.id === id);
    },

    async createUser(params) {
      const user: UserRecord = {
        id: params.id,
        email: params.email,
        name: params.name,
        password_hash: params.password_hash,
        created_at: new Date(),
        updated_at: new Date()
      };
      users.push(user);
      return user;
    },

    async createOrganization(params) {
      const org = { id: params.id, name: params.name };
      organizations.push(org);
      return org;
    },

    async findOrganizationById(id: string) {
      return organizations.find((o) => o.id === id);
    },

    async addUserToOrganization(params) {
      const existing = memberships.find(
        (m) => m.organization_id === params.organization_id && m.user_id === params.user_id
      );
      if (existing) {
        existing.role = params.role;
      } else {
        memberships.push({
          organization_id: params.organization_id,
          user_id: params.user_id,
          role: params.role
        });
      }
    },

    async getUserMemberships(userId: string): Promise<OrgMembershipRecord[]> {
      const userMemberships = memberships.filter((m) => m.user_id === userId);
      return userMemberships.map((m) => {
        const org = organizations.find((o) => o.id === m.organization_id);
        return {
          organization_id: m.organization_id,
          organization_name: org ? org.name : "Unknown Org",
          user_id: m.user_id,
          role: m.role
        };
      });
    },

    async getUserMembershipInOrg(userId: string, orgId: string): Promise<OrgMembershipRecord | undefined> {
      const mem = memberships.find((m) => m.user_id === userId && m.organization_id === orgId);
      if (!mem) return undefined;
      const org = organizations.find((o) => o.id === orgId);
      return {
        organization_id: mem.organization_id,
        organization_name: org ? org.name : "Unknown Org",
        user_id: mem.user_id,
        role: mem.role
      };
    },

    async createRefreshToken(params) {
      const record: RefreshTokenRecord = {
        id: params.id,
        user_id: params.user_id,
        token_hash: params.token_hash,
        expires_at: params.expires_at,
        revoked_at: null,
        replaced_by_token_id: null,
        created_at: new Date()
      };
      refreshTokens.push(record);
      return record;
    },

    async findRefreshTokenByHash(tokenHash: string) {
      return refreshTokens.find((t) => t.token_hash === tokenHash);
    },

    async revokeRefreshToken(tokenId: string, replacedByTokenId?: string) {
      const token = refreshTokens.find((t) => t.id === tokenId);
      if (token) {
        token.revoked_at = new Date();
        token.replaced_by_token_id = replacedByTokenId ?? null;
      }
    },

    async revokeAllUserRefreshTokens(userId: string) {
      for (const token of refreshTokens) {
        if (token.user_id === userId && token.revoked_at === null) {
          token.revoked_at = new Date();
        }
      }
    }
  };
}
