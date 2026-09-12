import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import OpenAI from 'openai'
import { pathToFileURL } from 'node:url'
import serverlessHttp from 'serverless-http'

const app = express()
app.use(cors({ origin: true, allowedHeaders: ['Content-Type', 'Authorization'] }))
app.use(express.json({ limit: '1mb' }))

const port = Number(process.env.PORT ?? 8787)
const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  throw new Error('Missing OPENAI_API_KEY environment variable')
}

const client = new OpenAI({ apiKey })

const usageTable = process.env.USAGE_TABLE
const rateLimitPerDay = Number(process.env.RATE_LIMIT_PER_DAY ?? 20)

let dynamo
async function getDynamo() {
  if (!dynamo) {
    const { DynamoDBClient, UpdateItemCommand } = await import('@aws-sdk/client-dynamodb')
    dynamo = { client: new DynamoDBClient({}), UpdateItemCommand }
  }
  return dynamo
}

async function checkRateLimit(userId) {
  if (!usageTable) return true

  const { client, UpdateItemCommand } = await getDynamo()
  const today = new Date().toISOString().slice(0, 10)
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 48

  try {
    await client.send(
      new UpdateItemCommand({
        TableName: usageTable,
        Key: {
          userId: { S: userId },
          date: { S: today },
        },
        UpdateExpression: 'ADD #count :one SET expiresAt = :exp',
        ConditionExpression: 'attribute_not_exists(#count) OR #count < :limit',
        ExpressionAttributeNames: { '#count': 'count' },
        ExpressionAttributeValues: {
          ':one': { N: '1' },
          ':exp': { N: String(expiresAt) },
          ':limit': { N: String(rateLimitPerDay) },
        },
      }),
    )
    return true
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return false
    throw err
  }
}

app.post('/api/rewrite', async (req, res) => {
  try {
    const { shortMessage, recipientName, type, fluffiness, effusiveness, addEmojis, tones } =
      req.body ?? {}

    if (typeof shortMessage !== 'string') {
      return res.status(400).json({ error: 'shortMessage must be a string' })
    }

    const userId = req.requestContext?.authorizer?.claims?.sub
    if (usageTable) {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      const allowed = await checkRateLimit(userId)
      if (!allowed) {
        return res.status(429).json({ error: `Daily limit of ${rateLimitPerDay} requests reached` })
      }
    }

    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

    const toneList =
      tones && typeof tones === 'object'
        ? Object.entries(tones)
            .map(([k, v]) => `${k}: ${v}/5`)
            .join(', ')
        : ''

    const system =
      'You rewrite short messages into a friendly, polished version. Preserve intent. Be natural and non-cliché. Avoid overused AI phrases, especially "Hope you’re doing well". Do not invent facts. Keep it appropriate for the chosen message type.' +
      (toneList ? ` Target tone levels (1-5): ${toneList}.` : '')

    const user = JSON.stringify(
      {
        shortMessage,
        recipientName,
        type,
        fluffiness: fluffiness ?? effusiveness,
        tones,
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

export const handler = serverlessHttp(app)

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, () => {
    process.stdout.write(`API listening on http://localhost:${port}\n`)
  })
}
