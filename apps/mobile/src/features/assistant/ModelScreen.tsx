import { useState } from 'react';
import { EvaluationScreen, type EvaluationStart } from '../../qa/ai-evaluation/EvaluationScreen';
import type { EvaluationReceipt, EvaluationExportResult } from '../../qa/ai-evaluation/contracts';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import type { ModelStatus } from '../../ai/modelManager';
import { Icon, palette } from '../../ui/components';
import { assistantStyles as s } from './styles';
import { modelStyles as m } from './modelStyles';

type ModelOperation = 'download' | 'activate' | 'remove';
type ModelScreenProps = {
  busy: boolean;
  status: ModelStatus | null;
  modelReady?: boolean;
  operationStatus: string;
  onBack: () => void;
  onOperation: (operation: ModelOperation) => Promise<void>;
  onStop: () => void;
  onClear: () => Promise<void>;
  evaluationAvailable?: boolean;
  onEvaluation?: (input: EvaluationStart) => Promise<{ runId: string }>;
  onEvaluationExport?: (
    runId: string,
    receipt: EvaluationReceipt,
  ) => Promise<EvaluationExportResult>;
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
  evaluationAvailable = false,
  onEvaluation,
  onEvaluationExport,
}: ModelScreenProps) {
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const canActivate =
    !busy &&
    (status?.state === 'PENDING_NATIVE_SMOKE_TEST' || (status?.state === 'ACTIVE' && !modelReady));
  const installed = status && status.state !== 'NOT_INSTALLED';
  const progress = status?.totalBytes
    ? Math.max(0, Math.min(100, Math.floor((status.bytesReceived / status.totalBytes) * 100)))
    : null;
  const failed =
    status?.state === 'FAILED' || operationStatus.startsWith('Model setup unavailable');
  const run = (operation: ModelOperation) => {
    void onOperation(operation);
  };
  if (evaluationOpen && evaluationAvailable && onEvaluation && onEvaluationExport)
    return (
      <EvaluationScreen
        busy={busy}
        onRun={onEvaluation}
        onExport={onEvaluationExport}
        onStop={onStop}
        onBack={() => setEvaluationOpen(false)}
      />
    );
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
                <Icon name="assistant" color={palette.blue} size={28} />
              </View>
              <View style={m.modelName}>
                <Text
                  accessibilityRole="header"
                  style={m.title}
                  onLongPress={
                    evaluationAvailable && onEvaluation && onEvaluationExport
                      ? () =>
                          Alert.alert(
                            'Open preview QA?',
                            'Synthetic evaluation is separate from chat. No run starts until you import a receipt and confirm Start.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Open QA', onPress: () => setEvaluationOpen(true) },
                            ],
                          )
                      : undefined
                  }
                >
                  Gemma 4 E2B
                </Text>
                <Text style={s.caption}>2.59 GB · Apache 2.0</Text>
              </View>
            </View>
            <Text style={s.body}>
              A little help for your next BGC visit. Once set up, it works without internet.
            </Text>
            <View style={m.stateRow}>
              {busy ? <ActivityIndicator color={palette.blue} /> : null}
              <Text accessibilityLiveRegion="polite" style={m.stateText}>
                {status?.state === 'ACTIVE' && !modelReady
                  ? 'Ready to use'
                  : status
                    ? stateCopy[status.state]
                    : 'Checking setup…'}
                {status?.state === 'DOWNLOADING' && progress !== null ? ` ${progress}%` : ''}
              </Text>
            </View>
            {failed ? (
              <Text accessibilityLiveRegion="polite" style={m.error}>
                We couldn't finish setup. Please try downloading again.
              </Text>
            ) : null}
            {status?.state === 'PENDING_NATIVE_SMOKE_TEST' ? (
              <Text style={s.caption}>Tap Use to finish setting up your model.</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use this model"
              accessibilityState={{ disabled: !canActivate }}
              disabled={!canActivate}
              style={[m.primaryButton, !canActivate && m.disabled]}
              onPress={() =>
                Alert.alert(
                  'Use this model?',
                  'This may take a moment. Keep the app open while your model gets ready.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Use model', onPress: () => run('activate') },
                  ],
                )
              }
            >
              <Text style={m.primaryText}>
                {status?.state === 'ACTIVE' && modelReady ? 'In use' : 'Use this model'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Download reviewed local model"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              style={m.secondaryButton}
              onPress={() =>
                Alert.alert(
                  'Download model?',
                  'This downloads the reviewed 2.59 GB Gemma model to this phone. Internet and free storage are needed. The file is verified before use. Apache 2.0 license and attribution apply when sharing it.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Download', onPress: () => run('download') },
                  ],
                )
              }
            >
              <Text style={m.secondaryText}>Download model</Text>
            </Pressable>
            {busy ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Stop model setup"
                onPress={onStop}
                style={m.secondaryButton}
              >
                <Text style={m.secondaryText}>Stop</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove local model"
            accessibilityState={{ disabled: busy || !installed }}
            disabled={busy || !installed}
            style={[m.quietRow, (busy || !installed) && { opacity: 0.5 }]}
            onPress={() =>
              Alert.alert(
                'Remove model?',
                'This frees its storage. Your conversation history and map stay here.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => run('remove') },
                ],
              )
            }
          >
            <Text style={[m.destructiveText, (busy || !installed) && { color: palette.muted }]}>
              Remove model
            </Text>
          </Pressable>
          <View style={m.conversation}>
            <Text accessibilityRole="header" style={s.heading}>
              Conversation
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete all AI history"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              style={m.quietRow}
              onPress={() =>
                Alert.alert(
                  'Clear conversation?',
                  'This clears your messages and temporary itinerary preview. Your model and map stay here.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear conversation',
                      style: 'destructive',
                      onPress: () => {
                        void onClear();
                      },
                    },
                  ],
                )
              }
            >
              <Text style={m.secondaryText}>Clear conversation</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
