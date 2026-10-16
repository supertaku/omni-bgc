import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Place, SavedState } from '../../contracts';
import { Icon, palette } from '../../ui/components';
import type { AssistantActions } from './contracts';
import { MessageContent } from './cards';
import { placeMatchesCategory } from './directory';
import { useAssistantConversation } from './useAssistantConversation';
import { assistantStyles as s } from './styles';
export type AssistantScreenProps = AssistantActions & {
  places: Place[];
  saved: SavedState;
  onBackMap: () => void;
  onFocusMapPlace?: (place: Place) => boolean;
  onSavedChange?: (saved: SavedState) => void;
  onCriticalChange?: (critical: boolean) => void;
};
const suggestions = [
  { label: 'Find coffee', query: 'Find coffee', icon: 'coffee' as const },
  { label: 'Find food', query: 'Find food', icon: 'food' as const },
  { label: 'Saved places', query: 'Show my saved places', icon: 'bookmark' as const },
];
const controlButton = [s.mapButton, { maxWidth: '100%' as const, alignSelf: 'stretch' as const }];
/** Keep mounted when switching screens so draft and conversation remain on this device. */

export function AssistantScreen({
  places,
  saved,
  onOpenPlace,
  onBackMap,
  onFocusMapPlace,
  onSavedChange,
  onCriticalChange,
}: AssistantScreenProps) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [modelOptionsOpen, setModelOptionsOpen] = useState(false);
  const timeline = useRef<ScrollView>(null);
  const {
    messages,
    draft,
    setDraft,
    busy,
    cancelled,
    pendingScroll,
    send: sendQuery,
    cancel,
    status,
    pending,
    confirming,
    confirm,
    cancelPending,
    clear,
    setupStatus,
    modelOperation,
    openPlace,
  } = useAssistantConversation(
    places,
    saved,
    onFocusMapPlace ??
      ((place) => {
        onOpenPlace(place);
        return true;
      }),
    onSavedChange,
    onOpenPlace,
  );
  useEffect(() => {
    onCriticalChange?.(!!pending || confirming);
    return () => onCriticalChange?.(false);
  }, [pending, confirming, onCriticalChange]);
  const actions = {
    onOpenPlace: (place: Place) => {
      void openPlace(place);
    },
  };
  const send = (query = draft) => {
    if (sendQuery(query)) setSuggestionsOpen(false);
  };
  const discovery = places
    .filter((place) => placeMatchesCategory(place, 'food') || placeMatchesCategory(place, 'coffee'))
    .slice(0, 2);
  const featured = discovery.length ? discovery : places.slice(0, 2);
  const lastCollection = [...messages]
    .reverse()
    .find((message) => message.payload.kind === 'places');
  const lastPlaceId =
    lastCollection?.payload.kind === 'places' ? lastCollection.payload.placeIds[0] : undefined;
  const lastPlace = places.find((place) => place.id === lastPlaceId);
  return (
    <View style={s.screen}>
      <View style={{ flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Map"
            onPress={onBackMap}
            style={s.backButton}
          >
            <Icon name="back" size={20} />
            <Text style={s.backText}>Back to Map</Text>
          </Pressable>
          <View style={s.headerText}>
            <Text accessibilityRole="header" style={s.title}>
              Assistant
            </Text>
            <Text accessibilityLiveRegion="polite" style={s.headerCaption}>
              {status}
            </Text>
          </View>
        </View>
        <ScrollView
          ref={timeline}
          style={{ flex: 1 }}
          contentContainerStyle={s.timeline}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => {
            if (pendingScroll.current) {
              timeline.current?.scrollToEnd({ animated: false });
              pendingScroll.current = false;
            }
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Local AI and history controls"
            accessibilityState={{ expanded: modelOptionsOpen }}
            style={s.suggestionToggle}
            onPress={() => setModelOptionsOpen((value) => !value)}
          >
            <Icon name="info" size={17} />
            <Text style={s.suggestionText}>Local AI &amp; history</Text>
          </Pressable>
          {modelOptionsOpen ? (
            <View style={s.inlineNotice}>
              <Text style={s.body}>
                Gemma 4 E2B · optional 2.59 GB setup · Apache 2.0. Download requires internet; chat
                and search stay local. POCO acceptance is pending device tests.
              </Text>
              {setupStatus ? (
                <Text accessibilityLiveRegion="polite" style={s.caption}>
                  {setupStatus.state}
                  {setupStatus.totalBytes
                    ? ` · ${Math.floor((setupStatus.bytesReceived / setupStatus.totalBytes) * 100)}%`
                    : ''}
                  {setupStatus.error ? ` · ${setupStatus.error}` : ''}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Download reviewed local model"
                disabled={busy || confirming}
                accessibilityState={{ disabled: busy || confirming }}
                style={controlButton}
                onPress={() =>
                  Alert.alert(
                    'Download local model?',
                    'Download the pinned 2.59 GB Apache 2.0 Gemma artifact to private app storage. Keep license and attribution with any redistribution. This does not enable AI until the local runtime trial passes.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Download',
                        onPress: () => {
                          void modelOperation('download');
                        },
                      },
                    ],
                  )
                }
              >
                <Text style={s.mapButtonText}>Download / retry model setup</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Import reviewed local model file"
                disabled={busy || confirming}
                accessibilityState={{ disabled: busy || confirming }}
                style={controlButton}
                onPress={() => {
                  void modelOperation('import');
                }}
              >
                <Text style={s.mapButtonText}>Import model file · size and hash checked</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Test and enable installed model"
                disabled={busy || confirming || setupStatus?.state !== 'PENDING_NATIVE_SMOKE_TEST'}
                accessibilityState={{
                  disabled:
                    busy || confirming || setupStatus?.state !== 'PENDING_NATIVE_SMOKE_TEST',
                }}
                style={controlButton}
                onPress={() => {
                  void modelOperation('activate');
                }}
              >
                <Text style={s.mapButtonText}>Test &amp; enable installed model</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove local model"
                disabled={busy || confirming}
                style={controlButton}
                onPress={() =>
                  Alert.alert(
                    'Remove local model?',
                    'Directory search and your saved places remain available.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => {
                          void modelOperation('remove');
                        },
                      },
                    ],
                  )
                }
              >
                <Text style={s.mapButtonText}>Remove model</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete all AI history"
                disabled={confirming}
                style={controlButton}
                onPress={() =>
                  Alert.alert(
                    'Delete all AI history?',
                    'Clear local conversation messages. Saved places and map data are separate.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete history',
                        style: 'destructive',
                        onPress: () => {
                          void clear();
                        },
                      },
                    ],
                  )
                }
              >
                <Text style={s.mapButtonText}>Delete all AI history</Text>
              </Pressable>
            </View>
          ) : null}
          {!messages.length ? (
            <MessageContent
              payload={{ kind: 'text', text: 'Find a place, building or recorded dish.' }}
              places={places}
              actions={actions}
            />
          ) : null}
          {!messages.length && featured.length ? (
            <MessageContent
              payload={{
                kind: 'places',
                title: 'Explore BGC',
                placeIds: featured.map((place) => place.id),
                total: featured.length,
              }}
              places={places}
              actions={actions}
            />
          ) : null}
          {!messages.length && !places.length ? (
            <MessageContent
              payload={{
                kind: 'capability',
                state: 'retrieval-unavailable',
                text: 'No local directory is installed yet. You can still explore the map.',
              }}
              places={places}
              actions={actions}
            />
          ) : null}
          {messages.map((message) => (
            <MessageContent
              key={message.id}
              payload={message.payload}
              places={message.sourcePlaces?.length ? message.sourcePlaces : places}
              actions={actions}
            />
          ))}
          {pending ? (
            <View style={s.inlineNotice} accessibilityLiveRegion="polite">
              <Text accessibilityRole="header" style={s.heading}>
                Confirm this change
              </Text>
              <Text style={s.body}>{pending.summary}</Text>
              <Text style={s.caption}>
                Nothing is saved until you tap Confirm. This preview expires in two minutes.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm saved change"
                disabled={confirming}
                accessibilityState={{ disabled: confirming }}
                style={controlButton}
                onPress={() => {
                  void confirm();
                }}
              >
                <Text style={s.mapButtonText}>{confirming ? 'Saving…' : 'Confirm'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel saved change"
                disabled={confirming}
                accessibilityState={{ disabled: confirming }}
                style={controlButton}
                onPress={cancelPending}
              >
                <Text style={s.mapButtonText}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}
          {busy ? (
            <View style={[s.inlineNotice, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <ActivityIndicator color={palette.blue} />
              <Text accessibilityLiveRegion="polite" style={s.body}>
                Working on this device…
              </Text>
            </View>
          ) : null}
        </ScrollView>
        <View style={s.suggestionBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              suggestionsOpen ? 'Hide search suggestions' : 'Show search suggestions'
            }
            accessibilityState={{ expanded: suggestionsOpen }}
            onPress={() => setSuggestionsOpen((value) => !value)}
            style={s.suggestionToggle}
          >
            <Icon name={suggestionsOpen ? 'down' : 'up'} size={17} />
            <Text style={s.suggestionText}>Suggestions</Text>
          </Pressable>
          {suggestionsOpen ? (
            <View style={s.suggestions}>
              {lastPlace?.menus.length ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Show recorded menu for ${lastPlace.name}`}
                  disabled={busy}
                  accessibilityState={{ disabled: busy }}
                  onPress={() => send(`Show menu for ${lastPlace.name}`)}
                  style={s.suggestionChip}
                >
                  <Icon name="menu" size={16} />
                  <Text style={s.suggestionText}>Show menu</Text>
                </Pressable>
              ) : null}
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.query}
                  accessibilityRole="button"
                  disabled={busy}
                  accessibilityState={{ disabled: busy }}
                  onPress={() => send(suggestion.query)}
                  style={[s.suggestionChip, busy && { opacity: 0.5 }]}
                >
                  <Icon name={suggestion.icon} size={16} />
                  <Text style={s.suggestionText}>{suggestion.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <View style={s.composerArea}>
          <View style={s.composer}>
            <TextInput
              accessibilityLabel="Message the local BGC directory"
              accessibilityHint="Search by place, building, category or dish name"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              value={draft}
              onChangeText={setDraft}
              editable={!busy && !confirming}
              placeholder="Ask about a place or dish…"
              placeholderTextColor={palette.muted}
              style={s.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={busy ? 'Cancel local search' : 'Send message'}
              accessibilityState={{ disabled: !busy && (!draft.trim() || confirming) }}
              disabled={!busy && (!draft.trim() || confirming)}
              onPress={() => (busy ? cancel() : send())}
              style={({ pressed }) => [
                s.send,
                !busy && !draft.trim() && s.disabled,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Icon name={busy ? 'close' : 'send'} size={21} color="#FFFFFF" />
            </Pressable>
          </View>
          <Text style={s.composerFootnote}>
            {busy
              ? 'Checking records on this device'
              : cancelled
                ? 'Ready when you are'
                : 'Local search · Your conversation stays on this device'}
          </Text>
        </View>
      </View>
    </View>
  );
}
