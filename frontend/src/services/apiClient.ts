import { parseEnv } from '../config/env'
import { getAccessToken } from '../features/auth/auth'
import { createApiClient } from './createApiClient'

const env = parseEnv(import.meta.env, import.meta.env.PROD)

export const apiClient = createApiClient({ baseURL: env.VITE_API_BASE_URL, getAccessToken })
