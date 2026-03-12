export type Role = 'admin' | 'tecnico'
export type TicketStatus = 'aberto' | 'pendente' | 'concluido'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; name: string; role: Role; phone: string | null }
        Insert: { id: string; name: string; role: Role; phone?: string | null }
        Update: { id?: string; name?: string; role?: Role; phone?: string | null }
        Relationships: []
      }
      projects: {
        Row: { id: string; name: string }
        Insert: { id?: string; name: string }
        Update: { id?: string; name?: string }
        Relationships: []
      }
      units: {
        Row: { id: string; project_id: string; identifier: string }
        Insert: { id?: string; project_id: string; identifier: string }
        Update: { id?: string; project_id?: string; identifier?: string }
        Relationships: []
      }
      tickets: {
        Row: {
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
          completed_at: string | null
          duration: string | null
        }
        Insert: {
          id?: string
          project_id: string
          tech_id: string
          scheduled_date: string
          scheduled_time?: string | null
          description: string
          unidade?: string | null
          bloco?: string | null
          categoria?: string | null
          status?: TicketStatus
          report?: string | null
          photo_url?: string | null
          signature_url?: string | null
          completed_at?: string | null
          duration?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          tech_id?: string
          scheduled_date?: string
          scheduled_time?: string | null
          description?: string
          unidade?: string | null
          bloco?: string | null
          categoria?: string | null
          status?: TicketStatus
          report?: string | null
          photo_url?: string | null
          signature_url?: string | null
          completed_at?: string | null
          duration?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { role: Role; ticket_status: TicketStatus }
    CompositeTypes: { [_ in never]: never }
  }
}
