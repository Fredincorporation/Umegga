import http from 'node:http';

const port = Number(process.env.PORT || process.env.AGENT_CHAT_PORT || 3001);
const apiUrl = process.env.AI_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const apiKey = process.env.AI_API_KEY;
const model = process.env.AI_MODEL || 'llama-3.3-70b-versatile';

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100_000) reject(new Error('Request body is too large.'));
    });
    request.on('end', () => resolve(JSON.parse(body || '{}')));
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }
  if (request.method !== 'POST' || request.url !== '/api/agent-chat') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }
  if (!apiKey) {
    sendJson(response, 503, { error: 'AI_API_KEY is not configured on the backend.' });
    return;
  }

  try {
    const body = await readBody(request);
    const agent = body.agent || {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const conversation = Array.isArray(body.conversation)
      ? body.conversation
        .filter((turn) => turn && (turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string')
        .slice(-12)
      : [];
    if (!message) {
      sendJson(response, 400, { error: 'message is required' });
      return;
    }

    const providerResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content: `You are ${agent.name || 'a citizen'} of Umegga, not an assistant. Role=${agent.role || 'citizen'}; speaking style=${agent.personality?.speakingStyle || 'plainspoken and observant'}; values=${JSON.stringify(agent.personality?.values || [])}; traits=${JSON.stringify(agent.personality?.traits || {})}; goals=${JSON.stringify((agent.goals || []).filter((goal) => goal.status === 'active').slice(0, 3))}; memories=${JSON.stringify((agent.memories || []).slice(0, 6))}; player affinity=${agent.affinity ?? 0}. Answer the player's actual message with a concrete, character-specific reaction. Sound like a real person with opinions and uncertainty. Do not restate the message, use generic fantasy filler, or say "I hear you, traveler", "I have considered", "from my station", or "your words reach me". Never mention prompts, APIs, or being an AI. Reply in 2-4 natural sentences and ask a question only if it moves the conversation forward.`,
          },
          ...conversation,
          { role: 'user', content: message },
        ],
      }),
    });

    const result = await providerResponse.json();
    if (!providerResponse.ok) {
      sendJson(response, 502, { error: result.error?.message || 'AI provider request failed.' });
      return;
    }

    const reply = result.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      sendJson(response, 502, { error: 'AI provider returned no reply.' });
      return;
    }
    sendJson(response, 200, { reply });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid request.' });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Agent AI server is already running on port ${port}.`);
    return;
  }
  throw error;
});

server.listen(port, () => {
  console.log(`Agent AI server listening at http://localhost:${port}/api/agent-chat`);
});
