import { useState, type RefObject } from 'react';
import type { AppDialogAction } from '../ui/AppDialog';
import { installPack, rollbackPack } from '../updates';
import type { PackKind, PackManifest } from '../updates/contracts';

export function useContentPackActions(
  downloadController: RefObject<AbortController | null>,
  refreshRecords: () => Promise<void>,
  setMessage: (value: string) => void,
  setError: (value: string) => void,
) {
  const [installing, setInstalling] = useState(false),
    [confirming, setConfirming] = useState(false);
  const [packChecking, setPackChecking] = useState(false);
  const [dialog, setDialog] = useState<{
    title: string;
    description: string;
    actions: AppDialogAction[];
  } | null>(null);
  const dismissDialog = () => {
    setConfirming(false);
    setDialog(null);
  };
  const confirm = (
    title: string,
    body: string,
    buttons: { text: string; style?: 'cancel'; onPress?: () => void }[],
  ) => {
    setConfirming(true);
    setDialog({
      title,
      description: body,
      actions: buttons.map((button) => ({
        label: button.text,
        onPress: () => {
          dismissDialog();
          button.onPress?.();
        },
      })),
    });
  };
  const download = (manifest: PackManifest) => {
    if (installing) return;
    const bytes = manifest.files.reduce((n, f) => n + f.sizeBytes, 0);
    confirm(
      'Download reviewed offline content?',
      manifest.kind +
        ' · ' +
        manifest.version +
        '\n' +
        (bytes / 1024 / 1024).toFixed(1) +
        ' MB download. Additional space is required for validation and the previous version.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => {
            const controller = new AbortController();
            downloadController.current = controller;
            setInstalling(true);
            void installPack(manifest, {
              userInitiated: true,
              retries: 1,
              signal: controller.signal,
            })
              .then(refreshRecords)
              .then(() => setMessage('Reviewed content installed.'))
              .catch(() =>
                setError(
                  'Content could not be safely installed. Existing valid content is retained.',
                ),
              )
              .finally(() => {
                downloadController.current = null;
                setInstalling(false);
              });
          },
        },
      ],
    );
  };
  const rollback = (kind: PackKind) =>
    confirm(
      'Restore previous content pack?',
      'Restore the existing previous ' +
        kind +
        ' pack only if integrity and dependencies still validate?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore previous',
          onPress: () => {
            setPackChecking(true);
            void rollbackPack(kind)
              .then(refreshRecords)
              .then(() => setMessage('Previous validated content pack restored.'))
              .catch(() => setError('The previous pack could not be safely restored.'))
              .finally(() => setPackChecking(false));
          },
        },
      ],
    );

  return {
    installing,
    confirming,
    packChecking,
    setPackChecking,
    download,
    rollback,
    dialog,
    dismissDialog,
  };
}
