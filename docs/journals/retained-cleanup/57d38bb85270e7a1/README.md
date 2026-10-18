# Internal pilot resource builder

Requires the exact accepted M3 outputs at `data/generated/m3/run-a`, retained Noto Sans/OFL files at `data/raw/map-assets`, and the pinned Python environment in `requirements.txt`. Inputs and generated geographic/font/tile bytes are ignored and are not publicly distributed. No tile service is contacted.

From the repository root, run the isolated Python interpreter with `pipelines/map-pack/build.py`. The builder verifies accepted source/artifact hashes, emits deterministic clipped vector tiles/PMTiles, original grass/tree atlases and local SDF glyphs, retains notices, and copies the pack into `apps/mobile/assets/generated/omni`.

The candidate inventory is `data/manifests/offline-pilot-inventory.json`; authored style is `apps/mobile/src/map/pilot-style.json`. The builder synchronizes these outputs and the bundled resource hash declaration; parent review is required before integration. CNG rejects mismatched inventory/style or resource checksums. A new geographic version requires parent review and new evidence. The current reference is High Street only, historic candidate geometry with zero navigation authority.

The UX pack includes nineteen original 1x/2x category and environmental sprites. Run `node pipelines/map-pack/check.mjs` to validate the installed style specification, hashes, sprite densities, camera bounds and mocked atomic private-file installation. Run the isolated Python interpreter with `pipelines/map-pack/build_landmark_registry.py` for the separately retained source-footprint landmark extension registry. It does not change packaged bytes. See `WORK_JOURNAL.md` for exact hashes, primary native-compatibility sources and device limitations. Android 13.6.1 receives PMTiles through verified app-private `file:///` resources, avoiding unsupported asset range reads. These checks do not replace device map loading or performance evidence.

Glyph coverage includes emitted road/path text and, when available, names from `apps/mobile/assets/generated/directory/places.json`. The builder retains all 256 entries in every necessary range, fails for unsupported font characters, removes obsolete generated ranges, and records the optional directory checksum. A checkout without the directory still builds a portable GIS pack. The checker verifies every currently rendered name character and all retained PBF glyph IDs. Non-rendered source feature names are outside this font contract.

Official font origin: https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf; licence: https://github.com/notofonts/noto-fonts/blob/main/LICENSE. Exact reviewed SHA256 values are in the builder/inventory; mutable remote URLs alone are not accepted inputs. Do not copy prior processed data/code/media or public raster tile caches.

For a local Android build with the existing SDK/JBR and installed pinned npm dependencies, use `apps/mobile/scripts/build-preview.ps1`. It uses a repository-root short Gradle cache and disables optional native QA startup. The resulting ARM64 release-variant APK is development-key-signed for internal review. Device cold-offline/font/sprite/crash and iOS tests remain separate, currently skipped/unavailable. Full M5/production acceptance is withheld.

## UX V2 city presentation

`ux-city-v2` includes ten original 64px facade motifs and distinct same-footprint roof caps, source height/levels interpretation and building-part retention. `building_metadata.py` preserves source height as unverified historical evidence; valid integer levels use a separately recorded 3m estimate, missing values use explicit family defaults. No IDs, database facts, footprint vertices or route topology change. Detail tiers are encoded in the style metadata. Six source-tagged zebra crossing ways receive decoration at zoom18+.

Run `check-building-metadata.py` for adversarial source values and `check-building-pack.py` against every emitted tile, plus `check.mjs` for installed-spec/resource/native-host closure. Exact per-feature evidence is `building-evidence.json`; bounded landmark metadata is `apps/mobile/src/map/landmarks.json`; original sample assets and their checksums live in `apps/mobile/assets/map-v2`. The full pack is still internal-only.

The local pinned Python dependencies can be restored with `python -m pip install --target .g/map-v2-python -r pipelines/map-pack/requirements.txt`; set `PYTHONPATH` to that absolute task-local directory before running the builder/tests. This leaves system packages unchanged.
