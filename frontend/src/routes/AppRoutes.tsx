import { Route, Routes } from 'react-router-dom'
import { ROUTES } from '../constants/routes'

export function AppRoutes() {
  return (
    <Routes>
      {ROUTES.map(({ path, element }) => (
        <Route key={path} path={path} element={element} />
      ))}
    </Routes>
  )
}
