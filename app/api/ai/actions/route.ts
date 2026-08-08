import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface CreateTaskPayload {
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Vous devez être connecté.' }, { status: 401 })
    }

    const { action, payload } = await req.json()

    if (action !== 'create_task') {
      return Response.json({ error: 'Action non prise en charge.' }, { status: 400 })
    }

    const taskPayload = payload as CreateTaskPayload
    if (!taskPayload?.title?.trim()) {
      return Response.json({ error: 'Titre de tâche manquant.' }, { status: 400 })
    }

    const { data, error } = await supabase.from('tasks').insert({
      user_id: user.id,
      title: taskPayload.title.trim(),
      description: taskPayload.description?.trim() || 'Créée depuis Kininaru AI Coach',
      priority: taskPayload.priority || 'medium',
      status: 'todo',
      tags: [],
    }).select('id,title').single()

    if (error) {
      console.error('Erreur création tâche IA', error)
      return Response.json({ error: 'Impossible de créer la tâche.' }, { status: 500 })
    }

    return Response.json({ success: true, task: data })
  } catch (error) {
    console.error('Erreur route actions IA', error)
    return Response.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
