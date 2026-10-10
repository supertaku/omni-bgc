# Internal pilot resource builder

Requires the exact accepted M3 outputs at `data/generated/m3/run-a`, retained Noto Sans/OFL files at `data/raw/map-assets`, and the pinned Python environment in `requirements.txt`. Inputs and generated geographic/font/tile bytes are ignored and are not publicly distributed. No tile service is contacted.

From the repository root, run the isolated Python interpreter with `pipelines/map-pack/build.py`. The builder verifies accepted source/artifact hashes, emits deterministic clipped vector tiles/PMTiles, original grass/tree atlases and local SDF glyphs, retains notices, and copies the pack into `apps/mobile/assets/generated/omni`.

The reviewed inventory is `data/manifests/offline-pilot-inventory.json`; original style is `apps/mobile/src/map/pilot-style.json`. CNG rejects changed inventory/style or resource checksums. A new geographic version requires parent review and new evidence before updating those tracked references. The current reference is High Street only, historic candidate geometry with zero navigation authority.

Official font origin: https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf; licence: https://github.com/notofonts/noto-fonts/blob/main/LICENSE. Exact reviewed SHA256 values are in the builder/inventory; mutable remote URLs alone are not accepted inputs. Do not copy prior processed data/code/media or public raster tile caches.

For a local Android build with the existing SDK/JBR and installed pinned npm dependencies, use `apps/mobile/scripts/build-preview.ps1`. It uses a repository-root short Gradle cache and disables optional native QA startup. The resulting ARM64 release-variant APK is development-key-signed for internal review. Device cold-offline/font/sprite/crash and iOS tests remain separate, currently skipped/unavailable. Full M5/production acceptance is withheld.
