/**
 * Per-browser chat session id.
 *
 * Chat messages are tagged with this id so each visitor only sees their own
 * NPC conversations. Shared world state (laws, chronicles, agents, events)
 * remains global. The id is generated once and kept in localStorage, so a
 * returning visitor resumes the same private chat history.
 */
const STORAGE_KEY = 'umegga_chat_session_id';

export function getChatSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id =
      'sess_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 6);
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
