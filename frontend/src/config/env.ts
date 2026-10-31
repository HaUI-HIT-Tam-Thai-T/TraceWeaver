import { z } from "zod";

const httpsUrl = z.url({ protocol: /^https$/ }).refine((value) => {
  const url = new URL(value);
  return !url.username && !url.password && !url.search && !url.hash;
}, "URL must not contain credentials, query or fragment");

const apiOrigin = httpsUrl.refine(
  (value) => new URL(value).pathname === "/",
  "API base URL must be an origin without a path",
);

const publicEnvSchema = z.object({
  VITE_API_BASE_URL: z
    .union([z.literal(""), apiOrigin])
    .transform((value) => value.replace(/\/$/, "")),
  VITE_KEYCLOAK_URL: httpsUrl.transform((value) => value.replace(/\/$/, "")),
  VITE_KEYCLOAK_REALM: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9._-]+$/),
  VITE_KEYCLOAK_CLIENT_ID: z.string().trim().min(1),
});

export type AppEnv = z.infer<typeof publicEnvSchema>;

export function parseEnv(input: unknown, production: boolean): AppEnv {
  const result = publicEnvSchema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];

    throw new Error(`Invalid frontend configuration: ${fields.join(", ")}. See .env.example.`);
  }
  if (production && !result.data.VITE_API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL must be an HTTPS origin for production.");
  }
  return result.data;
}
