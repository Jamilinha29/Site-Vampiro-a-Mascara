import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../backend/src/index.js'

const playerToken = `dev-${Buffer.from('criar-ficha@ci.local').toString('base64url')}`

describe('POST /api/v1/me/characters', () => {
  it('creates a primary character for authenticated player', async () => {
    const res = await request(app)
      .post('/api/v1/me/characters')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        name: 'Personagem CI',
        species: 'Vampiro / Cainita',
        level: 1,
        isPrimary: true,
        hp: { current: 10, max: 10 },
        blood: { current: 10, max: 10 },
        characterClass: 'Combatente',
        vitals: { hpDie: 'D10', locked: true },
      })
    expect(res.status).toBe(201)
    expect(res.body.id).toBeTruthy()
    expect(res.body.name).toBe('Personagem CI')
  })

  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/me/characters').send({
      name: 'Sem auth',
      species: 'Mortal',
      hp: { current: 1, max: 1 },
    })
    expect(res.status).toBe(401)
  })
})
