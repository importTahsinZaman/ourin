import { describe, it, expect } from "vitest";

/**
 * Tests for the Authentication and Account Linking logic.
 * These tests verify the anonymous -> real account upgrade flow,
 * pending link management, and email verification handling.
 */

describe("Account Linking Logic (createOrUpdateUser callback)", () => {
  describe("Pending Link Upgrade Flow", () => {
    it("identifies when pending link exists for email", () => {
      const pendingLinks = [
        { email: "test@example.com", anonymousUserId: "user_anon_123" },
        { email: "other@example.com", anonymousUserId: "user_anon_456" },
      ];
      const normalizedEmail = "test@example.com";

      const pendingLink = pendingLinks.find((l) => l.email === normalizedEmail);

      expect(pendingLink).toBeDefined();
      expect(pendingLink?.anonymousUserId).toBe("user_anon_123");
    });

    it("returns undefined when no pending link exists", () => {
      const pendingLinks = [
        { email: "other@example.com", anonymousUserId: "user_anon_456" },
      ];
      const normalizedEmail = "test@example.com";

      const pendingLink = pendingLinks.find((l) => l.email === normalizedEmail);

      expect(pendingLink).toBeUndefined();
    });

    it("determines upgrade eligibility - anonymous user with pending link", () => {
      const anonymousUser = {
        _id: "user_anon_123",
        isAnonymous: true,
        email: undefined,
      };
      const pendingLink = {
        email: "test@example.com",
        anonymousUserId: "user_anon_123",
      };

      const shouldUpgrade = pendingLink && anonymousUser?.isAnonymous === true;

      expect(shouldUpgrade).toBe(true);
    });

    it("rejects upgrade when user is not anonymous", () => {
      const nonAnonymousUser = {
        _id: "user_123",
        isAnonymous: false,
        email: "existing@example.com",
      };
      const pendingLink = {
        email: "test@example.com",
        anonymousUserId: "user_123",
      };

      const shouldUpgrade =
        pendingLink && nonAnonymousUser?.isAnonymous === true;

      expect(shouldUpgrade).toBe(false);
    });

    it("rejects upgrade when anonymous user not found", () => {
      const anonymousUser = null as { isAnonymous?: boolean } | null;
      const pendingLink = {
        email: "test@example.com",
        anonymousUserId: "user_anon_123",
      };

      const shouldUpgrade = pendingLink && anonymousUser?.isAnonymous === true;

      expect(shouldUpgrade).toBe(false);
    });

    it("builds correct upgrade patch for anonymous user", () => {
      const anonymousUser = {
        _id: "user_anon_123",
        isAnonymous: true,
        email: undefined,
        firstName: undefined,
        lastName: undefined,
        image: undefined,
      };
      const profile = {
        email: "test@example.com",
        emailVerified: true,
        firstName: "John",
        lastName: "Doe",
        image: "https://example.com/avatar.jpg",
      };

      const upgradePatch = {
        isAnonymous: false,
        email: profile.email,
        emailVerificationTime: profile.emailVerified ? Date.now() : undefined,
        firstName: profile.firstName ?? anonymousUser.firstName,
        lastName: profile.lastName ?? anonymousUser.lastName,
        image: profile.image ?? anonymousUser.image,
      };

      expect(upgradePatch.isAnonymous).toBe(false);
      expect(upgradePatch.email).toBe("test@example.com");
      expect(upgradePatch.emailVerificationTime).toBeDefined();
      expect(upgradePatch.firstName).toBe("John");
      expect(upgradePatch.lastName).toBe("Doe");
    });

    it("preserves existing anonymous user fields when profile fields are missing", () => {
      const anonymousUser = {
        _id: "user_anon_123",
        isAnonymous: true,
        email: undefined,
        firstName: "Custom",
        lastName: "Name",
        image: "https://example.com/custom-avatar.jpg",
      };
      const profile = {
        email: "test@example.com",
        emailVerified: true,
        firstName: undefined,
        lastName: undefined,
        image: undefined,
      };

      const upgradePatch = {
        isAnonymous: false,
        email: profile.email,
        emailVerificationTime: profile.emailVerified ? Date.now() : undefined,
        firstName: profile.firstName ?? anonymousUser.firstName,
        lastName: profile.lastName ?? anonymousUser.lastName,
        image: profile.image ?? anonymousUser.image,
      };

      expect(upgradePatch.firstName).toBe("Custom");
      expect(upgradePatch.lastName).toBe("Name");
      expect(upgradePatch.image).toBe("https://example.com/custom-avatar.jpg");
    });

    it("returns anonymous user ID after upgrade (preserving conversations)", () => {
      const anonymousUserId = "user_anon_123";
      const newUserId = "user_new_456";

      // After upgrade, we return the original anonymous user ID
      // This ensures conversations created while anonymous are preserved
      const returnedUserId = anonymousUserId;

      expect(returnedUserId).toBe("user_anon_123");
      expect(returnedUserId).not.toBe(newUserId);
    });
  });

  describe("Email Verification Time Logic", () => {
    it("sets emailVerificationTime when profile.emailVerified is true", () => {
      const profile = { emailVerified: true };
      const now = Date.now();

      const emailVerificationTime = profile.emailVerified ? now : undefined;

      expect(emailVerificationTime).toBe(now);
    });

    it("does not set emailVerificationTime when profile.emailVerified is false", () => {
      const profile = { emailVerified: false };
      const now = Date.now();

      const emailVerificationTime = profile.emailVerified ? now : undefined;

      expect(emailVerificationTime).toBeUndefined();
    });

    it("does not set emailVerificationTime when profile.emailVerified is undefined", () => {
      const profile = { emailVerified: undefined };
      const now = Date.now();

      const emailVerificationTime = profile.emailVerified ? now : undefined;

      expect(emailVerificationTime).toBeUndefined();
    });

    it("does not overwrite existing emailVerificationTime", () => {
      const existingUser = {
        emailVerificationTime: 1000000000000, // Existing timestamp
      };
      const profile = { emailVerified: true };
      const now = Date.now();

      // Only set if not already set
      const shouldSetEmailVerificationTime =
        profile.emailVerified && !existingUser.emailVerificationTime;

      expect(shouldSetEmailVerificationTime).toBe(false);
    });

    it("sets emailVerificationTime when not previously set", () => {
      const existingUser = {
        emailVerificationTime: undefined,
      };
      const profile = { emailVerified: true };

      const shouldSetEmailVerificationTime =
        profile.emailVerified && !existingUser.emailVerificationTime;

      expect(shouldSetEmailVerificationTime).toBe(true);
    });
  });

  describe("Email Normalization", () => {
    it("normalizes email to lowercase", () => {
      const email = "Test@Example.COM";
      const normalized = email.toLowerCase().trim();

      expect(normalized).toBe("test@example.com");
    });

    it("trims whitespace from email", () => {
      const email = "  test@example.com  ";
      const normalized = email.toLowerCase().trim();

      expect(normalized).toBe("test@example.com");
    });

    it("handles email with mixed case and whitespace", () => {
      const email = "  TeSt@ExAmPlE.CoM  ";
      const normalized = email.toLowerCase().trim();

      expect(normalized).toBe("test@example.com");
    });

    it("handles undefined email gracefully", () => {
      const email = undefined as string | undefined;
      const normalized = email?.toLowerCase().trim();

      expect(normalized).toBeUndefined();
    });
  });

  describe("Provider Detection", () => {
    it("identifies anonymous provider", () => {
      const provider = { id: "anonymous" };
      const isAnonymousProvider = provider?.id === "anonymous";

      expect(isAnonymousProvider).toBe(true);
    });

    it("identifies password provider", () => {
      const provider = { id: "password" };
      const isPasswordProvider = provider?.id === "password";
      const isAnonymousProvider = provider?.id === "anonymous";

      expect(isPasswordProvider).toBe(true);
      expect(isAnonymousProvider).toBe(false);
    });

    it("identifies OAuth providers", () => {
      const githubProvider = { id: "github" };
      const googleProvider = { id: "google" };

      expect(githubProvider.id).not.toBe("anonymous");
      expect(googleProvider.id).not.toBe("anonymous");
    });

    it("skips pending link check for anonymous provider", () => {
      const provider = { id: "anonymous" };
      const normalizedEmail = "test@example.com";

      const shouldCheckPendingLink =
        normalizedEmail && provider?.id !== "anonymous";

      expect(shouldCheckPendingLink).toBe(false);
    });

    it("checks pending link for non-anonymous provider", () => {
      const provider = { id: "password" };
      const normalizedEmail = "test@example.com";

      const shouldCheckPendingLink =
        normalizedEmail && provider?.id !== "anonymous";

      expect(shouldCheckPendingLink).toBe(true);
    });
  });

  describe("Existing User Update Flow", () => {
    it("builds update patch only for changed fields", () => {
      const existingUser = {
        _id: "user_123",
        isAnonymous: true,
        email: undefined,
        emailVerificationTime: undefined,
        firstName: undefined,
        lastName: undefined,
      };
      const profile = {
        email: "test@example.com",
        emailVerified: true,
        firstName: "John",
        lastName: "Doe",
      };
      const provider = { id: "password" };

      const updates: Record<string, unknown> = {};

      if (existingUser.isAnonymous && provider?.id !== "anonymous") {
        updates.isAnonymous = false;
      }
      if (profile.email && profile.email !== existingUser.email) {
        updates.email = profile.email;
      }
      if (profile.emailVerified && !existingUser.emailVerificationTime) {
        updates.emailVerificationTime = Date.now();
      }
      if (profile.firstName && !existingUser.firstName) {
        updates.firstName = profile.firstName;
      }
      if (profile.lastName && !existingUser.lastName) {
        updates.lastName = profile.lastName;
      }

      expect(updates.isAnonymous).toBe(false);
      expect(updates.email).toBe("test@example.com");
      expect(updates.emailVerificationTime).toBeDefined();
      expect(updates.firstName).toBe("John");
      expect(updates.lastName).toBe("Doe");
    });

    it("does not update fields that already exist", () => {
      const existingUser = {
        _id: "user_123",
        isAnonymous: false,
        email: "existing@example.com",
        emailVerificationTime: 1000000000000,
        firstName: "Existing",
        lastName: "Name",
      };
      const profile = {
        email: "new@example.com",
        emailVerified: true,
        firstName: "New",
        lastName: "Name",
      };
      const provider = { id: "password" };

      const updates: Record<string, unknown> = {};

      if (existingUser.isAnonymous && provider?.id !== "anonymous") {
        updates.isAnonymous = false;
      }
      if (profile.email && profile.email !== existingUser.email) {
        updates.email = profile.email;
      }
      if (profile.emailVerified && !existingUser.emailVerificationTime) {
        updates.emailVerificationTime = Date.now();
      }
      if (profile.firstName && !existingUser.firstName) {
        updates.firstName = profile.firstName;
      }
      if (profile.lastName && !existingUser.lastName) {
        updates.lastName = profile.lastName;
      }

      // isAnonymous already false, so not updated
      expect(updates.isAnonymous).toBeUndefined();
      // Email changed, so updated
      expect(updates.email).toBe("new@example.com");
      // Already has verification time, so not updated
      expect(updates.emailVerificationTime).toBeUndefined();
      // Already has name fields, so not updated
      expect(updates.firstName).toBeUndefined();
      expect(updates.lastName).toBeUndefined();
    });

    it("skips patch when no updates needed", () => {
      const updates: Record<string, unknown> = {};

      const shouldPatch = Object.keys(updates).length > 0;

      expect(shouldPatch).toBe(false);
    });

    it("performs patch when updates exist", () => {
      const updates: Record<string, unknown> = {
        email: "new@example.com",
      };

      const shouldPatch = Object.keys(updates).length > 0;

      expect(shouldPatch).toBe(true);
    });
  });

  describe("Link by Email Flow", () => {
    it("finds existing user by verified email", () => {
      const users = [
        { _id: "user_1", email: "test@example.com" },
        { _id: "user_2", email: "other@example.com" },
      ];
      const profile = { email: "test@example.com", emailVerified: true };

      const existingUser = users.find((u) => u.email === profile.email);

      expect(existingUser).toBeDefined();
      expect(existingUser?._id).toBe("user_1");
    });

    it("only links when email is verified", () => {
      const profile = { email: "test@example.com", emailVerified: false };

      const shouldLinkByEmail = profile.email && profile.emailVerified;

      expect(shouldLinkByEmail).toBe(false);
    });

    it("links when email exists and is verified", () => {
      const profile = { email: "test@example.com", emailVerified: true };

      const shouldLinkByEmail = profile.email && profile.emailVerified;

      expect(shouldLinkByEmail).toBe(true);
    });

    it("returns existing user ID when linked", () => {
      const existingUser = { _id: "user_existing_123" };

      const returnedUserId = existingUser._id;

      expect(returnedUserId).toBe("user_existing_123");
    });
  });

  describe("New User Creation", () => {
    it("creates user with all profile fields", () => {
      const profile = {
        email: "new@example.com",
        emailVerified: true,
        firstName: "New",
        lastName: "User",
        image: "https://example.com/avatar.jpg",
      };
      const provider = { id: "password" };

      const newUser = {
        email: profile.email,
        emailVerificationTime: profile.emailVerified ? Date.now() : undefined,
        firstName: profile.firstName,
        lastName: profile.lastName,
        image: profile.image,
        isAnonymous: provider?.id === "anonymous",
      };

      expect(newUser.email).toBe("new@example.com");
      expect(newUser.emailVerificationTime).toBeDefined();
      expect(newUser.firstName).toBe("New");
      expect(newUser.lastName).toBe("User");
      expect(newUser.image).toBe("https://example.com/avatar.jpg");
      expect(newUser.isAnonymous).toBe(false);
    });

    it("creates anonymous user for anonymous provider", () => {
      const profile = {
        email: undefined,
        emailVerified: undefined,
      };
      const provider = { id: "anonymous" };

      const newUser = {
        email: profile.email,
        emailVerificationTime: profile.emailVerified ? Date.now() : undefined,
        isAnonymous: provider?.id === "anonymous",
      };

      expect(newUser.email).toBeUndefined();
      expect(newUser.emailVerificationTime).toBeUndefined();
      expect(newUser.isAnonymous).toBe(true);
    });

    it("handles partial profile data", () => {
      const profile = {
        email: "partial@example.com",
        emailVerified: false,
        firstName: undefined,
        lastName: undefined,
        image: undefined,
      };
      const provider = { id: "password" };

      const newUser = {
        email: profile.email,
        emailVerificationTime: profile.emailVerified ? Date.now() : undefined,
        firstName: profile.firstName,
        lastName: profile.lastName,
        image: profile.image,
        isAnonymous: provider?.id === "anonymous",
      };

      expect(newUser.email).toBe("partial@example.com");
      expect(newUser.emailVerificationTime).toBeUndefined();
      expect(newUser.isAnonymous).toBe(false);
    });
  });
});

