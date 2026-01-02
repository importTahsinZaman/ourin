# AGENTS.md

This file provides guidance on how to work with the Ourin repository.

## Project Overview

Ourin is an AI chat application with multi-provider LLM support, built with Next.js 16, React 19, and Convex as the backend. It uses a Bun + Turbo monorepo structure with a shared core package.

**Key Features:**

- Multi-provider AI chat (Anthropic, OpenAI, Google)
- Streaming responses with reasoning model support
- Subscription billing via Stripe (production mode)
- Self-hosting mode with no restrictions (default)
- Custom theming system
- System prompt library ("Cores")
- File attachments with deduplication

## General Guidelines

- Always use **bun** as the package manager (not npm/yarn/pnpm)
- Run commands from the `/web` directory for web-specific tasks
- Use `turbo` commands from root for monorepo-wide operations
- Convex functions live in `/web/convex/` - run `bun run dev:convex` separately
- Never hardcode API keys - use environment variables
- Prefer editing existing files over creating new ones
- Use CSS variables for colors, never hardcode hex values in components

## Essential Commands

### Development

```bash
# Start everything (from root)
bun run dev

# Start only web app
bun run dev:web

# Start Convex backend (separate terminal)
bun run dev:convex
```

### Building

```bash
# Build all packages
bun run build

# Build outputs to .next/ and packages/core/dist/
```

### Testing

```bash
# From /web directory:
bun run test              # Watch mode
bun run test:run          # Single run
bun run test:coverage     # With coverage report
```

**Test file locations:**

- `/web/__tests__/` - Frontend/API tests
- `/web/convex/__tests__/` - Convex backend tests

### Code Quality

```bash
# Lint (from root or /web)
bun run lint

# Auto-fix linting issues
bun run lint:fix

# Format code with Prettier
bun run format

# Check formatting without making changes
bun run format:check
```

**Linting & Formatting:**

- ESLint with TypeScript, React, and Next.js plugins
- Prettier for consistent code formatting
- Both tools are configured at root and package level
- Run `lint:fix` and `format` before committing
- Aways write comments in lowercase

### Pricing Generation

When modifying `/web/lib/models.ts`, pricing is auto-regenerated via pre-commit hook:

```bash
bun run generate:pricing
```

## Architecture Overview

### Directory Structure

```
ourin/
├── web/                          # Main Next.js application
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API routes (chat, stripe, keys)
│   │   ├── c/[id]/               # Conversation pages
│   │   ├── layout.tsx            # Root layout with providers
│   │   └── page.tsx              # Home page
│   ├── components/               # React components by feature
│   │   ├── chat/                 # Chat UI (MessageList, ChatArea, etc.)
│   │   ├── providers/            # Context providers
│   │   ├── settings/             # Settings modal
│   │   ├── sidebar/              # Sidebar components
│   │   └── ui/                   # Shared primitives
│   ├── convex/                   # Convex backend
│   │   ├── schema.ts             # Database schema
│   │   ├── messages.ts           # Message mutations/queries
│   │   ├── conversations.ts      # Conversation management
│   │   ├── billing.ts            # Credit/subscription logic
│   │   └── __tests__/            # Convex tests
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utilities and helpers
│   ├── contexts/                 # React Context definitions
│   └── types/                    # TypeScript types
└── packages/
    └── core/                     # Shared @ourin/core package
        └── src/
            ├── theme/            # Theme utilities
            └── types/            # Shared types
```

### Key Files

| File                                     | Purpose                           |
| ---------------------------------------- | --------------------------------- |
| `app/api/chat/route.ts`                  | Main streaming chat endpoint      |
| `hooks/useOurinChat.ts`                  | Client-side chat state management |
| `convex/schema.ts`                       | Database schema definition        |
| `convex/billing.ts`                      | Credit calculation and tier logic |
| `lib/models.ts`                          | AI model definitions and pricing  |
| `lib/verifyChatToken.ts`                 | Authentication token verification |
| `components/providers/ThemeProvider.tsx` | Theme management                  |

## Technology Stack

**Frontend:**

- Next.js 16 + React 19 + TypeScript 5.7
- Tailwind CSS 3.4 with CSS variables for theming
- Radix UI primitives (Tooltip)
- Lucide React icons

