'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, MotionConfig } from 'framer-motion'
import {
  Sparkles,
  CheckSquare,
  Repeat2,
  Timer,
  BookOpen,
  Users,
  ArrowRight,
  Menu,
  X,
  CalendarDays,
  Play,
  Check,
  BarChart3,
  TrendingUp,
  Send,
  ShieldCheck,
  Sunrise,
  BellRing,
  Moon,
  Target,
} from 'lucide-react'
import { KinLogo } from '@/components/kin-logo'
import { BetaBadge } from '@/components/beta-badge'
import { Button } from '@/components/ui/button'
import { InstallAppButton } from '@/components/install-app-button'
import { InstallBanner } from '@/components/install-banner'
import { HeroShapes } from '@/components/landing/elegant-shapes'
import { SpotlightCards } from '@/components/landing/spotlight-cards'
import { FlipCard } from '@/components/landing/flip-card'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Copy (French — original language of the product)                    */
/* ------------------------------------------------------------------ */

const CHAT_SCRIPT: Record<string, { reply: string[] }> = {
  'Planifie ma journée': {
    reply: [
      'Voici une proposition pour aujourd’hui 🎯',
      '• 9h00 — Tâche prioritaire (2h en focus)',
      '• 11h30 — Mini-pause + habitude du matin',
      '• 14h00 — Sous-tâches de votre projet',
      '• 17h00 — Journal : 3 gratitudes',
      '',
      'Souhaitez-vous que je l’ajoute à votre dashboard ?',
    ],
  },
  'Aide-moi à organiser mes tâches': {
    reply: [
      'On va trier ça ensemble, c’est plus simple qu’il n’y paraît :',
      '1. Gardez 3 tâches prioritaires maximum par jour.',
      '2. Regroupez le reste par thème ou par projet.',
      '3. Planifiez-les sur des jours précis — une tâche sans date est une tâche reportée.',
      '',
      'Voulez-vous créer une tâche prioritaire pour demain ?',
    ],
  },
  'Crée une routine d’étude': {
    reply: [
      'Une routine efficace tient en 4 ingrédients :',
      '• Même créneau chaque jour (votre cerveau adore les repères)',
      '• 25 min de focus + 5 min de pause (méthode Pomodoro)',
      '• Une habitude de révision quotidienne',
      '• Un objectif hebdomadaire mesurable',
      '',
      'Je peux transformer ça en habitudes Kininaru en 2 clics.',
    ],
  },
  'Analyse ma progression': {
    reply: [
      'Voici ce que je vois :',
      '• Tâches terminées : 12 cette semaine (+40 %)',
      '• Habitudes : 5 jours de série sur « lecture »',
      '• Focus : 4 h 30 de concentration cumulée',
      '',
      'Vous êtes sur une belle dynamique — on fixe l’objectif de la semaine ?',
    ],
  },
  'Aide-moi à atteindre mon objectif': {
    reply: [
      'Découpons cet objectif en étapes qui ne font pas peur :',
      '1. Définissez le résultat visible (ex. : 10 pages écrites).',
      '2. Créez 3 mini-tâches de 20 minutes max.',
      '3. Ajoutez une habitude de progression quotidienne.',
      '',
      'Quel est l’objectif que vous visez ?',
    ],
  },
}

const DEFAULT_SUGGESTIONS = Object.keys(CHAT_SCRIPT)

/* ------------------------------------------------------------------ */
/* Hero planner mockup                                                 */
/* ------------------------------------------------------------------ */

