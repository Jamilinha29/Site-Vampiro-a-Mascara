import { AdminShopEditor } from '../../components/admin/AdminShopEditor'

export default function AdminShopPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Loja da sessão (mestre)</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Cadastre equipamentos, relíquias, serviços e consumíveis no mesmo estilo da loja do jogador — com estoque e
          atributos.
        </p>
      </header>
      <AdminShopEditor />
    </div>
  )
}
