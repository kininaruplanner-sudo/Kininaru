'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, MotionConfig, useReducedMotion } from 'framer-motion'
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
  Check,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Sunrise,
  BellRing,
  Moon,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { KinLogo } from '@/components/kin-logo'
import { BetaBadge } from '@/components/beta-badge'
import { Button } from '@/components/ui/button'
import { InstallAppButton } from '@/components/install-app-button'
import { InstallBanner } from '@/components/install-banner'
import { HeroShapes } from '@/components/landing/elegant-shapes'
import { SpotlightCards } from '@/components/landing/spotlight-cards'
import { FlipCard } from '@/components/landing/flip-card'
import TypewriterTitle from '@/components/ui/TypewriterTitle'
import AILoadingState from '@/components/ui/AILoadingState'
import TeamSelector from '@/components/ui/TeamSelector'
import MouseEffectCard from '@/components/ui/MouseEffectCard'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Copy (French — original language of the product)                    */
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

/* ------------------------------------------------------------------ */
/* Progression — compteurs animés (0 → 128) déclenchés à l'affichage    */
/* ------------------------------------------------------------------ */

function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  duration = 1.1,
}: {
  value: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!started) return
    if (reduced) {
      // prefers-reduced-motion : afficher directement la valeur finale,
      // différée d'une frame pour éviter un setState synchrone dans l'effet.
      const raf = requestAnimationFrame(() => setDisplay(value))
      return () => cancelAnimationFrame(raf)
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic : rapide au départ, doux à la fin
      setDisplay(Math.round(eased * value))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [started, value, duration, reduced])

  return (
    <motion.span
      onViewportEnter={() => setStarted(true)}
      viewport={{ once: true, margin: '-40px' }}
      className="tabular-nums"
    >
      {prefix}
      {display.toLocaleString('fr-FR')}
      {suffix}
    </motion.span>
  )
}

