/**
 * Kininaru — AI 2.0 end-to-end test (suivi ÉTAPE 12).
 *
 * Two modes:
 *
 *   A) Offline validation (no credentials needed) — runs in CI/sandbox:
 *        node --experimental-strip-types scripts/ai-e2e-test.ts
 *      Exercises the strict server-side action whitelist (validateAiAction)
 *      against valid payloads and malicious/invalid ones.
 *
 *   B) Live authenticated flow (IA → proposition → validation serveur →
 *      Supabase → résultat), requires a real account + a running build of the
 *      app (`npm start`) + a real Supabase project with the schema applied:
 *        NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *        KIN_TEST_EMAIL=... KIN_TEST_PASSWORD=... \
 *        KIN_TEST_APP_URL=http://localhost:3000 \
 *        node --experimental-strip-types scripts/ai-e2e-test.ts --live
 *      The script signs in with the test account, builds the Supabase SSR
 *      cookie, calls /api/chat then /api/ai/actions, verifies the created
 *      rows in the database, and cleans them up afterwards.
 */
import { strict as assert } from 'node:assert'
import { createClient } from '@supabase/supabase-js'
import { validateAiAction } from '../lib/ai/actions.ts'

let failures = 0

async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failures++
    console.error(`  ✗ ${name}`)
    console.error(`      ${err instanceof Error ? err.message : String(err)}`)
  }
}

/* ------------------------------------------------------------------ */
/* Part A — offline validation of the action whitelist                 */
/* ------------------------------------------------------------------ */

