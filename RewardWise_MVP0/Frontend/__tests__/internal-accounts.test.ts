/** @format */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getInternalEmails, isInternalEmail } from '@/utils/auth/internal-accounts'

const ORIGINAL = process.env.INTERNAL_EMAILS
const ORIGINAL_PUBLIC = process.env.NEXT_PUBLIC_INTERNAL_EMAILS

describe('internal-accounts allowlist', () => {
  beforeEach(() => {
    delete process.env.INTERNAL_EMAILS
    delete process.env.NEXT_PUBLIC_INTERNAL_EMAILS
  })
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.INTERNAL_EMAILS
    else process.env.INTERNAL_EMAILS = ORIGINAL
    if (ORIGINAL_PUBLIC === undefined) delete process.env.NEXT_PUBLIC_INTERNAL_EMAILS
    else process.env.NEXT_PUBLIC_INTERNAL_EMAILS = ORIGINAL_PUBLIC
  })

  describe('getInternalEmails', () => {
    it('returns [] when env var is unset', () => {
      expect(getInternalEmails()).toEqual([])
    })

    it('returns [] when env var is empty string', () => {
      process.env.INTERNAL_EMAILS = ''
      expect(getInternalEmails()).toEqual([])
    })

    it('parses comma-separated values, trims, and lowercases', () => {
      process.env.INTERNAL_EMAILS = ' Sabby@Example.com , Test@Foo.io '
      expect(getInternalEmails()).toEqual(['sabby@example.com', 'test@foo.io'])
    })

    it('drops empty entries from leading/trailing/double commas', () => {
      process.env.INTERNAL_EMAILS = ',a@x.com,,b@x.com,'
      expect(getInternalEmails()).toEqual(['a@x.com', 'b@x.com'])
    })

    it('falls back to NEXT_PUBLIC_INTERNAL_EMAILS when server var is unset', () => {
      process.env.NEXT_PUBLIC_INTERNAL_EMAILS = 'Public@Foo.com'
      expect(getInternalEmails()).toEqual(['public@foo.com'])
    })

    it('prefers INTERNAL_EMAILS over NEXT_PUBLIC_INTERNAL_EMAILS when both are set', () => {
      process.env.INTERNAL_EMAILS = 'server@foo.com'
      process.env.NEXT_PUBLIC_INTERNAL_EMAILS = 'public@foo.com'
      expect(getInternalEmails()).toEqual(['server@foo.com'])
    })
  })

  describe('isInternalEmail', () => {
    it('returns false for null/undefined/empty', () => {
      expect(isInternalEmail(null)).toBe(false)
      expect(isInternalEmail(undefined)).toBe(false)
      expect(isInternalEmail('')).toBe(false)
    })

    it('returns false when env var is unset', () => {
      expect(isInternalEmail('sabby@example.com')).toBe(false)
    })

    it('matches case-insensitively against the allowlist', () => {
      process.env.INTERNAL_EMAILS = 'sabby@example.com,test@foo.io'
      expect(isInternalEmail('SABBY@EXAMPLE.COM')).toBe(true)
      expect(isInternalEmail(' sabby@example.com ')).toBe(true)
      expect(isInternalEmail('test@foo.io')).toBe(true)
    })

    it('returns false for emails not in the allowlist', () => {
      process.env.INTERNAL_EMAILS = 'sabby@example.com'
      expect(isInternalEmail('outsider@example.com')).toBe(false)
    })
  })

  // Locks the exact Vercel allowlist as of 2026-05-28. If anyone changes the
  // env-var string in Vercel, this test should be updated in lockstep. Two
  // mytravelwallet.ai smoke addresses (Playwright) + two gmail.com personal
  // addresses (Sudeepta + Sabby) — proves the bypass has no domain-suffix
  // gate and gmail.com works as long as the address is on the list.
  describe('production allowlist (Vercel INTERNAL_EMAILS as of 2026-05-28)', () => {
    const PROD_ALLOWLIST =
      'smoke-test@mytravelwallet.ai,smoke-test-empty@mytravelwallet.ai,sudeeptaaiproducts@gmail.com,sarabjit.nagi@gmail.com'

    it.each([
      'smoke-test@mytravelwallet.ai',
      'smoke-test-empty@mytravelwallet.ai',
      'sudeeptaaiproducts@gmail.com',
      'sarabjit.nagi@gmail.com',
    ])('whitelists %s', (email) => {
      process.env.INTERNAL_EMAILS = PROD_ALLOWLIST
      expect(isInternalEmail(email)).toBe(true)
    })

    it('rejects a near-miss not on the list', () => {
      process.env.INTERNAL_EMAILS = PROD_ALLOWLIST
      expect(isInternalEmail('sarabjit.nagi+test@gmail.com')).toBe(false)
      expect(isInternalEmail('attacker@mytravelwallet.ai')).toBe(false)
    })
  })
})
