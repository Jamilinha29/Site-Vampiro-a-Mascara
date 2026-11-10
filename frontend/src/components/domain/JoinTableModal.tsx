import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useToast } from '../ui/ToastProvider'

type Props = {
  open: boolean
  onClose: () => void
}

export function JoinTableModal({ open, onClose }: Props) {
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  const { push } = useToast()

  const join = useMutation({
    mutationFn: (roomCode: string) => api.joinSessionByCode(roomCode),
    onSuccess: (result) => {
      push('Sala autorizada. Bem-vindo à mesa.', 'success')
      onClose()
      navigate(`/user/sessions/${result.sessionId}/table`)
    },
    onError: (err: Error) => {
      push(err.message || 'Código inválido ou sessão indisponível.', 'error')
    },
  })

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-table-title"
    >
      <div className="card-surface w-full max-w-md p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="join-table-title" className="font-headline-sm text-lg text-secondary">
              Entrar na Mesa
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Informe o código feudal concedido pelo narrador.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-outline hover:text-on-surface" aria-label="Fechar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface" htmlFor="room-code">
          Código da sala
        </label>
        <input
          id="room-code"
          className="input-feudal mt-1 pl-4"
          placeholder="Ex: VTM-1204-CONST"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoComplete="off"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!code.trim() || join.isPending}
            onClick={() => join.mutate(code.trim())}
          >
            {join.isPending ? 'Validando…' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
