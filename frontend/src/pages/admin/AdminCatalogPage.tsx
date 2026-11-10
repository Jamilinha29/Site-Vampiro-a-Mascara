import { AdminGlossaryEditor } from '../../components/admin/AdminGlossaryEditor'

export default function AdminCatalogPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Glossário</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Crie e edite grimórios, amuletos, relíquias e o bestiário. O que for publicado aparece no Glossário dos
          jogadores.
        </p>
      </header>
      <AdminGlossaryEditor />
    </div>
  )
}
