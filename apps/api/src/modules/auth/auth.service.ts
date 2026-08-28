import crypto from "node:crypto";
import type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  AuthenticatedUser,
  UserRole,
  Permission
} from "@skynav/contracts";
import { getPermissionsForRole } from "@skynav/contracts";
import type { AuthRepository } from "./auth.repository.js";
import type { AuditService } from "../audit/audit.service.js";
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
  validatePasswordPolicy
} from "./crypto.js";

export class AuthError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthService {
  register(input: RegisterRequest): Promise<AuthResponse>;
  login(input: LoginRequest): Promise<AuthResponse>;
  refresh(refreshTokenString: string): Promise<AuthResponse>;
  logout(refreshTokenString?: string, actorUserId?: string, orgId?: string): Promise<{ success: boolean }>;
  getProfile(userId: string, orgId: string): Promise<AuthenticatedUser>;
}

export function createAuthService(
  repo: AuthRepository,
  auditService: AuditService,
  jwtSign: (payload: Record<string, unknown>, options?: { expiresIn?: string }) => string
): AuthService {
  const ACCESS_TOKEN_TTL = "15m";
  const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 900; // 15 mins
  const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  async function issueTokenPair(userId: string, email: string, name: string, orgId: string, orgName: string, role: UserRole) {
    const permissions: Permission[] = Array.from(getPermissionsForRole(role));

    const accessToken = jwtSign(
      {
        sub: userId,
        email,
        name,
        orgId,
        orgName,
        role,
        permissions
      },
      { expiresIn: ACCESS_TOKEN_TTL }
    );

    const rawRefreshToken = generateSecureToken(32);
    const tokenHash = hashToken(rawRefreshToken);
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await repo.createRefreshToken({
      id: tokenId,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      permissions
    };
  }

  return {
    async register(input: RegisterRequest): Promise<AuthResponse> {
      const email = input.email.toLowerCase().trim();
      const passwordValidation = validatePasswordPolicy(input.password);
      if (!passwordValidation.valid) {
        throw new AuthError(400, "WEAK_PASSWORD", passwordValidation.error ?? "Password does not meet security requirements.");
      }

      const existingUser = await repo.findUserByEmail(email);
      if (existingUser) {
        throw new AuthError(409, "EMAIL_ALREADY_EXISTS", "A user with this email address already exists.");
      }

      const passwordHash = await hashPassword(input.password);
      const userId = crypto.randomUUID();
      const userName = input.name?.trim() || email.split("@")[0] || "User";

      const user = await repo.createUser({
        id: userId,
        email,
        name: userName,
        password_hash: passwordHash
      });

      const orgId = crypto.randomUUID();
      const orgName = input.organizationName?.trim() || `${userName}'s Fleet`;
      const org = await repo.createOrganization({
        id: orgId,
        name: orgName
      });

      const role: UserRole = "ADMIN";
      await repo.addUserToOrganization({
        organization_id: org.id,
        user_id: user.id,
        role
      });

      const tokens = await issueTokenPair(user.id, user.email, user.name, org.id, org.name, role);

      await auditService.log({
        organizationId: org.id,
        actorUserId: user.id,
        action: "ORGANIZATION_CREATED",
        resourceType: "organization",
        resourceId: org.id,
        metadata: { name: org.name }
      });

      await auditService.log({
        organizationId: org.id,
        actorUserId: user.id,
        action: "USER_REGISTERED",
        resourceType: "user",
        resourceId: user.id,
        metadata: { email: user.email, role }
      });

      return {
        user: { id: user.id, email: user.email, name: user.name },
        organization: { id: org.id, name: org.name, role },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: "Bearer",
        expiresIn: tokens.expiresIn,
        permissions: tokens.permissions
      };
    },

    async login(input: LoginRequest): Promise<AuthResponse> {
      const email = input.email.toLowerCase().trim();
      const user = await repo.findUserByEmail(email);

      if (!user) {
        throw new AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
      }

      const validPassword = await verifyPassword(user.password_hash, input.password);
      if (!validPassword) {
        throw new AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
      }

      const memberships = await repo.getUserMemberships(user.id);
      if (memberships.length === 0) {
        throw new AuthError(403, "NO_ORGANIZATION_MEMBERSHIP", "User does not belong to any active organization.");
      }

      let activeMembership = memberships[0]!;
      if (input.organizationId) {
        const selected = memberships.find((m) => m.organization_id === input.organizationId);
        if (!selected) {
          throw new AuthError(403, "NOT_AN_ORGANIZATION_MEMBER", "User is not a member of the requested organization.");
        }
        activeMembership = selected;
      }

      const tokens = await issueTokenPair(
        user.id,
        user.email,
        user.name,
        activeMembership.organization_id,
        activeMembership.organization_name,
        activeMembership.role
      );

      await auditService.log({
        organizationId: activeMembership.organization_id,
        actorUserId: user.id,
        action: "USER_LOGGED_IN",
        resourceType: "user",
        resourceId: user.id,
        metadata: { role: activeMembership.role }
      });

      return {
        user: { id: user.id, email: user.email, name: user.name },
        organization: {
          id: activeMembership.organization_id,
          name: activeMembership.organization_name,
          role: activeMembership.role
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: "Bearer",
        expiresIn: tokens.expiresIn,
        permissions: tokens.permissions
      };
    },

    async refresh(refreshTokenString: string): Promise<AuthResponse> {
      if (!refreshTokenString) {
        throw new AuthError(401, "MISSING_REFRESH_TOKEN", "Refresh token is required.");
      }

      const tokenHash = hashToken(refreshTokenString);
      const tokenRecord = await repo.findRefreshTokenByHash(tokenHash);

      if (!tokenRecord) {
        throw new AuthError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired.");
      }

      // Detect potential refresh token reuse (breach detection)
      if (tokenRecord.revoked_at !== null) {
        await repo.revokeAllUserRefreshTokens(tokenRecord.user_id);
        throw new AuthError(401, "REFRESH_TOKEN_REUSED", "Refresh token was already used. All active sessions have been revoked for security.");
      }

      const isExpired = new Date(tokenRecord.expires_at).getTime() < Date.now();
      if (isExpired) {
        await repo.revokeRefreshToken(tokenRecord.id);
        throw new AuthError(401, "REFRESH_TOKEN_EXPIRED", "Refresh token has expired.");
      }

      const user = await repo.findUserById(tokenRecord.user_id);
      if (!user) {
        throw new AuthError(401, "USER_NOT_FOUND", "User associated with this token no longer exists.");
      }

      const memberships = await repo.getUserMemberships(user.id);
      if (memberships.length === 0) {
        throw new AuthError(403, "NO_ORGANIZATION_MEMBERSHIP", "User does not belong to any active organization.");
      }
      const activeMembership = memberships[0]!;

      // Issue new token pair
      const newTokens = await issueTokenPair(
        user.id,
        user.email,
        user.name,
        activeMembership.organization_id,
        activeMembership.organization_name,
        activeMembership.role
      );

      // Rotate: Revoke the old token and link to the replacement
      await repo.revokeRefreshToken(tokenRecord.id);

      await auditService.log({
        organizationId: activeMembership.organization_id,
        actorUserId: user.id,
        action: "TOKEN_REFRESHED",
        resourceType: "user",
        resourceId: user.id
      });

      return {
        user: { id: user.id, email: user.email, name: user.name },
        organization: {
          id: activeMembership.organization_id,
          name: activeMembership.organization_name,
          role: activeMembership.role
        },
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        tokenType: "Bearer",
        expiresIn: newTokens.expiresIn,
        permissions: newTokens.permissions
      };
    },

    async logout(refreshTokenString?: string, actorUserId?: string, orgId?: string): Promise<{ success: boolean }> {
      if (refreshTokenString) {
        const tokenHash = hashToken(refreshTokenString);
        const record = await repo.findRefreshTokenByHash(tokenHash);
        if (record) {
          await repo.revokeRefreshToken(record.id);
        }
      }

      if (actorUserId && orgId) {
        await auditService.log({
          organizationId: orgId,
          actorUserId,
          action: "USER_LOGGED_OUT",
          resourceType: "user",
          resourceId: actorUserId
        });
      }

      return { success: true };
    },

    async getProfile(userId: string, orgId: string): Promise<AuthenticatedUser> {
      const user = await repo.findUserById(userId);
      if (!user) {
        throw new AuthError(404, "USER_NOT_FOUND", "User not found.");
      }

      const membership = await repo.getUserMembershipInOrg(userId, orgId);
      if (!membership) {
        throw new AuthError(403, "NOT_AN_ORGANIZATION_MEMBER", "User is not an active member of this organization.");
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: membership.organization_id,
        organizationName: membership.organization_name,
        role: membership.role,
        permissions: Array.from(getPermissionsForRole(membership.role))
      };
    }
  };
}
