import { useState } from 'react';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ModelStatus } from '../../ai/modelManager';
import { QWEN3_06B, MODEL_CATALOG } from '../../ai/modelCatalog';
import { AppDialog, type AppDialogAction } from '../../ui/AppDialog';
import { BrandMark, Icon, palette } from '../../ui/components';
import { assistantStyles as s } from './styles';
import { modelStyles as m } from './modelStyles';

type ModelOperation = 'download' | 'activate' | 'remove' | 'select';
type Confirmation = 'download' | 'activate' | 'remove' | 'clear' | null;
type ModelScreenProps = {
  busy: boolean;
  status: ModelStatus | null;
  modelReady?: boolean;
  operationStatus: string;
  onBack: () => void;
  onOperation: (operation: ModelOperation, modelId?: string) => Promise<void>;
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
    'There is not enough free storage to install this model. Free its download size plus 256 MiB, then try again.',
  MODEL_HASH_MISMATCH:
    'The downloaded model did not match the reviewed file and was rejected. Try downloading it again.',
  MODEL_SETUP_CANCELLED: 'Model setup was stopped. You can resume it when you are ready.',
  MODEL_STAGED_MISSING:
    'The staged model is unavailable. Download the reviewed model to try again.',
  MODEL_SETUP_CONSENT_REQUIRED: 'Model setup needs your confirmation before it can continue.',
  MODEL_DOWNLOAD_NETWORK_ERROR:
    'The download lost its connection. Your partial file is saved; resume when you have a connection.',
  MODEL_DOWNLOAD_PERMISSION_DENIED:
    'Android blocked the download. Check the app’s network permission and try again.',
  MODEL_SMOKE_FAILED:
    'The model did not complete its native startup check. The verified download is still available; try Use again.',
  MODEL_SMOKE_TOOL_INVALID:
    'This model did not return a valid startup tool call. Its verified file is retained. Try another model, or retry setup.',
  MODEL_SMOKE_TOOL_RESPONSE_INVALID:
    'This model could not read the startup tool result. Its verified file is retained. Try another model, or retry setup.',
};
function modelError(status: ModelStatus | null, operationStatus: string) {
  const error = status?.runtimeError ?? status?.error;
  if (error && /^MODEL_DOWNLOAD_HTTP_(?:408|429|5\d\d)$/.test(error))
    return 'The model host is temporarily unavailable. Your partial file is saved; resume in a moment.';
  if (error && /^MODEL_DOWNLOAD_HTTP_\d{3}$/.test(error))
    return 'The reviewed model host rejected this download. Your saved model files remain available.';
  if (error)
    return knownErrors[error] ?? `Model setup failed: ${error.replace(/_/g, ' ').toLowerCase()}.`;
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
  modelReady: runtimeReady = false,
  operationStatus,
  onBack,
  onOperation,
  onStop,
  onClear,
}: ModelScreenProps) {
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const model = MODEL_CATALOG.find((entry) => entry.id === status?.modelId) ?? QWEN3_06B;
  const modelReady = runtimeReady && status?.state === 'ACTIVE';
  const size = `${(model.bytes / 1_000_000_000).toFixed(2)} GB`;
  const installed = status?.artifactState !== undefined && status.artifactState !== 'MISSING';
  const downloaded = status?.artifactState === 'VERIFIED';
  const canDownload = status?.artifactState === 'MISSING' || status?.artifactState === 'PARTIAL';
  const canActivate =
    !busy &&
    (downloaded ||
      status?.artifactState === 'PRESENT' ||
      status?.state === 'PENDING_NATIVE_SMOKE_TEST' ||
      status?.state === 'STAGED') &&
    !modelReady;
  const resumingDownload = status?.artifactState === 'PARTIAL';
  const progress = status?.totalBytes
    ? Math.max(0, Math.min(100, Math.floor((status.bytesReceived / status.totalBytes) * 100)))
    : null;
  const error = modelError(status, operationStatus);
  const run = (operation: ModelOperation) => {
    setConfirmation(null);
    void onOperation(operation, model.id);
  };
  const actions: AppDialogAction[] = [
    { label: 'Cancel', onPress: () => setConfirmation(null) },
    ...(confirmation === 'download'
      ? [
          {
            label: resumingDownload ? 'Resume download' : 'Download',
            onPress: () => run('download'),
          },
        ]
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
      ? resumingDownload
        ? 'Resume download?'
        : 'Download model?'
      : confirmation === 'activate'
        ? 'Use this model?'
        : confirmation === 'remove'
          ? 'Remove model?'
          : 'Clear conversation?';
  const dialogDescription =
    confirmation === 'download'
      ? resumingDownload
        ? `This continues the saved ${model.displayName} download. Internet and free storage are needed. The complete file is verified before use.`
        : `This downloads ${size} of ${model.displayName} to this phone. Internet and free storage are needed. The file is verified before use. Apache 2.0 license and attribution apply when sharing it.`
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
          <Text style={s.caption}>Optional local AI · device acceptance pending</Text>
          <View style={m.catalog}>
            {MODEL_CATALOG.map((entry) => (
              <Pressable
                key={entry.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: model.id === entry.id, disabled: busy }}
                disabled={busy}
                onPress={() => {
                  void onOperation('select', entry.id);
                }}
                style={[m.catalogChoice, model.id === entry.id && m.catalogSelected]}
              >
                <Text style={m.rowLabel}>{entry.displayName}</Text>
                <Text style={s.caption}>
                  {(entry.bytes / 1_000_000).toFixed(0)} MB ·{' '}
                  {entry.bytes < 500_000_000 ? 'lightweight candidate' : 'optional candidate'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={m.modelCard}>
            <View style={m.modelHeading}>
              <View style={m.modelIcon}>
                <BrandMark size={42} />
              </View>
              <View style={m.modelName}>
                <Text accessibilityRole="header" style={m.title}>
                  {model.displayName}
                </Text>
                <Text style={s.caption}>{size} · Apache 2.0</Text>
              </View>
              <View style={m.actionRow}>
                {canDownload ? (
                  <IconAction
                    label={
                      status?.artifactState === 'PARTIAL'
                        ? 'Resume download'
                        : status?.state === 'FAILED'
                          ? 'Retry download'
                          : 'Download'
                    }
                    name="cloud-download-outline"
                    disabled={busy || !status}
                    onPress={() => setConfirmation('download')}
                  />
                ) : null}
                {canActivate ? (
                  <IconAction
                    label={
                      status?.runtimeError || status?.state === 'FAILED' ? 'Retry' : 'Use model'
                    }
                    name="checkmark-circle-outline"
                    onPress={() => setConfirmation('activate')}
                  />
                ) : null}
                {busy ? (
                  <IconAction label="Stop" name="stop-circle-outline" onPress={onStop} />
                ) : null}
              </View>
            </View>
            <Text style={s.body}>
              A little help for your next BGC visit. Once set up, it works without internet.
            </Text>
            <View style={m.stateRow}>
              {busy ? <ActivityIndicator color={palette.blue} /> : null}
              <Text accessibilityLiveRegion="polite" style={m.stateText}>
                {status?.state === 'DOWNLOADING'
                  ? 'Downloading…'
                  : status?.artifactState === 'PARTIAL'
                    ? 'Download paused'
                    : status?.state === 'ACTIVE' && !modelReady
                      ? status.runtimeError
                        ? 'Installed · couldn’t start'
                        : 'Installed'
                      : status
                        ? stateCopy[status.state]
                        : 'Checking setup…'}
                {status?.state === 'DOWNLOADING' && progress !== null ? ` ${progress}%` : ''}
              </Text>
            </View>
            {error ? (
              <Text accessibilityLiveRegion="polite" style={m.error}>
                {error}
              </Text>
            ) : null}
            {status?.artifactState === 'VERIFIED' && !busy && !modelReady ? (
              <Text style={s.caption}>Tap Use model to start or retry local AI.</Text>
            ) : null}
            {status?.artifactState === 'PARTIAL' && status.state !== 'DOWNLOADING' ? (
              <Text style={s.caption}>
                Your partial download is saved. Resume it when you are ready.
              </Text>
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
