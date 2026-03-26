const PROMPT =
  'Transcreva este áudio com máxima precisão. Corrija eventuais erros gramaticais ou palavras mal reconhecidas para o texto fazer sentido técnico. Devolva apenas o texto final transcrito.'

export async function transcribeAudio(blob: Blob, mimeType: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) return null

  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: PROMPT },
            ],
          }],
        }),
      },
    )

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('[Gemini] Erro na transcrição:', res.status, errBody)
      return null
    }
    const data = await res.json()
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined)?.trim() ?? null
    if (!text) console.warn('[Gemini] Resposta vazia:', JSON.stringify(data))
    return text
  } catch (e) {
    console.error('[Gemini] Exceção na transcrição:', e)
    return null
  }
}