function ProgressStat({
  icon: Icon,
  value,
  label,
  chip,
  suffix = '',
  delay,
}: {
  icon: LucideIcon
  value: number
  label: string
  chip: string
  suffix?: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-border bg-card p-4 text-center hover-lift transition-smooth"
    >
      <span className={cn('inline-flex w-8 h-8 rounded-lg items-center justify-center mb-2.5', chip)}>
        <Icon className="w-4 h-4" />
      </span>
      <p className="font-serif font-bold text-xl sm:text-2xl text-foreground leading-none">
        <AnimatedNumber value={value} suffix={suffix} />
      </p>
      <p className="kin-caption mt-1.5">{label}</p>
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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="mb-6"
          >
            <p className="kin-script kin-gradient-vivid text-xl sm:text-2xl mb-3">
              Ma journée évolue.
            </p>
            <TypewriterTitle
              className="kin-display"
              sequences={[
                { text: 'Un coach qui planifie avec vous,', pauseAfter: 600 },
                { text: 'pas à votre place.' },
              ]}
              typingSpeed={38}
              startDelay={350}
            />
          </motion.div>

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
          <Reveal>
            <div className="rounded-[40px] border border-border bg-card/40 shadow-kin p-4 sm:p-8">
              <AILoadingState />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Une journée avec Kininaru ---------------- */}
      <section id="day" className="py-20 sm:py-28 border-t border-border/60 bg-card/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-14 items-center">
          {/* Apparition séquentielle : message → détails → action. */}
          <Reveal>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-kin-blue/15 text-kin-blue text-xs font-semibold mb-4">
              <Sunrise className="w-3 h-3" /> Une journée avec Kininaru
            </span>
          </Reveal>

          <Reveal delay={0.06}>
            <h2 className="kin-h1 text-foreground mb-5">
              Votre journée,
              <br /> accompagnée du matin au soir.
            </h2>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="text-muted-foreground leading-relaxed mb-8 max-w-lg">
              Kininaru ne se contente pas de vous écouter : il prépare votre journée, vous
              rappelle ce qui compte vraiment, vous aide à entrer en focus et clôture la
              journée avec vous. Discret, jamais envahissant.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
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
          </Reveal>

          <Reveal delay={0.24}>
            <Button render={<Link href="/auth/sign-up">Vivre une journée avec Kininaru</Link>} className="gap-2 h-11 sm:h-8">
              Vivre une journée avec Kininaru <ArrowRight className="w-4 h-4" />
            </Button>
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
                    /* Chaque moment de la journée apparaît l'un après l'autre. */
                    <motion.div
                      key={step.time}
                      initial={{ opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.45, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                      className="relative flex gap-4 pb-5 last:pb-0"
                    >
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
                    </motion.div>
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

              <div className="mt-8 flex justify-center">
                <TeamSelector
                  label="Taille de la famille"
                  defaultValue={4}
                  min={1}
                  max={10}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Progression ---------------- */}
      <section id="progress" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-14 items-center">
          {/* Apparition séquentielle : message → données → chiffres qui évoluent.
              Le titre, le sous-texte puis chaque carte entrent dans le viewport
              l'un après l'autre (whileInView, une seule fois). */}
          <Reveal>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <BarChart3 className="w-3 h-3" /> Progression
            </span>
          </Reveal>

          <Reveal delay={0.06}>
            <h2 className="kin-h1 text-foreground mb-5">
              Voyez le chemin parcouru,
              <br /> pas seulement la liste.
            </h2>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="text-muted-foreground leading-relaxed mb-7 max-w-lg">
              Analytics calcule votre productivité, vos séries d’habitudes et vos heures de
              focus. Des graphiques lisibles, pas de chiffres pour le plaisir.
            </p>
          </Reveal>

          <div className="grid grid-cols-3 gap-3">
            <ProgressStat icon={CheckSquare} value={128} label="Tâches terminées" chip="bg-kin-coral/15 text-kin-coral" delay={0.2} />
            <ProgressStat icon={Timer} value={84} suffix=" h" label="Heures de focus" chip="bg-kin-blue/15 text-kin-blue" delay={0.28} />
            <ProgressStat icon={Repeat2} value={37} label="Habitudes tenues" chip="bg-kin-sage/20 text-kin-sage" delay={0.36} />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <ProgressStat icon={TrendingUp} value={12} suffix=" j" label="Jours de progression" chip="bg-warm/15 text-warm" delay={0.44} />
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: 0.52, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-border bg-card p-4 hover-lift transition-smooth"
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-medium text-foreground">Progression globale</span>
                <p className="font-serif font-bold text-lg text-foreground">
                  <AnimatedNumber value={87} suffix=" %" />
                </p>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '87%' }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 1, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full kin-gradient-brand"
                />
              </div>
            </motion.div>
          </div>

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
      <section className="py-16 sm:py-20 border-t border-border/60 flex justify-center">
        <div className="w-full px-4 sm:px-6">
          <Reveal>
            <MouseEffectCard
              title="Prêt à reprendre le contrôle de vos journées ?"
              subtitle="Organisez votre temps efficacement grâce à un accompagnement personnalisé."
              topText="Kininaru Planner"
              topSubtext="Passez à l'action"
              primaryCtaText="Commencer gratuitement"
              primaryCtaUrl="/auth/sign-up"
              secondaryCtaText="En savoir plus"
              secondaryCtaUrl="#features"
              dotSize={2}
              dotSpacing={16}
              repulsionRadius={90}
              repulsionStrength={25}
            />
          </Reveal>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="relative overflow-hidden border-t border-border bg-card/60">
        {/* Transition douce depuis la section précédente + motifs géométriques
            Memphis intégrés au pied de page (discrétion : opacités faibles,
            pointer-events-none, couleurs de la palette unique). */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent to-card/80" />
          {/* Cercles concentriques — coin haut droit (marine) */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-10 right-[4%] hidden sm:block"
          >
            <svg width="104" height="104" viewBox="0 0 104 104" fill="none">
              <circle cx="52" cy="52" r="48" stroke="var(--kt-cool)" strokeWidth="2" opacity="0.16" />
              <circle cx="52" cy="52" r="34" stroke="var(--kt-cool)" strokeWidth="2" opacity="0.12" />
              <circle cx="52" cy="52" r="10" fill="var(--kt-cool)" opacity="0.14" />
            </svg>
          </motion.div>
          {/* Vague sinueuse — milieu gauche (cyan) */}
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/3 left-[3%] hidden md:block"
          >
            <svg width="140" height="26" viewBox="0 0 140 26" fill="none">
              <path
                d="M2 21 C 18 4, 34 4, 50 15 C 66 26, 82 26, 98 15 C 114 4, 128 5, 138 8"
                stroke="var(--kt-brand)"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.28"
              />
            </svg>
          </motion.div>
          {/* Triangle — coin bas gauche (orange) */}
          <motion.div
            animate={{ y: [0, -6, 0], rotate: [0, 6, 0] }}
            transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-10 left-[7%] hidden sm:block"
          >
            <svg width="56" height="48" viewBox="0 0 56 48" fill="none">
              <path d="M28 3 L54 45 H2 Z" fill="var(--kt-warm)" opacity="0.18" />
            </svg>
          </motion.div>
          {/* Demi-cercle — coin bas droit (terracotta) */}
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-12 right-[10%] hidden lg:block"
          >
            <svg width="64" height="34" viewBox="0 0 64 34" fill="none">
              <path d="M0 34 A32 32 0 0 1 64 34 Z" fill="var(--kt-complement)" opacity="0.16" />
            </svg>
          </motion.div>
          {/* Motif de points — bas centre gauche (cyan) */}
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-16 left-[32%] hidden md:block"
          >
            <div
              className="w-20 h-14"
              style={{
                backgroundImage: 'radial-gradient(var(--kt-brand) 1.4px, transparent 2px)',
                backgroundSize: '14px 14px',
                opacity: 0.22,
              }}
            />
          </motion.div>
          {/* Carré pivoté — centre droit (marine) */}
          <motion.div
            animate={{ y: [0, 4, 0], rotate: [12, 18, 12] }}
            transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/2 right-[22%] hidden xl:block"
          >
            <div className="w-8 h-8 rounded-md border-2 rotate-12" style={{ borderColor: 'var(--kt-cool)', opacity: 0.2 }} />
          </motion.div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12">
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