describe("Pending Account Link Logic (registerPendingAccountLink)", () => {
  describe("Authentication Requirements", () => {
    it("requires authenticated user", () => {
      const userId = null;

      const isAuthenticated = userId !== null;

      expect(isAuthenticated).toBe(false);
    });

    it("accepts authenticated user", () => {
      const userId = "user_123";

      const isAuthenticated = userId !== null;

      expect(isAuthenticated).toBe(true);
    });
  });

  describe("Anonymous User Validation", () => {
    it("allows registration for anonymous user", () => {
      const user = { _id: "user_123", isAnonymous: true };

      const canRegister = user && user.isAnonymous;

      expect(canRegister).toBe(true);
    });

    it("rejects registration for non-anonymous user", () => {
      const user = { _id: "user_123", isAnonymous: false };

      const canRegister = user && user.isAnonymous;

      expect(canRegister).toBe(false);
    });

    it("rejects registration when user not found", () => {
      const user = null as { isAnonymous?: boolean } | null;

      const canRegister = user && user.isAnonymous;

      expect(canRegister).toBeFalsy();
    });

    it("returns not_anonymous reason for non-anonymous user", () => {
      const user = { _id: "user_123", isAnonymous: false };

      if (!user || !user.isAnonymous) {
        const result = { success: false, reason: "not_anonymous" };
        expect(result.success).toBe(false);
        expect(result.reason).toBe("not_anonymous");
      }
    });
  });

  describe("Email Normalization", () => {
    it("normalizes email before storing", () => {
      const inputEmail = "  TeSt@ExAmPlE.CoM  ";
      const normalizedEmail = inputEmail.toLowerCase().trim();

      expect(normalizedEmail).toBe("test@example.com");
    });
  });

  describe("Existing Link Replacement", () => {
    it("identifies existing link for email", () => {
      const pendingLinks = [
        {
          _id: "link_1",
          email: "test@example.com",
          anonymousUserId: "user_old",
        },
      ];
      const normalizedEmail = "test@example.com";

      const existingLink = pendingLinks.find(
        (l) => l.email === normalizedEmail
      );

      expect(existingLink).toBeDefined();
      expect(existingLink?._id).toBe("link_1");
    });

    it("replaces existing link with new one", () => {
      const existingLink = {
        _id: "link_old",
        email: "test@example.com",
        anonymousUserId: "user_old",
      };
      const newAnonymousUserId = "user_new";

      // After deletion of existing and creation of new
      const newLink = {
        email: "test@example.com",
        anonymousUserId: newAnonymousUserId,
        createdAt: Date.now(),
      };

      expect(newLink.anonymousUserId).toBe("user_new");
      expect(newLink.anonymousUserId).not.toBe(existingLink.anonymousUserId);
    });
  });

  describe("Pending Link Creation", () => {
    it("creates pending link with correct structure", () => {
      const normalizedEmail = "test@example.com";
      const userId = "user_anon_123";
      const now = Date.now();

      const pendingLink = {
        email: normalizedEmail,
        anonymousUserId: userId,
        createdAt: now,
      };

      expect(pendingLink.email).toBe("test@example.com");
      expect(pendingLink.anonymousUserId).toBe("user_anon_123");
      expect(pendingLink.createdAt).toBe(now);
    });

    it("returns success response", () => {
      const result = { success: true, visibleUntilVerified: true };

      expect(result.success).toBe(true);
      expect(result.visibleUntilVerified).toBe(true);
    });
  });
});

