import { createElement } from 'react'
import { AuthCallbackPage } from '../pages/AuthCallbackPage'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'

export const ROUTES = [
  { path: '/', element: createElement(HomePage) },
  { path: '/auth/callback', element: createElement(AuthCallbackPage) },
  { path: '*', element: createElement(NotFoundPage) },
]
