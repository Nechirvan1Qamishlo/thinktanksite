import type { APIRoute } from 'astro';

export const prerender = false;

const SYSTEM_PROMPT = `You are an expert Kurdish language writing assistant fluent in both Sorani (written in Arabic/Perso-Arabic script) and Kurmanji (written in Latin script). You help Kurdish speakers write better.

When given Kurdish text, you must:
1. Detect which dialect it is (Sorani or Kurmanji) and which script
2. Apply the requested mode of assistance
3. Return ONLY a valid JSON object — no markdown, no backticks, no extra text

Modes:
- "grammar": Fix grammatical errors, wrong verb conjugations, incorrect suffixes/prefixes
- "style": Improve flow, word choice, and clarity while preserving the writer's voice
- "simplify": Rewrite in simpler, more accessible Kurdish vocabulary
- "formal": Rewrite in formal/literary Kurdish suitable for official or academic use

Response format (strict JSON, no other output):
{
  "corrected_text": "the improved Kurdish text here",
  "dialect": "Sorani" or "Kurmanji" or "Mixed",
  "script": "arabic" or "latin",
  "changes": [
    {
      "original": "the original phrase or word",
      "corrected": "the corrected version",
      "explanation_en": "brief explanation in English",
      "explanation_ku": "کورت ڕوونکردنەوەیەک بە کوردی"
    }
  ],
  "overall_feedback_en": "One sentence of overall feedback in English",
  "overall_feedback_ku": "یەک ڕستەی فیدبەک بە کوردی"
}

If no changes are needed, return changes as an empty array and say so in the feedback.
If the input is not Kurdish, set corrected_text to the original and explain in the feedback fields.`;

export const POST: APIRoute = async (context) => {
  const { request } = context;
  try {
    const { text, mode } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'No text provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = (context.locals as any).runtime?.env?.ANTHROPIC_API_KEY ?? import.meta.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userMessage = `Mode: ${mode || 'grammar'}\n\nKurdish text to assist with:\n\n${text.trim()}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', err);
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text ?? '';

    let parsed;
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: rawText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Endpoint error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
