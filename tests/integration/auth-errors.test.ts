import { describe, it, expect, vi } from 'vitest'
import { getAuthErrorMessage } from '@/lib/auth-errors'

describe('getAuthErrorMessage', () => {
  it('returns generic message for "Invalid login credentials"', () => {
    const err = new Error('Invalid login credentials')
    const result = getAuthErrorMessage(err, 'Fallback')
    expect(result).toBe('Email ou mot de passe incorrect.')
  })

  it('returns generic message for "Email not confirmed"', () => {
    const err = new Error('Email not confirmed')
    const result = getAuthErrorMessage(err, 'Fallback')
    expect(result).toBe('Veuillez confirmer votre adresse email.')
  })

  it('returns generic message for "User already registered"', () => {
    const err = new Error('User already registered')
    const result = getAuthErrorMessage(err, 'Fallback')
    expect(result).toBe('Un compte existe déjà avec cette adresse email.')
  })

  it('returns generic message for password too short', () => {
    const err = new Error('Password should be at least 6 characters')
    const result = getAuthErrorMessage(err, 'Fallback')
    expect(result).toBe('Le mot de passe doit contenir au moins 6 caractères.')
  })

  it('returns generic message for rate limiting', () => {
    const err = new Error('Too many requests')
    const result = getAuthErrorMessage(err, 'Fallback')
    expect(result).toBe('Trop de tentatives. Réessayez dans un instant.')
  })

  it('returns fallback for unknown error', () => {
    const err = new Error('Some obscure Supabase internal error XYZ')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = getAuthErrorMessage(err, 'Erreur de connexion')
    expect(result).toBe('Erreur de connexion')
    expect(consoleSpy).toHaveBeenCalledWith('[Kininaru Auth]', 'Some obscure Supabase internal error XYZ')
    consoleSpy.mockRestore()
  })

  it('returns fallback when error is not an Error instance', () => {
    const result = getAuthErrorMessage('string error', 'Fallback')
    expect(result).toBe('Fallback')
  })

  it('returns fallback for null', () => {
    const result = getAuthErrorMessage(null, 'Fallback')
    expect(result).toBe('Fallback')
  })

  it('never exposes the original error message to the client', () => {
    const err = new Error('Supabase: Error connecting to database at 10.0.0.5:5432')
    const result = getAuthErrorMessage(err, 'Erreur de connexion')
    expect(result).not.toContain('10.0.0.5')
    expect(result).not.toContain('database')
    expect(result).not.toContain('Supabase')
    expect(result).toBe('Erreur de connexion')
  })

  it('handles email rate limit exceeded', () => {
    const err = new Error('Email rate limit exceeded: please try again later')
    const result = getAuthErrorMessage(err, 'Fallback')
    expect(result).toBe('Trop de tentatives. Réessayez dans un instant.')
  })
})
