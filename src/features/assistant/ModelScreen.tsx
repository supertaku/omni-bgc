import { useState } from 'react';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ModelStatus } from '../../ai/modelManager';
import { AppDialog, type AppDialogAction } from '../../ui/AppDialog';
import { BrandMark, Icon, palette } from '../../ui/components';
import { assistantStyles as s } from './styles';
import { modelStyles as m } from './modelStyles';

type ModelOperation = 'download' | 'activate' | 'remove';
type Confirmation = 'download' | 'activate' | 'remove' | 'clear' | null;
type ModelScreenProps = {
  busy: boolean;
  status: ModelStatus | null;
  modelReady?: boolean;
  operationStatus: string;
  onBack: () => void;
  onOperation: (operation: ModelOperation) => Promise<void>;
  onStop: () => void;
  onClear: () => Promise<void>;
};
const stateCopy: Record<ModelStatus['state'], string> = {
  NOT_INSTALLED: 'Not installed yet',
  DOWNLOADING: 'Downloading…',
  VERIFYING: 'Checking your model…',
  STAGED: 'Finishing setup…',
  PENDING_NATIVE_SMOKE_TEST: 'Downloaded',
  ACTIVE: 'Ready to chat',
  FAILED: 'Setup needs another try',
  PAUSED: 'Setup paused',
};
const knownErrors: Record<string, string> = {
  OOM: 'The phone could not allocate enough memory. Close other apps, then try Use again. The verified download is retained.',
  THERMAL_BLOCK: 'Your phone is too warm for local AI. Let it cool before trying Use again.',
  SESSION_POISONED:
    'The native engine has not safely released its resources. Wait for setup to finish, or reopen the app before retrying.',
  CANCEL_TIMEOUT:
    'Model startup or stopping took too long. Keep the app open while native resources settle, then retry Use. Reopen the app if it remains unavailable.',
  RUNTIME_UNSUPPORTED:
    'This model requires the standalone ARM64 Android app and a supported native runtime.',
  CONTEXT_OVERFLOW:
    'The model could not fit this request. Try a shorter question or clear the conversation.',
  MODEL_EXISTING_ARTIFACT_CORRUPT:
    'The saved model failed verification. Remove it, then download the reviewed file again.',
  MODEL_STORAGE_INSUFFICIENT:
    'There is not enough free storage to install the model. Free at least 2.9 GB, then try again.',
  MODEL_HASH_MISMATCH:
    'The downloaded model did not match the reviewed file and was rejected. Try downloading it again.',
  MODEL_SETUP_CANCELLED: 'Model setup was stopped. You can resume it when you are ready.',
  MODEL_STAGED_MISSING:
    'The staged model is unavailable. Download the reviewed model to try again.',
  MODEL_SETUP_CONSENT_REQUIRED: 'Model setup needs your confirmation before it can continue.',
  MODEL_DOWNLOAD_NETWORK_ERROR: 'The download lost its connection. Your partial file is saved; resume when you have a connection.',
  MODEL_DOWNLOAD_PERMISSION_DENIED: 'Android blocked the download. Check the app’s network permission and try again.',
  MODEL_SMOKE_FAILED:
    'The model did not complete its native startup check. The verified download is still available; try Use again.',
};
function modelError(status: ModelStatus | null, operationStatus: string) {
  const error = status?.runtimeError ?? status?.error;
  if (error && /^MODEL_DOWNLOAD_HTTP_(?:408|429|5\d\d)$/.test(error))
    return 'The model host is temporarily unavailable. Your partial file is saved; resume in a moment.';
  if (error && /^MODEL_DOWNLOAD_HTTP_\d{3}$/.test(error))
    return 'The reviewed model host rejected this download. Your saved model files remain available.';
  if (error) return knownErrors[error] ?? `Model setup failed: ${error.replace(/_/g, ' ').toLowerCase()}.`;
  if (operationStatus.startsWith('Model setup unavailable'))
    return 'The model could not be started. Your local directory is still available; check free storage and try Use again.';
  return null;
}

function IconAction({
  label,
  name,
  disabled,
  onPress,
}: {
  label: string;
  name: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        m.iconAction,
        disabled && m.actionDisabled,
        pressed && !disabled && m.actionPressed,
      ]}
    >
      <Ionicons name={name} size={22} color={disabled ? palette.muted : palette.blue} />
    </Pressable>
  );
}

