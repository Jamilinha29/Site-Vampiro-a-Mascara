import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useToast } from '../ui/ToastProvider'

export function AdminAchievementsPanel() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [howToEarn, setHowToEarn] = useState('')
  const [grantEmail, setGrantEmail] = useState<Record<string, string>>({})
  const qc = useQueryClient()
  const { push } = useToast()

  const { data: achievements = [] } = useQuery({
    queryKey: ['admin-achievements'],
    queryFn: () => api.adminListAchievements(),
  })
  const { data: court } = useQuery({
    queryKey: ['admin-court-players'],
    queryFn: () => api.adminCourtPlayers(),
  })

  const create = useMutation({
    mutationFn: () => api.adminCreateAchievement({ title, description, howToEarn }),
    onSuccess: () => {
      setTitle('')
      setDescription('')
      setHowToEarn('')
      push('Conquista criada.', 'success')
      void qc.invalidateQueries({ queryKey: ['admin-achievements'] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.adminDeleteAchievement(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-achievements'] }),
  })
  const grant = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) => api.adminGrantAchievement(id, email),
    onSuccess: () => push('Conquista marcada para o amigo.', 'success'),
    onError: (e: Error) => push(e.message, 'error'),
  })

  const friends = court?.friends ?? []

  return (
    <section id="conquistas" className="admin-form-panel flex h-full flex-col">
      <p className="font-label-sm text-xs text-secondary uppercase">Conquistas</p>
      <p className="text-sm text-on-surface-variant">
        Crie o feito e escreva como ele deve ser conquistado. Marque só para um amigo.
      </p>
      <label className="mt-1 block text-xs uppercase text-on-surface-variant">
        Título
        <input className="input-feudal mt-1 pl-4" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-xs uppercase text-on-surface-variant">
        Descrição
        <input className="input-feudal mt-1 pl-4" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="block text-xs uppercase text-on-surface-variant">
        Como deve ser conquistada
        <textarea className="input-feudal textarea-compact mt-1 pl-4" value={howToEarn} onChange={(e) => setHowToEarn(e.target.value)} />
      </label>
      <button
        type="button"
        className="btn-primary text-xs"
        disabled={create.isPending || title.trim().length < 2 || howToEarn.trim().length < 4}
        onClick={() => create.mutate()}
      >
        Criar conquista
      </button>
      <ul className="mt-2 max-h-72 flex-1 space-y-3 overflow-y-auto">
        {achievements.length === 0 ? <li className="text-sm text-on-surface-variant">Nenhuma conquista criada ainda.</li> : null}
        {achievements.map((item) => (
          <li key={item.id} className="rounded border border-outline-variant/40 p-3">
            <p className="font-serif text-on-surface">{item.title}</p>
            {item.description ? <p className="mt-1 text-xs text-on-surface-variant">{item.description}</p> : null}
            <p className="mt-1 text-xs text-secondary">Como conquistar · {item.howToEarn}</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <select
                className="input-feudal min-w-[10rem] flex-1 py-2 pl-3 text-sm normal-case"
                value={grantEmail[item.id] ?? ''}
                onChange={(e) => setGrantEmail((prev) => ({ ...prev, [item.id]: e.target.value }))}
                aria-label={`Amigo para ${item.title}`}
              >
                <option value="">Selecionar amigo…</option>
                {friends.map((friend) => {
                  const target = friend.id || friend.handle || friend.email || friend.displayName
                  return (
                    <option key={target} value={target}>
                      {friend.displayName} ({friend.handle})
                    </option>
                  )
                })}
              </select>
              <button
                type="button"
                className="btn-primary text-[10px]"
                disabled={!grantEmail[item.id] || grant.isPending}
                onClick={() => grant.mutate({ id: item.id, email: grantEmail[item.id] })}
              >
                Marcar
              </button>
              <button type="button" className="btn-secondary text-[10px]" onClick={() => remove.mutate(item.id)}>
                Apagar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
