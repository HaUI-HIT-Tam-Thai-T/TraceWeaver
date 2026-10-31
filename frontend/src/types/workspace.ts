import type { z } from "zod";
import type {
  meSchema,
  membershipSchema,
  sourceSchema,
  sourcesPageSchema,
} from "../features/workspace/schemas.ts";

export type Me = z.infer<typeof meSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type SourcesPage = z.infer<typeof sourcesPageSchema>;

export type WorkspacePermissions = {
  canAdmin: boolean;
  canRead: boolean;
  canWrite: boolean;
  canVerify: boolean;
};
