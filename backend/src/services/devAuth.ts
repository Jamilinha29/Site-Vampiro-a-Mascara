export type DevRole = 'player' | 'narrator' | 'admin'

/** Papel inicial / dev: convenções de e-mail da mesa Beladona (produção usa `user_metadata.role`). */
export function devRoleForEmail(email: string): DevRole {
  const local = email.split('@')[0]?.toLowerCase() ?? ''
  if (local === 'admin' || local === 'adm' || local.startsWith('admin.')) return 'admin'
  if (local === 'testeuseradm' || local.startsWith('testeuseradm.')) return 'admin'
  if (local === 'narrador' || local === 'mestre' || local.startsWith('narrador.') || local.startsWith('mestre.')) {
    return 'narrator'
  }
  return 'player'
}

/** Dev-only token until Supabase Auth is wired with env credentials. */
export function signDevToken(email: string, displayName: string, role: DevRole = devRoleForEmail(email)) {
  const payload = {
    accessToken: `dev-${Buffer.from(email).toString('base64url')}`,
    userId: email,
    email,
    displayName,
    role,
  }
  return payload
}
