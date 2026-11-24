import { describe, expect, it } from 'vitest'
import { hasRole } from '../src/access/roles'

describe('staff role checks', () => {
  it('accepts only a user from the staff collection with an allowed role', () => {
    expect(
      hasRole({ collection: 'users', role: 'manager' }, ['owner', 'manager']),
    ).toBe(true)
    expect(
      hasRole({ collection: 'users', role: 'content' }, ['owner', 'manager']),
    ).toBe(false)
    expect(hasRole({ collection: 'customers', role: 'owner' }, ['owner'])).toBe(
      false,
    )
    expect(hasRole(null, ['owner'])).toBe(false)
  })
})
