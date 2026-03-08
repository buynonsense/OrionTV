# AGENTS.md

## Project Scope

- OrionTV is an Expo + React Native TVOS app for Apple TV, Android TV, and responsive mobile/tablet layouts.
- Treat this as a frontend-only TypeScript codebase with external API calls centralized in `services/`.
- Prefer minimal, surgical edits that match existing patterns instead of broad refactors.

## Source Of Truth

- Use `package.json` for runnable commands.
- Use `tsconfig.json` for TypeScript/compiler expectations.
- Use `.eslintrc.js` for linting baseline.
- Use `CLAUDE.md` for repository-specific architecture and workflow notes.
- There is currently no repository-local `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md`.

## Core Commands

- Install deps: `yarn`
- Start Metro in TV mode: `yarn start`
- Run on Android TV: `yarn android`
- Run on Apple TV: `yarn ios`
- Regenerate native projects after dependency/native config changes: `yarn prebuild`
- Copy TV Android config only: `yarn copy-config`
- Release Android build: `yarn build`
- Debug Android build: `yarn build-debug`
- Lint: `yarn lint`
- Type check: `yarn typecheck`
- Jest CI run: `yarn test-ci`
- Jest watch mode: `yarn test`
- Clean caches and Android build artifacts: `yarn clean`
- Reinstall modules: `yarn clean-modules`

## Single Test Commands

- Run one test file in CI mode: `yarn test-ci --runTestsByPath utils/__tests__/DeviceUtils.test.ts`
- Run one component test file: `yarn test-ci --runTestsByPath components/__tests__/ThemedText-test.tsx`
- Run tests by name: `yarn test-ci --runTestsByPath utils/__tests__/DeviceUtils.test.ts -t "应该在宽度 >= 1024 时返回 tv"`
- If you need plain Jest behavior without watch mode, prefer `yarn test-ci` plus extra Jest args over `yarn test`.
- `yarn test` uses `jest --watchAll`, so avoid it in non-interactive agent flows unless watch mode is explicitly desired.

## Expected Verification Flow

- For code changes, run `yarn lint` and `yarn typecheck` unless the change is strictly documentation-only.
- Run focused Jest tests for the touched area whenever a nearby test exists.
- If you change shared utilities, stores, or hooks, prefer both focused tests and a full `yarn test-ci` when practical.
- If you change native config or dependency wiring, consider `yarn prebuild` the relevant validation step.
- Do not claim success without actual command evidence.

## Architecture Map

- `app/`: Expo Router screens and layout entrypoints.
- `components/`: reusable UI, including platform variants like `.tv.tsx`, `.mobile.tsx`, `.tablet.tsx`.
- `stores/`: Zustand domain stores.
- `services/`: API, storage, remote control, update, and protocol logic.
- `hooks/`: reusable behavior like responsive layout and TV remote handling.
- `utils/`: utilities such as logging, device detection, and responsive style helpers.
- `constants/`: theme and config constants.

## Platform Expectations

- This is TV-first UI. Preserve focus management, remote navigation, and large-screen ergonomics.
- When adding UI, consider mobile/tablet/TV behavior explicitly.
- Reuse existing responsive helpers instead of hardcoding breakpoints repeatedly.
- Prefer platform variant files when behavior or layout differs materially by device class.

## Import Conventions

- Use the `@/*` path alias for project-root imports, as configured in `tsconfig.json`.
- Prefer absolute alias imports for app code like `@/stores/settingsStore` and `@/utils/Logger`.
- Keep React/React Native/external imports at the top, then internal alias imports.
- Follow the surrounding file's quote and spacing style; the repo is not fully uniform.
- Do not reformat unrelated imports just to normalize style.

## Formatting Conventions

- Match the local file's existing formatting exactly; some files use double quotes, others single quotes, and spacing is inconsistent.
- Existing code commonly uses semicolons; preserve them.
- Keep components and stores readable with one logical concern per block.
- Use `StyleSheet.create(...)` for React Native styles instead of large inline style objects when patterns already do so.
- Add comments sparingly; only explain non-obvious logic.

## TypeScript Rules

