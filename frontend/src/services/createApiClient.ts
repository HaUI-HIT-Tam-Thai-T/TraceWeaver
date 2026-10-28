import axios, { CanceledError } from 'axios'
import type { GenericAbortSignal } from 'axios'
import { ApiError, normalizeApiError } from './apiError.ts'

type ApiClientOptions = {
  baseURL: string
  getAccessToken: () => Promise<string>
}

function invalidRequest() {
  return new ApiError({ kind: 'client', code: 'INVALID_API_REQUEST', message: 'Đường dẫn hoặc cấu hình API không hợp lệ.' })
}

function validatePath(path: string | undefined) {
  if (!path?.startsWith('/api/v1/') || /[\\\s#]/.test(path)) throw invalidRequest()
  // URL normalizes dot segments, including %2e%2e, before the scope check.
  const normalized = new URL(path, 'https://api-client.invalid')
  if (!normalized.pathname.startsWith('/api/v1/')) throw invalidRequest()
}

function waitForToken(getToken: () => Promise<string>, signal?: GenericAbortSignal): Promise<string> {
  if (signal?.aborted) return Promise.reject(new CanceledError('Request canceled'))
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener?.('abort', cancel)
    const cancel = () => {
      cleanup()
      reject(new CanceledError('Request canceled'))
    }
    signal?.addEventListener?.('abort', cancel, { once: true })
    // Cancellation only stops this request; it must not abort a shared SDK refresh.
    Promise.resolve().then(() => {
      if (signal?.aborted) throw new CanceledError('Request canceled')
      return getToken()
    }).then((token) => {
      cleanup()
      if (signal?.aborted) cancel()
      else resolve(token)
    }, (error: unknown) => {
      cleanup()
      if (signal?.aborted) cancel()
      else reject(error)
    })
  })
}

export function createApiClient({ baseURL, getAccessToken }: ApiClientOptions) {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    headers: { Accept: 'application/json' },
    withCredentials: false,
    transitional: { silentJSONParsing: true, forcedJSONParsing: true, clarifyTimeoutError: true },
  })

  client.interceptors.request.use(async (config) => {
    validatePath(config.url)
    if (config.baseURL !== baseURL || config.auth) throw invalidRequest()
    if (config.signal?.aborted) throw new CanceledError('Request canceled')
    let token: string
    try {
      token = await waitForToken(getAccessToken, config.signal)
      if (!token.trim()) throw new Error('Missing access token')
    } catch (error: unknown) {
      if (axios.isCancel(error)) throw error
      throw new ApiError({ kind: 'auth', code: 'AUTHENTICATION_REQUIRED', message: 'Vui lòng đăng nhập lại để tiếp tục.' })
    }
    if (config.signal?.aborted) throw new CanceledError('Request canceled')
    config.headers.set('Authorization', `Bearer ${token}`, true)
    config.withCredentials = false
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => Promise.reject(axios.isCancel(error) ? error : normalizeApiError(error)),
  )
  return client
}
