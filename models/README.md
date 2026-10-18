# Local model storage

Keep the single verified host copy at `gemma-4-e2b/gemma-4-E2B-it.litertlm`.
Its adjacent `manifest.json` records the actual SHA256, byte size, original
location and catalog reference. Weights and local receipts are ignored by Git.

The app's authoritative model metadata remains in
[`modelCatalog.ts`](../apps/mobile/src/ai/modelCatalog.ts). This folder is host
storage, not an app import path or a bundled asset. Normal app setup still uses
Download, Use and Remove and stores its own verified model privately.

Moving the host file does not install or activate a model on a phone. Existing
model acceptance limitations and redistribution restrictions remain in force.
