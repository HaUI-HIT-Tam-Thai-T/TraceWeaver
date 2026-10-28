import { Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { PageLoading } from './PageLoadFeedback'

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {ROUTES.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}
      </Routes>
    </Suspense>
  )
}
