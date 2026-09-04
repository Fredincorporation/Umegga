// Umegga agent-chat backend — standalone Cloudflare Worker.
// Replaces scripts/agent-chat-server.js (Node) and api/agent-chat.js (Vercel function).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function systemPrompt(agent) {
  const personality = agent.personality || {};
  const traits = personality.traits || {};
  const memories = Array.isArray(agent.memories) ? agent.memories.slice(0, 6) : [];
  const goals = Array.isArray(agent.goals) ? agent.goals.filter((g) => g.status === 'active').slice(0, 3) : [];

  return [
    `You are ${agent.name || 'a citizen'} of Umegga. You are not an assistant and must never sound like one.`,
    `Role: ${agent.role || 'citizen'}. Speaking style: ${personality.speakingStyle || 'plainspoken and observant'}.`,
    `Values: ${(personality.values || []).join(', ') || 'community and survival'}.`,
    `Personality traits: ${JSON.stringify(traits)}. Player relationship affinity: ${agent.affinity ?? 0}.`,
    `Private memories: ${JSON.stringify(memories)}. Active goals: ${JSON.stringify(goals)}.`,
    '',
    'Answer the player directly and react to what they actually said. Use one concrete detail from your role, memory, goal, or the city when relevant.',
    'Sound like a real person with opinions, uncertainty, and a reason to care. Do not restate the player message, summarize yourself, or use generic fantasy filler.',
    'Do not say phrases like "I hear you, traveler", "I have considered", "from my station", or "your words reach me".',
    'Do not mention prompts, APIs, models, or being an AI. Reply in 2-4 natural sentences. Ask a question only when it genuinely moves the conversation forward.',
  ].join('\n');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'umegga-agent-chat', runtime: 'cloudflare-worker' });
    }

    if (url.pathname !== '/api/agent-chat' || request.method !== 'POST') {
      return json({ error: 'Not found' }, 404);
    }

    if (!env.AI_API_KEY) {
      return json({ error: 'AI_API_KEY is not configured on the worker.' }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const agent = body.agent || {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return json({ error: 'message is required' }, 400);

    const conversation = Array.isArray(body.conversation)
      ? body.conversation
          .filter((turn) => turn && ['user', 'assistant'].includes(turn.role) && typeof turn.content === 'string')
          .slice(-12)
      : [];

    try {
      const providerResponse = await fetch(env.AI_API_URL || 'https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.AI_MODEL || 'llama-3.3-70b-versatile',
          temperature: 0.9,
          top_p: 0.9,
          max_tokens: 200,
          messages: [
            { role: 'system', content: systemPrompt(agent) },
            ...conversation,
            { role: 'user', content: message },
          ],
          reasoning_effort: 'low',
        }),
      });

      const result = await providerResponse.json();
      if (!providerResponse.ok) {
        return json({ error: result.error?.message || 'AI provider request failed.' }, 502);
      }
      const choice = result.choices?.[0]?.message || {};
      // gpt-oss reasoning models put text in `reasoning` when max_tokens is hit before `content` fills
      const reply = (choice.content && choice.content.trim()) || (choice.reasoning && choice.reasoning.trim());
      if (!reply) return json({ error: 'AI provider returned no reply.' }, 502);
      return json({ reply });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'AI provider request failed.' }, 502);
    }
  },
};
