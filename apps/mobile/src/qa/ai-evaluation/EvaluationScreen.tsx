import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { File } from 'expo-file-system';
import type {
  EvaluationReceipt,
  EvaluationEnvelope,
  EvaluationExportResult,
  CaseObservation,
} from './contracts';
import { readBoundedText } from './boundedRead';
import { assistantStyles as s } from '../../features/assistant/styles';
import { modelStyles as m } from '../../features/assistant/modelStyles';

export type EvaluationStart = {
  envelope: EvaluationEnvelope;
  onProgress: (row: CaseObservation, completed: number, total: number) => void;
};
export function EvaluationScreen({
  busy,
  onRun,
  onExport,
  onStop,
  onBack,
}: {
  busy: boolean;
  onRun: (input: EvaluationStart) => Promise<{ runId: string }>;
  onExport: (runId: string, receipt: EvaluationReceipt) => Promise<EvaluationExportResult>;
  onStop: () => void;
  onBack: () => void;
}) {
  const [receipt, setReceipt] = useState<EvaluationEnvelope | null>(null),
    [progress, setProgress] = useState('Not run'),
    [error, setError] = useState('');
  const [completedRun, setCompletedRun] = useState<{
    runId: string;
    receipt: EvaluationReceipt;
  } | null>(null);
  const importReceipt = async () => {
    try {
      const selected = await File.pickFileAsync({ multipleFiles: false });
      if (selected.canceled) return;
      const file = new File(selected.result.uri);
      const value = JSON.parse(readBoundedText(file, 1024 * 1024)) as EvaluationEnvelope;
      const keys = ['receipt', 'sourceReceiptUtf8', 'apkVerificationUtf8'];
      if (!value || Object.keys(value).sort().join() !== keys.sort().join())
        throw Error('Invalid receipt');
      setReceipt(value);
      setError('');
    } catch {
      setError('Could not read the evaluation receipt.');
    }
  };
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={m.content} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Models"
          style={m.quietRow}
          onPress={onBack}
        >
          <Text style={m.secondaryText}>Back to Models</Text>
        </Pressable>
        <Text accessibilityRole="header" style={m.title}>
          Synthetic model evaluation
        </Text>
        <Text style={s.body}>
          Private preview QA only. This runs 120 frozen cases using invented records in memory. It
          does not change saved places, source approvals or conversation history.
        </Text>
        <Text style={s.caption}>
          Raw synthetic prompts, native outputs and tool traces are written only to a new private
          evaluation folder. No score or model quality claim is produced automatically.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Import evaluation receipt"
          disabled={busy}
          accessibilityState={{ disabled: busy }}
          style={m.secondaryButton}
          onPress={() => {
            void importReceipt();
          }}
        >
          <Text style={m.secondaryText}>Import evaluation receipt</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start synthetic evaluation"
          disabled={busy || !receipt}
          accessibilityState={{ disabled: busy || !receipt }}
          style={m.primaryButton}
          onPress={() =>
            Alert.alert(
              'Run synthetic evaluation?',
              'This may take a while. Keep the app open. Stop remains available, and health or native errors halt the run. No model download, database changes or automatic grading occur.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Start',
                  onPress: () => {
                    if (!receipt) return;
                    setError('');
                    setCompletedRun({ runId: receipt.receipt.runId, receipt: receipt.receipt });
                    void onRun({
                      envelope: receipt,
                      onProgress: (row, completed, total) =>
                        setProgress(`${completed}/${total} · ${row.caseId} · ${row.status}`),
                    }).catch(() =>
                      setError('Evaluation stopped. Preserve the private trace for review.'),
                    );
                  },
                },
              ],
            )
          }
        >
          <Text style={m.primaryText}>Start evaluation</Text>
        </Pressable>
        {busy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop synthetic evaluation"
            style={m.secondaryButton}
            onPress={onStop}
          >
            <Text style={m.secondaryText}>Stop</Text>
          </Pressable>
        ) : null}
        {completedRun && !busy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Export synthetic evaluation trace"
            style={m.secondaryButton}
            onPress={() =>
              Alert.alert(
                'Export private QA trace?',
                'Choose a folder with the system picker. Only this synthetic run trace and its checksum receipt will be copied there.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Choose folder',
                    onPress: () => {
                      void onExport(completedRun.runId, completedRun.receipt)
                        .then((result) =>
                          setProgress(
                            'Trace and receipt exported and checked. Receipt SHA256: ' +
                              result.sidecarSha256,
                          ),
                        )
                        .catch(() =>
                          setError('Export did not finish. The private trace is retained.'),
                        );
                    },
                  },
                ],
              )
            }
          >
            <Text style={m.secondaryText}>Export trace</Text>
          </Pressable>
        ) : null}
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {progress}
        </Text>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={m.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