function PlannerMock() {
  return (
    <div className="relative mx-auto max-w-md w-full">
      {/* Glow behind */}
      <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-primary/15 via-accent/10 to-transparent blur-2xl" />

      {/* Main planner card */}
      <motion.div
        initial={{ opacity: 0, y: 32, rotateX: 6 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-3xl border border-border bg-card shadow-kin-hover p-5 sm:p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="kin-caption mb-0.5">Aujourd’hui</p>
            <p className="font-serif font-bold text-lg text-foreground">Bonjour, Camille 👋</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Coach IA
          </div>
        </div>

        {/* Tasks */}
        <div className="space-y-2 mb-4">
          {[
            { t: 'Préparer la présentation', done: true, p: 'high' },
            { t: 'Course pour le dîner', done: false, p: 'medium' },
            { t: 'Relire le chapitre 4', done: false, p: 'low' },
          ].map((task) => (
            <div
              key={task.t}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/60 border border-border/60"
            >
              <span
                className={cn(
                  'w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0',
                  task.done ? 'bg-kin-sage border-kin-sage' : 'border-border'
                )}
              >
                {task.done && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />}
              </span>
              <span className={cn('text-sm flex-1', task.done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                {task.t}
              </span>
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  task.p === 'high' && 'bg-kin-coral',
                  task.p === 'medium' && 'bg-kin-yellow',
                  task.p === 'low' && 'bg-kin-sage'
                )}
              />
            </div>
          ))}
        </div>

        {/* Habits strip */}
        <div className="flex items-center justify-between px-3 py-3 rounded-xl bg-primary/5 border border-primary/15 mb-4">
          <span className="text-sm text-foreground font-medium">Habitude · Lecture</span>
          <span className="text-xs text-primary font-semibold">🔥 7 jours</span>
        </div>

        {/* Focus + week */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/60 border border-border/60 p-3">
            <Timer className="w-4 h-4 text-primary mb-2" />
            <p className="text-lg font-bold text-foreground">24:12</p>
            <p className="kin-caption">Session focus</p>
          </div>
          <div className="rounded-xl bg-muted/60 border border-border/60 p-3">
            <BarChart3 className="w-4 h-4 text-primary mb-2" />
            <div className="flex items-end gap-1 h-7">
              {[35, 60, 45, 80, 65, 90, 55].map((h, i) => (
                <div
                  key={i}
                  className={cn('flex-1 rounded-sm', i === 5 ? 'bg-primary' : 'bg-primary/30')}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <p className="kin-caption mt-1.5">Semaine productive</p>
          </div>
        </div>
      </motion.div>

      {/* Floating chips */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        className="absolute -left-4 sm:-left-10 top-16 glass rounded-2xl border border-border shadow-kin px-3.5 py-2.5 flex items-center gap-2 hidden sm:flex"
      >
        <span className="w-6 h-6 rounded-full bg-kin-rose/25 flex items-center justify-center text-xs">👨‍👩‍👧</span>
        <div>
          <p className="text-xs font-semibold text-foreground">Famille · Dîner</p>
          <p className="text-[10px] text-muted-foreground">ce soir à 19 h</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="absolute -right-4 sm:-right-10 bottom-10 glass rounded-2xl border border-border shadow-kin px-3.5 py-2.5 flex items-center gap-2 hidden sm:flex"
      >
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-xs font-medium text-foreground">3 suggestions prêtes</p>
      </motion.div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Interactive AI demo                                                  */
/* ------------------------------------------------------------------ */

function AiDemo() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [typing, setTyping] = useState(false)
  const [doneSuggestions, setDoneSuggestions] = useState<string[]>([])

  const ask = (suggestion: string) => {
    if (typing) return
    setDoneSuggestions((prev) => [...prev, suggestion])
    setMessages((prev) => [...prev, { role: 'user', text: suggestion }])
    setTyping(true)

    const reply = CHAT_SCRIPT[suggestion]?.reply ?? []
    const delay = 500
    reply.forEach((line, i) => {
      setTimeout(() => {
        setMessages((prev) => [...prev, { role: 'ai', text: line }])
        if (i === reply.length - 1) setTyping(false)
      }, delay + i * 480)
    })
  }

  const available = DEFAULT_SUGGESTIONS.filter((s) => !doneSuggestions.includes(s))

  return (
    <div className="relative mx-auto max-w-md w-full">
      <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-kin-violet/15 via-kin-blue/10 to-transparent blur-2xl" />

      <div className="relative rounded-3xl border border-border bg-card shadow-kin-hover overflow-hidden flex flex-col h-[460px]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">Kininaru AI Coach</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-kin-sage" /> en ligne · propulsé par Groq
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-8 leading-relaxed">
              Cliquez sur une suggestion pour voir
              <br />
              le coach en action.
            </p>
          )}
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] text-sm px-3.5 py-2.5 rounded-2xl rounded-br-md bg-primary text-primary-foreground shadow-kin">
                  {m.text}
                </p>
              </div>
            ) : (
              <div key={i} className="flex justify-start gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <p className="max-w-[85%] text-sm px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-muted text-foreground border border-border/60 whitespace-pre-line">
                  {m.text}
                </p>
              </div>
            )
          )}
          {typing && (
            <div className="flex justify-start gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Sparkles className="w-3 h-3 text-primary" />
              </div>
              <div className="px-3.5 py-3 rounded-2xl rounded-bl-md bg-muted border border-border/60 flex gap-1">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: d * 0.18 }}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        <div className="px-4 pb-3 flex flex-wrap gap-2 sm:gap-1.5">
          {available.slice(0, 3).map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={typing}
              className="min-h-11 sm:min-h-0 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary hover:bg-primary/5 transition-smooth disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-border bg-muted/40 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/15 transition-smooth">
            <input
              placeholder="Écrivez votre message…"
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              readOnly
            />
            <span className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Send className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Coach in action — “du conseil à l’action”                           */
/* ------------------------------------------------------------------ */

function CoachActionDemo() {
  const steps = [
    { icon: Timer, label: 'Focus pré-rempli' },
    { icon: Play, label: 'Session lancée' },
    { icon: Check, label: 'Tâche terminée' },
    { icon: TrendingUp, label: 'Progression +' },
  ]

  return (
    <div className="relative mx-auto max-w-3xl">
      <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-kin-sage/20 via-kin-blue/10 to-transparent blur-2xl" />
      <div className="relative rounded-3xl border border-border bg-card shadow-kin-hover p-6 sm:p-8">
        <div className="text-center mb-7">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
            <Sparkles className="w-3 h-3" /> Le coach, du conseil à l’action
          </span>
          <h3 className="kin-h1 text-foreground">Un coach qui vous mène à l’action</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            Observation → suggestion → action. Le coach propose toujours un prochain pas
            précis, basé sur vos vraies données — jamais de commentaires génériques.
          </p>
        </div>

        {/* Conversation */}
        <div className="space-y-3 max-w-lg mx-auto">
          <div className="flex justify-end">
            <p className="max-w-[85%] text-sm px-3.5 py-2.5 rounded-2xl rounded-br-md bg-primary text-primary-foreground shadow-kin">
              J’ai 5 choses à faire.
            </p>
          </div>
          <div className="flex justify-start gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="max-w-[85%]">
              <p className="text-sm px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-muted text-foreground border border-border/60 leading-relaxed">
                Commence par « Préparer la présentation ». Ça te prendra environ 25 minutes —
                je pré-remplis une session Focus pour toi.
              </p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <Button
                  size="sm"
                  className="gap-1.5 h-11 sm:h-9"
                  render={<Link href="/auth/sign-up">▶ Commencer</Link>}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 sm:h-9"
                  render={<Link href="/auth/sign-up">Voir le plan</Link>}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Ce qui se passe ensuite */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-y-2.5">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center">
              {i > 0 && (
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mx-1.5" aria-hidden />
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background/60 text-xs sm:text-sm font-medium text-foreground/90">
                <step.icon className="w-3.5 h-3.5 text-kin-sage" />
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function SectionHeading({
  kicker,
  title,
  text,
}: {
  kicker: string
  title: React.ReactNode
  text?: string
}) {
  return (
    <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16 px-4">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
        <Sparkles className="w-3 h-3" />
        {kicker}
      </span>
      <h2 className="kin-h1 text-foreground mb-4">{title}</h2>
      {text && <p className="text-muted-foreground leading-relaxed">{text}</p>}
    </div>
  )
}

export function Landing() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { href: '#features', label: 'Fonctionnalités' },
    { href: '#ai', label: 'Coach IA' },
    { href: '#day', label: 'Une journée' },
    { href: '#family', label: 'Famille' },
    { href: '#progress', label: 'Progression' },
  ]

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ---------------- Navbar ---------------- */}
      <header
        className={cn(
          'fixed top-0 inset-x-0 z-50 transition-all duration-300',
          scrolled || mobileOpen ? 'glass-topbar' : 'bg-transparent'
        )}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" aria-label="Kininaru — accueil" className="flex items-center gap-2.5 min-h-11">
            <KinLogo variant="row" markClassName="w-8 h-8" wordmarkClassName="text-lg" />
            <BetaBadge />
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            <Button variant="ghost" render={<Link href="/auth/login">Connexion</Link>} />
            <Button render={<Link href="/auth/sign-up">Commencer gratuitement</Link>} />
          </div>

          <button
            className="md:hidden p-2 min-w-11 min-h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-xl px-5 py-4 space-y-1">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
              >
                {l.label}
              </a>
            ))}
            <div className="flex gap-3 pt-3">
              <Button variant="outline" className="flex-1 h-11" render={<Link href="/auth/login">Connexion</Link>} />
              <Button className="flex-1 h-11" render={<Link href="/auth/sign-up">Commencer</Link>} />
            </div>
          </div>
        )}
      </header>

      {/* ---------------- Hero — « Ma journée évolue. » ---------------- */}
      <section className="relative overflow-hidden">
        {/* Formes géométriques flottantes + halos — couleurs de la palette du
            thème actif, derrière le contenu (z-0), parallaxe souris légère. */}
        <HeroShapes />

        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-6 pt-36 sm:pt-44 pb-16 sm:pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/70 text-xs font-medium text-muted-foreground mb-8 shadow-kin"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Kininaru · votre coach personnel de progression
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="kin-display text-foreground mb-6"
          >
            Ma journée{' '}
            <span className="kin-script kin-gradient-vivid">évolue</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="text-muted-foreground text-base sm:text-lg leading-[1.65] sm:leading-relaxed mb-8 sm:mb-10 max-w-2xl mx-auto"
          >
            Kininaru réunit tes <strong className="text-foreground font-semibold">tâches</strong>, tes{' '}
            <strong className="text-foreground font-semibold">objectifs</strong>, tes{' '}
            <strong className="text-foreground font-semibold">habitudes</strong>, ton{' '}
            <strong className="text-foreground font-semibold">focus</strong>, ton{' '}
            <strong className="text-foreground font-semibold">journal</strong> et un{' '}
            <strong className="text-foreground font-semibold">coach IA</strong> — il observe ta journée
            et intervient au bon moment pour t’aider à avancer.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.19 }}
            className="flex flex-col sm:flex-row gap-3 mb-10 items-center justify-center"
          >
            <Button
              size="lg"
              className="h-12 sm:h-11 px-7 gap-2 text-base"
              render={<Link href="/auth/sign-up">Commencer gratuitement</Link>}
            />
            {/* 📲 Installer Kininaru — visible uniquement quand le navigateur
                peut réellement installer la PWA (beforeinstallprompt) ;
                disparaît une fois installée ou en mode standalone. */}
            <InstallAppButton
              variant="button"
              className="h-12 sm:h-11 sm:w-auto sm:px-6 text-base border-primary/30 text-primary hover:border-primary/50"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground mb-12"
          >
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-kin-sage" /> +38 % de tâches terminées en moyenne
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-kin-sage" /> Gratuit pour commencer
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-kin-sage" /> Vos données restent privées
            </span>
          </motion.div>

          {/* La boucle quotidienne — chaque module de Kininaru, en une ligne. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            <div className="flex flex-wrap items-center justify-center gap-y-2.5">
              {[
                { icon: CheckSquare, label: 'Tâches', color: 'text-brand' },
                { icon: Target, label: 'Objectifs', color: 'text-warm' },
                { icon: Repeat2, label: 'Habitudes', color: 'text-kin-sage' },
                { icon: Timer, label: 'Focus', color: 'text-cool' },
                { icon: BookOpen, label: 'Journal', color: 'text-complement' },
                { icon: Sparkles, label: 'Coach IA', color: 'text-primary' },
                { icon: TrendingUp, label: 'Progression', color: 'text-kin-coral' },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center">
                  {i > 0 && (
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mx-1.5" aria-hidden />
                  )}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card/80 shadow-kin text-xs sm:text-sm font-medium text-foreground/90">
                    <step.icon className={cn('w-3.5 h-3.5', step.color)} />
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Un seul système, du matin au soir — des tâches à la prochaine action, guidé par votre coach.
            </p>
          </motion.div>
        </div>

        {/* Aperçu produit — centré, entouré des formes du hero. */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-md mx-auto px-5 sm:px-6 pb-24 sm:pb-32"
        >
          <PlannerMock />
        </motion.div>
      </section>

      {/* ---------------- Le problème → la transformation (Card Flip) ---------------- */}
      <section id="why" className="py-20 sm:py-28 border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-14 lg:gap-16 items-center">
          <Reveal>
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warm/15 text-warm text-xs font-semibold mb-4">
                <Repeat2 className="w-3 h-3" /> Le problème
              </span>
              <h2 className="kin-h1 text-foreground mb-5">
                47 choses à faire.
                <br /> Aucune idée par où commencer.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Les applications de tâches vous donnent encore plus de listes. Kininaru
                transforme la liste en <strong className="text-foreground font-semibold">système</strong> :
                priorisation, objectifs, habitudes, focus — et un coach qui adapte la journée à
                ce qui s’est réellement passé.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  { icon: Target, text: 'Une seule prochaine action claire, pas 47 choses à trier' },
                  { icon: Sparkles, text: 'Un coach qui observe vos vraies données et propose la suite concrète' },
                  { icon: Timer, text: 'Le Focus se pré-remplit d’un clic : vous commencez, sans friction' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3 text-sm text-foreground/90">
                    <span className="w-5 h-5 rounded-full bg-warm/20 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="w-3 h-3 text-warm" />
                    </span>
                    {item.text}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="h-11 sm:h-9"
                render={
                  <Link href="#features" className="inline-flex items-center gap-1.5">
                    Découvrir les fonctionnalités
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                }
              />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <FlipCard />
          </Reveal>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="py-20 sm:py-28 border-t border-border/60 bg-card/40">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionHeading
              kicker="Tout-en-un"
              title={
                <>
                  Tout ce qu’il faut pour avancer,
                  <br className="hidden sm:block" /> rien de superflu.
                </>
              }
              text="Chaque outil est pensé pour être utilisé en quelques secondes par jour — pas pour devenir une nouvelle corvée."
            />
          </Reveal>

          <Reveal>
            <div className="px-4 sm:px-6">
              {/* Spotlight Cards — tilt 3D, glow, shimmer : les couleurs sont
                  celles de la palette du thème actif (tokens --kt-*). */}
              <SpotlightCards />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- AI Coach ---------------- */}
      <section id="ai" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                <Sparkles className="w-3 h-3" /> Coach IA
              </span>
              <h2 className="kin-h1 text-foreground mb-5">
                Un coach qui planifie
                <br /> avec vous, pas à votre place.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Posez une question, recevez un plan actionnable. Kininaru transforme vos
                objectifs en étapes, vos journées en plans concrets — et reste toujours
                dans votre camp.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Planifier une journée chargée en 30 secondes',
                  'Découper un gros objectif en petites étapes',
                  'Créer une routine d’étude ou de sport durable',
                  'Analyser votre progression chaque semaine',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-foreground/90">
                    <span className="w-5 h-5 rounded-full bg-kin-sage/25 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-kin-rose-dark" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Button render={<Link href="/auth/sign-up">Essayer le coach IA</Link>} className="gap-2 h-11 sm:h-8">
                Essayer le coach IA <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <AiDemo />
          </Reveal>
          </div>

          {/* Le coach, du conseil à l’action — démonstration visuelle simple. */}
          <Reveal delay={0.05}>
            <div className="mt-16 sm:mt-24">
              <CoachActionDemo />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Une journée avec Kininaru ---------------- */}
      <section id="day" className="py-20 sm:py-28 border-t border-border/60 bg-card/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-kin-blue/15 text-kin-blue text-xs font-semibold mb-4">
                <Sunrise className="w-3 h-3" /> Une journée avec Kininaru
              </span>
              <h2 className="kin-h1 text-foreground mb-5">
                Votre journée,
                <br /> accompagnée du matin au soir.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Kininaru ne se contente pas de vous écouter : il prépare votre journée, vous
                rappelle ce qui compte vraiment, vous aide à entrer en focus et clôture la
                journée avec vous. Discret, jamais envahissant.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Brief du matin : vos 1 à 3 priorités du jour',
                  'Rappels intelligents au bon moment, jamais en excès',
                  'Sessions Focus lancées en un clic depuis une tâche',
                  'Bilan du soir + préparation du lendemain',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-foreground/90">
                    <span className="w-5 h-5 rounded-full bg-kin-blue/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-kin-blue" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Button render={<Link href="/auth/sign-up">Vivre une journée avec Kininaru</Link>} className="gap-2 h-11 sm:h-8">
                Vivre une journée avec Kininaru <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative mx-auto max-w-md w-full">
              <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-kin-blue/15 via-kin-sage/10 to-transparent blur-2xl" />
              <div className="relative rounded-3xl border border-border bg-card shadow-kin-hover p-6 sm:p-7">
                <p className="font-serif font-bold text-foreground mb-6">Une journée type</p>
                <div className="space-y-1">
                  {[
                    {
                      time: '08:00',
                      icon: Sunrise,
                      title: 'Le Coach prépare la journée',
                      text: 'Brief du matin : vos priorités, vos événements, votre première action.',
                      color: 'bg-kin-yellow/25 text-kin-coral',
                    },
                    {
                      time: '10:30',
                      icon: BellRing,
                      title: 'Coach → prochaine action',
                      text: '« Votre prochaine action est prête — 25 minutes de focus suffisent. »',
                      color: 'bg-kin-coral/15 text-kin-coral',
                    },
                    {
                      time: '14:00',
                      icon: Timer,
                      title: 'Session Focus',
                      text: 'La tâche se pré-remplit dans Focus. Vous lancez, le coach vous laisse travailler.',
                      color: 'bg-kin-blue/15 text-kin-blue',
                    },
                    {
                      time: '18:00',
                      icon: TrendingUp,
                      title: 'Progression',
                      text: 'Tâches terminées, habitudes cochées, minutes de focus — sans culpabiliser.',
                      color: 'bg-kin-sage/20 text-kin-sage',
                    },
                    {
                      time: '21:00',
                      icon: Moon,
                      title: 'Journal + lendemain',
                      text: 'Une pensée, un bilan, et demain est déjà préparé.',
                      color: 'bg-primary/10 text-primary',
                    },
                  ].map((step, i) => (
                    <div key={step.time} className="relative flex gap-4 pb-5 last:pb-0">
                      {i < 4 && (
                        <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" aria-hidden="true" />
                      )}
                      <span
                        className={cn(
                          'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 z-10 shadow-kin',
                          step.color
                        )}
                      >
                        <step.icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[11px] font-semibold text-muted-foreground tracking-wide tabular-nums">
                          {step.time}
                        </p>
                        <p className="text-sm font-semibold text-foreground leading-snug">{step.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{step.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Family ---------------- */}
      <section id="family" className="py-20 sm:py-28 border-t border-border/60 bg-card/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <div className="relative mx-auto max-w-md w-full order-2 lg:order-1">
              <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-kin-coral/15 via-kin-rose/10 to-transparent blur-2xl" />
              <div className="relative rounded-3xl border border-border bg-card shadow-kin-hover p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-serif font-bold text-foreground">Famille Martin</p>
                    <p className="kin-caption">4 membres · 2 parents</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {['#F6B7D2', '#CDE9D2', '#BFDFFF', '#FFF1B6'].map((c, i) => (
                    <span key={i} className="w-9 h-9 rounded-full border-2 border-card -ml-2 first:ml-0 shadow-kin" style={{ backgroundColor: c }} />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">Tous synchronisés</span>
                </div>
                <div className="space-y-2">
                  {[
                    { t: 'Dîner de famille', when: 'ce soir · 19 h 00', c: '#CDE9D2' },
                    { t: 'Sortie vélo samedi', when: 'sam. · 10 h 00', c: '#BFDFFF' },
                  ].map((e) => (
                    <div key={e.t} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/60 border border-border/60">
                      <span className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: e.c }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{e.t}</p>
                        <p className="text-[11px] text-muted-foreground">{e.when}</p>
                      </div>
                      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Un calendrier partagé, des tâches communes et des rôles clairs — les parents
                  gardent la main, chacun avance à son rythme.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="lg:pl-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                <Users className="w-3 h-3" /> Espace famille
              </span>
              <h2 className="kin-h1 text-foreground mb-5">
                La productivité,
                <br /> c’est mieux à plusieurs.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6 max-w-lg">
                Créez un espace familial en une minute, invitez avec un code et partagez
                calendrier, tâches et événements. Chaque membre garde son espace personnel.
              </p>
              <ul className="space-y-3">
                {[
                  'Invitation simple par code, rôles parent / membre',
                  'Événements et tâches partagés en temps réel',
                  'Notifications quand un membre rejoint ou participe',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-foreground/90">
                    <span className="w-5 h-5 rounded-full bg-kin-coral/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="w-3 h-3 text-kin-rose-dark" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Progression ---------------- */}
      <section id="progress" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                <BarChart3 className="w-3 h-3" /> Progression
              </span>
              <h2 className="kin-h1 text-foreground mb-5">
                Voyez le chemin parcouru,
                <br /> pas seulement la liste.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6 max-w-lg">
                Analytics calcule votre productivité, vos séries d’habitudes et vos heures de
                focus. Des graphiques lisibles, pas de chiffres pour le plaisir.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { v: '87 %', l: 'Tâches faites' },
                  { v: '12 j', l: 'Série record' },
                  { v: '9 h 20', l: 'Focus cette semaine' },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl border border-border bg-card p-4 text-center hover-lift transition-smooth">
                    <p className="font-serif font-bold text-xl text-foreground">{s.v}</p>
                    <p className="kin-caption">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative mx-auto max-w-md w-full">
              <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-kin-sage/20 via-kin-blue/10 to-transparent blur-2xl" />
              <div className="relative rounded-3xl border border-border bg-card shadow-kin-hover p-6">
                <div className="flex items-center justify-between mb-6">
                  <p className="font-serif font-bold text-foreground">Votre semaine</p>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-kin-sage/25 text-foreground font-medium">En hausse</span>
                </div>
                {[
                  { label: 'Tâches terminées', pct: 85, c: '#9BC7A4' },
                  { label: 'Habitudes tenues', pct: 65, c: '#B9A7FF' },
                  { label: 'Heures de focus', pct: 72, c: '#8FC1EF' },
                ].map((bar) => (
                  <div key={bar.label} className="mb-5 last:mb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-foreground font-medium">{bar.label}</span>
                      <span className="text-xs text-muted-foreground">{bar.pct} %</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${bar.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: bar.c }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="py-20 sm:py-28 border-t border-border/60">
        <Reveal>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <div className="rounded-[40px] border border-border bg-card p-10 sm:p-14 shadow-kin-hover relative overflow-hidden">
              <div className="absolute inset-0 kin-glow pointer-events-none" />
              <div className="relative">
                <Play className="w-10 h-10 text-primary mx-auto mb-6" />
                <h2 className="kin-h1 text-foreground mb-4">
                  Prêt à reprendre le contrôle de vos journées ?
                </h2>
                <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
                  Créez votre compte gratuit en 30 secondes. Aucune carte requise.
                </p>
                <div className="flex flex-col items-center gap-4">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-base gap-2"
                    render={<Link href="/auth/sign-up">Commencer gratuitement</Link>}
                  >
                    Commencer gratuitement <ArrowRight className="w-4 h-4" />
                  </Button>
                  <InstallAppButton variant="card" className="w-full sm:w-auto sm:min-w-[380px] text-left" />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-border bg-card/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col md:flex-row gap-10 md:items-start md:justify-between">
            <div className="max-w-xs">
              <KinLogo />
              <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
                Le planificateur chaleureux qui vous aide à organiser votre vie — et celle de
                votre famille — avec curiosité.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:gap-16">
              <div>
                <p className="kin-caption uppercase tracking-wider mb-3">Produit</p>
                <ul className="space-y-2.5 text-sm">
                  <li><a href="#features" className="text-muted-foreground hover:text-foreground transition-smooth">Fonctionnalités</a></li>
                  <li><a href="#ai" className="text-muted-foreground hover:text-foreground transition-smooth">Coach IA</a></li>
                  <li><a href="#day" className="text-muted-foreground hover:text-foreground transition-smooth">Une journée</a></li>
                  <li><a href="#family" className="text-muted-foreground hover:text-foreground transition-smooth">Famille</a></li>
                  <li><a href="#progress" className="text-muted-foreground hover:text-foreground transition-smooth">Progression</a></li>
                </ul>
              </div>
              <div>
                <p className="kin-caption uppercase tracking-wider mb-3">Légal</p>
                <ul className="space-y-2.5 text-sm">
                  <li><Link href="/legal/conditions" className="text-muted-foreground hover:text-foreground transition-smooth">Conditions d’utilisation</Link></li>
                  <li><Link href="/legal/confidentialite" className="text-muted-foreground hover:text-foreground transition-smooth">Confidentialité</Link></li>
                  <li><Link href="/legal/suppression-compte" className="text-muted-foreground hover:text-foreground transition-smooth">Suppression de compte</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Kininaru. Tous droits réservés.</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-primary" /> Fait avec curiosité
            </p>
          </div>
        </div>
      </footer>

      {/* Smart install banner — only when installable, never after install,
          remembered when dismissed. */}
      <InstallBanner />
    </div>
    </MotionConfig>
  )
}
