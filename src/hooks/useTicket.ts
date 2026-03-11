import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TicketWithRelations } from './useTickets'

interface UseTicketResult {
  ticket: TicketWithRelations | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useTicket(id: string): UseTicketResult {
  const [ticket, setTicket] = useState<TicketWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTicket = useCallback(async () => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('tickets')
      .select(`
        id, project_id, tech_id, scheduled_date, scheduled_time,
        description, unidade, bloco, categoria, status,
        report, photo_url, signature_url,
        project:projects ( name )
      `)
      .eq('id', id)
      .single()
    if (err) setError(err.message)
    else setTicket(data as unknown as TicketWithRelations)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchTicket() }, [fetchTicket])
  return { ticket, loading, error, refetch: fetchTicket }
}
