import { z } from "zod";

/**
 * The public shape of a User as returned by the API — never includes
 * `passwordHash` or any token hash. Keep in sync with
 * `apps/api/src/modules/users/users.service.ts` (`toPublicUser`).
 */
export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  isActive: z.boolean(),
  isEmailVerified: z.boolean(),
  roles: z.array(z.string()),
  createdAt: z.string(),
});

export type PublicUser = z.infer<typeof publicUserSchema>;
