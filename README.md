# Omni-BGC

**Explore Bonifacio Global City, even without the internet.**

Omni-BGC is an offline-first mobile application that helps people explore Bonifacio Global City (BGC), Taguig, Philippines.

The app brings together an interactive city map, a local directory of places, restaurant and office information, and an optional AI assistant that runs directly on your phone.

The goal is simple: **make BGC easier to explore, search, and understand through one mobile application.**

Omni-BGC is built with React Native and Expo. Development currently focuses on Android.

> **Project status: Under active development — Internal Preview**
>
> This is not a production-ready application. Some information is still being researched or verified. Offline walking navigation is not available yet, and the local AI model still needs full testing on a physical Android device.
>
> Some bundled map and research data is approved for internal development only. Public distribution of the complete application and its data has not been approved.

## Table of Contents

1. [About the Project](#about-the-project)
2. [Features](#features)
3. [Current Project Status](#current-project-status)
4. [Technology Stack](#technology-stack)
5. [How the App Works](#how-the-app-works)
6. [Project Structure](#project-structure)
7. [Getting Started](#getting-started)
8. [How to Use Omni-BGC](#how-to-use-omni-bgc)
9. [Offline AI Assistant](#offline-ai-assistant)
10. [Maps and Local Data](#maps-and-local-data)
11. [Privacy and Offline Support](#privacy-and-offline-support)
12. [Development and Testing](#development-and-testing)
13. [Known Limitations](#known-limitations)
14. [Development Priorities](#development-priorities)
15. [Credits, Sources, and Licenses](#credits-sources-and-licenses)
16. [References](#references)

---

## About the Project

Bonifacio Global City is home to offices, restaurants, shopping malls, parks, residential buildings, and other establishments.

Finding information about these places often means switching between maps, search engines, websites, and business directories.

Omni-BGC aims to bring useful local information into one place.

The application is designed around three ideas.

### 1. Explore the city visually

Use an interactive map to discover places and understand where they are located.

The map uses a modern, stylized city design with roads, paths, buildings, and selected landmarks.

### 2. Find useful local information

Search for restaurants, coffee shops, stores, offices, buildings, and recorded menu items.

Some records contain more details than others. Omni-BGC keeps track of the source and review status of the available information.

### 3. Ask a local AI assistant

Use simple questions to search the local directory.

For example:

- "Find coffee shops in BGC."
- "Show restaurants with ramen."
- "Find dishes under 300 pesos."
- "Look for offices in BGC."
- "Show this place on the map."

When a supported AI model is installed, the assistant can use it to understand questions and choose local search tools.

Without an AI model, the application can still answer supported directory questions using normal search logic.

**The long-term goal is to make Omni-BGC a useful, reliable, and accessible city explorer that does not depend on a constant internet connection.**

---

## Features

### Interactive Offline Map

Omni-BGC includes a locally stored map powered by MapLibre.

The current implementation supports:

- Moving around the map by dragging.
- Zooming in and out.
- Switching between flat and 2.5D map views.
- Viewing roads, paths, buildings, and selected landmarks.
- Displaying place markers.
- Selecting a place to view its details.
- Showing available map coverage information.
- Loading map resources from local device storage.

The current expanded map uses a bundled PMTiles archive.

If the expanded map resources fail to load, the application includes a smaller pilot map as a recovery option.

Map coverage is still limited. Building heights and some visual details are illustrative and should not be treated as measurements.

### Place and Business Directory

Users can search for places by name, category, building, or other available details.

The local directory includes different kinds of records:

- Restaurants and food establishments.
- Cafés and coffee shops.
- Stores and shopping locations.
- Office buildings and company offices.
- Other recorded places and landmarks.

Not every listing has been independently verified.

The application separates approved records from research candidates and fictional demonstration records.

### Restaurant and Menu Search

Omni-BGC includes a research-based restaurant directory with recorded menu information.

Available functions include:

- Searching for restaurant names.
- Searching for dishes and menu items.
- Filtering menu results by recorded prices.
- Viewing available menu details.
- Viewing recorded business hours where available.
- Checking the source and limitations of research information.

**Important:** Recorded prices and business hours are not live information. Some prices are estimates or may apply to a different branch. Users should confirm details with the establishment.

### Office Directory

The project also includes a separate office information system.

It is designed to support:

- Searching for companies and office names.
- Finding offices by building or district.
- Viewing available office information.
- Keeping track of source evidence.
- Checking whether approved office information has expired.

Research candidates are not automatically treated as verified operating offices.

### Offline AI Assistant

The app includes an optional local AI system.

It can:

- Understand supported questions about BGC.
- Search local records using predefined tools.
- Present place and menu results.
- Open supported places on the map.
- Explain when requested information is unavailable.
- Create temporary visit-list previews.
- Keep conversation history on the device.

The assistant is designed to avoid inventing business details, prices, coordinates, or walking directions.

AI setup and performance still require physical-device verification.

### Model Management

The application has a model management screen.

It supports:

- Downloading the selected local AI model.
- Checking the downloaded model's file integrity.
- Preparing and activating the model.
- Stopping model setup.
- Removing an installed model.
- Clearing saved AI conversation history.

Model files are not included in the Git repository.

### Shake-to-Switch Navigation

Omni-BGC includes a motion-based way to switch between the Map and Assistant screens.

A deliberate shake can switch screens when the device sensor is available.

The app also provides normal buttons, so shaking is not required.

The screen transition uses a sliding animation and respects the device's reduced-motion setting.

---

## Current Project Status

The following status reflects **M14 development, October 24, 2026**. The application is branded **The Fort**; Omni-BGC remains the repository/project name.

| Component                     | Status                      | Notes                                                 |
| ----------------------------- | --------------------------- | ----------------------------------------------------- |
| React Native application      | Implemented                 | Android-first application                             |
| Offline map rendering         | Implemented                 | Physical-device acceptance remains incomplete         |
| Flat and 2.5D map views       | Implemented                 | Uses local map styles and geometry                    |
| Place directory               | Implemented                 | Includes approved and candidate records               |
| Restaurant research           | Implemented                 | Partial menus and recorded prices                     |
| Office directory              | Implemented                 | Approved projections and separate research candidates |
| Directory search              | Implemented                 | Works without an installed AI model                   |
| AI conversation interface     | Implemented                 | Includes local history                                |
| Qwen3 0.6B / 1.7B catalog     | Implemented                 | 1.7B has limited historical phone observations; full acceptance pending |
| AI tool calling               | Implemented in code         | Needs full end-to-end evaluation                      |
| Model download and setup      | Implemented in code         | Large-file and device testing pending                 |
| Temporary itinerary preview   | Implemented                 | Does not save permanent itineraries                   |
| Walking navigation            | Not available               | Requires an approved pedestrian graph                 |
| Saved places and favorites UI | Not available               | Previous local records are retained                   |
| Live business information     | Not supported               | No real-time hours, prices, or availability           |
| iOS deployment                | Not validated               | Android is the current development target             |
| Focused regressions and CI    | Implemented in M14          | Host checks on PR/main; native build manually gated |

An implemented feature is not automatically considered tested or ready for public release.

---

## Technology Stack

Omni-BGC uses the following technologies.

| Technology            | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| React Native          | Build the mobile interface                         |
| Expo                  | Manage mobile development and native configuration |
| TypeScript            | Write the application logic                        |
| React                 | Build and manage UI components                     |
| MapLibre React Native | Display and interact with maps                     |
| PMTiles               | Store map tiles in compact local files             |
| SQLite                | Store local records and application data           |
| SQLite FTS5           | Support text searching                             |
| SQLite RTree          | Support geographic indexing                        |
| Kotlin                | Connect the Android application to native AI       |
| LiteRT-LM             | Run supported AI models on the device              |
| Qwen3 0.6B / 1.7B      | Optional local language model catalog               |
| Expo FileSystem       | Manage local resources and downloads               |
| Expo Sensors          | Detect device movement                             |
| Expo Location         | Provide optional location APIs and permissions     |

### Current Main Versions

| Package               | Version |
| --------------------- | ------- |
| Expo                  | 57.0.27 |
| React Native          | 0.86.3  |
| React                 | 19.2.3  |
| TypeScript            | 6.0.3   |
| MapLibre React Native | 11.5.0  |
| Expo SQLite           | 57.0.4  |
| LiteRT-LM Android     | 0.18.0  |

These versions come from the current repository files.

The application identity comes from `app.json`. This is an internal development preview, not a public release.

| Configuration | Value |
| --- | --- |
| Application version | 0.5.0 |
| Android package | com.omnibgc.preview |
| Android versionCode | 4 |

---

## How the App Works

Omni-BGC has two main screens: **Map** and **Assistant**.

### Map Screen

The Map screen lets users explore places visually.

It loads the available local map resources and places markers on the map.

Users can search for places, apply category filters, and open a place's information panel.

### Assistant Screen

The Assistant screen accepts questions written in everyday language.

It uses one of two approaches.

**Explicit supported requests, with or without a model:**

Deterministic handlers parse place/menu searches, exact PHP bounds and named details. Supported compound actions and current-result references use bounded host tools. The host revalidates source records and canonical identities before rendering or focusing the map. Ambiguous results require selection.

**Ambiguous interpretation with a ready local model:**

The optional model may propose allowlisted local tools. Application code validates arguments, source eligibility, exact arithmetic and state changes, then composes factual answers from current records. Free-form model text is not a source of business facts. Useful validated reads can survive an incomplete follow-up.

The model cannot directly change the database, run shell commands, access arbitrary files or introduce remote inference. Unsupported capabilities remain unavailable. Without a ready model, deterministic discovery remains usable.

### Basic Application Flow

```text
Question → capability/source checks → explicit supported intent?
                                      ├─ yes → deterministic local tools
                                      └─ no  → optional ready model proposes tools
                                             or model-off fallback
Both paths → validate arguments → retrieve → re-read sources → host answer
```

The main idea is that the map, directory, and Assistant share local information.

---

## Project Structure

The Expo application is located at the **repository root**.

This is a single mobile application repository, not a multi-package workspace.

```text
omni-bgc/
|
|-- App.tsx
|-- index.ts
|-- app.json
|-- package.json
|-- package-lock.json
|-- metro.config.js
|-- tsconfig.json
|-- eslint.config.mjs
|
|-- assets/
|   |-- brand/
|   |-- fonts/
|   `-- generated/
|       |-- directory/
|       |-- food-research/
|       |-- offices/
|       |-- gex/
|       `-- omni/
|
|-- config/
|   `-- map/
|
|-- modules/
|   `-- omni-local-ai/
|       |-- android/
|       |-- expo-module.config.json
|       `-- index.ts
|
|-- plugins/
|   |-- withLocalAi.cjs
|   `-- withOfflinePilot.cjs
|
`-- src/
    |-- ai/
    |-- app/
    |-- data/
    |-- domain/
    |-- features/
    |   |-- assistant/
    |   |-- explore/
    |   |-- food/
    |   `-- offices/
    |-- map/
    |-- routing/
    |-- ui/
    `-- updates/
```

### Main Folders Explained

| Folder                   | What it contains                                        |
| ------------------------ | ------------------------------------------------------- |
| `assets/`                | Fonts, icons, and bundled local data                    |
| `config/map/`            | Map inventory and approval records                      |
| `modules/omni-local-ai/` | Custom native Android AI module                         |
| `plugins/`               | Expo plugins for native setup and offline resources     |
| `src/ai/`                | AI model, tools, and conversation logic                 |
| `src/app/`               | Application setup and main navigation                   |
| `src/data/`              | SQLite, data queries, and validation                    |
| `src/domain/`            | Shared rules for prices and other data                  |
| `src/features/`          | Assistant, explorer, food, and office features          |
| `src/map/`               | Map renderer, map styles, and resource loading          |
| `src/routing/`           | Walking route engine and graph handling                 |
| `src/ui/`                | Shared UI components, animations, and sensor navigation |
| `src/updates/`           | Offline content downloads, validation, and rollback     |

### Important Files

- `src/app/Application.tsx` — Main application screen and layout.
- `src/map/MapCanvas.tsx` — Map rendering and interaction.
- `src/ai/AgentOrchestrator.ts` — Manages AI requests and tool calls.
- `src/ai/NativeLiteRtProvider.ts` — Connects TypeScript to native inference.
- `src/ai/modelCatalog.ts` — Lists the selected AI model and its metadata.
- `src/ai/modelManager.ts` — Handles AI model installation and activation.
- `src/data/store.ts` — Reads and manages local SQLite records.
- `src/updates/index.ts` — Manages reviewed content packs.
- `src/features/explore/directory.ts` — Combines available directory records for browsing.

The older repository structure, including `apps/mobile/` and `packages/`, is no longer used in the current branch.

---

## Getting Started

### Requirements

Before running the project, install:

1. Git.
2. Node.js and npm.
3. Android Studio.
4. The Android SDK and a compatible JDK.
5. An Android emulator or physical Android device.

Node.js 22 is the recommended version for the existing development setup.

An ARM64 Android device is required for the selected local AI model configuration.

**Important:** Omni-BGC uses native Android modules. The full application cannot run inside Expo Go. Use an Expo development build instead.

### Step 1: Clone the Repository

Open a terminal and run:

```bash
git clone https://github.com/supertaku/omni-bgc.git
cd omni-bgc
```

### Step 2: Install Dependencies

Install the dependencies using the committed lockfile.

```bash
npm ci
```

Run this command from the repository root.

### Step 3: Check the Project

Run the TypeScript checker.

```bash
npm run typecheck
```

Run ESLint.

```bash
npm run lint
```

To check formatting without changing files:

```bash
npx prettier --check App.tsx index.ts src modules/omni-local-ai/index.ts plugins app.json metro.config.js package.json tsconfig.json eslint.config.mjs
```

These checks verify source code and formatting. They do not prove that the Android application will build or work correctly on a phone.

### Step 4: Build the Android Application

Make sure the Android SDK is configured and an emulator or authorized Android device is available.

Run:

```bash
npm run android
```

This uses Expo to prepare and compile the Android application.

The command may generate an `android/` directory. This folder is ignored by Git because native files are generated from the Expo configuration.

You can also generate the Android project separately:

```bash
npm run prebuild
```

Use the normal Expo build process when native dependencies or configuration change.

### Step 5: Start the Development Server

After installing the development build, start the project with:

```bash
npm run start
```

The current start script uses a local development server with `--localhost`.

If you are using a physical Android device over USB, you may need Android Debug Bridge port forwarding:

```bash
adb reverse tcp:8081 tcp:8081
```

Only enable USB debugging and authorize the computer when you intend to use an Android debugging connection.

### Step 6: Open the Application

Launch the installed Omni-BGC development build.

The application should prepare its local storage and map resources.

The directory and map do not require an AI model to be installed.

**Note:** These are the intended development commands from the repository. A clean installation and successful build on a new machine still need independent verification.

---

## How to Use Omni-BGC

### Explore the Map

1. Open the application.
2. Drag the map to explore the city.
3. Pinch to zoom in or out.
4. Select a place marker to see its details.
5. Use the map view control to switch between flat and 2.5D views.

### Search for a Place

1. Tap the search field.
2. Enter a restaurant, building, office, shop, or category.
3. Review the matching results.
4. Select a result to open its information.

Search results depend on the records available locally.

### Filter Results

Use the category controls to filter the visible directory.

The main map shortcuts include:

- All
- Food
- Coffee
- Shops

More categories are available through the filters panel.

### Open the Assistant

Tap the Assistant button on the map.

You can also use the shake gesture on devices where the sensor is supported and the gesture is enabled.

Ask a question about a place, business, or recorded menu item.

If the AI model is unavailable, the application uses its supported local search functions instead.

### View Sources

Some details include information about where the data came from.

Always check whether a record is approved, a research listing, stale, or a fictional sample.

---

## Offline AI Assistant

Omni-BGC uses an optional on-device language model.

Unlike a cloud chatbot, an on-device model runs using the phone's own hardware.

This means the app does not need to send each AI question to a remote model server.

### Available Models: Qwen3

The selectable catalog contains two pinned LiteRT-LM artifacts. CPU is the default; the default context remains 2,048 tokens. Backend experiments require explicit diagnostic configuration and do not establish GPU performance.

| Model | Artifact bytes |
| --- | ---: |
| Qwen3 0.6B | 344671744 |
| Qwen3 1.7B | 977184032 |

Both are dynamic INT4 models with FP32 activations, published by `litert-community` from Qwen base models under Apache 2.0. Android support is `arm64-v8a`, using LiteRT-LM 0.18.0. Each artifact has its own pinned revision, size and SHA-256 in `src/ai/modelCatalog.ts`.

Catalog availability does not mean downloaded, activated or device-accepted. Files are separately acquired and checksum-verified; activation runs native checks. No model weights ship in the app or download at startup. Legacy Gemma identity is retained only to retire saved pointers safely; it is no longer selectable and its historical files are not silently deleted.

[Historical owner-authorized tests](docs/device-validation-v050.md) observed Qwen3 1.7B activation, ordinary generated chat and selected local tool cases. Complex CPU cases took **39.910–78.172 seconds**; a coffee/details request returned search cards without its requested separate detail action. These are individual historical observations, not new M14 benchmarks, latency percentiles or universal quality acceptance. The owner's 0.6B download was removed at their request; 1.7B remained active at that historical handoff. Current device state is not inferred from repository metadata.

M14 host fixtures check routing, identity and bounded execution. Physical-device speed, repeated cancellation, GPU behavior, memory, thermals and broad response quality still need a separately authorized validation stage. Conversation reuse remains disabled pending native safety validation.

### How to Set Up the Model

1. Open the Assistant screen.
2. Open the Models page.
3. Select **Download model**.
4. Confirm the download.
5. Allow the application to verify the downloaded file.
6. When the model is ready for setup, select **Use this model**.
7. The application runs its model activation checks before using the model.

An internet connection is needed for an explicit initial download. Reserve space for the selected artifact plus verification/staging overhead; import and use of an existing verified file are also supported.

Once installed and successfully activated, the model is intended to run without an internet connection.

### How the AI Answers Questions

The AI does not have unrestricted access to application data.

Instead, it can request a small set of local tools.

For example, “Find ramen under 300 pesos” uses deterministic exact-PHP menu filtering without an inference call. More ambiguous requests may use the local model to propose tools.

The application, not the language model, decides whether a tool request is allowed.

It also checks important conditions such as price limits and source approval.

### Available AI Tools

The current tool system supports these operations:

| Tool                        | Purpose                                |
| --------------------------- | -------------------------------------- |
| `find_places`               | Search approved place records          |
| `get_place_details`         | Read a place's details                 |
| `search_preview_directory` | Search the separately gated preview overlay |
| `get_preview_place_details` | Read canonical preview details |
| `get_verified_entrances`    | Read verified entrance records         |
| `find_menu_items`           | Search approved menu items             |
| `search_food_research`      | Search recorded restaurant research    |
| `get_food_research_details` | Read research details for a restaurant |
| `find_approved_offices`     | Find approved office records           |
| `get_office_details`        | Read approved office details           |
| `focus_map_place`           | Focus the map on a supported place     |
| `get_itinerary_preview`     | Read a temporary visit list            |
| `preview_itinerary_change`  | Change a temporary visit-list preview  |

Not every tool is available for every question.

The application limits tool access based on the user's request.

### AI Safety and Reliability

The AI system is designed with several restrictions.

- It must not invent prices, coordinates, or business facts.
- It must not describe old research prices as live prices.
- It must not invent walking routes or travel times.
- It cannot execute arbitrary database commands.
- It cannot run shell commands.
- It cannot access arbitrary network services.
- It cannot make permanent changes to saved places through its current tool list.
- It must use locally available records when answering factual BGC questions.

The current agent is limited to two tool rounds and four tool calls per request.

These controls reduce unnecessary work and help keep local inference manageable.

**Important:** Safety rules and source validation reduce errors, but they do not guarantee that every model response will be correct.

Physical-device and response-quality testing are still required.

### AI Conversation History

AI conversation history is stored locally using SQLite.

The application keeps a limited number of messages rather than an unlimited history.

Temporary actions are not restored as active actions when the application restarts.

Users can clear conversation history from the Models page.

---

## Maps and Local Data

### Offline Map Resources

Omni-BGC uses local map resources instead of depending on live map tile requests during normal offline exploration.

The repository contains two bundled map sets.

| Map set | Purpose                                  |
| ------- | ---------------------------------------- |
| `omni`  | Smaller pilot map and recovery resources |
| `gex`   | Expanded internal map preview            |

The currently selected map is `commercial-v2`, which uses the `gex` assets.

It includes roads, paths, buildings, other mapped features, and selected labels.

These resources are for internal research and engineering review.

They are not approved for public distribution or pedestrian navigation.

### Current Research Data

The preview builder retains the original research inputs and explicit same-branch crosswalks. Current generated coverage:

| Dataset | Recorded amount |
| --- | ---: |
| Canonical preview places | 609 |
| Restaurants/cafés with menus | 335 |
| Preview menu items | 3518 |
| Original retained menu items | 1279 |
| Internally generated menu items | 2239 |
| Original directory points | 161 |
| Original restaurant research listings | 278 |
| Original office research candidates | 179 |

The **2,239 internally generated items are not verified venue menus**. Preview descriptions, illustrative images and estimated amounts do not establish current availability, pricing, source rights or business approval. Strict source queries preserve their evidence gates. Fictional samples remain separate.

See [preview coverage](assets/generated/preview/COVERAGE.md), [individual exceptions](assets/generated/preview/exceptions.json) and [rebuild/rights limits](docs/OFFLINE-PREVIEW.md).

### Geographic Precision

Coordinate quality and business review are separate. A recorded place point retains its source evidence; a reviewed building association establishes a relationship; a derived building anchor is a representative polygon point, **not a verified establishment entrance**. Unresolved records remain searchable and readable without inventing coordinates or moving the map camera. Existing recorded coordinates and canonical IDs are preserved.

The generated [coverage report](assets/generated/preview/COVERAGE.md) records the current counts, unresolved identities and evidence limitations. The visual map extent does not enlarge business approval or routing scope. [Map coverage](docs/map-coverage.md) describes pinned OSM sources, both unchanged original packs and additive display context.

| Geographic measure | Count |
| --- | ---: |
| Recorded place points | 161 |
| Derived building anchors | 362 |
| Unresolved preview identities | 86 |

M14 resolves 27 previously unlocated records through fourteen explicit building associations against retained polygons, including seven branch-specific source addresses. The 86 remaining identities include two ambiguous polygon matches, 11 without a building claim and 73 without matching retained geometry. The stable [machine-readable quality report](assets/generated/preview/quality.json) retains individual reasons, lineage, evidence-age policy and source-rights limits. No candidate becomes approved through this mapping.

### How Data Is Classified

Omni-BGC separates information based on its source and review status.

**Approved records**

These records have passed the application's required review checks and can be used by functions that need approved information.

**Research candidates**

These are collected records that still need verification.

They may help users explore recorded information, but should not be presented as fully verified facts.

**Stale records**

These contain information that may no longer be current or has passed its validity period.

**Fictional samples**

These are made-up places and menus used to demonstrate the interface.

They do not represent real BGC businesses.

### Data Verification

The data system is designed to track information such as:

- Source identity.
- Original source reference.
- Recorded observation date.
- Review status.
- Source and file checksums.
- Geographic coordinates.
- Data validity period.
- Source license and permitted use.

For approved content packs, the application checks file integrity, required metadata, and dependencies before activation.

### Content Pack Updates

The repository contains software for managing reviewed offline content packs.

The system is designed to support:

1. Explicitly requested downloads.
2. File checksum verification.
3. Validation before activation.
4. Keeping previous valid content where supported.
5. Rollback to a previous valid pack.

However, the current reviewed download catalog is empty.

This means the repository does not currently offer new approved downloadable content packs through that catalog.

Bundled preview assets are separate from reviewed downloadable content packs.

---

## Privacy and Offline Support

Privacy and offline operation are important goals of Omni-BGC.

### What Can Work Offline?

The intended offline functions include:

- Opening bundled map resources.
- Exploring available local places.
- Searching the local directory.
- Reading stored business and menu information.
- Using supported deterministic Assistant searches.
- Reading local conversation history.
- Running the local AI model after successful installation.

Some features may be unavailable if required local records have not been installed or validated.

### When Is Internet Needed?

An internet connection may be needed to:

- Download the local AI model.
- Download future reviewed content packs.
- Open external source or license links.
- Install project dependencies during development.

Ordinary on-device AI generation is designed not to use a remote inference service.

### Location Permissions

The application includes optional foreground location permissions in its configuration.

Users should be able to explore the bundled map without granting location access.

The current application does not provide full live GPS walking navigation.

Precise location data must not be uploaded to external services as part of the offline map experience.

### Local Storage

The application uses local device storage for:

- Application settings.
- Existing saved-state records.
- Conversation history.
- Installed model files.
- Downloaded content and map resources.

The currently disabled saved-place interface does not mean historical saved data has been deleted.

The application is designed to retain existing local records rather than remove them during an unrelated migration or recovery.

---

## Development and Testing

### Available Commands

Run commands from the repository root.

| Command             | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `npm ci`            | Install dependencies from the lockfile          |
| `npm run start`     | Start the local Expo development server         |
| `npm run android`   | Build and run the Android application           |
| `npm run prebuild`  | Generate the native Android project             |
| `npm run typecheck` | Check TypeScript errors                         |
| `npm run lint`      | Run ESLint                                      |
| `npm run format`    | Format supported source and configuration files |

**Note:** `npm run format` changes files. Review changes before committing.

M14 adds `npm run check:host` to execute existing focused regressions, plus a documentation consistency check (`node scripts/check-docs.cjs`). TypeScript and ESLint remain separate required gates. Python geometry checks use the pinned build-only dependencies in `scripts/map-requirements.txt`.

[Host CI](.github/workflows/host-checks.yml) runs on pull requests and main-branch changes. [Android release verification](.github/workflows/android-release.yml) is manually triggered and requires a clean identifiable source revision. It uses standard Expo prebuild and Gradle, then verifies package/version/permissions, ARM64 native libraries, Hermes/source maps, resources, signer and SHA-256. Restricted APKs are not automatically published or uploaded.

[Build controls and provenance](docs/M14-BUILD.md) explain the toolchain and reproducibility limits. Delivery APKs use increasing sequence numbers in `apks/`, with SHA-256 sidecars and [reviewable receipts](apks/INDEX.md). A release variant may use the preview debug/test signer; it does not imply production signing or device acceptance. Byte-identical reproducibility is claimed only when independently demonstrated.

### Recommended Development Checks

After making changes:

1. Run the TypeScript checker.
2. Run ESLint.
3. Check formatting.
4. Build the Android application if native code or configuration changed.
5. Test affected features on an emulator or physical device.
6. Check that offline features work with internet access disabled.
7. Make sure existing local data is not lost.
8. Review source permissions before adding research data.

### Important Testing Areas

**Map testing**

Check initial map loading, zooming, panning, place selection, map coverage, and recovery from damaged resources.

**Directory testing**

Check search results, filters, source status, menu price filtering, and missing or expired information.

**AI testing**

Check model installation, generation, tool calls, grounding, cancellation, and recovery after failure.

**Storage testing**

Check first launch, migration, database integrity, application restart, and interrupted downloads.

**Performance testing**

Measure startup time, memory use, map responsiveness, AI response time, and device temperature.

A successful TypeScript check or Android compilation does not prove that all of these behaviors work.

---

## Known Limitations

Omni-BGC is still under development.

### 1. Incomplete Geographic Coverage

The map does not cover every place in BGC with the same level of detail.

Some paths, buildings, labels, and location records still need verification.

The current map also contains illustrative visual elements.

### 2. Walking Navigation Is Unavailable

The repository contains a walking route engine, but the application does not currently provide walking directions.

Before navigation can be enabled, the pedestrian graph needs a separate review of connected paths, entrances, crossings, and permitted access.

### 3. No Live Business Updates

The application does not currently verify live opening status, restaurant availability, traffic, reviews, or changing prices.

Recorded information should not be mistaken for real-time data.

### 4. Partial Restaurant Menus

Many restaurant records have incomplete menus.

Some menu prices are estimates or come from research sources that may not reflect the current branch.

### 5. AI Device Testing Is Incomplete

The Qwen3 catalog and native integration are implemented. Limited Qwen3 1.7B historical checks are documented above; full M14 acceptance on the intended Android device is pending.

This includes:

- Successful model loading.
- Actual text generation.
- Reliable tool calling.
- Safe cancellation.
- Memory and thermal behavior.
- Performance measurement.
- Recovery after errors.

### 6. Android-First Development

The main native AI implementation is written for Android.

The project contains iOS configuration, but iOS offline installation and local AI functionality are not yet validated.

### 7. Saved Features Are Disabled

The current interface does not provide persistent favorites or saved itinerary editing.

The Assistant supports temporary itinerary previews only.

### 8. Public Release Is Not Authorized

Some bundled research and map resources are marked for internal use only.

Their presence in the repository does not grant permission to redistribute them.

A separate data-rights and release review is needed before sharing an application package publicly.

---

## Development Priorities

The following are suggested next priorities based on the current implementation. They are not completed features or promised release dates.

### Priority 1 — Reliable Android Builds

- Maintain the focused host regressions and CI.
- Exercise the controlled native build workflow after authorized pushes.
- Keep build steps reproducible.
- Verify the app from a clean checkout.
- Check native dependency compatibility.

### Priority 2 — Complete Local AI Testing

- Validate the M14 APK and Qwen3 models on a physical Android device in a separately authorized stage.
- Measure response speed and memory usage.
- Validate tool calls against expected results.
- Test cancellation and model reloading.
- Improve fallback behavior when AI inference fails.

### Priority 3 — Improve Data Quality

- Verify business identities and locations.
- Review restaurant menu sources.
- Validate available office records.
- Remove outdated or unsupported claims.
- Keep research information separate from approved facts.

### Priority 4 — Improve the Offline Experience

- Test the application without internet access.
- Improve map resource loading.
- Reduce unnecessary storage and memory use.
- Make source status easier to understand.
- Improve search and Assistant usability.

### Priority 5 — Future Navigation

- Prepare a verified pedestrian network.
- Review crossings and legal walking access.
- Validate walking entrances.
- Test route accuracy before enabling directions.

### Priority 6 — Release Preparation

- Complete data-rights reviews.
- Establish a clear project license.
- Add release and regression tests.
- Validate supported devices.
- Prepare public distribution only after the required approvals.

---

## Credits, Sources, and Licenses

Omni-BGC uses open-source technologies and research-based geographic information.

### OpenStreetMap

Some geographic records and map resources are derived from OpenStreetMap.

**Map data © OpenStreetMap contributors**

OpenStreetMap data is available under the Open Database License (ODbL).

For more information:

- [OpenStreetMap Copyright and License](https://www.openstreetmap.org/copyright)
- [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)

The application must keep required map attribution visible.

Do not bulk-download or package the OpenStreetMap Foundation's public raster tiles for offline use. Offline map resources must come from sources that permit that use.

### MapLibre

Map rendering uses MapLibre React Native.

- [MapLibre](https://maplibre.org/)
- [MapLibre React Native](https://maplibre.org/maplibre-react-native/)

### Expo and React Native

The mobile application is built using:

- [Expo](https://expo.dev/)
- [React Native](https://reactnative.dev/)

### Qwen and LiteRT-LM

The optional current model catalog uses Qwen3 0.6B and 1.7B artifacts with LiteRT-LM.

- [Qwen3 0.6B artifact repository](https://huggingface.co/litert-community/Qwen3-0.6B)
- [Qwen3 1.7B artifact repository](https://huggingface.co/litert-community/Qwen3-1.7B)
- [Qwen3 Apache 2.0 license](https://huggingface.co/Qwen/Qwen3-1.7B/blob/main/LICENSE)
- [LiteRT-LM source and documentation](https://github.com/google-ai-edge/LiteRT-LM)

Preserve applicable upstream licenses, attribution and notices. Model redistribution still requires the project's separate release review. Historical Gemma records document earlier implementation work and do not describe the current selectable catalog.

### Research Data

Restaurant, office, and geographic research records may come from third-party sources.

These records are not automatically approved for public redistribution.

The project must respect the original sources, permissions, attribution requirements, and applicable licenses.

### Project License

**A repository-wide license has not yet been provided in the current repository.**

Public access to source code does not automatically grant permission to copy, modify, or redistribute all project code and data.

Third-party licenses also remain separate from the project's own license.

A root `LICENSE` file and a complete release-rights review should be added before public distribution.

---

## References

Official documentation used for the main technologies:

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo Custom Native Code](https://docs.expo.dev/workflow/customizing/)
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [MapLibre React Native Documentation](https://maplibre.org/maplibre-react-native/docs/)
- [LiteRT-LM Documentation and Source](https://github.com/google-ai-edge/LiteRT-LM)
- [OpenStreetMap Copyright](https://www.openstreetmap.org/copyright)

---

## Project Summary

**Omni-BGC is an offline-first mobile city explorer for Bonifacio Global City.**

It combines a stylized local map, a searchable directory, recorded business information, and an optional on-device AI assistant.

The project places importance on offline access, accurate geographic information, clear source records, privacy, and safe AI behavior.

Development currently focuses on completing and verifying the Android experience before expanding functionality or preparing a public release.

**Built to make exploring BGC simpler, smarter, and more accessible — even offline.**
