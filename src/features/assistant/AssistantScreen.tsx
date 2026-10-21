import { useRef } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Place } from '../../contracts';
import { BrandMark, Icon, palette } from '../../ui/components';
import type { AssistantActions, AssistantPayload, PlaceDisplaySnapshot } from './contracts';
import { MessageContent } from './cards';
import { useAssistantConversation } from './useAssistantConversation';
import { assistantStyles as s } from './styles';
import { ModelScreen } from './ModelScreen';
export type AssistantScreenProps = AssistantActions & {
  places: Place[];
  onBackMap: () => void;
  onFocusMapPlace?: (place: Place) => boolean;
  modelsOpen?: boolean;
  onModelsChange?: (open: boolean) => void;
};
const controlButton = [s.mapButton, { maxWidth: '100%' as const, alignSelf: 'stretch' as const }];
/** Keep mounted when switching screens so draft and conversation remain on this device. */

export function AssistantScreen({
  places,
  onOpenPlace,
  onBackMap,
  onFocusMapPlace,
  modelsOpen = false,
  onModelsChange,
}: AssistantScreenProps) {
  const timeline = useRef<ScrollView>(null);
  const {
    messages,
    draft,
    setDraft,
    busy,
    pendingScroll,
    send: sendQuery,
    cancel,
    status,
    dismissItineraryPreview,
    clear,
    setupStatus,
    modelReady,
    modelOperation,
    openPlace,
  } = useAssistantConversation(
    places,
    onFocusMapPlace ??
      ((place) => {
        onOpenPlace(place);
        return true;
      }),
    onOpenPlace,
  );
  const actions = {
    onOpenPlace: (place: Place) => {
      void openPlace(place);
    },
  };
  const renderMessage = (
    payload: AssistantPayload,
    sourcePlaces = places,
    key?: string,
    displayPlaces: PlaceDisplaySnapshot[] = [],
  ) => {
    const content = (
      <MessageContent
        payload={payload}
        places={sourcePlaces}
        displayPlaces={displayPlaces}
        actions={actions}
      />
    );
    if (payload.kind === 'user') return <View key={key}>{content}</View>;
    return (
      <View key={key} style={s.assistantMessage}>
        <BrandMark size={28} />
        <View style={s.assistantBubble}>{content}</View>
      </View>
    );
  };
  const send = () => {
    sendQuery(draft);
  };
  const latestQuestion = [...messages].reverse().find((entry) => entry.payload.kind === 'user');
  const checkingMenus =
    latestQuestion?.payload.kind === 'user' &&
    /\b(menu|menus|dish|dishes|food|ramen|coffee|kape|pagkain|pesos?|php)\b/i.test(
      latestQuestion.payload.text,
    );
  const progressText = status.startsWith('Checking local sources')
    ? checkingMenus
      ? 'Looking through the menus…'
      : 'Looking for a few matches…'
    : 'One moment…';
  if (modelsOpen)
    return (
      <ModelScreen
        busy={busy}
        status={setupStatus}
        modelReady={modelReady}
        operationStatus={status}
        onBack={() => onModelsChange?.(false)}
        onOperation={modelOperation}
        onStop={cancel}
        onClear={clear}
      />
    );
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
          </Pressable>
          <Text accessibilityRole="header" style={[s.title, s.headerText]}>
            The Fort
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open models"
            onPress={() => {
              Keyboard.dismiss();
              onModelsChange?.(true);
            }}
            style={s.backButton}
          >
            <Icon name="settings" size={18} />
          </Pressable>
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
          {!messages.length
            ? renderMessage({ kind: 'text', text: 'Hey! What would you like to find in BGC?' })
            : null}
          {!messages.length && !places.length
            ? renderMessage({
                kind: 'capability',
                state: 'retrieval-unavailable',
                text: 'No local directory is installed yet. You can still explore the map.',
              })
            : null}
          {messages.map((message) =>
            renderMessage(
              message.payload,
              message.sourcePlaces?.length ? message.sourcePlaces : places,
              message.id,
              message.displayPlaces,
            ),
          )}
          {messages.some((entry) => entry.payload.kind === 'itinerary-preview') ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss temporary itinerary preview"
              style={controlButton}
              onPress={dismissItineraryPreview}
            >
              <Text style={s.mapButtonText}>Dismiss preview</Text>
            </Pressable>
          ) : null}
          {busy ? (
            <View style={[s.inlineNotice, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <ActivityIndicator color={palette.blue} />
              <Text accessibilityLiveRegion="polite" style={s.body}>
                {progressText}
              </Text>
            </View>
          ) : null}
        </ScrollView>
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
              editable={!busy}
              placeholder="Ask about a place or dish…"
              placeholderTextColor={palette.muted}
              style={s.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={busy ? 'Cancel local search' : 'Send message'}
              accessibilityState={{ disabled: !busy && !draft.trim() }}
              disabled={!busy && !draft.trim()}
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
        </View>
      </View>
    </View>
  );
}
