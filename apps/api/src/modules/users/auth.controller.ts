import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import type { EnvConfig } from "../../config/env.validation";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AuthService, type TokenPair } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { UsersService, type PublicUser } from "./users.service";

interface AuthResponseBody {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) { }

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseBody> {
    const { user, tokens } = await this.authService.register(dto, { ip });
    this.setRefreshCookie(res, tokens, req, user);
    return this.toResponseBody(user, tokens);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseBody> {
    const { user, tokens } = await this.authService.login(dto, { ip });
    this.setRefreshCookie(res, tokens, req, user);
    return this.toResponseBody(user, tokens);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseBody> {
    const incoming = this.resolveIncomingCookie(req);

    if (!incoming) {
      throw new BadRequestException("No refresh session found");
    }

    const { user, tokens } = await this.authService.refresh(incoming.token, { ip });
    this.setRefreshCookie(res, tokens, req, user, incoming.name);
    return this.toResponseBody(user, tokens);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const incoming = this.resolveIncomingCookie(req);

    if (incoming) {
      await this.authService.logout(incoming.token);
      res.clearCookie(incoming.name, { path: "/api/v1/auth" });
    } else {
      this.clearAllRefreshCookies(res);
    }
  }

  /** Phase 12 hardening — ends every session for the current user, not just this device (see `AuthService.logoutAll()`'s doc comment). */
  @Post("logout-all")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logoutAll(user.sub);
    this.clearAllRefreshCookies(res);
  }

  /**
   * Phase 12 fix: was `GET /auth/verify-email?token=...` — a single-use
   * secret in a URL is captured by every access-log line for the request
   * (`req.url` includes the query string) and by `AllExceptionsFilter` on
   * any failure, the same exposure class already fixed for `reset-password`
   * by making it POST-with-body. The token still arrives at the *frontend*
   * via a query string (unavoidable for an emailed link — see
   * `customer-web`'s `/verify-email` page), but the API call itself no
   * longer echoes it into a URL a server log will capture.
   */
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiExcludeEndpoint()
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ verified: true }> {
    await this.authService.verifyEmail(dto.token);
    return { verified: true };
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return { message: "If that email exists, a reset link has been sent." };
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: "Password updated. Please log in again." };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() currentUser: AuthenticatedUser): Promise<PublicUser> {
    const user = await this.usersService.findById(currentUser.sub);
    if (!user) {
      throw new BadRequestException("User not found");
    }
    return this.usersService.toPublicUser(user);
  }

  private toResponseBody(user: PublicUser, tokens: TokenPair): AuthResponseBody {
    return {
      user,
      accessToken: tokens.accessToken,
      expiresIn: tokens.accessTokenExpiresInSeconds,
    };
  }

  private getRefreshCookieNames(): { adminCookie: string; customerCookie: string } {
    const adminCookie = process.env.ADMIN_REFRESH_COOKIE_NAME ?? "skynav_admin_refresh_token";
    const customerCookie = process.env.CUSTOMER_REFRESH_COOKIE_NAME ?? "skynav_customer_refresh_token";
    return { adminCookie, customerCookie };
  }

  private resolveIncomingCookie(req: Request): { name: string; token: string } | null {
    const { adminCookie, customerCookie } = this.getRefreshCookieNames();
    const clientApp = req.headers["x-client-app"] as string | undefined;

    // Strict cookie isolation:
    // When x-client-app=admin, read ONLY admin cookie (no fallthrough to customer cookie)
    if (clientApp === "admin") {
      return req.cookies?.[adminCookie] ? { name: adminCookie, token: req.cookies[adminCookie] } : null;
    }

    // When x-client-app=customer, read ONLY customer cookie (no fallthrough to admin cookie)
    if (clientApp === "customer") {
      return req.cookies?.[customerCookie] ? { name: customerCookie, token: req.cookies[customerCookie] } : null;
    }

    // When x-client-app is not specified, resolve from dedicated cookies (no legacy default cookie fallback)
    if (req.cookies?.[adminCookie]) {
      return { name: adminCookie, token: req.cookies[adminCookie] };
    }
    if (req.cookies?.[customerCookie]) {
      return { name: customerCookie, token: req.cookies[customerCookie] };
    }

    return null;
  }

  private setRefreshCookie(
    res: Response,
    tokens: TokenPair,
    req?: Request,
    user?: PublicUser,
    explicitCookieName?: string,
  ): void {
    const { adminCookie, customerCookie } = this.getRefreshCookieNames();
    let cookieName = explicitCookieName;

    if (!cookieName) {
      const clientApp = req?.headers["x-client-app"] as string | undefined;
      const isStaffUser = user?.roles ? user.roles.some((r) => r !== "customer" && r !== "guest") : false;

      if (clientApp === "admin" || isStaffUser) {
        cookieName = adminCookie;
      } else if (clientApp === "customer" || user) {
        cookieName = customerCookie;
      } else {
        return;
      }
    }

    res.cookie(cookieName, tokens.refreshToken, {
      httpOnly: true,
      secure: this.configService.get("NODE_ENV", { infer: true }) === "production",
      sameSite: "lax",
      path: "/api/v1/auth",
      expires: tokens.refreshTokenExpiresAt,
    });
  }

  private clearAllRefreshCookies(res: Response): void {
    const { adminCookie, customerCookie } = this.getRefreshCookieNames();
    const cookieOptions = { path: "/api/v1/auth" };
    res.clearCookie(adminCookie, cookieOptions);
    res.clearCookie(customerCookie, cookieOptions);
  }
}
