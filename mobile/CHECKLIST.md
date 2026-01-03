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
  - [x] `useAnonymousAuth` hook for auto sign-in

- [x] **Tests**
  - [x] Vitest setup with path aliases
  - [x] Storage tests (35 tests)
  - [x] SecureStorage tests (18 tests)
  - [x] API/SSE parser tests (19 tests)

---

## Phase 3: Auth Flow ✅

- [x] **Anonymous auth**
  - [x] Auto-create anonymous user on first launch
  - [x] Store anonymous session via expo-secure-store

- [x] **Email OTP login**
  - [x] Login screen - email + password inputs, dark theme
  - [x] Verify screen - 8-digit OTP input, dark theme
  - [x] Resend code functionality with 60s cooldown
  - [x] Error handling + loading states

- [x] **Account upgrade**
  - [x] `useAccountUpgrade` hook with pending link flow
  - [x] `useAuth` hook for auth state
  - [x] Convex API path aliases for mobile

- [x] **UI Updates**
  - [x] Dark theme for all screens (matching Claude app)
  - [x] Settings screen with sign in option
  - [x] Chat/History screens with dark theme

---

## Phase 4: Chat Feature

- [ ] **Chat hook**
  - [ ] Port `useOurinChat.ts` for React Native
  - [ ] Streaming with fetch + ReadableStream
  - [ ] Message state management
  - [ ] Error handling + retry

- [ ] **Chat UI components**
  - [ ] `MessageList.tsx` - FlatList (inverted)
  - [ ] `MessageBubble.tsx` - render message parts
  - [ ] `ChatInput.tsx` - TextInput + send button
  - [ ] Loading/streaming indicators
  - [ ] Markdown rendering

- [ ] **Model selection**
  - [ ] Model picker (bottom sheet)
  - [ ] Model info display
  - [ ] Persist selection

---

## Phase 5: Conversations

- [ ] **History screen**
  - [ ] Conversation list from Convex
  - [ ] Pull to refresh
  - [ ] Empty state

- [ ] **Conversation actions**
  - [ ] Navigate to conversation detail
  - [ ] Swipe to delete
  - [ ] Rename conversation

- [ ] **New chat**
  - [ ] Create new conversation
  - [ ] Auto-generate title

---

## Phase 6: File Attachments

- [ ] **Image picker**
  - [ ] expo-image-picker integration
  - [ ] Image preview
  - [ ] Resize/compress before upload

- [ ] **Document picker**
  - [ ] expo-document-picker for PDFs
  - [ ] File type validation

- [ ] **Upload flow**
  - [ ] File hash for deduplication
  - [ ] Upload to Convex storage
  - [ ] Progress indicator
  - [ ] Error handling

---

## Phase 7: Settings

- [ ] **Account section**
  - [ ] User info display
  - [ ] Sign out
  - [ ] Delete account

- [ ] **Preferences**
  - [ ] Theme toggle (light/dark/system)
  - [ ] Default model selection

- [ ] **Cores management**
  - [ ] List cores
  - [ ] Create/edit/delete cores
  - [ ] Sync with Convex

- [ ] **BYOK (Bring Your Own Keys)**
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

**Completed:** Phase 1 (Infrastructure), Phase 2 (Core Infrastructure), Phase 3 (Auth Flow)
**Next:** Phase 4 (Chat Feature)
