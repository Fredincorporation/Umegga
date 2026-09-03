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
  const greeting = affinity >= 50 || (traits?.openness || 0) > 0.75 ? 'I know you well enough to answer plainly.' : 'I am listening.';
  const goalLine = goal ? ` That matters because I am trying to ${goal.description.toLowerCase()}.` : '';
  const memoryLine = memory ? ` I keep thinking about ${memory.toLowerCase()}.` : '';
  const normalized = message.toLowerCase();

  if (normalized.includes('help') || normalized.includes('stuck') || normalized.includes('what should')) {
    return `${greeting} Tell me what is keeping you stuck, and I will help you find a practical next step.${goalLine}`;
  }
  if (normalized.includes('story') || normalized.includes('chronicle')) {
    return `${greeting} A good story should leave a mark on someone, not merely decorate the chronicle. I would begin with the choice that caused the trouble.${memoryLine}`;
  }
  if (normalized.includes('law') || normalized.includes('rule')) {
    return `${greeting} A rule is only worth keeping if ordinary people can live with its consequences. I would test who bears the cost before I praise its intent.${memoryLine}`;
  }
  return `${greeting} ${traits && traits.order > traits.idealism ? 'I would start with what can be tested and repaired.' : 'I would look for the meaning underneath the obvious answer.'} You have given me something specific to think about: "${message.trim()}".${goalLine}`;
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
    const result = await response.json().catch(() => ({})) as { reply?: string; error?: string };
    if (response.ok && result.reply?.trim()) return result.reply.trim();
    console.error(`[Agent AI] Request failed (${response.status}):`, result.error || 'No reply returned.');
  } catch (error) {
    console.error('[Agent AI] Endpoint unavailable:', error);
  }
  return fallbackReply(agent, message);
}