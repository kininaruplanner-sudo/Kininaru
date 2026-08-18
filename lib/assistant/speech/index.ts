/**
 * Kininaru Assistant — Speech Module
 *
 * Barrel export for the modular speech interfaces.
 */

export { createWebSpeechInput } from './input'
export type { SpeechInput, SpeechInputState, SpeechInputResult, SpeechInputCallbacks } from './input'
export { createWebSpeechOutput } from './output'
export type { SpeechOutput, SpeechOutputState, SpeechOutputPrefs, SpeechOutputCallbacks } from './output'