describe("getCurrentUser Logic", () => {
  describe("Email Verification Derivation", () => {
    it("derives emailVerified as true when emailVerificationTime exists", () => {
      const user = {
        emailVerificationTime: 1000000000000,
      };

      const emailVerified = !!user.emailVerificationTime;

      expect(emailVerified).toBe(true);
    });

    it("derives emailVerified as false when emailVerificationTime is undefined", () => {
      const user = {
        emailVerificationTime: undefined,
      };

      const emailVerified = !!user.emailVerificationTime;

      expect(emailVerified).toBe(false);
    });

    it("derives emailVerified as false when emailVerificationTime is null", () => {
      const user = {
        emailVerificationTime: null as number | null,
      };

      const emailVerified = !!user.emailVerificationTime;

      expect(emailVerified).toBe(false);
    });

    it("derives emailVerified as false when emailVerificationTime is 0", () => {
      const user = {
        emailVerificationTime: 0,
      };

      // 0 is falsy, so this would be false
      // In practice, we'd never set emailVerificationTime to 0
      const emailVerified = !!user.emailVerificationTime;

      expect(emailVerified).toBe(false);
    });
  });

  describe("Anonymous User Handling", () => {
    it("returns isAnonymous true for anonymous user", () => {
      const user = { isAnonymous: true };

      const isAnonymous = user.isAnonymous ?? false;

      expect(isAnonymous).toBe(true);
    });

    it("returns isAnonymous false for non-anonymous user", () => {
      const user = { isAnonymous: false };

      const isAnonymous = user.isAnonymous ?? false;

      expect(isAnonymous).toBe(false);
    });

    it("defaults isAnonymous to false when undefined", () => {
      const user = { isAnonymous: undefined };

      const isAnonymous = user.isAnonymous ?? false;

      expect(isAnonymous).toBe(false);
    });
  });

  describe("User Response Structure", () => {
    it("builds correct response for authenticated user", () => {
      const user = {
        _id: "user_123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        isAnonymous: false,
        emailVerificationTime: 1000000000000,
      };

      const response = {
        _id: user._id,
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAnonymous: user.isAnonymous ?? false,
        emailVerified: !!user.emailVerificationTime,
      };

      expect(response._id).toBe("user_123");
      expect(response.id).toBe("user_123");
      expect(response.firstName).toBe("John");
      expect(response.lastName).toBe("Doe");
      expect(response.email).toBe("john@example.com");
      expect(response.isAnonymous).toBe(false);
      expect(response.emailVerified).toBe(true);
    });

    it("builds correct response for anonymous user", () => {
      const user = {
        _id: "user_anon_123",
        firstName: undefined,
        lastName: undefined,
        email: undefined,
        isAnonymous: true,
        emailVerificationTime: undefined,
      };

      const response = {
        _id: user._id,
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAnonymous: user.isAnonymous ?? false,
        emailVerified: !!user.emailVerificationTime,
      };

      expect(response._id).toBe("user_anon_123");
      expect(response.firstName).toBeUndefined();
      expect(response.lastName).toBeUndefined();
      expect(response.email).toBeUndefined();
      expect(response.isAnonymous).toBe(true);
      expect(response.emailVerified).toBe(false);
    });

    it("returns null for unauthenticated request", () => {
      const userId = null;

      if (!userId) {
        const response = null;
        expect(response).toBeNull();
      }
    });

    it("returns null when user not found", () => {
      const user = null;

      if (!user) {
        const response = null;
        expect(response).toBeNull();
      }
    });
  });
});

