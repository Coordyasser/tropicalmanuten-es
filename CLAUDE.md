# Vibe Coding: App de Manutenção 
## Stack
- Frontend: Vite, React, TypeScript.
- Estilização: Tailwind CSS, shadcn/ui.
- Backend/DB: Supabase.
- UX: Admin (Desktop) e Técnico (Mobile-first).
## Regras de Código (DX & Clean Code)
- Tipagem estrita no TypeScript. Zero any.
- Rotas: /admin/* e /tecnico/*.
- Crie hooks customizados para o Supabase.
## Banco de Dados (Supabase Schema)
1. profiles: id, name, role ('admin', 'tecnico'), phone.
2. projects: id, name.
3. units: id, project_id, identifier.
4. tickets: id, unit_id, tech_id, scheduled_date, description, status ('aberto', 'concluido'), report, photo_url (nullable), signature_url (nullable).
## Fluxo
- Admin: Dashboard, tabela com filtros, histórico por unidade.
- Técnico: Interface focada em mobile, 2 abas (Pendentes/Concluídas), formulário de baixa rápido.
