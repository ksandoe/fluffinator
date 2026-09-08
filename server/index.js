import 'dotenv/config'
import express from 'express'
import OpenAI from 'openai'

const app = express()
app.use(express.json({ limit: '1mb' }))

const port = Number(process.env.PORT ?? 8787)
const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  throw new Error('Missing OPENAI_API_KEY environment variable')
}

const client = new OpenAI({ apiKey })

app.post('/api/rewrite', async (req, res) => {
  try {
    const { shortMessage, recipientName, type, effusiveness, addEmojis } = req.body ?? {}

    if (typeof shortMessage !== 'string') {
      return res.status(400).json({ error: 'shortMessage must be a string' })
    }

    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

    const system =
      'You rewrite short messages into a friendly, polished version. Preserve intent. Be natural and non-cliché. Avoid overused AI phrases, especially "Hope you’re doing well". Do not invent facts. Keep it appropriate for the chosen message type.'

    const user = JSON.stringify(
      {
        shortMessage,
        recipientName,
        type,
        effusiveness,
        addEmojis,
      },
      null,
      2,
    )

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content:
            'Rewrite using these inputs. Return only the rewritten message text (no extra commentary).\n\n' +
            user,
        },
      ],
    })

    const text = completion.choices[0]?.message?.content?.trim() ?? ''

    if (!text) return res.status(502).json({ error: 'Empty response from model' })

    return res.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
})

app.listen(port, () => {
  process.stdout.write(`API listening on http://localhost:${port}\n`)
})
