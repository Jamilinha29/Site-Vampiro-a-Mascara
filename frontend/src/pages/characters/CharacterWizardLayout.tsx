import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/ToastProvider'
import { STARTING_CHARACTER_XP } from '../../lib/characterAbilityRules'
import { formatMortalFaithValue, MORTAL_FAITH_PATHS, OTHER_SPECIES_OPTIONS } from '../../lib/characterOptions'
import { resolveResourceProfile } from '../../lib/characterSheetKind'
import { useCharacterWizardStore, type WizardStepId } from '../../stores/characterWizardStore'

const steps: {
  path: string
  short: string
  title: string
  stepId: WizardStepId
  subtitle: string
}[] = [
  {
    path: '/user/characters/new/lineage',
    short: 'Etapa 01',
    title: 'Linhagem & Clã',
    stepId: 'lineage',
    subtitle: 'Dê vida a um cainita ou mortal no coração da Idade das Trevas.',
  },
  {
    path: '/user/characters/new/identity',
    short: 'Etapa 02',
    title: 'Identidade & Fé',
    stepId: 'identity',
    subtitle: 'Registre o nome, o senhor e a orientação espiritual do personagem.',
  },
  {
    path: '/user/characters/new/archetype',
    short: 'Etapa 03',
    title: 'Arquétipo & Natureza',
    stepId: 'archetype',
    subtitle: 'Defina a essência da alma, a máscara social perante a corte e a força motriz.',
  },
  {
    path: '/user/characters/new/attributes',
    short: 'Etapa 04',
    title: 'Atributos & Virtudes',
    stepId: 'attributes',
    subtitle: 'Distribua o poder do sangue entre atributos fundamentais e virtudes da alma.',
  },
  {
    path: '/user/characters/new/powers',
    short: 'Etapa 05',
    title: 'Habilidades',
    stepId: 'powers',
    subtitle: 'Defina perícias feudais e crie habilidades próprias para a ficha.',
  },
  {
    path: '/user/characters/new/review',
    short: 'Etapa 06',
    title: 'Resumo & Conclusão',
    stepId: 'review',
    subtitle: 'Revise a ficha completa e corrija o que estiver errado antes de concluir.',
  },
]

