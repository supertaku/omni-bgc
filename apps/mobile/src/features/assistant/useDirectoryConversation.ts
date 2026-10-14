import { useEffect, useRef, useState } from 'react';
import type { Place, SavedState } from '../../contracts';
import type { ConversationMessage } from './contracts';
import { answerDirectoryQuery } from './directory';

/** Mounted directory state. Timer cancellation is not native inference cancellation. */
export function useDirectoryConversation(places: Place[], saved: SavedState) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const pendingScroll = useRef(false),
    sequence = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef({ places, saved });
  current.current = { places, saved };
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );
  const append = (payloads: ConversationMessage['payload'][]) =>
    setMessages((previous) => [
      ...previous,
      ...payloads.map((payload) => ({ id: `message-${++sequence.current}`, payload })),
    ]);
  const send = (query = draft) => {
    const trimmed = query.trim();
    if (!trimmed || busy) return false;
    if (query === draft) setDraft('');
    setCancelled(false);
    setBusy(true);
    pendingScroll.current = true;
    append([{ kind: 'user', text: trimmed }]);
    // Yield one frame for native input feedback. This checks the directory, never a model.
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      try {
        append(answerDirectoryQuery(trimmed, current.current.places, current.current.saved));
      } catch {
        append([
          {
            kind: 'status',
            severity: 'error',
            text: 'The local search could not be completed. Try a shorter place or dish name.',
          },
        ]);
      }
      pendingScroll.current = true;
      setBusy(false);
    }, 160);
    return true;
  };
  const cancel = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = null;
    setBusy(false);
    setCancelled(true);
    pendingScroll.current = true;
    append([
      {
        kind: 'capability',
        state: 'cancelled',
        text: 'Search cancelled. You can try another place or dish name.',
      },
    ]);
  };

  return { messages, draft, setDraft, busy, cancelled, pendingScroll, send, cancel };
}