- `strict: true` is enabled. New code must satisfy strict typing.
- Prefer explicit interfaces/types for props, store state, API shapes, and helper parameters.
- Follow existing names such as `FooProps`, `FooState`, `ServerConfig`, `ApiConfigStatus`.
- Avoid introducing new `any`; the codebase has legacy `any` usage, but treat that as debt, not precedent.
- Do not use `@ts-ignore`, `@ts-expect-error`, or `eslint-disable` unless absolutely unavoidable and justified.
- Prefer `type` imports where the file already uses them, e.g. `import {Text, type TextProps}`.

## Naming Conventions

- Screen and component files use PascalCase or route names expected by Expo Router.
- Components are typically exported as `export const Name` or `export default function Name()`.
- Hooks are named `useXxx` and live in `hooks/`.
- Zustand stores commonly export `useXxxStore` hooks from files in `stores/`.
- Interfaces and types use PascalCase.
- Internal state setters/actions use verb-first camelCase names like `setShowControls`, `loadSettings`, `fetchServerConfig`.

## State Management Patterns

- Use Zustand `create<State>((set, get) => ({ ... }))` for stores.
- Keep store state, sync setters, and async actions together in the same store object.
- Read sibling store state with `otherStore.getState()` only when necessary and consistent with existing patterns.
- Preserve store action names and selector patterns when extending behavior.
- Do not move domain logic out of stores unless there is a strong existing pattern for it.

## Service Layer Patterns

- Keep network and persistence logic in `services/`, not in screen components.
- Define request/response interfaces near the service that owns them.
- Throw `Error` for unrecoverable service failures, especially around HTTP and filesystem actions.
- Keep API URL building and fetch wrappers centralized, following `services/api.ts`.
- Reuse existing managers like `SettingsManager`, `PlayRecordManager`, and `PlayerSettingsManager` instead of bypassing them.

## Error Handling And Logging

- Use `Logger.withTag('FeatureName')` at module scope for logs.
- In services, throw when callers need to react; in UI/store layers, catch, log, and surface via state or toast as appropriate.
- Avoid empty `catch` blocks.
- Preserve user-facing Chinese messages where existing code already uses Chinese text.
- Prefer actionable log messages with context such as source, id, URL, or attempt count.

## UI Patterns

- Reuse themed/responsive primitives before adding a brand-new control.
- Preserve TV focus behavior (`onFocus`, `onBlur`, `useTVEventHandler`, focusable sections).
- Check for existing responsive helpers in `useResponsiveLayout`, `DeviceUtils`, and `ResponsiveStyles` before inventing new sizing logic.
- Use platform variants (`.tv.tsx`, `.mobile.tsx`, `.tablet.tsx`) when interaction models differ.
- Keep accessibility and remote-control navigation in mind when editing buttons, lists, and modals.

## Testing Patterns

- Jest uses the `jest-expo` preset from `package.json`.
- Existing tests live under `__tests__/` and use Jest globals plus targeted mocks.
- Utility tests often mock `react-native` APIs directly, as seen in `utils/__tests__/DeviceUtils.test.ts`.
- Component tests use React test renderer patterns, as seen in `components/__tests__/ThemedText-test.tsx`.
- When adding tests, keep them focused and colocated with the module area they verify.

## Agent Working Rules

- Read the relevant file before editing it.
- Search for an existing implementation pattern before introducing a new approach.
- Prefer editing existing files over creating new ones.
- Keep changes minimal and scoped to the requested work.
- Do not add documentation files unless explicitly asked; this `AGENTS.md` exists because it was explicitly requested.
- Do not commit unless the user explicitly asks for a commit.

## Practical File References

- Commands come from `package.json`.
- TypeScript strictness and aliasing come from `tsconfig.json`.
- ESLint baseline comes from `.eslintrc.js`.
- Repo-specific architectural notes come from `CLAUDE.md`.
- Representative code patterns can be found in `app/_layout.tsx`, `components/StyledButton.tsx`, `hooks/useTVRemoteHandler.ts`, `services/api.ts`, `stores/settingsStore.ts`, `stores/playerStore.ts`, and `utils/Logger.ts`.
