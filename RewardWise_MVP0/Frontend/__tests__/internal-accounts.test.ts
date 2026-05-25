/** @format */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getInternalEmails, isInternalEmail } from '@/utils/auth/internal-accounts'

const ORIGINAL = process.env.INTERNAL_EMAILS

describe('internal-accounts allowlist', () => {
  beforeEach(() => {
    delete process.env.INTERNAL_EMAILS
  })
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.INTERNAL_EMAILS
    else process.env.INTERNAL_EMAILS = ORIGINAL
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
})
