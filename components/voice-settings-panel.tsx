'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Play, Volume2, Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import {
  type VoicePrefs,
  voiceLabel,
  speakSample,
} from '@/lib/voice-preferences'

interface VoiceSettingsPanelProps {
  prefs: VoicePrefs
  onChange: (next: VoicePrefs) => void
  voices: SpeechSynthesisVoice[]
  voicesLoaded: boolean
  /** Compact layout for the in-call popover. */
  compact?: boolean
}

/** Groups voices by language (e.g. "fr-FR" → French) for the <optgroup>. */
function groupVoices(voices: SpeechSynthesisVoice[]): { lang: string; items: SpeechSynthesisVoice[] }[] {
  const map = new Map<string, SpeechSynthesisVoice[]>()
  for (const v of voices) {
    const lang = v.lang || '—'
    if (!map.has(lang)) map.set(lang, [])
    map.get(lang)!.push(v)
  }
  return [...map.entries()]
    .map(([lang, items]) => ({ lang, items }))
    .sort((a, b) => a.lang.localeCompare(b.lang))
}

export function VoiceSettingsPanel({
  prefs,
  onChange,
  voices,
  voicesLoaded,
  compact = false,
}: VoiceSettingsPanelProps) {
  const { t } = useI18n()
  const [tested, setTested] = useState(false)
  const groups = useMemo(() => groupVoices(voices), [voices])

  const handleTest = () => {
    speakSample(prefs, t('settings.voiceSample'))
    setTested(true)
  }

  const sliderClass =
    'w-full h-2 appearance-none rounded-full bg-muted accent-primary cursor-pointer transition-smooth'

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      {/* Voice choice */}
      <div>
        <label htmlFor="kin-voice-select" className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {t('settings.voiceLabel')}
        </label>
        <div className="relative">
          <select
            id="kin-voice-select"
            value={prefs.voiceURI ?? ''}
            onChange={(e) => onChange({ ...prefs, voiceURI: e.target.value || null })}
            className="w-full appearance-none rounded-xl border border-input bg-background px-3 py-2.5 pr-9 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-3 focus:ring-ring/15 transition-smooth"
          >
            <option value="">{t('settings.voiceAuto')}</option>
            {groups.map((g) => (
              <optgroup key={g.lang} label={g.lang}>
                {g.items.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {voiceLabel(v)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            aria-hidden
          />
        </div>
        {voicesLoaded && voices.length === 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">{t('settings.voiceNoVoices')}</p>
        )}
      </div>

      {/* Rate */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="kin-rate" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Gauge className="w-3.5 h-3.5" aria-hidden />
            {t('settings.voiceRate')}
          </label>
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {prefs.rate.toFixed(2).replace(/0$/, '')}×
          </span>
        </div>
        <input
          id="kin-rate"
          type="range"
          min={0.5}
          max={1.5}
          step={0.05}
          value={prefs.rate}
          onChange={(e) => onChange({ ...prefs, rate: Number(e.target.value) })}
          className={sliderClass}
          aria-label={t('settings.voiceRate')}
        />
      </div>

      {/* Volume */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="kin-volume" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Volume2 className="w-3.5 h-3.5" aria-hidden />
            {t('settings.voiceVolume')}
          </label>
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {Math.round(prefs.volume * 100)}%
          </span>
        </div>
        <input
          id="kin-volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={prefs.volume}
          onChange={(e) => onChange({ ...prefs, volume: Number(e.target.value) })}
          className={sliderClass}
          aria-label={t('settings.voiceVolume')}
        />
      </div>

      {/* Test */}
      <button
        onClick={handleTest}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:border-primary hover:bg-primary/5 active:scale-95 transition-smooth"
      >
        <Play className="w-3 h-3 text-primary" aria-hidden />
        {tested ? t('settings.voiceTestAgain') : t('settings.voiceTest')}
      </button>
    </div>
  )
}
