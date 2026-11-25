import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import type { EnvConfig } from "../../config/env.validation";
import { generateOpaqueToken, hashToken } from "../../common/security/token.util";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../notifications/mail.service";
import { RbacService } from "../rbac/rbac.service";
import { RedisService } from "../../redis/redis.service";
import type { PublicUser, UserWithRoles } from "./users.service";
import { UsersService } from "./users.service";

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

const DEFAULT_SELF_REGISTER_ROLE = "customer";

/**
 * Phase 12 hardening — the security audit flagged that `login` was only
 * rate-limited per-IP (`@Throttle` in `auth.controller.ts`), with no
 * per-account backstop, so a credential-stuffing attack spread across many
 * IPs could still brute-force one account's password at up to the global
 * per-IP rate on each of those IPs. This is a soft, self-expiring lockout
 * keyed by email (via the already-available `RedisService`) — applied
 * identically whether the email exists or not, and behind the same generic
 * "Invalid email or password" message, so it introduces no new user-
 * enumeration signal beyond what already existed.
 */
const LOGIN_LOCKOUT_THRESHOLD = 10;
const LOGIN_LOCKOUT_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly redisService: RedisService,
  ) {}

  async register(
    input: { email: string; password: string; firstName?: string; lastName?: string },
    context: { ip?: string },
  ): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const user = await this.usersService.createUser({
      ...input,
      roleNames: [DEFAULT_SELF_REGISTER_ROLE],
    });

    await this.sendVerificationEmail(user);

    await this.auditService.log({
      actorId: user.id,
      action: "auth.register",
      targetType: "User",
      targetId: user.id,
      ipAddress: context.ip,
    });

    const tokens = await this.issueTokenPair(user, context.ip);
    return { user: this.usersService.toPublicUser(user), tokens };
  }

  async login(
    input: { email: string; password: string },
    context: { ip?: string },
  ): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const genericError = "Invalid email or password";
    const lockoutKey = this.loginLockoutKey(input.email);

    // Account-level backstop (Phase 12) — checked before touching the DB,
    // and identically for an existing or nonexistent email, so this never
    // becomes a new way to distinguish "this account exists" from "it
    // doesn't" beyond what the identical generic error already permits.
    // A Redis outage degrades this defense-in-depth layer (no lockout is
    // enforced) rather than taking down login entirely — Postgres, not
    // Redis, is the system of record for who can authenticate.
    const attemptsSoFar = await this.readLockoutCount(lockoutKey);
    if (attemptsSoFar !== null && attemptsSoFar >= LOGIN_LOCKOUT_THRESHOLD) {
      await this.auditService.log({
        action: "auth.login.locked",
        metadata: { email: input.email },
        ipAddress: context.ip,
      });
      throw new UnauthorizedException(genericError);
    }

    const user = await this.usersService.findByEmail(input.email);

    if (!user) {
      await this.recordFailedLogin(lockoutKey);
      await this.auditService.log({
        action: "auth.login.failed",
        metadata: { email: input.email, reason: "no_such_user" },
        ipAddress: context.ip,
      });
      throw new UnauthorizedException(genericError);
    }

    const passwordValid = await this.usersService.verifyPassword(user.passwordHash, input.password);
    if (!passwordValid) {
      await this.recordFailedLogin(lockoutKey);
      await this.auditService.log({
        actorId: user.id,
        action: "auth.login.failed",
        targetType: "User",
        targetId: user.id,
        metadata: { reason: "bad_password" },
        ipAddress: context.ip,
      });
      throw new UnauthorizedException(genericError);
    }

    if (!user.isActive) {
      await this.auditService.log({
        actorId: user.id,
        action: "auth.login.failed",
        targetType: "User",
        targetId: user.id,
        metadata: { reason: "inactive" },
        ipAddress: context.ip,
      });
      throw new UnauthorizedException(genericError);
    }

    await this.clearLockout(lockoutKey);
    await this.auditService.log({
      actorId: user.id,
      action: "auth.login.success",
      targetType: "User",
      targetId: user.id,
      ipAddress: context.ip,
    });

    const tokens = await this.issueTokenPair(user, context.ip);
    return { user: this.usersService.toPublicUser(user), tokens };
  }

  private loginLockoutKey(email: string): string {
    return `auth:failed_login:${email.trim().toLowerCase()}`;
  }

  private async readLockoutCount(lockoutKey: string): Promise<number | null> {
    try {
      const value = await this.redisService.client.get(lockoutKey);
      return value ? Number(value) : 0;
    } catch (error) {
      this.logger.warn(`Redis unavailable — skipping login-lockout check: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  private async recordFailedLogin(lockoutKey: string): Promise<void> {
    try {
      const count = await this.redisService.client.incr(lockoutKey);
      if (count === 1) {
        await this.redisService.client.expire(lockoutKey, LOGIN_LOCKOUT_WINDOW_SECONDS);
      }
    } catch (error) {
      this.logger.warn(`Redis unavailable — could not record failed login attempt: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async clearLockout(lockoutKey: string): Promise<void> {
    try {
      await this.redisService.client.del(lockoutKey);
    } catch (error) {
      this.logger.warn(`Redis unavailable — could not clear login-lockout counter: ${error instanceof Error ? error.message : error}`);
    }
  }

  /** Rotates a refresh token, revoking its whole family if it's a reused (already-rotated) token. */
  async refresh(rawRefreshToken: string, context: { ip?: string }): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });

    if (!existing) {
      throw new UnauthorizedException("Invalid session");
    }

    if (existing.revokedAt) {
      // A rotated-out token was presented again: assume the token family is
      // compromised and revoke every token in it (blueprint Section O).
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.auditService.log({
        actorId: existing.userId,
        action: "auth.refresh.reuse_detected",
        targetType: "User",
        targetId: existing.userId,
        ipAddress: context.ip,
      });
      throw new UnauthorizedException("Invalid session");
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired");
    }

    if (!existing.user.isActive) {
      throw new UnauthorizedException("Invalid session");
    }

    const tokens = await this.issueTokenPair(existing.user, context.ip, existing.familyId);

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedByTokenHash: hashToken(tokens.refreshToken) },
    });

    return { user: this.usersService.toPublicUser(existing.user), tokens };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing) {
      return;
    }
    await this.prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.auditService.log({
      actorId: existing.userId,
      action: "auth.logout",
      targetType: "User",
      targetId: existing.userId,
    });
  }

  /**
   * Phase 12 hardening — `logout()` only revokes the *current* device's
   * token family (each login mints its own `familyId`); there was no way
   * for a user to end every other session (e.g. after noticing a device
   * they don't recognize, or losing a laptop) short of a password reset,
   * which also forces a password change they may not want. Revokes every
   * non-revoked refresh token for the user across every family.
   */
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.auditService.log({
      actorId: userId,
      action: "auth.logout_all",
      targetType: "User",
      targetId: userId,
    });
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const user = await this.prisma.user.findUnique({ where: { emailVerificationTokenHash: tokenHash } });

    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired verification token");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: "auth.email_verified",
      targetType: "User",
      targetId: user.id,
    });
  }

  /** Always succeeds from the caller's perspective, even for an unknown email — avoids user enumeration. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return;
    }

    const rawToken = generateOpaqueToken();
    const ttlMinutes = this.configService.get("PASSWORD_RESET_TTL_MINUTES", { infer: true });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hashToken(rawToken),
        passwordResetExpiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });

    const appBaseUrl = this.configService.get("APP_BASE_URL", { infer: true });
    await this.mailService.send({
      to: user.email,
      subject: "Reset your SkyNav password",
      html: `<p>Reset your password using this link (valid ${ttlMinutes} minutes):</p>
             <p><a href="${appBaseUrl}/reset-password?token=${rawToken}">${appBaseUrl}/reset-password?token=${rawToken}</a></p>`,
    });

    await this.auditService.log({
      actorId: user.id,
      action: "auth.password_reset.requested",
      targetType: "User",
      targetId: user.id,
    });
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const user = await this.prisma.user.findUnique({ where: { passwordResetTokenHash: tokenHash } });

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await this.usersService.hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
      }),
      // A password reset ends every existing session.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.log({
      actorId: user.id,
      action: "auth.password_reset.completed",
      targetType: "User",
      targetId: user.id,
    });
  }

  async buildAuthenticatedUser(user: UserWithRoles): Promise<AuthenticatedUser> {
    const roles = user.roles.map((userRole) => userRole.role.name);
    const permissions = await this.rbacService.resolvePermissions(roles);
    return { sub: user.id, email: user.email, roles, permissions };
  }

  private async issueTokenPair(
    user: UserWithRoles,
    ip: string | undefined,
    existingFamilyId?: string,
  ): Promise<TokenPair> {
    const authenticatedUser = await this.buildAuthenticatedUser(user);
    const accessToken = await this.jwtService.signAsync(authenticatedUser);
    const accessTokenExpiresInSeconds = this.parseTtlSeconds(
      this.configService.get("JWT_ACCESS_TTL", { infer: true }),
    );

    const rawRefreshToken = generateOpaqueToken();
    const refreshTtlDays = this.configService.get("REFRESH_TOKEN_TTL_DAYS", { infer: true });
    const refreshTokenExpiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        familyId: existingFamilyId ?? randomUUID(),
        expiresAt: refreshTokenExpiresAt,
        createdByIp: ip,
      },
    });

    return {
      accessToken,
      accessTokenExpiresInSeconds,
      refreshToken: rawRefreshToken,
      refreshTokenExpiresAt,
    };
  }

  private async sendVerificationEmail(user: UserWithRoles): Promise<void> {
    const rawToken = generateOpaqueToken();
    const ttlHours = this.configService.get("EMAIL_VERIFICATION_TTL_HOURS", { infer: true });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: hashToken(rawToken),
        emailVerificationExpiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
      },
    });

    const appBaseUrl = this.configService.get("APP_BASE_URL", { infer: true });
    await this.mailService.send({
      to: user.email,
      subject: "Verify your SkyNav email address",
      html: `<p>Verify your email using this link (valid ${ttlHours} hours):</p>
             <p><a href="${appBaseUrl}/verify-email?token=${rawToken}">${appBaseUrl}/verify-email?token=${rawToken}</a></p>`,
    });
  }

  private parseTtlSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) {
      return 900;
    }
    const [, value, unit] = match;
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit as "s" | "m" | "h" | "d"];
    return Number(value) * multiplier;
  }
}
