/** @format */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getThankYouEmails, isThankYouEmail } from '@/utils/auth/thank-you-accounts'

const ORIGINAL = process.env.THANK_YOU_EMAILS
const ORIGINAL_PUBLIC = process.env.NEXT_PUBLIC_THANK_YOU_EMAILS

describe('thank-you-accounts allowlist', () => {
  beforeEach(() => {
    delete process.env.THANK_YOU_EMAILS
    delete process.env.NEXT_PUBLIC_THANK_YOU_EMAILS
  })
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.THANK_YOU_EMAILS
    else process.env.THANK_YOU_EMAILS = ORIGINAL
    if (ORIGINAL_PUBLIC === undefined) delete process.env.NEXT_PUBLIC_THANK_YOU_EMAILS
    else process.env.NEXT_PUBLIC_THANK_YOU_EMAILS = ORIGINAL_PUBLIC
  })

  describe('getThankYouEmails', () => {
    it('returns [] when env var is unset', () => {
      expect(getThankYouEmails()).toEqual([])
    })

    it('returns [] when env var is empty string', () => {
      process.env.THANK_YOU_EMAILS = ''
      expect(getThankYouEmails()).toEqual([])
    })

    it('parses comma-separated values, trims, and lowercases', () => {
      process.env.THANK_YOU_EMAILS = ' Sara@Example.com , Test@Foo.io '
      expect(getThankYouEmails()).toEqual(['sara@example.com', 'test@foo.io'])
    })

    it('drops empty entries from leading/trailing/double commas', () => {
      process.env.THANK_YOU_EMAILS = ',a@x.com,,b@x.com,'
      expect(getThankYouEmails()).toEqual(['a@x.com', 'b@x.com'])
    })

    // Critical security property: prospect PII must not leak via a NEXT_PUBLIC_
    // fallback. Unlike internal-accounts, this helper has no public twin —
    // a NEXT_PUBLIC_THANK_YOU_EMAILS in env must be IGNORED, not silently used.
    it('does NOT fall back to NEXT_PUBLIC_THANK_YOU_EMAILS when server var is unset', () => {
      process.env.NEXT_PUBLIC_THANK_YOU_EMAILS = 'public@foo.com'
      expect(getThankYouEmails()).toEqual([])
    })

    it('does NOT fall back to NEXT_PUBLIC_THANK_YOU_EMAILS when server var is empty', () => {
      process.env.THANK_YOU_EMAILS = ''
      process.env.NEXT_PUBLIC_THANK_YOU_EMAILS = 'public@foo.com'
      expect(getThankYouEmails()).toEqual([])
    })
  })

  describe('isThankYouEmail', () => {
    it('returns false for null/undefined/empty', () => {
      expect(isThankYouEmail(null)).toBe(false)
      expect(isThankYouEmail(undefined)).toBe(false)
      expect(isThankYouEmail('')).toBe(false)
    })

    it('returns false when env var is unset', () => {
      expect(isThankYouEmail('sara@example.com')).toBe(false)
    })

    it('matches case-insensitively against the allowlist', () => {
      process.env.THANK_YOU_EMAILS = 'sara@example.com,test@foo.io'
      expect(isThankYouEmail('SARA@EXAMPLE.COM')).toBe(true)
      expect(isThankYouEmail(' sara@example.com ')).toBe(true)
      expect(isThankYouEmail('test@foo.io')).toBe(true)
    })

    it('returns false for emails not in the allowlist', () => {
      process.env.THANK_YOU_EMAILS = 'sara@example.com'
      expect(isThankYouEmail('outsider@example.com')).toBe(false)
    })

    it('returns false when only NEXT_PUBLIC_THANK_YOU_EMAILS is set', () => {
      // Defense against accidental dual-write to NEXT_PUBLIC_ — if a future
      // operator sets the public var thinking it'd be picked up, the banner
      // and coupon attach must BOTH stay off (no-op cleanly).
      process.env.NEXT_PUBLIC_THANK_YOU_EMAILS = 'sara@example.com'
      expect(isThankYouEmail('sara@example.com')).toBe(false)
    })
  })
})
