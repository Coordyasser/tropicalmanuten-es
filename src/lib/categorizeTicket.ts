export const CATEGORIAS = [
  'Hidráulica',
  'Gás',
  'Elétrica e Automação',
  'Telhado e Cobertura',
  'Infiltração e Impermeabilização',
  'Alvenaria e Acabamentos',
  'Esquadrias e Acessórios',
  'Climatização',
  'Serviços Gerais',
] as const

export type Categoria = (typeof CATEGORIAS)[number]

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string

function applyKeywordRules(desc: string): Categoria | null {
  const d = desc.toLowerCase()

  if (/gás|gas|cheiro/.test(d)) return 'Gás'

  const hasInfiltracao = /infiltra|mofo|goteira/.test(d)
  const hasTetoPuro = /teto|forro/.test(d) && !/pintura|lâmpada|lampada/.test(d)
  if (hasInfiltracao || hasTetoPuro) return 'Infiltração e Impermeabilização'

  if (/telha|calha|rufo/.test(d)) return 'Telhado e Cobertura'

  return null
}

async function callGemini(description: string): Promise<Categoria> {
  const prompt = `Atue como Engenheiro de Manutenção Predial Sênior. Classifique a observação abaixo em EXATAMENTE UMA das categorias da lista.

LISTA DE CATEGORIAS: [Hidráulica, Gás, Elétrica e Automação, Telhado e Cobertura, Infiltração e Impermeabilização, Alvenaria e Acabamentos, Esquadrias e Acessórios, Climatização, Serviços Gerais]

OBSERVAÇÃO DO CHAMADO: "${description}"

DIRETRIZES DE DECISÃO:
1. Elétrica e Automação: Tudo que envolve energia, tomadas, disjuntores, quadros, interfones, portões eletrônicos, câmeras, motores, bombas e iluminação.
2. Hidráulica: Vazamentos (exceto chuva), entupimentos, pias, sifões, torneiras, descargas, registros.
3. Alvenaria e Acabamentos: Pintura, reboco, gesso, cerâmica solta, rejunte, fissuras (sem água).
4. Esquadrias e Acessórios: Portas, janelas, vidros, fechaduras, molas, dobradiças.

CRITÉRIO DE DESEMPATE: Se houver dúvida entre Causa e Efeito, escolha a CAUSA TÉCNICA (Ex: "Pintura estourou por vazamento do cano" -> Hidráulica).

Retorne APENAS o nome exato da categoria, sem aspas, sem pontos e sem explicações.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
  const match = CATEGORIAS.find(c => c.toLowerCase() === raw.toLowerCase())
  return match ?? 'Serviços Gerais'
}

export async function categorizeTicket(description: string): Promise<Categoria> {
  const fromRules = applyKeywordRules(description)
  if (fromRules) return fromRules
  try {
    return await callGemini(description)
  } catch {
    return 'Serviços Gerais'
  }
}
