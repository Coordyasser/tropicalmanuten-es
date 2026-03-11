import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Tecnico {
  id: string
  name: string
  phone: string | null
}

interface UseTecnicosResult {
  tecnicos: Tecnico[]
  loading: boolean
}

export function useTecnicos(): UseTecnicosResult {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTecnicos = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, phone')
      .eq('role', 'tecnico')
      .order('name')
    setTecnicos(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTecnicos() }, [fetchTecnicos])
  return { tecnicos, loading }
}