**Backend:**

- Convex (real-time database + serverless functions)
- Convex Auth

**AI Integration:**

- Vercel AI SDK (`ai` package)
- Provider SDKs: @ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/google
- Langfuse for LLM observability

**Payments:**

- Stripe (subscriptions + one-time credit purchases)

**Testing:**

- Vitest + Testing Library + MSW
- convex-test for backend testing

**Build:**

- Bun 1.1.38 package manager
- Turbo 2.3 for monorepo orchestration

## Key Development Patterns

### TypeScript Best Practices

- **Never use `any`** - use proper types or `unknown`
- **Avoid type casting with `as`** - use type guards instead
- **Define shared types** in `/types/` or `@ourin/core`

### Component Patterns

- Mark client components with `"use client"` directive
- Use `React.memo()` for expensive components
- Extract callbacks with `useCallback` to prevent re-renders
- Prefer composition over prop drilling

### State Management

- Use Convex `useQuery()`/`useMutation()` for server state
- Use React Context for global UI state (theme, auth)
- Use custom hooks to encapsulate complex logic
- Use refs for mutable values that shouldn't trigger re-renders

### Styling Guidelines

- **Always use CSS variables** for colors: `var(--color-background-primary)`
- **Never hardcode colors** in components
- Use Tailwind utility classes
- Theme colors are defined in `tailwind.config.ts`

### Convex Patterns

- Queries are reactive and auto-update
- Mutations should be idempotent when possible
- Use soft deletion (`deletedAt` field) for billing accuracy
- Index fields that are frequently queried

### Error Handling

- Use `sonner` toast for user-facing errors
- Log errors but don't expose internals to users
- Handle abort signals in streaming operations

## Testing Guidelines

### Test Organization

```
__tests__/
├── api/              # API route tests
├── components/       # Component logic tests
├── hooks/            # Hook tests
└── lib/              # Utility function tests

convex/__tests__/     # Convex backend tests
```

### Testing Patterns

1. **Focus on business logic** - test functions, not UI rendering
2. **Mock external dependencies** - Stripe, auth, Convex client
3. **Use `vi.mock()`** for module mocking
4. **Reset state in `beforeEach`** - clear mocks and localStorage

### Writing Tests

```typescript
describe("Feature", () => {
  describe("Subfeature", () => {
    it("does something specific", () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Test Utilities

- `/test-utils/setup.ts` - Global test setup
- `/test-utils/mocks.ts` - Helper functions (token generation, SSE streams)

### Running Specific Tests

```bash
# Run tests matching a pattern
bun run test:run -- --grep "billing"

# Run a specific file
bun run test:run __tests__/api/chat.route.test.ts
```

## Common Development Tasks

### Adding a New AI Model

1. Add model definition to `lib/models.ts`
2. Pre-commit hook auto-generates `convex/generatedPricing.ts`
3. Test with `bun run generate:pricing` if needed

### Adding a New API Route

1. Create route in `app/api/[route]/route.ts`
2. Use `verifyChatToken()` for authenticated endpoints
3. Add appropriate error handling and logging

### Adding a New Component

1. Create in appropriate `/components/[feature]/` directory
2. Add `"use client"` if using hooks or browser APIs
3. Use CSS variables for all colors
4. Memoize if renders are expensive

### Modifying the Database Schema

1. Edit `convex/schema.ts`
2. Run `bun run dev:convex` to apply changes
3. Update related queries/mutations
4. Add indexes for frequently queried fields

### Working with Themes

1. Themes use 3 colors: background, text, accent
2. CSS is generated by `@ourin/core` `generateThemeCSSBlock()`
3. Theme type (light/dark) auto-detected from background luminance
4. Custom themes stored in localStorage, synced to cookies for SSR

## Environment Variables

### Self-Hosting Mode

Set `SELF_HOSTING=true` (or leave unset, as it defaults to `true`) for self-hosted deployments:

- Anonymous-only authentication (no sign-in UI, auto-authenticated on first visit)
- All users have unrestricted access to all models
- No billing/subscription system
- Stripe integration disabled
- BYOK (Bring Your Own Keys) disabled - all requests use server-side API keys
- Token usage still tracked for analytics

**Required for self-hosting:**

```bash
# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# AI Providers (at least one)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_GENERATIVE_API_KEY=

