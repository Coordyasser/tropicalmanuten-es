import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { TicketStatus, TicketType } from '../types/database'

export interface TicketWithRelations {
  id: string
  project_id: string
  tech_id: string
  scheduled_date: string
  scheduled_time: string | null
  description: string
  unidade: string | null
  bloco: string | null
  categoria: string | null
  status: TicketStatus
  report: string | null
  photo_url: string | null
  diagnostic_photo_url: string | null
  signature_url: string | null
  audio_url: string | null
  audio_transcription: string | null
  resolution_notes: string | null
  resolution_audio_url: string | null
  resolution_audio_transcription: string | null
  os_number: number | null
  os_pdf_url: string | null
  completed_at: string | null
  ticket_type: TicketType | null
  project: { name: string } | null
}

interface UseTicketsResult {
  tickets: TicketWithRelations[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useTickets(): UseTicketsResult {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTickets = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('tickets')
      .select(`
        id, project_id, tech_id, scheduled_date, scheduled_time,
        description, unidade, bloco, categoria, status,
        report, photo_url, diagnostic_photo_url, signature_url, audio_url, audio_transcription,
        resolution_notes, resolution_audio_url, resolution_audio_transcription,
        os_number, os_pdf_url, completed_at, ticket_type,
        project:projects ( name )
      `)
      .eq('tech_id', user.id)
      .order('scheduled_date', { ascending: true })
    if (err) setError(err.message)
    else setTickets((data ?? []) as unknown as TicketWithRelations[])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchTickets() }, [fetchTickets])
  return { tickets, loading, error, refetch: fetchTickets }
}
