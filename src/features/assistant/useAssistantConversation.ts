import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Place } from '../../contracts';
import type { ConversationMessage, AssistantPayload } from './contracts';
import { isDemoPlace } from '../explore/demoDirectory';
import { answerDirectoryQuery } from './directory';
import { createFoodResearchAnswer } from '../food/assistant';
import { foodResearch } from '../food/directory';
import { createAssistantRuntime, type AssistantRuntime } from '../../ai/assistantRuntime';
import type { ModelStatus } from '../../ai/modelManager';

const research = createFoodResearchAnswer(foodResearch);
let messageSerial = 0;
const message = (payload: AssistantPayload): ConversationMessage => ({
  id: `ai-${Date.now().toString(36)}-${++messageSerial}`,
  payload,
});

/** UI epochs own visibility; native provider independently owns resource quiescence. */
export function useAssistantConversation(
  places: Place[],
  focus: (place: Place) => boolean,
  onOpenPlace?: (place: Place) => void,
) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [status, setStatus] = useState('Local directory · AI not connected');
  const [setupStatus, setSetupStatus] = useState<ModelStatus | null>(null);
  const pendingScroll = useRef(false);
  const current = useRef({ places, focus, onOpenPlace });
  current.current = { places, focus, onOpenPlace };
  const live = useRef(true),
    busyRef = useRef(false),
    epoch = useRef(0);
  const request = useRef<AbortController | null>(null);
  const pickerVisible = useRef(false);
  const runtime = useRef<AssistantRuntime | null>(null);
  const ready = useRef(false);
  const initializationSettled = useRef(false);
  const clearRequested = useRef(false);
  const pendingHistory = useRef<ConversationMessage[]>([]);
  const resolved = useRef<string[]>([]);
  const timeline = useRef<ConversationMessage[]>([]);
  timeline.current = messages;
  const append = (payloads: AssistantPayload[], sourcePlaces: Place[] = []) => {
    const added = payloads.map((payload) => {
      const ids =
        payload.kind === 'places'
          ? payload.placeIds
          : payload.kind === 'place'
            ? [payload.placeId]
            : payload.kind === 'menus'
              ? payload.items.map((row) => row.placeId)
              : payload.kind === 'food-menus'
                ? payload.items.map((row) => row.placeId)
                : payload.kind === 'food-hours'
                  ? [payload.placeId]
                  : payload.kind === 'itinerary-preview'
                    ? payload.preview.stops.map((stop) => stop.placeId)
                    : [];
      const snapshots = sourcePlaces.filter((place) => ids.includes(place.id));
      return {
        ...message(payload),
        ...(snapshots.length
          ? {
              displayPlaces: snapshots.map((place) => ({
                id: place.id,
                name: place.name,
                category: place.category,
                ...(place.building ? { building: place.building } : {}),
                ...(place.floor ? { floor: place.floor } : {}),
                status: place.status,
                fictionalSample: isDemoPlace(place),
              })),
            }
          : {}),
        ...(snapshots.length
          ? {
              sourcePlaces: snapshots,
              canonicalPlaceIds: [...new Set(snapshots.map((place) => place.id))],
            }
          : {}),
      };
    });
    if (live.current) {
      setMessages((before) => [...before, ...added].slice(-200));
      pendingScroll.current = true;
    }
    return added;
  };
  const persist = async (records: ConversationMessage[]) => {
    if (!records.length) return;
    const activeRuntime = runtime.current;
    if (!activeRuntime) {
      pendingHistory.current = [...pendingHistory.current, ...records].slice(-200);
      return;
    }
    try {
      await activeRuntime.history.append(records);
    } catch {
      if (live.current)
        append([
          {
            kind: 'status',
            severity: 'error',
            text: 'I couldn’t keep this message in history. You can still chat for this session.',
          },
        ]);
    }
  };
  useEffect(() => {
    live.current = true;
    let active = true;
    const visibilityEpoch = epoch;
    const initialEpoch = epoch.current;
    let unsubscribe: (() => void) | undefined;
    void createAssistantRuntime((place) => current.current.focus(place))
      .then(async (created) => {
        if (!active || !live.current) {
          await created.close();
          return;
        }
        runtime.current = created;
        try {
          if (clearRequested.current) {
            await created.history.clear();
            clearRequested.current = false;
          }
          if (pendingHistory.current.length) {
            const queued = pendingHistory.current;
            pendingHistory.current = [];
            await created.history.append(queued);
          }
          const restored = await created.history.load();
          if (
            live.current &&
            active &&
            epoch.current === initialEpoch &&
            !busyRef.current &&
            !timeline.current.length &&
            restored.length
          )
            setMessages([
              message({
                kind: 'status',
                severity: 'info',
                text: 'Here’s where we left off. Ask again to refresh these details.',
              }),
              ...restored,
            ]);
        } catch {
          if (active && live.current)
            append([
              {
                kind: 'status',
                severity: 'error',
                text: 'I couldn’t open your history. You can still chat for this session.',
              },
            ]);
        }
        try {
          const initialized = await created.initialize();
          if (!active || !live.current) {
            await created.close();
            return;
          }
          ready.current = initialized;
          if (live.current)
            setStatus(
              ready.current
                ? 'Local AI · CPU · device acceptance pending'
                : 'Local directory · model not installed',
            );
          if (!active || !live.current) {
            await created.close();
            return;
          }
        } catch {
          if (active && live.current) {
            ready.current = false;
            setStatus('Local AI unavailable · directory fallback ready');
          }
        } finally {
          if (active) {
            initializationSettled.current = true;
            unsubscribe = created.getManager()?.subscribe((value) => {
              if (active && live.current) setSetupStatus(value);
            });
          }
        }
      })
      .catch(() => {
        if (active && live.current) setStatus('Local AI unavailable · directory fallback ready');
      });
    const background = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && !pickerVisible.current) {
        epoch.current++;
        request.current?.abort();
        runtime.current?.agent.cancel();
        busyRef.current = false;
        if (live.current) {
          setMessages((before) =>
            before.filter((entry) => !(entry.payload.kind === 'text' && entry.payload.partial)),
          );
          setBusy(false);
          setStatus('Paused · local directory ready');
        }
      }
    });
    return () => {
      active = false;
      live.current = false;
      visibilityEpoch.current++;
      request.current?.abort();
      unsubscribe?.();
      background.remove();
      const owned = runtime.current;
      runtime.current = null;
      void owned?.close().catch(() => undefined);
    };
  }, []);

  const cancel = () => {
    epoch.current++;
    request.current?.abort();
    runtime.current?.agent.cancel();
    busyRef.current = false;
    setMessages((before) =>
      before.filter((entry) => !(entry.payload.kind === 'text' && entry.payload.partial)),
    );
    setBusy(false);
    setCancelled(true);
    append([
      {
        kind: 'capability',
        state: 'cancelled',
        text: 'Stopped. Ready when you are.',
      },
    ]);
  };
  const send = (query = draft) => {
    const text = query.trim();
    if (!text || text.length > 1000 || busyRef.current) return false;
    const turnEpoch = ++epoch.current;
    busyRef.current = true;
    setBusy(true);
    setCancelled(false);
    const abort = new AbortController();
    request.current = abort;
    if (query === draft) setDraft('');
    const user = append([{ kind: 'user', text }]);
    const userPersisted = persist(user);
    const partialId = message({ kind: 'text', text: '' }).id;
    void (async () => {
      let output: AssistantPayload[];
      let sourcePlaces: Place[] = [];
      try {
        const service = runtime.current;
        if (service) {
          setStatus('Checking local request · Stop available');
          const turn = await service.answer(text, current.current.places, {
            signal: abort.signal,
            resolvedPlaceIds: resolved.current,
            recentMessages: timeline.current
              .flatMap((entry) =>
                entry.payload.kind === 'user' || entry.payload.kind === 'text'
                  ? [
                      {
                        role:
                          entry.payload.kind === 'user'
                            ? ('user' as const)
                            : ('assistant' as const),
                        text: entry.payload.text,
                      },
                    ]
                  : [],
              )
              .slice(-6),
            onTool: (_name, phase) => {
              if (live.current && epoch.current === turnEpoch && !abort.signal.aborted)
                setStatus(
                  phase === 'running' ? 'Checking local sources…' : 'Composing verified results…',
                );
            },
            onDelta: (delta) => {
              if (!live.current || epoch.current !== turnEpoch || abort.signal.aborted) return;
              setMessages((before) => {
                const existing = before.find((entry) => entry.id === partialId);
                if (!existing)
                  return [
                    ...before,
                    { id: partialId, payload: { kind: 'text', text: delta, partial: true } },
                  ];
                return before.map((entry) =>
                  entry.id === partialId && entry.payload.kind === 'text'
                    ? { ...entry, payload: { ...entry.payload, text: entry.payload.text + delta } }
                    : entry,
                );
              });
              pendingScroll.current = true;
            },
          });
          if (!live.current || epoch.current !== turnEpoch || abort.signal.aborted) return;
          if (turn.status === 'canceled') {
            setMessages((before) => before.filter((entry) => entry.id !== partialId));
            return;
          }
          output = turn.payloads;
          ready.current = service.provider.state === 'READY';
          sourcePlaces = turn.places ?? [];
          const displayed = output.flatMap((payload) =>
            payload.kind === 'places'
              ? payload.placeIds
              : payload.kind === 'place'
                ? [payload.placeId]
                : payload.kind === 'menus'
                  ? payload.items.map((row) => row.placeId)
                  : payload.kind === 'itinerary-preview'
                    ? payload.preview.stops.map((stop) => stop.placeId)
                    : [],
          );
          if (
            output.some((payload) =>
              ['places', 'place', 'menus', 'itinerary-preview'].includes(payload.kind),
            )
          )
            resolved.current = [
              ...new Set(displayed.filter((id) => sourcePlaces.some((place) => place.id === id))),
            ].slice(0, 12);
          if (turn.status === 'failed') {
            setStatus('Local AI unavailable · directory fallback ready');
          }
        } else {
          output = answerDirectoryQuery(text, current.current.places, undefined, research);
          sourcePlaces = current.current.places;
        }
      } catch {
        if (!live.current || epoch.current !== turnEpoch || abort.signal.aborted) return;
        ready.current = false;
        output = [
          {
            kind: 'status',
            severity: 'error',
            text: 'I couldn’t finish that one. Try again, or search for a place on the map.',
          },
        ];
      }
      if (!live.current || epoch.current !== turnEpoch || abort.signal.aborted) return;
      setMessages((before) => before.filter((entry) => entry.id !== partialId));
      const added = append(output, sourcePlaces);
      await userPersisted;
      await persist(added);
      if (live.current && epoch.current === turnEpoch)
        setStatus(
          ready.current ? 'Local AI · CPU · offline' : 'Local directory · AI not connected',
        );
    })().finally(() => {
      if (live.current && epoch.current === turnEpoch) {
        busyRef.current = false;
        setBusy(false);
      }
    });
    return true;
  };
  const dismissItineraryPreview = () => {
    if (busyRef.current) cancel();
    runtime.current?.itineraryPreview.clear();
    resolved.current = [];
    setMessages((before) => before.filter((entry) => entry.payload.kind !== 'itinerary-preview'));
  };
  const clear = async () => {
    cancel();
    runtime.current?.itineraryPreview.clear();
    resolved.current = [];
    pendingHistory.current = [];
    clearRequested.current = true;
    try {
      await runtime.current?.history.clear();
      if (live.current) setMessages([]);
    } catch {
      append([
        {
          kind: 'status',
          severity: 'error',
          text: 'AI history could not be cleared. Existing records were retained.',
        },
      ]);
    }
  };
  const modelOperation = async (operation: 'download' | 'import' | 'activate' | 'remove') => {
    const service = runtime.current;
    if (!service || busyRef.current) return;
    if (!initializationSettled.current) {
      setStatus('Checking local model setup…');
      return;
    }
    const operationEpoch = ++epoch.current;
    busyRef.current = true;
    setBusy(true);
    const abort = new AbortController();
    request.current = abort;
    try {
      ready.current = false;
      if (operation === 'download') await service.setup(abort.signal);
      else if (operation === 'import')
        await service.importModel(abort.signal, (visible) => {
          pickerVisible.current = visible;
        });
      else if (operation === 'activate') {
        await service.activate(abort.signal);
      } else await service.removeModel();
      if (live.current && epoch.current === operationEpoch) {
        ready.current = service.provider.state === 'READY';
        setSetupStatus(service.getManager()?.getStatus() ?? null);
        setStatus(
          ready.current ? 'Local AI · CPU · offline' : 'Local directory · model staged or absent',
        );
      }
    } catch (error) {
      if (live.current && epoch.current === operationEpoch) {
        // An import can fail after release while the checked active file remains.
        // Recover its availability, but never claim the released engine is ready.
        if (service.provider.state !== 'READY')
          await service
            .getManager()
            ?.recover()
            .catch(() => undefined);
        if (!live.current || epoch.current !== operationEpoch) return;
        ready.current = service.provider.state === 'READY';
        const recoveredStatus = service.getManager()?.getStatus();
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : error instanceof Error
              ? error.message
              : 'MODEL_SETUP_FAILED';
        setSetupStatus(recoveredStatus ? { ...recoveredStatus, error: code } : null);
        setStatus('Model setup unavailable · directory fallback ready');
      }
    } finally {
      if (live.current && epoch.current === operationEpoch) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };
  const openPlace = async (place: Place) => {
    if (place.status !== 'approved') {
      current.current.onOpenPlace?.(place);
      return;
    }
    const openingEpoch = epoch.current;
    const latest = await runtime.current?.resolvePlace(place.id).catch(() => null);
    if (!live.current || epoch.current !== openingEpoch) return;
    if (latest) current.current.onOpenPlace?.(latest);
    else
      append([
        {
          kind: 'status',
          severity: 'info',
          text: 'This place is no longer available from current approved sources. Ask again to refresh the results.',
        },
      ]);
  };
  return {
    messages,
    draft,
    setDraft,
    busy,
    cancelled,
    pendingScroll,
    send,
    cancel,
    status,
    dismissItineraryPreview,
    clear,
    setupStatus,
    modelReady: ready.current,
    modelOperation,
    openPlace,
  };
}
