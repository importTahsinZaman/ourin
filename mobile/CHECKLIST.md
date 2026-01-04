# Mobile App Implementation Checklist

## Phase 1: Infrastructure ✅

- [x] Monorepo setup with bun workspaces
- [x] `@ourin/shared` package (types, models, pricing, utils)
- [x] Expo SDK 54 + React 19
- [x] Metro config for monorepo
- [x] Convex provider (basic)
- [x] Environment variables (.env.local)
- [x] Navigation structure (tabs + modals)
- [x] Vercel build config for web
- [x] API versioning middleware

---

## Phase 2: Core Infrastructure ✅

- [x] **Storage adapter**
  - [x] Create `src/lib/storage.ts` (AsyncStorage wrapper)
  - [x] Draft storage utilities
  - [x] Model/theme preferences storage

- [x] **Secure storage**
  - [x] Create `src/lib/secureStorage.ts` (expo-secure-store)
  - [x] Token storage for Convex Auth
  - [x] API key storage (BYOK)

- [x] **API client**
  - [x] Create `src/lib/api.ts`
  - [x] Chat streaming with SSE parsing
  - [x] Title generation endpoint
  - [x] Billing config endpoint
  - [x] Error handling with typed errors

- [x] **Convex Auth integration**
  - [x] Switch to `ConvexAuthProvider` from `@convex-dev/auth/react`
  - [x] Token storage with expo-secure-store
  - [x] URL replacement for OAuth flows

- [x] **Tests**
  - [x] Vitest setup with path aliases
  - [x] Storage tests (35 tests)
  - [x] SecureStorage tests (18 tests)
  - [x] API/SSE parser tests (19 tests)

---

## Phase 3: Auth Flow ✅

- [x] **Auth gating**
  - [x] All screens gated behind authentication (no anonymous auth)
  - [x] Root layout redirects to login if not authenticated
  - [x] Automatic redirect to main app after login

- [x] **Sign In flow**
  - [x] Email + password inputs
  - [x] Error handling + loading states
  - [x] Toggle to sign up mode

- [x] **Multi-step Sign Up flow** (matches web)
  - [x] Step 1: First Name + Last Name + Email
  - [x] Step 2: Password + Confirm Password with validation
    - [x] 8+ characters
    - [x] Lowercase letter
    - [x] Uppercase letter
    - [x] Number
    - [x] Symbol
    - [x] Passwords match
    - [x] Dynamic validation colors (green/red)
  - [x] Step 3: 8-digit OTP verification
    - [x] Resend code with 60s cooldown
    - [x] Error handling

- [x] **Auth infrastructure**
  - [x] `useAuth` hook for auth state
  - [x] Convex API path aliases for mobile
  - [x] Sign out functionality

- [x] **UI Updates**
  - [x] Dark theme for all screens (matching Claude app)
  - [x] Settings screen with user email + sign out
  - [x] Chat/History screens with dark theme

---

## Phase 4: Chat Feature ✅

- [x] **Chat hook**
  - [x] Port `useOurinChat.ts` for React Native
  - [x] Streaming with SSE via existing api.ts streamChat
  - [x] Message state management
  - [x] Error handling with Alert
  - [x] sendMessage, stop, regenerate functions
  - [x] 250ms DB persistence for crash recovery

- [x] **Chat UI components**
  - [x] `MessageList.tsx` - FlatList with auto-scroll
  - [x] `MessageBubble.tsx` - render message parts
    - [x] TextPart with markdown
    - [x] ReasoningPart (collapsible thinking blocks)
    - [x] FilePart (images and documents)
    - [x] ToolInvocationPart
    - [x] SourcesPart (web search results)
  - [x] `ChatInput.tsx` - TextInput + send/stop button
  - [x] Streaming cursor indicator
  - [x] Markdown rendering (react-native-markdown-display)

- [x] **Model selection**
  - [x] Model picker (modal)
  - [x] Model info display
  - [x] Core picker (modal)

- [x] **Advanced features**
  - [x] Web search toggle (for supported models)
  - [x] Reasoning level picker (for reasoning models)
  - [x] Effort-based reasoning (low/medium/high)
  - [x] Budget-based reasoning (token presets)

---

## Phase 5: Conversations ✅

- [x] **History screen**
  - [x] Conversation list from Convex
  - [x] Pull to refresh
  - [x] Empty state
  - [x] Search filtering