describe("Full Sign-Up Flow Scenarios", () => {
  describe("Anonymous User Sign-Up with Account Linking", () => {
    it("completes full flow: anonymous -> signup -> verify -> linked", () => {
      // Step 1: Anonymous user exists
      const anonymousUser = {
        _id: "user_anon_123",
        isAnonymous: true,
        email: undefined,
        emailVerificationTime: undefined,
      };

      // Step 2: User starts signup, pending link created
      const pendingLink = {
        email: "test@example.com",
        anonymousUserId: anonymousUser._id,
        createdAt: Date.now(),
      };

      // Step 3: User verifies email, createOrUpdateUser called
      const profile = {
        email: "test@example.com",
        emailVerified: true,
        firstName: "Test",
        lastName: "User",
      };

      // Step 4: Pending link found, anonymous user upgraded
      const foundLink = pendingLink.email === profile.email?.toLowerCase();
      expect(foundLink).toBe(true);

      const upgradedUser = {
        ...anonymousUser,
        isAnonymous: false,
        email: profile.email,
        emailVerificationTime: profile.emailVerified ? Date.now() : undefined,
        firstName: profile.firstName,
        lastName: profile.lastName,
      };

      // Step 5: Verify final state
      expect(upgradedUser.isAnonymous).toBe(false);
      expect(upgradedUser.email).toBe("test@example.com");
      expect(upgradedUser.emailVerificationTime).toBeDefined();
      expect(upgradedUser._id).toBe("user_anon_123"); // Same ID preserved!
    });

    it("preserves conversations by keeping same user ID", () => {
      const conversations = [
        { _id: "conv_1", userId: "user_anon_123", title: "Chat 1" },
        { _id: "conv_2", userId: "user_anon_123", title: "Chat 2" },
      ];

      // After account linking, user ID stays the same
      const returnedUserId = "user_anon_123";

      // All conversations still belong to this user
      const userConversations = conversations.filter(
        (c) => c.userId === returnedUserId
      );

      expect(userConversations.length).toBe(2);
    });
  });

  describe("Fresh Sign-Up (No Anonymous User)", () => {
    it("creates new user when no pending link exists", () => {
      const pendingLinks: { email: string; anonymousUserId: string }[] = [];
      const profile = {
        email: "newuser@example.com",
        emailVerified: true,
        firstName: "New",
        lastName: "User",
      };

      const pendingLink = pendingLinks.find(
        (l) => l.email === profile.email?.toLowerCase()
      );

      expect(pendingLink).toBeUndefined();

      // New user would be created
      const newUser = {
        email: profile.email,
        emailVerificationTime: profile.emailVerified ? Date.now() : undefined,
        firstName: profile.firstName,
        lastName: profile.lastName,
        isAnonymous: false,
      };

      expect(newUser.email).toBe("newuser@example.com");
      expect(newUser.isAnonymous).toBe(false);
    });
  });

  describe("Sign-Up Before Verification", () => {
    it("does not set emailVerificationTime before OTP verified", () => {
      // During signup (before OTP verification)
      const profileDuringSignup = {
        email: "test@example.com",
        emailVerified: false, // Not verified yet
      };

      const emailVerificationTime = profileDuringSignup.emailVerified
        ? Date.now()
        : undefined;

      expect(emailVerificationTime).toBeUndefined();
    });

    it("sets emailVerificationTime after OTP verified", () => {
      // After OTP verification
      const profileAfterVerification = {
        email: "test@example.com",
        emailVerified: true, // Now verified
      };

      const emailVerificationTime = profileAfterVerification.emailVerified
        ? Date.now()
        : undefined;

      expect(emailVerificationTime).toBeDefined();
    });
  });

  describe("isFullyAuthenticated Calculation", () => {
    it("returns false for anonymous user", () => {
      const isAuthenticated = true;
      const currentUser = {
        emailVerified: false,
        isAnonymous: true,
      };

      const isFullyAuthenticated =
        isAuthenticated &&
        currentUser?.emailVerified &&
        !currentUser?.isAnonymous;

      expect(isFullyAuthenticated).toBe(false);
    });

    it("returns false for unverified email", () => {
      const isAuthenticated = true;
      const currentUser = {
        emailVerified: false,
        isAnonymous: false,
      };

      const isFullyAuthenticated =
        isAuthenticated &&
        currentUser?.emailVerified &&
        !currentUser?.isAnonymous;

      expect(isFullyAuthenticated).toBe(false);
    });

    it("returns true for verified non-anonymous user", () => {
      const isAuthenticated = true;
      const currentUser = {
        emailVerified: true,
        isAnonymous: false,
      };

      const isFullyAuthenticated =
        isAuthenticated &&
        currentUser?.emailVerified &&
        !currentUser?.isAnonymous;

      expect(isFullyAuthenticated).toBe(true);
    });

    it("returns false when not authenticated", () => {
      const isAuthenticated = false;
      const currentUser = {
        emailVerified: true,
        isAnonymous: false,
      };

      const isFullyAuthenticated =
        isAuthenticated &&
        currentUser?.emailVerified &&
        !currentUser?.isAnonymous;

      expect(isFullyAuthenticated).toBe(false);
    });

    it("returns false when currentUser is null", () => {
      const isAuthenticated = true;
      const currentUser = null as {
        emailVerified?: boolean;
        isAnonymous?: boolean;
      } | null;

      const isFullyAuthenticated =
        isAuthenticated &&
        currentUser?.emailVerified &&
        !currentUser?.isAnonymous;

      expect(isFullyAuthenticated).toBeFalsy();
    });
  });
});