/** Model setup has its own page; the conversation owner remains mounted behind it. */
export function ModelScreen({
  busy,
  status,
  modelReady = false,
  operationStatus,
  onBack,
  onOperation,
  onStop,
  onClear,
}: ModelScreenProps) {
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const installed = status?.artifactState !== undefined && status.artifactState !== 'MISSING';
  const downloaded = status?.artifactState === 'VERIFIED';
  const canDownload = status?.artifactState === 'MISSING' || status?.artifactState === 'PARTIAL';
  const canActivate =
    !busy && status?.runtimeError !== 'THERMAL_BLOCK' &&
    (downloaded || status?.state === 'PENDING_NATIVE_SMOKE_TEST' || status?.state === 'STAGED') &&
    !modelReady;
  const resumingDownload = status?.artifactState === 'PARTIAL';
  const progress = status?.totalBytes
    ? Math.max(0, Math.min(100, Math.floor((status.bytesReceived / status.totalBytes) * 100)))
    : null;
  const error = modelError(status, operationStatus);
  const run = (operation: ModelOperation) => {
    setConfirmation(null);
    void onOperation(operation);
  };
  const actions: AppDialogAction[] = [
    { label: 'Cancel', onPress: () => setConfirmation(null) },
    ...(confirmation === 'download'
      ? [{ label: resumingDownload ? 'Resume download' : 'Download', onPress: () => run('download') }]
      : confirmation === 'activate'
        ? [{ label: 'Use model', onPress: () => run('activate') }]
        : confirmation === 'remove'
          ? [{ label: 'Remove', destructive: true, onPress: () => run('remove') }]
          : confirmation === 'clear'
            ? [
                {
                  label: 'Clear conversation',
                  destructive: true,
                  onPress: () => {
                    setConfirmation(null);
                    void onClear();
                  },
                },
              ]
            : []),
  ];
  const dialogTitle =
    confirmation === 'download'
      ? resumingDownload ? 'Resume download?' : 'Download model?'
      : confirmation === 'activate'
        ? 'Use this model?'
        : confirmation === 'remove'
          ? 'Remove model?'
          : 'Clear conversation?';
  const dialogDescription =
    confirmation === 'download'
      ? resumingDownload
        ? 'This continues the saved Gemma download. Internet and free storage are needed. The complete file is verified before use.'
        : 'This downloads the reviewed 2.59 GB Gemma model to this phone. Internet and free storage are needed. The file is verified before use. Apache 2.0 license and attribution apply when sharing it.'
      : confirmation === 'activate'
        ? 'This may take a moment. Keep the app open while your model gets ready.'
        : confirmation === 'remove'
          ? 'This frees its storage. Your conversation history and map stay here.'
          : 'This clears your messages and temporary itinerary preview. Your model and map stay here.';

  return (
    <View style={s.screen}>
      <View style={m.page}>
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Assistant"
            onPress={onBack}
            style={s.backButton}
          >
            <Icon name="back" size={20} />
          </Pressable>
          <Text accessibilityRole="header" style={[s.title, { flex: 1 }]}>
            Models
          </Text>
        </View>
        <ScrollView contentContainerStyle={m.content} keyboardShouldPersistTaps="handled">
          <View style={m.modelCard}>
            <View style={m.modelHeading}>
              <View style={m.modelIcon}>
                <BrandMark size={42} />
              </View>
              <View style={m.modelName}>
                <Text accessibilityRole="header" style={m.title}>
                  Gemma 4 E2B
                </Text>
                <Text style={s.caption}>2.59 GB · Apache 2.0</Text>
              </View>
              <View style={m.actionRow}>
                {canDownload ? (
                  <IconAction
                    label={status?.artifactState === 'PARTIAL' ? 'Resume download' : status?.state === 'FAILED' ? 'Retry download' : 'Download'}
                    name="cloud-download-outline"
                    disabled={busy || !status}
                    onPress={() => setConfirmation('download')}
                  />
                ) : null}
                {canActivate ? (
                  <IconAction
                    label={status?.runtimeError || status?.state === 'FAILED' ? 'Retry' : 'Use model'}
                    name="checkmark-circle-outline"
                    onPress={() => setConfirmation('activate')}
                  />
                ) : null}
                {busy ? (
                  <IconAction
                    label="Stop"
                    name="stop-circle-outline"
                    onPress={onStop}
                  />
                ) : null}
              </View>
            </View>
            <Text style={s.body}>
              A little help for your next BGC visit. Once set up, it works without internet.
            </Text>
            <View style={m.stateRow}>
              {busy ? <ActivityIndicator color={palette.blue} /> : null}
              <Text accessibilityLiveRegion="polite" style={m.stateText}>
                {status?.runtimeError === 'THERMAL_BLOCK'
                  ? `${downloaded ? 'Installed' : 'Local AI'} · cooling required`
                  : status?.state === 'DOWNLOADING'
                  ? 'Downloading…'
                  : status?.artifactState === 'PARTIAL'
                    ? 'Download paused'
                    : status?.state === 'ACTIVE' && !modelReady
                  ? (status.runtimeError ? 'Installed · couldn’t start' : 'Installed')
                  : status
                    ? stateCopy[status.state]
                    : 'Checking setup…'}
                {status?.runtimeError === 'THERMAL_BLOCK'
                  ? `${downloaded ? 'Installed' : 'Local AI'} · cooling required`
                  : status?.state === 'DOWNLOADING' && progress !== null ? ` ${progress}%` : ''}
              </Text>
            </View>
            {error ? (
              <Text accessibilityLiveRegion="polite" style={m.error}>
                {error}
              </Text>
            ) : null}
            {status?.artifactState === 'VERIFIED' && !modelReady && status.runtimeError !== 'THERMAL_BLOCK' ? (
              <Text style={s.caption}>Tap Use model to start or retry local AI.</Text>
            ) : null}
            {status?.artifactState === 'PARTIAL' && status.state !== 'DOWNLOADING' ? (
              <Text style={s.caption}>Your partial download is saved. Resume it when you are ready.</Text>
            ) : null}
            {status?.state === 'ACTIVE' && modelReady ? (
              <Text style={s.caption}>This model is in use on this device.</Text>
            ) : null}
          </View>
          <View style={m.managementRow}>
            <Text style={m.rowLabel}>Local model</Text>
            <IconAction
              label="Remove"
              name="trash-outline"
              disabled={busy || !installed}
              onPress={() => setConfirmation('remove')}
            />
          </View>
          <View style={m.conversation}>
            <Text accessibilityRole="header" style={s.heading}>
              Conversation
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete all AI history"
              disabled={busy}
              accessibilityState={{ disabled: busy }}
              style={m.quietRow}
              onPress={() => setConfirmation('clear')}
            >
              <Text style={m.secondaryText}>Clear conversation</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
      {confirmation ? (
        <AppDialog
          visible
          title={dialogTitle}
          description={dialogDescription}
          actions={actions}
          onDismiss={() => setConfirmation(null)}
        />
      ) : null}
    </View>
  );
}
