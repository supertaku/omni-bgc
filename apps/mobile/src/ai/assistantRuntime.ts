import { File } from 'expo-file-system';
import type { Place } from '../contracts';
import { NativeLiteRtProvider } from './NativeLiteRtProvider';
import { createAppRetrieval } from './retrieval';
import { createToolExecutor } from './toolExecutor';
import { AgentOrchestrator } from './AgentOrchestrator';
import { ItineraryPreviewOwner } from './itineraryPreview';
import { ConversationStore } from './conversationStore';
import { createExpoModelManager } from './modelStorage';
import { createProviderSmokeRunner, type ModelManager } from './modelManager';
import { GEMMA_4_E2B } from './modelCatalog';

export async function createAssistantRuntime(focus: (place: Place) => boolean) {
  const provider = new NativeLiteRtProvider();
  const retrieval = await createAppRetrieval();
  const itineraryPreview = new ItineraryPreviewOwner(
    async (id) => (await retrieval.getPlaceDetails(id)).data,
  );
  const executor = createToolExecutor(retrieval, {
    focusMapPlace: focus,
    getItineraryPreview: (signal) => itineraryPreview.read(signal),
    previewItinerary: (stops, requestId, operation, signal) =>
      itineraryPreview.preview(stops, requestId, operation, signal),
    cancelPending: () => itineraryPreview.cancelPending(),
  });
  const agent = new AgentOrchestrator(provider, executor);
  const history = new ConversationStore();
  let manager: ModelManager | null = null;
  let initialization: Promise<boolean> | null = null;
  let closing: Promise<void> | null = null;
  const initialize = () =>
    (initialization ??= (async () => {
      if (!(await provider.getCapabilities()).nativeModulePresent) return false;
      manager = await createExpoModelManager();
      const pointers = await manager.recover();
      if (!pointers.active) return false;
      await provider.load({ ...pointers.active, contextTokens: 4096 }, 'cpu');
      return true;
    })());
  const setup = async (signal: AbortSignal) => {
    await provider.release();
    manager ??= await createExpoModelManager();
    await manager.install(
      GEMMA_4_E2B.id,
      { kind: 'download', userInitiated: true, licenseAcknowledged: true },
      signal,
    );
  };
  const importModel = async (
    signal: AbortSignal,
    pickerVisibility?: (visible: boolean) => void,
  ) => {
    pickerVisibility?.(true);
    const picked = await (async () => {
      try {
        return await File.pickFileAsync({ multipleFiles: false });
      } finally {
        pickerVisibility?.(false);
      }
    })();
    if (picked.canceled || signal.aborted) return;
    await provider.release();
    manager ??= await createExpoModelManager();
    await manager.install(
      GEMMA_4_E2B.id,
      {
        kind: 'import',
        sourceUri: picked.result.uri,
        userInitiated: true,
        licenseAcknowledged: true,
      },
      signal,
    );
  };
  const activate = async (signal: AbortSignal) => {
    await provider.release();
    manager ??= await createExpoModelManager();
    // A retained ACTIVE pointer has already passed the native trial. Reverify it
    // before an explicit reload; newly staged candidates still require the trial.
    if (manager.getStatus().state === 'ACTIVE') {
      const recovered = await manager.recover();
      if (signal.aborted) throw new Error('Model setup canceled');
      if (!recovered.active) throw new Error('MODEL_MISSING');
      await provider.load({ ...recovered.active, contextTokens: 4096 }, 'cpu');
      return;
    }
    const model = await manager.activate(createProviderSmokeRunner(provider, signal), signal);
    if (signal.aborted) throw new Error('Model setup canceled');
    await provider.load({ ...model, contextTokens: 4096 }, 'cpu');
  };
  const removeModel = async () => {
    await provider.release();
    manager ??= await createExpoModelManager();
    await manager.removeInstalled(GEMMA_4_E2B.id, { userInitiated: true });
  };
  return {
    provider,
    itineraryPreview,
    agent,
    history,
    initialize,
    setup,
    importModel,
    activate,
    removeModel,
    resolvePlace: async (id: string) => (await retrieval.getPlaceDetails(id)).data,
    getManager: () => manager,
    close() {
      closing ??= (async () => {
        agent.cancel();
        itineraryPreview.clear();
        await initialization?.catch(() => undefined);
        try {
          await history.close();
        } finally {
          await provider.release();
        }
      })();
      return closing;
    },
  };
}
export type AssistantRuntime = Awaited<ReturnType<typeof createAssistantRuntime>>;