- [x] **Conversation actions**
  - [x] Navigate to conversation detail
  - [x] Long-press to delete (with iOS ActionSheet)
  - [x] Favorite indicator

- [x] **New chat**
  - [x] New chat button in header
  - [x] Auto-generate title (existing)

---

## Phase 6: File Attachments ✅

- [x] **Image picker**
  - [x] expo-image-picker integration
  - [x] Camera (take photo)
  - [x] Photo library (pick image)
  - [x] Image preview

- [x] **Document picker**
  - [x] expo-document-picker for PDFs
  - [x] File type validation (PDF, text, markdown)

- [x] **Upload flow**
  - [x] File hash for deduplication (SHA-256)
  - [x] Upload to Convex storage
  - [x] Progress/loading indicator
  - [x] Error handling with overlay
  - [x] Remove file button

- [x] **Chat integration**
  - [x] File parts passed to sendMessage
  - [x] ActionSheet for attachment options (iOS)
  - [x] Alert fallback for Android

---

## Phase 7: Settings ✅

- [x] **Account section**
  - [x] User info display (email)
  - [x] Sign out functionality

- [x] **Usage display**
  - [x] Monthly credits progress bar
  - [x] Credits remaining / total
  - [x] Period dates display
  - [x] Purchased credits section
  - [x] Self-hosting mode (token usage stats)

- [x] **Theming system**
  - [x] ThemeProvider with context
  - [x] 54 built-in themes (29 light, 25 dark)
  - [x] Theme picker modal with grid layout
  - [x] Color swatches preview
  - [x] Custom theme support infrastructure
  - [x] AsyncStorage persistence

- [x] **Font selection**
  - [x] Font picker modal
  - [x] 10 font options from @ourin/core
  - [x] Persistence with AsyncStorage

- [x] **App-wide theming**
  - [x] Color utility functions (getDerivedColors)
  - [x] 15+ derived color variants from 3 base colors
  - [x] Root layout theming
  - [x] Chat screen theming
  - [x] Sidebar theming
  - [x] ChatInput theming
  - [x] MessageBubble theming (with dynamic markdown styles)
  - [x] All modals theming (Model, Core, Reasoning, Theme, Font)
  - [x] Settings screen theming
  - [x] UsageCard theming

- [ ] **BYOK (Bring Your Own Keys)** - Deferred
  - [ ] API key input for each provider
  - [ ] Secure storage with expo-secure-store
  - [ ] Validate keys

---

## Phase 8: Billing

- [ ] **Subscription**
  - [ ] Show current tier/credits
  - [ ] Open Stripe checkout via expo-web-browser
  - [ ] Handle success/cancel redirects

- [ ] **Credit packs**
  - [ ] Purchase flow
  - [ ] Credit balance display

---

## Phase 9: Platform Polish

- [ ] **iOS**
  - [ ] Safe area handling
  - [ ] Keyboard avoiding view
  - [ ] Haptic feedback (expo-haptics)
  - [ ] App icon + splash screen

- [ ] **Android**
  - [ ] Back button handling
  - [ ] Status bar styling
  - [ ] Adaptive icon

- [ ] **Both platforms**
  - [ ] Loading states
  - [ ] Error boundaries
  - [ ] Offline handling

---

## Phase 10: Push Notifications

- [ ] expo-notifications setup
- [ ] Permission request flow
- [ ] Register device token with Convex
- [ ] Handle notification tap (deep link)

---

## Phase 11: Deep Linking

- [ ] Configure `ourin://` scheme in app.json
- [ ] Handle `ourin://c/[id]` URLs
- [ ] Universal links (iOS) / App Links (Android)

---

## Phase 12: App Store Submission

- [ ] **Assets**
  - [ ] App icon (1024x1024)
  - [ ] Screenshots for all device sizes
  - [ ] App preview video (optional)

- [ ] **Metadata**
  - [ ] App description
  - [ ] Keywords
  - [ ] Privacy policy URL
  - [ ] Support URL

- [ ] **Build & Submit**
  - [ ] EAS Build setup
  - [ ] TestFlight / Internal testing
  - [ ] Production release

---

## Current Status

**Completed:** Phase 1-7 (Infrastructure, Core Infrastructure, Auth Flow, Chat Feature, Conversations, File Attachments, Settings)
**Next:** Phase 8 (Billing)
