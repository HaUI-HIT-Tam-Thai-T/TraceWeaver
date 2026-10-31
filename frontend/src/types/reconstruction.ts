import type { z } from "zod";
import type {
  linkSchema,
  runCreateSchema,
  runSchema,
  graphSchema,
} from "../features/reconstruction/schemas.ts";

export type Link = z.infer<typeof linkSchema>;
export type RunCreate = z.infer<typeof runCreateSchema>;
export type Run = z.infer<typeof runSchema>;
export type Graph = z.infer<typeof graphSchema>;
