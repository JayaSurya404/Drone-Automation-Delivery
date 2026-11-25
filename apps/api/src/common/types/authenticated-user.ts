/** Shape of the JWT access-token payload, attached to `request.user` by `JwtAuthGuard`. */
export interface AuthenticatedUser {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

declare module "express" {
  interface Request {
    user?: AuthenticatedUser;
  }
}
