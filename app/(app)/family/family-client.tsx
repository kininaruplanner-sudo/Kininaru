'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import {
  Users,
  Plus,
  X,
  Check,
  CalendarDays,
  CheckSquare,
  Shield,
  LogOut,
  Copy,
  UserPlus,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cardVariants } from '@/components/ui/card'
import TeamSelector from '@/components/ui/TeamSelector'
import { palette } from '@/lib/palette'
import { PageHeader } from '@/components/page-header'

interface Family {
  id: string
  name: string
  created_by: string
  invite_code: string
  created_at: string
}

interface Member {
  family_id: string
  user_id: string
  role: 'parent' | 'member'
  joined_at: string
  profiles: { display_name: string | null; email: string | null } | null
}

interface FamilyEvent {
  id: string
  family_id: string
  user_id: string
  title: string
  description: string | null
  start_at: string
  end_at: string
  color: string
}

interface FamilyTask {
  id: string
  family_id: string
  user_id: string
  assignee_id: string | null
  title: string
  done: boolean
  created_at: string
}

interface Props {
  userId: string
  families: Family[]
  members: Member[]
  events: FamilyEvent[]
  tasks: FamilyTask[]
}

const EVENT_COLORS = [
  palette('sage'), palette('coral'), palette('violet'),
  palette('rose-dark'), palette('blue'), palette('lavender'),
]

