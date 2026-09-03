import { AgentState, AgentGoal } from '../types/game';

function activeGoal(agent: AgentState): AgentGoal | undefined {
  return (agent.goals || [])
    .filter((goal) => goal.status === 'active')
    .sort((left, right) => right.priority - left.priority)[0];
}

function fallbackReply(agent: AgentState, message: string): string {
  const goal = activeGoal(agent);
  const memory = agent.memory[0]?.event;
  const affinity = agent.affinityWithPlayer;
  const traits = agent.personality?.traits;
  const greeting = affinity >= 50 || (traits?.openness || 0) > 0.75 ? 'Your words reach me as a trusted current.' : 'I hear you, traveler.';
  const goalLine = goal ? ` My immediate purpose is to ${goal.description.toLowerCase()}.` : '';
  const memoryLine = memory ? ` I still carry this remembrance: ${memory}` : '';
  const styleLine = agent.personality?.speakingStyle || '';
  const normalized = message.toLowerCase();

  if (normalized.includes('help') || normalized.includes('stuck') || normalized.includes('what should')) {
    return `${greeting}${goalLine} I would value your judgment before I act. What path would you have me take?`;
  }
  if (normalized.includes('story') || normalized.includes('chronicle')) {
    return `${greeting} ${styleLine} As ${agent.role}, I would shape that tale toward consequence, not spectacle.${goalLine}`;
  }
  if (normalized.includes('law') || normalized.includes('rule')) {
    return `${greeting} A law must protect the living fabric as well as constrain it. I will weigh its cost carefully.${memoryLine}`;
  }
  return `${greeting} I have considered "${message.trim()}". From my station as ${agent.role}, I believe ${traits && traits.order > traits.idealism ? 'discipline and useful action' : 'meaning and imagination'} will serve Umegga best.${goalLine}`;
}

export async function generateAgentReply(
  agent: AgentState,
  message: string,
  conversation: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<string> {
  const endpoint = import.meta.env.VITE_AGENT_CHAT_ENDPOINT || '/api/agent-chat';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: {
          name: agent.name,
          role: agent.role,
          characterId: agent.characterId,
          gender: ['aelira', 'sylis', 'lira'].includes(agent.characterId) ? 'woman' : undefined,
          personality: agent.personality,
          goals: agent.goals || [],
          memories: agent.memory.slice(0, 8),
          affinity: agent.affinityWithPlayer,
        },
        message,
        conversation: conversation.slice(-12),
      }),
    });
    if (response.ok) {
      const result = await response.json() as { reply?: string };
      if (result.reply?.trim()) return result.reply.trim();
    }
  } catch {
    // Fall back only when the AI service cannot be reached.
  }
  return fallbackReply(agent, message);
}