import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function AppSectionPage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">{description}</p>
      </header>
      {children ?? (
        <div className="card-surface p-8 text-center text-sm text-on-surface-variant">
          Conteúdo carregado via API quando a campanha estiver vinculada.
        </div>
      )}
    </div>
  )
}

export function ErrorPage({ code, title, message }: { code: string; title: string; message: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-6 text-center">
      <p className="font-numeric-stat text-5xl text-primary-container">{code}</p>
      <h1 className="mt-2 font-headline-md text-xl">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-on-surface-variant">{message}</p>
      <Link to="/" className="btn-primary mt-6">
        Voltar ao início
      </Link>
    </div>
  )
}
