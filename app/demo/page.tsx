import type { Metadata } from 'next'
import { DemoPlanner } from '@/components/demo/demo-planner'

export const metadata: Metadata = {
  title: 'Démo — Essaie Kininaru sans compte',
  description:
    'Démo interactive de Kininaru : coche des tâches, suis une habitude et lance une session de focus. Aucune inscription, rien n’est enregistré.',
  alternates: { canonical: '/demo' },
}

/**
 * Démo publique : aucune dépendance à Supabase, donc la page fonctionne même
 * quand les variables d'environnement ne sont pas encore configurées.
 */
export default function DemoPage() {
  return <DemoPlanner />
}