export function CharacterWizardLayout({ children }: { title?: string; children: ReactNode }) {
  const location = useLocation()
  const idx = Math.max(
    0,
    steps.findIndex((s) => location.pathname.startsWith(s.path)),
  )
  const current = steps[idx]!
  const { push } = useToast()

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-col gap-3 border-b border-outline-variant/30 pb-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 font-label-sm text-[10px] tracking-[0.18em] text-secondary uppercase">
            <span className="material-symbols-outlined text-sm text-secondary">menu_book</span>
            Grimório de criação de personagem
          </p>
          <h1 className="mt-1 font-headline-lg text-2xl text-on-surface md:text-3xl">Forjar Novo Personagem</h1>
          <p className="mt-1 max-w-xl text-sm italic text-primary/90">{current.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Link to="/user/characters" className="btn-secondary px-4 py-2 text-xs">
            Cancelar
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded border border-secondary/70 bg-surface-container px-4 py-2 text-xs font-medium text-on-surface transition hover:bg-surface-container-high"
            onClick={() => push('Rascunho salvo neste dispositivo.', 'success')}
          >
            <span className="material-symbols-outlined text-base text-secondary">bookmark</span>
            Salvar Rascunho
          </button>
        </div>
      </header>

      <ol className="grid gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
        {steps.map((step, i) => {
          const active = i === idx
          const done = i < idx
          return (
            <li key={step.path}>
              <Link
                to={step.path}
                className={`block rounded border px-2 py-2 transition ${
                  active
                    ? 'border-primary-container bg-primary-container/15 shadow-[inset_0_0_0_1px_rgba(158,27,45,0.35)]'
                    : done
                      ? 'border-secondary/50 bg-secondary/5 hover:bg-secondary/10'
                      : 'border-outline-variant/30 bg-surface-container-lowest/40 text-on-surface-variant hover:border-outline-variant'
                }`}
              >
                <span
                  className={`block text-[10px] font-semibold tracking-wider uppercase ${
                    active ? 'text-primary' : done ? 'text-secondary' : 'text-on-surface-variant'
                  }`}
                >
                  {step.short}
                  {done ? ' · Concluído' : active ? ' · Em edição' : ''}
                </span>
                <span className={`mt-1 block text-[11px] font-semibold leading-snug ${active ? 'text-on-surface' : ''}`}>
                  {step.title}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>

      <div className="card-surface p-4 md:p-5">{children}</div>
      <WizardNav stepIndex={idx} />
    </div>
  )
}

function WizardNav({ stepIndex }: { stepIndex: number }) {
  const prev = steps[stepIndex - 1]
  const next = steps[stepIndex + 1]
  const current = steps[stepIndex]
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { push } = useToast()
  const oathAccepted = useCharacterWizardStore((s) => s.oathAccepted)
  const species = useCharacterWizardStore((s) => s.species)
  const name = useCharacterWizardStore((s) => s.name)
  const reset = useCharacterWizardStore((s) => s.reset)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const speciesLabels: Record<string, string> = {
    vampiro: 'Vampiro / Cainita',
    mortal: 'Mortal / Caçador',
    outros: 'Outras espécies',
  }

  const hpValue = useCharacterWizardStore((s) => s.hpValue)
  const manaValue = useCharacterWizardStore((s) => s.manaValue)

  const resources = resolveResourceProfile(
    species === 'vampiro' ? 'Vampiro' : species === 'mortal' ? 'Mortal' : 'Outras espécies',
  )

  const missing: string[] = []
  if (!species) missing.push('escolha a espécie')
  if (!name.trim()) missing.push('informe o nome')
  if (hpValue == null || hpValue < 1) missing.push('informe o HP rolado (etapa 04)')
  if (resources.showMana && (manaValue == null || manaValue < 1)) {
    missing.push('informe a Mana rolada (etapa 04)')
  }
  if (!oathAccepted) missing.push('aceite as Seis Tradições')

  useEffect(() => {
    if (missing.length) return
    setError(null)
  }, [missing.length])

  const onFinish = async () => {
    if (missing.length) {
      const message = `Para criar o personagem, ${missing.join(', ')}.`
      setError(message)
      push(message, 'error')
      return
    }
    const state = useCharacterWizardStore.getState()
    const speciesLabel = speciesLabels[species!] ?? species!
    setPending(true)
    setError(null)
    try {
      const { api } = await import('../../services/api')
      const otherLabel = OTHER_SPECIES_OPTIONS.find((o) => o.id === state.otherSpeciesKind)?.label
      const speciesFinal =
        species === 'outros' && otherLabel
          ? `${speciesLabel} · ${otherLabel}${state.otherSpeciesType ? ` (${state.otherSpeciesType})` : ''}`
          : speciesLabel

      const willValue = Math.max(0, state.virtues.courage)
      const hp = Math.max(1, state.hpValue ?? 1)
      const mana = Math.max(1, state.manaValue ?? 1)
      const created = await api.createCharacter({
        name: name.trim(),
        species: speciesFinal,
        clan: state.clanName ?? undefined,
        level: 1,
        isPrimary: true,
        hp: { current: hp, max: hp },
        blood: species === 'vampiro' ? { current: 10, max: 10 } : undefined,
        mana: resources.showMana ? { current: mana, max: mana } : undefined,
        will:
          species === 'mortal'
            ? undefined
            : { current: willValue || 0, max: Math.max(5, willValue || 5) },
        startingXp: STARTING_CHARACTER_XP,
        characterClass: state.characterClass,
        vitals: {
          hpDie: state.hpDie,
          manaDie: resources.showMana ? state.manaDie : undefined,
          locked: true,
        },
        balanceStats: {
          ...state.attributes,
          ...state.abilities,
          consciencia: state.virtues.conscience,
          autocontrole: state.virtues.selfControl,
          coragem: state.virtues.courage,
        },
      })

      let faith: string | null = null
      if (state.faithPath === 'luz' || state.faithPath === 'trevas') {
        const path = MORTAL_FAITH_PATHS.find((p) => p.id === state.faithPath)
        if (path && state.cathedralName) {
          faith = formatMortalFaithValue(path.label, state.cathedralName, '')
        } else if (path) {
          faith = path.label
        }
      }

      await api.patchMeCharacter(created.id, {
        faith,
        identityPatch: {
          concept: state.concept.trim() || null,
          nature: state.archetype,
          demeanor: state.demeanor,
          house: [state.title, state.socialRank, state.characterClass].filter(Boolean).join(' · ') || null,
          residence: state.origin.trim() || null,
        },
        createdSkills: state.createdSkills,
        characterClass: state.characterClass,
        subclass: null,
      })

      reset()
      void queryClient.invalidateQueries({ queryKey: ['me-profile'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      push('Personagem forjado com sucesso.', 'success')
      navigate(`/user/characters/${created.id}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível criar o personagem.'
      setError(message)
      push(message, 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {prev ? (
          <Link to={prev.path} className="btn-secondary text-xs">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Voltar para {prev.title}
          </Link>
        ) : (
          <Link to="/user/characters" className="btn-secondary text-xs">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Voltar ao Painel
          </Link>
        )}

        {next ? (
          <Link to={next.path} className="btn-primary text-xs">
            Avançar para {next.title}
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        ) : (
          <button type="button" className="btn-primary text-xs" disabled={pending} onClick={() => void onFinish()}>
            {pending ? 'Criando…' : 'Concluir Personagem'}
            <span className="material-symbols-outlined text-base">check</span>
          </button>
        )}
      </div>
      {current?.stepId === 'review' && error ? <p className="text-right text-sm text-primary">{error}</p> : null}
      {current?.stepId === 'review' && !error && missing.length ? (
        <p className="text-right text-xs text-on-surface-variant">Para criar: {missing.join('; ')}.</p>
      ) : null}
    </div>
  )
}