/** Short, readable invite code (e.g. 6 chars) generated client-side. */
function makeInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function FamilyClient({ userId, families: initialFamilies, members, events, tasks }: Props) {
  const [families, setFamilies] = useState(initialFamilies)
  const [selectedId, setSelectedId] = useState<string | null>(initialFamilies[0]?.id ?? null)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createSize, setCreateSize] = useState(2)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const supabase = createClient()

  // Local mutable copies so the UI updates instantly.
  const [memberState, setMemberState] = useState(members)
  const [eventState, setEventState] = useState(events)
  const [taskState, setTaskState] = useState(tasks)

  // ---- derived per selected family ----
  const selected = families.find((f) => f.id === selectedId) ?? null
  const selectedMembers = memberState.filter((m) => m.family_id === selectedId)
  const selectedEvents = eventState
    .filter((e) => e.family_id === selectedId)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
  const selectedTasks = taskState.filter((t) => t.family_id === selectedId)
  const currentMember = selectedMembers.find((m) => m.user_id === userId)
  const isParent = currentMember?.role === 'parent'

  const memberName = (m: Member) =>
    m.profiles?.display_name || m.profiles?.email?.split('@')[0] || 'Membre'

  // ---- create family ----
  const createFamily = async () => {
    if (!createName.trim()) return
    setBusy(true)
    setError('')
    try {
      const inviteCode = makeInviteCode()
      const { data, error: famErr } = await supabase
        .from('families')
        .insert({ name: createName.trim(), created_by: userId, invite_code: inviteCode })
        .select()
        .single()
      if (famErr) throw famErr

      const { error: memErr } = await supabase
        .from('family_members')
        .insert({ family_id: data.id, user_id: userId, role: 'parent' })
      if (memErr) throw memErr

      setFamilies((prev) => [...prev, data])
      setMemberState((prev) => [
        ...prev,
        { family_id: data.id, user_id: userId, role: 'parent', joined_at: new Date().toISOString(), profiles: null },
      ])
      setSelectedId(data.id)
      setShowCreate(false)
      setCreateName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de créer la famille')
    } finally {
      setBusy(false)
    }
  }

  // ---- join family via invite code (server-validated RPC) ----
  const joinFamily = async () => {
    if (!joinCode.trim()) return
    setBusy(true)
    setError('')
    try {
      const { data, error: rpcErr } = await supabase.rpc('join_family', {
        p_code: joinCode.trim().toUpperCase(),
      })
      if (rpcErr) throw rpcErr

      const { data: family } = await supabase
        .from('families')
        .select('*')
        .eq('id', data)
        .single()
      if (family) {
        setFamilies((prev) => (prev.some((f) => f.id === family.id) ? prev : [...prev, family]))
        setMemberState((prev) => [
          ...prev,
          { family_id: family.id, user_id: userId, role: 'member', joined_at: new Date().toISOString(), profiles: null },
        ])
        setSelectedId(family.id)
      }
      setShowJoin(false)
      setJoinCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code d'invitation invalide")
    } finally {
      setBusy(false)
    }
  }

  // ---- leave family ----
  const leaveFamily = async () => {
    if (!selected) return
    if (!window.confirm(`Quitter la famille « ${selected.name} » ?`)) return
    await supabase.from('family_members').delete().eq('family_id', selected.id).eq('user_id', userId)
    setFamilies((prev) => prev.filter((f) => f.id !== selected.id))
    setMemberState((prev) => prev.filter((m) => !(m.family_id === selected.id && m.user_id === userId)))
    setSelectedId(families.find((f) => f.id !== selected.id)?.id ?? null)
  }

  // ---- remove member (parent only) ----
  const removeMember = async (member: Member) => {
    if (member.user_id === userId) return
    if (!window.confirm(`Retirer ${memberName(member)} de la famille ?`)) return
    await supabase
      .from('family_members')
      .delete()
      .eq('family_id', member.family_id)
      .eq('user_id', member.user_id)
    setMemberState((prev) => prev.filter((m) => !(m.family_id === member.family_id && m.user_id === member.user_id)))
  }

  // ---- family events ----
  const [eventForm, setEventForm] = useState({ title: '', start_at: '', end_at: '', color: EVENT_COLORS[0] })
  const [showEventModal, setShowEventModal] = useState(false)

  const addEvent = async () => {
    if (!selected || !eventForm.title.trim() || !eventForm.start_at || !eventForm.end_at) return
    const { data } = await supabase
      .from('family_events')
      .insert({
        family_id: selected.id,
        user_id: userId,
        title: eventForm.title.trim(),
        start_at: new Date(eventForm.start_at).toISOString(),
        end_at: new Date(eventForm.end_at).toISOString(),
        color: eventForm.color,
      })
      .select()
      .single()
    if (data) {
      setEventState((prev) => [...prev, data])
      setShowEventModal(false)
      setEventForm({ title: '', start_at: '', end_at: '', color: EVENT_COLORS[0] })
    }
  }

  const deleteEvent = async (id: string) => {
    await supabase.from('family_events').delete().eq('id', id)
    setEventState((prev) => prev.filter((e) => e.id !== id))
  }

  // ---- family tasks ----
  const [taskTitle, setTaskTitle] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [taskBusy, setTaskBusy] = useState(false)

  const addTask = async () => {
    if (!selected || !taskTitle.trim() || taskBusy) return
    setTaskBusy(true)
    try {
      const { data, error } = await supabase
        .from('family_tasks')
        .insert({
          family_id: selected.id,
          user_id: userId,
          assignee_id: taskAssignee || null,
          title: taskTitle.trim(),
        })
        .select()
        .single()
      if (error) {
        setError('Impossible d\'ajouter la tâche. Réessayez.')
        return
      }
      if (data) {
        setTaskState((prev) => [data, ...prev])
        setTaskTitle('')
        setTaskAssignee('')
      }
    } finally {
      setTaskBusy(false)
    }
  }

  const toggleTask = async (task: FamilyTask) => {
    const next = !task.done
    await supabase.from('family_tasks').update({ done: next }).eq('id', task.id)
    setTaskState((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: next } : t)))
  }

  const deleteTask = async (id: string) => {
    await supabase.from('family_tasks').delete().eq('id', id)
    setTaskState((prev) => prev.filter((t) => t.id !== id))
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={Users}
        title="Famille"
        subtitle="Collaborez avec vos proches"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowJoin(true)} className="gap-1.5">
              <UserPlus className="w-4 h-4" /> Rejoindre
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Créer une famille
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {families.length === 0 ? (
          <div className="text-center py-16 max-w-md mx-auto">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">Aucune famille</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Crée un groupe familial pour partager un calendrier, des tâches et rester
              connecté avec les personnes qui comptent.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Créer une famille
              </Button>
              <Button variant="outline" onClick={() => setShowJoin(true)} className="gap-2">
                <UserPlus className="w-4 h-4" /> Rejoindre avec un code
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Family selector */}
            <div className="flex gap-2 flex-wrap">
              {families.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedId(f.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-smooth',
                    selectedId === f.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40'
                  )}
                >
                  <Users className="w-4 h-4 text-primary" />
                  {f.name}
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}

            {selected && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Members + invite */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cardVariants({ padding: 'lg' })}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <h2 className="font-semibold text-foreground">Membres</h2>
                    </div>
                    <span className="text-xs text-muted-foreground">{selectedMembers.length} membre{selectedMembers.length > 1 ? 's' : ''}</span>
                  </div>

                  <div className="space-y-2 mb-4">
                    {selectedMembers.map((m) => (
                      <div key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/50">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary uppercase">
                            {memberName(m).slice(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {memberName(m)}
                            {m.user_id === userId && <span className="text-muted-foreground"> (vous)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.role === 'parent' ? 'Parent' : 'Membre'}
                          </p>
                        </div>
                        {isParent && m.user_id !== userId && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeMember(m)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                            title="Retirer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Invite code (visible to all members) */}
                  <div className="border border-dashed border-border rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-2">Code d&apos;invitation</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-center text-lg font-bold tracking-[0.3em] text-primary bg-muted rounded-lg py-2 select-all">
                        {selected.invite_code}
                      </code>
                      <Button variant="outline" size="sm" onClick={() => copyCode(selected.invite_code)} className="gap-1">
                        {copied === selected.invite_code ? <Check className="w-3.5 h-3.5 text-kin-sage" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === selected.invite_code ? 'Copié' : 'Copier'}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={leaveFamily} className="gap-1.5 text-destructive hover:bg-destructive/10">
                      <LogOut className="w-3.5 h-3.5" /> Quitter la famille
                    </Button>
                  </div>
                </motion.div>

                {/* Shared calendar + tasks */}
                <div className="space-y-6">
                  {/* Events */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className={cardVariants({ padding: 'lg' })}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-primary" />
                        <h2 className="font-semibold text-foreground">Calendrier partagé</h2>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setShowEventModal(true)} className="gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Événement
                      </Button>
                    </div>

                    {selectedEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Aucun événement partagé
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedEvents.slice(0, 6).map((e) => (
                          <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 group">
                            <div
                              className="w-1 h-9 rounded-full shrink-0"
                              style={{ backgroundColor: e.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(e.start_at), 'EEE d MMM · HH:mm')}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => deleteEvent(e.id)}
                              className="opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  {/* Tasks */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className={cardVariants({ padding: 'lg' })}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <CheckSquare className="w-4 h-4 text-primary" />
                      <h2 className="font-semibold text-foreground">Tâches partagées</h2>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                      <Input
                        placeholder="Nouvelle tâche..."
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) addTask()
                        }}
                      />
                      <select
                        value={taskAssignee}
                        onChange={(e) => setTaskAssignee(e.target.value)}
                        className="h-8 px-2 text-xs bg-muted rounded-lg border-none focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
                      >
                        <option value="">Personne</option>
                        {selectedMembers.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {memberName(m)}
                          </option>
                        ))}
                      </select>
                      <Button size="sm" onClick={addTask} disabled={taskBusy || !taskTitle.trim()} className="gap-1">
                        <Plus className="w-3.5 h-3.5" /> {taskBusy ? 'Ajout...' : 'Ajouter'}
                      </Button>
                    </div>

                    {selectedTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucune tâche partagée
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedTasks.map((t) => {
                          const assignee = selectedMembers.find((m) => m.user_id === t.assignee_id)
                          return (
                            <div key={t.id} className="flex items-center gap-2.5 group py-1">
                              <button
                                onClick={() => toggleTask(t)}
                                className={cn(
                                  'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-smooth hover:scale-110',
                                  t.done ? 'bg-kin-sage border-kin-sage' : 'border-border hover:border-primary'
                                )}
                              >
                                {t.done && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                              <span className={cn('text-sm flex-1 truncate', t.done && 'text-muted-foreground line-through')}>
                                {t.title}
                              </span>
                              {assignee && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground shrink-0">
                                  {memberName(assignee)}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => deleteTask(t.id)}
                                className="opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create family modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="glass border border-border rounded-3xl p-6 w-full max-w-md shadow-kin-hover"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-serif font-bold text-foreground">Créer une famille</h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowCreate(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Nom de la famille</Label>
                  <Input
                    placeholder="ex. La famille Martin"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="mt-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) createFamily()
                    }}
                  />
                </div>
                <div>
                  <Label>Combien de membres serez-vous ?</Label>
                  <div className="mt-2 flex justify-center">
                    <TeamSelector
                      label="Taille de la famille"
                      defaultValue={createSize}
                      min={1}
                      max={10}
                      onChange={setCreateSize}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {createSize > 1
                      ? `Parfait — vous pourrez inviter ${createSize - 1} autre${createSize - 1 > 1 ? 's' : ''} membre${createSize - 1 > 1 ? 's' : ''} avec votre code d’invitation.`
                      : 'Vous resterez seul·e pour l’instant — vous pourrez inviter des membres plus tard.'}
                  </p>
                </div>
                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
                    {error}
                  </div>
                )}
                <Button onClick={createFamily} disabled={busy || !createName.trim()} className="w-full">
                  {busy ? 'Création...' : 'Créer'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join modal */}
      <AnimatePresence>
        {showJoin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowJoin(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="glass border border-border rounded-3xl p-6 w-full max-w-md shadow-kin-hover"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-serif font-bold text-foreground">Rejoindre une famille</h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowJoin(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Code d&apos;invitation</Label>
                  <Input
                    placeholder="ABC123"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="mt-1 font-mono tracking-widest"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) joinFamily()
                    }}
                  />
                </div>
                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
                    {error}
                  </div>
                )}
                <Button onClick={joinFamily} disabled={busy || !joinCode.trim()} className="w-full">
                  {busy ? 'Connexion...' : 'Rejoindre'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New event modal */}
      <AnimatePresence>
        {showEventModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEventModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="glass border border-border rounded-3xl p-6 w-full max-w-md shadow-kin-hover"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-serif font-bold text-foreground">Nouvel événement familial</h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowEventModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Titre</Label>
                  <Input
                    placeholder="ex. Dîner de famille"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    className="mt-1"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Début</Label>
                    <Input
                      type="datetime-local"
                      value={eventForm.start_at}
                      onChange={(e) => setEventForm({ ...eventForm, start_at: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Fin</Label>
                    <Input
                      type="datetime-local"
                      value={eventForm.end_at}
                      onChange={(e) => setEventForm({ ...eventForm, end_at: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Couleur</Label>
                  <div className="flex gap-2 mt-2">
                    {EVENT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEventForm({ ...eventForm, color: c })}
                        className={cn(
                          'w-7 h-7 rounded-full transition-smooth hover:scale-110',
                          eventForm.color === c && 'ring-2 ring-offset-2 ring-foreground scale-110'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  onClick={addEvent}
                  disabled={!eventForm.title.trim() || !eventForm.start_at || !eventForm.end_at}
                  className="w-full"
                >
                  Créer l&apos;événement
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
