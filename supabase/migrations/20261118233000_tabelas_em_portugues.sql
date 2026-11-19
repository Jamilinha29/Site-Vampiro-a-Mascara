-- Renomeia as tabelas já criadas. Os registros permanecem.
-- Nomes entre aspas preservam a forma usada no código e no Table Editor.

do $$
declare
  par text[];
  pares text[][] := array[
    array['clans', 'Linhagens'],
    array['player_profiles', 'PerfisJogadores'],
    array['characters', 'Personagens'],
    array['character_items', 'ItensPersonagem'],
    array['character_skills', 'HabilidadesPersonagem'],
    array['chronicle_entities', 'EntidadesCronica'],
    array['scheduled_sessions', 'SessoesAgendadas'],
    array['session_presence', 'PresencaSessao'],
    array['session_seats', 'AssentosSessao'],
    array['session_handouts', 'MateriaisSessao'],
    array['handout_participants', 'ParticipantesMaterial'],
    array['handout_rewards', 'RecompensasMaterial'],
    array['scene_threats', 'AmeacasCena'],
    array['scene_npcs', 'NpcsCena'],
    array['wallets', 'Carteiras'],
    array['wallet_ledger', 'ExtratoCarteira'],
    array['shop_purchases', 'ComprasLoja'],
    array['notifications', 'NotificacoesPublicas'],
    array['notification_reads', 'LeiturasNotificacao'],
    array['registrations', 'Inscricoes'],
    array['email_deliveries', 'EntregasEmail'],
    array['character_subclasses', 'SubclassesPersonagem'],
    array['reference_catalog', 'CatalogoReferencia'],
    array['campaign_documents', 'DocumentosCampanha']
  ];
begin
  foreach par slice 1 in array pares
  loop
    if to_regclass('public.' || par[1]) is not null
       and to_regclass('public."' || par[2] || '"') is null then
      execute format('alter table public.%I rename to %I', par[1], par[2]);
    end if;
  end loop;
end $$;