async function runOffline() {
  console.log('\n[A] Validation hors-ligne de la whitelist d’actions\n')

  await check('create_task valide (titre, priorité, échéance, tags, description)', () => {
    const r = validateAiAction({
      action: 'create_task',
      data: {
        title: '  Réviser les maths  ',
        priority: 'high',
        due_date: '2026-09-01',
        tags: ['école', 'important'],
        description: 'Chapitre 3',
      },
    })
    if (!r.action || r.action.action !== 'create_task') throw new Error('action inattendue')
    assert.equal(r.action.data.title, 'Réviser les maths')
    assert.equal(r.action.data.priority, 'high')
    assert.equal(r.action.data.due_date, '2026-09-01')
    assert.deepEqual(r.action.data.tags, ['école', 'important'])
  })

  await check('create_task rejette un titre vide', () => {
    const r = validateAiAction({ action: 'create_task', data: { title: '   ' } })
    assert.ok(r.error)
  })

  await check('create_task rejette une priorité inconnue', () => {
    const r = validateAiAction({ action: 'create_task', data: { title: 'x', priority: 'asap' } })
    assert.ok(r.error)
  })

  await check('create_task rejette une date invalide', () => {
    const r = validateAiAction({ action: 'create_task', data: { title: 'x', due_date: '01/09/2026' } })
    assert.ok(r.error)
  })

  await check('create_task rejette plus de 5 étiquettes', () => {
    const r = validateAiAction({
      action: 'create_task',
      data: { title: 'x', tags: ['a', 'b', 'c', 'd', 'e', 'f'] },
    })
    assert.ok(r.error)
  })

  await check('create_tasks_batch valide (parent + étapes)', () => {
    const r = validateAiAction({
      action: 'create_tasks_batch',
      data: { parent_title: 'Apprendre Python', steps: ['Variables', 'Boucles', 'Mini-projet'] },
    })
    if (!r.action || r.action.action !== 'create_tasks_batch') throw new Error('action inattendue')
    assert.equal(r.action.data.steps.length, 3)
  })

  await check('create_tasks_batch rejette 0 étape', () => {
    const r = validateAiAction({ action: 'create_tasks_batch', data: { parent_title: 'x', steps: [] } })
    assert.ok(r.error)
  })

  await check('create_tasks_batch rejette plus de 10 étapes', () => {
    const steps = Array.from({ length: 11 }, (_, i) => `Étape ${i}`)
    const r = validateAiAction({ action: 'create_tasks_batch', data: { parent_title: 'x', steps } })
    assert.ok(r.error)
  })

  // ÉTAPE 15.5 §4-5 — Journal → objectif → tâches (avec confirmation)
  await check('create_objective valide (objectif + étapes confirmées)', () => {
    const r = validateAiAction({
      action: 'create_objective',
      data: {
        parent_title: 'Améliorer mon niveau en maths',
        steps: ['Identifier mes difficultés', 'Réviser le chapitre 1', 'Faire des exercices'],
      },
    })
    if (!r.action || r.action.action !== 'create_objective') throw new Error('action inattendue')
    assert.equal(r.action.data.parent_title, 'Améliorer mon niveau en maths')
    assert.equal(r.action.data.steps.length, 3)
  })

  await check('create_objective rejette 0 étape (jamais de création silencieuse)', () => {
    const r = validateAiAction({ action: 'create_objective', data: { parent_title: 'x', steps: [] } })
    assert.ok(r.error)
  })

  await check('create_objective rejette plus de 10 étapes', () => {
    const steps = Array.from({ length: 11 }, (_, i) => `Étape ${i}`)
    const r = validateAiAction({ action: 'create_objective', data: { parent_title: 'x', steps } })
    assert.ok(r.error)
  })

  await check('create_objective rejette un titre manquant', () => {
    const r = validateAiAction({ action: 'create_objective', data: { steps: ['a'] } })
    assert.ok(r.error)
  })

  await check('create_habit valide / titre manquant', () => {
    assert.ok(validateAiAction({ action: 'create_habit', data: { title: 'Lire' } }).action)
    assert.ok(validateAiAction({ action: 'create_habit', data: {} }).error)
  })

  await check('create_event valide + fin > début', () => {
    const r = validateAiAction({
      action: 'create_event',
      data: { title: 'Cours', start_at: '2026-09-01T10:00:00.000Z', end_at: '2026-09-01T11:00:00.000Z' },
    })
    assert.ok(r.action)
    const bad = validateAiAction({
      action: 'create_event',
      data: { title: 'Cours', start_at: '2026-09-01T11:00:00.000Z', end_at: '2026-09-01T10:00:00.000Z' },
    })
    assert.ok(bad.error)
  })

  await check('create_family_task exige un UUID valide', () => {
    assert.ok(
      validateAiAction({
        action: 'create_family_task',
        data: { title: 'Vaisselle', family_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
      }).action
    )
    assert.ok(
      validateAiAction({ action: 'create_family_task', data: { title: 'Vaisselle', family_id: 'not-a-uuid' } }).error
    )
  })

  await check('create_memory valide (contenu + catégorie)', () => {
    const r = validateAiAction({
      action: 'create_memory',
      data: { content: '  Examen de maths le 20 prochain mois  ', category: 'goal' },
    })
    if (!r.action || r.action.action !== 'create_memory') throw new Error('action inattendue')
    assert.equal(r.action.data.content, 'Examen de maths le 20 prochain mois')
    assert.equal(r.action.data.category, 'goal')
  })

  await check('create_memory rejette un contenu vide, > 500 caractères, catégorie inconnue', () => {
    assert.ok(validateAiAction({ action: 'create_memory', data: { content: ' ' } }).error)
    assert.ok(validateAiAction({ action: 'create_memory', data: { content: 'x'.repeat(501) } }).error)
    assert.ok(validateAiAction({ action: 'create_memory', data: { content: 'ok', category: 'weird' } }).error)
  })

  await check('action inconnue / payload non-objet rejetés', () => {
    assert.ok(validateAiAction({ action: 'drop_table', data: {} }).error)
    assert.ok(validateAiAction('create_task').error)
    assert.ok(validateAiAction(null).error)
    assert.ok(validateAiAction({ action: 'create_task' }).error)
  })
}

/* ------------------------------------------------------------------ */
/* Part B — live authenticated flow                                    */
/* ------------------------------------------------------------------ */

async function runLive() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.KIN_TEST_EMAIL
  const password = process.env.KIN_TEST_PASSWORD
  const appUrl = (process.env.KIN_TEST_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  if (!url || !anonKey || !email || !password) {
    console.error(
      '\n[B] Mode live ignoré : variables manquantes.\n' +
        '    Requises : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,\n' +
        '    KIN_TEST_EMAIL, KIN_TEST_PASSWORD (KIN_TEST_APP_URL optionnel).\n'
    )
    return
  }

  console.log('\n[B] Test de bout en bout authentifié (IA → action → Supabase)\n')

  const supabase = createClient(url, anonKey)
  const ref = new URL(url).hostname.split('.')[0]
  const cookieName = `sb-${ref}-auth-token`

  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError || !sessionData.session) {
    failures++
    console.error(`  ✗ Connexion du compte de test : ${signInError?.message ?? 'pas de session'}`)
    return
  }
  const s = sessionData.session
  const uid = s.user.id
  const cookieValue = Buffer.from(
    JSON.stringify([s.access_token, s.refresh_token, s.expires_in, s.token_type, s.expires_at])
  ).toString('base64url')
  const cookie = `${cookieName}=${cookieValue}`
  console.log(`  ✓ Connexion : ${email}`)

  const createdIds: { table: string; id: string }[] = []

  await check('anonyme bloqué sur /api/chat', async () => {
    const res = await fetch(`${appUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Bonjour' }] }),
    })
    assert.ok([401, 403, 307].includes(res.status), `statut reçu : ${res.status}`)
  })

  await check('/api/chat (avec session) répond et peut proposer des actions', async () => {
    const res = await fetch(`${appUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Planifie ma journée' }] }),
    })
    assert.ok(res.ok, `statut reçu : ${res.status}`)
    const text = await res.text()
    assert.ok(text.length > 0, 'réponse vide')
    // The model may or may not emit an action block — that is fine. If it
    // does, it must contain a whitelisted action, not SQL or free-form code.
    if (text.includes('==ACTIONS==')) {
      assert.ok(
        /create_task|create_tasks_batch|create_objective|create_habit|create_event|create_family_task|create_memory/.test(text),
        'le bloc d’actions doit contenir une action de la whitelist'
      )
    }
    console.log(`      (réponse ${text.length} caractères)`)
  })

  await check('/api/ai/actions : action invalide rejetée (400)', async () => {
    const res = await fetch(`${appUrl}/api/ai/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ actions: [{ action: 'create_task', data: { title: '' } }] }),
    })
    assert.equal(res.status, 400)
  })

  await check('/api/ai/actions : création de tâche + vérification Supabase', async () => {
    const title = `[E2E] Tâche ${Date.now()}`
    const res = await fetch(`${appUrl}/api/ai/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ actions: [{ action: 'create_task', data: { title, priority: 'high' } }] }),
    })
    assert.ok(res.ok, `statut reçu : ${res.status}`)
    const json = await res.json()
    assert.ok(json.results?.[0]?.ok, `résultat : ${JSON.stringify(json)}`)
    const id = json.results[0].id
    assert.ok(id, 'id manquant')

    const { data: row, error } = await supabase
      .from('tasks')
      .select('id, user_id, title, priority')
      .eq('id', id)
      .single()
    assert.ok(!error, error?.message)
    assert.equal(row?.user_id, uid, 'user_id doit venir de la session')
    assert.equal(row?.title, title)
    createdIds.push({ table: 'tasks', id })
    console.log(`      ✓ tâche vérifiée en base : "${title}"`)
  })

  await check('/api/ai/actions : mémorisation + vérification Supabase', async () => {
    const content = `[E2E] Préférence ${Date.now()}`
    const res = await fetch(`${appUrl}/api/ai/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ actions: [{ action: 'create_memory', data: { content, category: 'preference' } }] }),
    })
    assert.ok(res.ok, `statut reçu : ${res.status}`)
    const json = await res.json()
    assert.ok(json.results?.[0]?.ok, `résultat : ${JSON.stringify(json)}`)
    const id = json.results[0].id

    const { data: row, error } = await supabase
      .from('ai_memories')
      .select('id, user_id, content, category')
      .eq('id', id)
      .single()
    assert.ok(!error, error?.message)
    assert.equal(row?.user_id, uid, 'user_id doit venir de la session')
    assert.equal(row?.category, 'preference')
    createdIds.push({ table: 'ai_memories', id })
    console.log('      ✓ mémoire vérifiée en base')
  })

  // Cleanup — remove exactly the rows this run created (never user data).
  for (const { table, id } of createdIds.reverse()) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) console.error(`      ! nettoyage ${table}/${id} : ${error.message}`)
  }
  console.log(`      ✓ nettoyage : ${createdIds.length} ligne(s) supprimée(s)`)
  await supabase.auth.signOut()
}

/* ------------------------------------------------------------------ */

async function main() {
  await runOffline()
  if (process.argv.includes('--live')) {
    await runLive()
  }
  console.log(failures === 0 ? '\n✅ Tous les tests sont passés.' : `\n❌ ${failures} test(s) en échec.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
