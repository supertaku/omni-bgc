import { File } from 'expo-file-system';
import type { Origin, Place } from '../contracts';
import { NativeLiteRtProvider } from './NativeLiteRtProvider';
import { createAppRetrieval } from './retrieval';
import { createToolExecutor } from './toolExecutor';
import { AgentOrchestrator } from './AgentOrchestrator';
import { ItineraryPreviewOwner } from './itineraryPreview';
import { ConversationStore } from './conversationStore';
import { createExpoModelManager } from './modelStorage';
import { createProviderSmokeRunner, type ModelManager } from './modelManager';
import { QWEN3_06B, reviewedModel } from './modelCatalog';
import { runHybridTurn } from './hybridAssistant';
import { confirmedOrigin } from './confirmedOrigin';
import type { AgentRunOptions } from './AgentOrchestrator';
import { answerDirectoryQuery } from '../features/assistant/directory';
import { createFoodResearchAnswer } from '../features/food/assistant';
import { foodResearch } from '../features/food/directory';

export async function createAssistantRuntime(focus: (place: Place) => boolean | Promise<boolean>) {
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
  const research = createFoodResearchAnswer(foodResearch);
  const history = new ConversationStore();
  let manager: ModelManager | null = null;
  let initialization: Promise<boolean> | null = null;
  let closing: Promise<void> | null = null;
  let closingRequested = false;
  let lifecycle: Promise<unknown> = Promise.resolve();
  let activeOperation: AbortController | null = null;
  let selectedModelId = QWEN3_06B.id;
  const loadModel = (model: Parameters<typeof provider.load>[0]) =>
    provider.load({ ...model, contextTokens: reviewedModel(model.id).defaultContextTokens }, 'cpu');
  // Serialize runtime operations around the existing manager/provider owners;
  // teardown cancels setup and drains it before releasing native resources.
  const own = <T>(work: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (closingRequested) return Promise.reject(new Error('Assistant runtime is closed'));
    const result = lifecycle.then(async () => {
      if (closingRequested) throw new Error('Assistant runtime is closed');
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      activeOperation = controller;
      try {
        if (signal?.aborted) controller.abort();
        if (controller.signal.aborted) throw new Error('MODEL_SETUP_CANCELLED');
        return await work(controller.signal);
      } finally {
        signal?.removeEventListener('abort', abort);
        activeOperation = null;
      }
    });
    lifecycle = result.catch(() => undefined);
    return result;
  };
  const initialize = (): Promise<boolean> => {
    if (closingRequested) return Promise.reject(new Error('Assistant runtime is closed'));
    return (initialization ??= own(async () => {
      if (!(await provider.getCapabilities()).nativeModulePresent) return false;
      manager ??= await createExpoModelManager();
      const pointers = await manager.recover();
      selectedModelId = pointers.active?.id ?? pointers.staged?.id ?? selectedModelId;
      if (!pointers.active) return false;
      await loadModel(pointers.active);
      return true;
    }).catch((error: unknown) => {
      initialization = null;
      manager?.setRuntimeError(error instanceof Error ? error.message : 'MODEL_STARTUP_FAILED');
      throw error;
    }));
  };
  const setup = async (signal: AbortSignal, id = selectedModelId) => {
    selectedModelId = reviewedModel(id).id;
    await provider.release();
    manager ??= await createExpoModelManager();
    await manager.install(
      id,
      { kind: 'download', userInitiated: true, licenseAcknowledged: true },
      signal,
    );
  };
  const importModel = async (
    signal: AbortSignal,
    pickerVisibility?: (visible: boolean) => void,
    id = selectedModelId,
  ) => {
    pickerVisibility?.(true);
    const picked = await (async () => {
      try {
        return await File.pickFileAsync({ multipleFiles: false });
      } finally {
        pickerVisibility?.(false);
      }
    })();
    if (picked.canceled || signal.aborted) {
      return;
    }
    await provider.release();
    manager ??= await createExpoModelManager();
    await manager.install(
      reviewedModel(id).id,
      {
        kind: 'import',
        sourceUri: picked.result.uri,
        userInitiated: true,
        licenseAcknowledged: true,
      },
      signal,
    );
  };
  const activate = async (signal: AbortSignal, id = selectedModelId) => {
    selectedModelId = reviewedModel(id).id;
    await provider.release();
    manager ??= await createExpoModelManager();
    // A retained ACTIVE pointer has already passed the native trial. Reverify it
    // before an explicit reload; newly staged candidates still require the trial.
    const recovered = await manager.recover();
    if (recovered.active?.id === id && recovered.staged?.id !== id) {
      if (signal.aborted) throw new Error('Model setup canceled');
      if (!recovered.active) throw new Error('MODEL_MISSING');
      await loadModel(recovered.active);
      return;
    }
    // Only reuse an existing artifact here; activation must never start a network transfer.
    if (recovered.staged?.id !== id) {
      await manager.install(
        id,
        { kind: 'existing', userInitiated: true, licenseAcknowledged: true },
        signal,
      );
    }
    const model = await manager.activate(createProviderSmokeRunner(provider, signal), signal);
    if (signal.aborted) throw new Error('Model setup canceled');
    await loadModel(model);
  };
  const removeModel = async (id = selectedModelId) => {
    await provider.release();
    manager ??= await createExpoModelManager();
    await manager.removeInstalled(reviewedModel(id).id, { userInitiated: true });
  };
  return {
    provider,
    itineraryPreview,
    agent,
    answer: (
      query: string,
      places: readonly Place[],
      options?: AgentRunOptions,
      origin?: Origin | null,
    ) =>
      runHybridTurn(
        query,
        places,
        {
          agent,
          executor,
          canInfer: () => provider.state === 'READY',
          answerDirectory: (q, records) =>
            answerDirectoryQuery(q, [...records], undefined, research),
        },
        options,
        confirmedOrigin(origin),
      ),
    history,
    initialize,
    selectModel: (id: string) =>
      own(async () => {
        selectedModelId = reviewedModel(id).id;
        manager ??= await createExpoModelManager();
        await manager.inspect(id);
      }),
    setup: (signal: AbortSignal, id?: string) =>
      own((ownedSignal) => setup(ownedSignal, id), signal),
    importModel: (
      signal: AbortSignal,
      pickerVisibility?: (visible: boolean) => void,
      id?: string,
    ) => own((ownedSignal) => importModel(ownedSignal, pickerVisibility, id), signal),
    activate: (signal: AbortSignal, id?: string) =>
      own((ownedSignal) => activate(ownedSignal, id), signal),
    removeModel: (id?: string) => own(() => removeModel(id)),
    resolvePlace: async (id: string) => (await retrieval.getPlaceDetails(id)).data ??
      (await retrieval.getPreviewPlaceDetails(id)).data,
    getManager: () => manager,
    refreshThermal: () => provider.thermalBlocked(),
    onThermalStatus: (listener: (blocked: boolean) => void) => provider.onThermalStatus(listener),
    close() {
      closingRequested = true;
      activeOperation?.abort();
      closing ??= (async () => {
        agent.cancel();
        itineraryPreview.clear();
        await lifecycle;
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
