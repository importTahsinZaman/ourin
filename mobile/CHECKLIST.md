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

## Phase 2: Core Infrastructure

- [ ] **Storage adapter**
  - [ ] Create `src/lib/storage.ts` (AsyncStorage wrapper)
  - [ ] Migrate localStorage patterns to AsyncStorage

- [ ] **API client**
  - [ ] Create `src/lib/api.ts`
  - [ ] Chat streaming endpoint
  - [ ] Auth token handling

- [ ] **Convex Auth integration**
  - [ ] Switch to `ConvexAuthProvider` from `@convex-dev/auth/react-native`
  - [ ] Token storage with expo-secure-store
  - [ ] Auth state management

---

## Phase 3: Auth Flow

- [ ] **Anonymous auth**
  - [ ] Auto-create anonymous user on first launch
  - [ ] Store anonymous session

- [ ] **Email OTP login**
  - [ ] Login screen - email input + validation
  - [ ] Verify screen - OTP input + validation
  - [ ] Resend code functionality
  - [ ] Error handling

- [ ] **Account upgrade**
  - [ ] Link anonymous account to email
  - [ ] Preserve conversation history

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

**Completed:** Phase 1 (Infrastructure)
**Next:** Phase 2 (Core Infrastructure) → Phase 3 (Auth)