# Security
CHAT_AUTH_SECRET=           # Must match in Next.js and Convex

# Self-hosting mode (defaults to true if not set)
SELF_HOSTING=true
NEXT_PUBLIC_SELF_HOSTING=true
```

**Note:** For Convex functions, you may also need to set the env var in Convex:

```bash
# Only needed if you want to explicitly set it (defaults to true/self-hosting)
npx convex env set SELF_HOSTING true
```

**Optional for self-hosting (not required):**

- `API_KEY_ENCRYPTION_SECRET` - Not needed (BYOK disabled)
- `AUTH_RESEND_KEY` - Not needed (anonymous auth only)
- `AUTH_GITHUB_ID/SECRET` - Not needed
- `AUTH_GOOGLE_ID/SECRET` - Not needed
- `STRIPE_*` - Not needed

### Production/SaaS Mode

Set `SELF_HOSTING=false` for production SaaS deployments with full billing:

- Tiered access (anonymous, free, subscriber)
- Credit calculations and limits
- Stripe subscription and credit pack purchases
- Free tier message limits
- BYOK (Bring Your Own Keys) - subscriber-only feature, allows using own API keys to bypass credit usage

**Required for production (in addition to self-hosting vars):**

```bash
# Disable self-hosting mode (Next.js)
SELF_HOSTING=false
NEXT_PUBLIC_SELF_HOSTING=false

# BYOK encryption (required for user API key storage)
API_KEY_ENCRYPTION_SECRET=    # Generate with: openssl rand -base64 32

# Stripe (required for production)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_SUBSCRIPTION_PRICE_ID=
STRIPE_CREDIT_PACK_PRICE_ID=
```

**Convex environment variables (set via dashboard or CLI):**

```bash
# Disable self-hosting mode in Convex
npx convex env set SELF_HOSTING false

# Billing configuration
npx convex env set COST_MARKUP 1.2
npx convex env set SUBSCRIPTION_CREDITS 10000
npx convex env set CREDIT_PACK_AMOUNT 20000
```

**Important:** The `SELF_HOSTING` environment variable must be set consistently in both Next.js and Convex environments. If they are out of sync, you may experience inconsistent behavior:

- If Next.js says self-hosting but Convex says production: API routes skip billing checks, but Convex still calculates credits
- If Next.js says production but Convex says self-hosting: API routes enforce full billing, but Convex returns self-hosted tier

**Optional:**

```bash
# LLM Observability
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASEURL=
```

## Git Guidelines

- Create feature branches from `main`
- Write descriptive commit messages
- Pre-commit hook automatically runs ESLint + Prettier on staged files
- Pre-commit hook regenerates pricing if `lib/models.ts` changed

## Debugging Tips

### Chat Streaming Issues

- Check browser Network tab for SSE stream
- Verify `CHAT_AUTH_SECRET` matches between Next.js and Convex
- Check Convex dashboard for mutation errors

### Convex Issues

- Run `bun run dev:convex` to see real-time logs
- Check Convex dashboard for function errors
- Verify schema indexes exist for query patterns

### Theme Issues

- Check browser console for CSS variable values
- Verify cookies are being set (`ourin-theme`, `ourin-custom-theme-data`)
- Check `<style id="ourin-theme">` element in DOM

## API Routes Reference

| Route                     | Method | Purpose                        |
| ------------------------- | ------ | ------------------------------ |
| `/api/chat`               | POST   | Streaming chat completion      |
| `/api/chat/title`         | POST   | Generate conversation title    |
| `/api/keys/save`          | POST   | Save encrypted API keys        |
| `/api/billing/config`     | GET    | Get billing configuration      |
| `/api/stripe/checkout`    | POST   | Create Stripe checkout session |
| `/api/stripe/webhook`     | POST   | Handle Stripe webhooks         |
| `/api/stripe/portal`      | POST   | Get Stripe customer portal URL |
| `/api/stripe/buy-credits` | POST   | Purchase credit pack           |

Absolutely NEVER use emojis in code, readmes or anytime unless explicitly asked for
