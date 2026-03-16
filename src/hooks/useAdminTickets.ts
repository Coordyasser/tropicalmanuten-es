import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TicketStatus } from '../types/database'

export interface AdminTicket {
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
  signature_url: string | null
  audio_url: string | null
  resolution_notes: string | null
  resolution_audio_url: string | null
  project: { name: string } | null
  technician: { id: string; name: string } | null
}

interface UseAdminTicketsResult {
  tickets: AdminTicket[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAdminTickets(): UseAdminTicketsResult {
  const [tickets, setTickets] = useState<AdminTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('tickets')
      .select(`
        id, project_id, tech_id, scheduled_date, scheduled_time,
        description, unidade, bloco, categoria,
        status, report, photo_url, signature_url, audio_url,
        resolution_notes, resolution_audio_url,
        project:projects ( name ),
        technician:profiles ( id, name )
      `)
      .order('scheduled_date', { ascending: false })
    if (err) setError(err.message)
    else setTickets((data ?? []) as unknown as AdminTicket[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTickets() }, [fetchTickets])
  return { tickets, loading, error, refetch: fetchTickets }
}
