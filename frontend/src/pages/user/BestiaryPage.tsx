import { Navigate } from 'react-router-dom'

/** Bestiário integrado ao Glossário. */
export default function BestiaryPage() {
  return <Navigate to="/user/archive?section=bestiary" replace />
}
