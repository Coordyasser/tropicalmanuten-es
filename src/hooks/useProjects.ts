import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Project {
  id: string
  name: string
}

interface UseProjectsResult {
  projects: Project[]
  loading: boolean
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.from('projects').select('id, name').order('name')
    setProjects(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  return { projects, loading }
}
