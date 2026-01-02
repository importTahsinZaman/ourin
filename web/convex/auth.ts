import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { ConvexError } from "convex/values";
import { ResendOTP } from "./ResendOTP";
import { isSelfHosting } from "./config";

/**
 * build auth providers based on deployment mode.
 *
 * self-hosting mode: anonymous auth only (simple, no external dependencies)
 * production mode: all providers (anonymous, password+resend, gitHub, google)
 */
function buildAuthProviders() {
  // self-hosting mode: only anonymous auth for simplicity
  if (isSelfHosting()) {
    return [Anonymous];
  }

  // production mode: build full provider list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providers: any[] = [Anonymous];

  // add password provider only if resend aPI key is configured
  if (process.env.AUTH_RESEND_KEY) {
    providers.push(
      Password({
        verify: ResendOTP,
        profile(params) {
          const result: {
            email: string;
            firstName?: string;
            lastName?: string;
          } = {
            email: params.email as string,
          };
          if (params.firstName) result.firstName = params.firstName as string;
          if (params.lastName) result.lastName = params.lastName as string;
          return result;
        },
        validatePasswordRequirements: (password: string) => {
          const minLength = password.length >= 8;
          const hasLowercase = /[a-z]/.test(password);
          const hasUppercase = /[A-Z]/.test(password);
          const hasNumber = /[0-9]/.test(password);
          const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(
            password
          );

          if (
            !minLength ||
            !hasLowercase ||
            !hasUppercase ||
            !hasNumber ||
            !hasSymbol
          ) {
            throw new ConvexError(
              "Password must be at least 8 characters and include lowercase, uppercase, number, and symbol"
            );
          }
        },
      })
    );
  }

  // add oAuth providers (they work if their env vars are configured)
  providers.push(GitHub, Google);

  return providers;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: buildAuthProviders(),
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // extract profile data
      const profile = args.profile as {
        email?: string;
        emailVerified?: boolean;
        image?: string;
        firstName?: string;
        lastName?: string;
      };

      const normalizedEmail = profile.email?.toLowerCase().trim();

      // check for pending account link (anonymous -> real account upgrade)
      if (normalizedEmail && args.provider?.id !== "anonymous") {
        const pendingLink = await ctx.db
          .query("pendingAccountLinks")
          .filter((q) => q.eq(q.field("email"), normalizedEmail))
          .first();

        if (pendingLink) {
          // sECURITY: only honor the pending link if the current session owns it
          // this prevents attackers from claiming emails by registering links before victims
          const isLinkOwner =
            args.existingUserId === pendingLink.anonymousUserId;

          // also check if link has expired (10 minutes)
          const isExpired =
            pendingLink.expiresAt && pendingLink.expiresAt < Date.now();

          if (isLinkOwner && !isExpired) {
            const anonymousUser = await ctx.db.get(pendingLink.anonymousUserId);

            if (anonymousUser && anonymousUser.isAnonymous) {
              // safe to upgrade - same user who created the link
              await ctx.db.patch(anonymousUser._id, {
                isAnonymous: false,
                email: profile.email,
                emailVerificationTime: profile.emailVerified
                  ? Date.now()
                  : undefined,
                firstName: profile.firstName ?? anonymousUser.firstName,
                lastName: profile.lastName ?? anonymousUser.lastName,
                image: profile.image ?? anonymousUser.image,
              });

              // delete the pending link
              await ctx.db.delete(pendingLink._id);

              return anonymousUser._id;
            }
          }

          // link doesn't match current session or is expired - clean it up
          await ctx.db.delete(pendingLink._id);
        }
      }

      // fallback: check library's existingUserId
      if (args.existingUserId) {
        try {
          const existingUser = await ctx.db.get(args.existingUserId);
          if (existingUser) {
            // update user with any new profile data
            const updates: Record<string, unknown> = {};

            if (existingUser.isAnonymous && args.provider?.id !== "anonymous") {
              updates.isAnonymous = false;
            }
            if (profile.email && profile.email !== existingUser.email) {
              updates.email = profile.email;
            }
            // only set emailVerificationTime when profile.emailVerified is true
            // this happens after oTP verification, not during signup
            if (profile.emailVerified && !existingUser.emailVerificationTime) {
              updates.emailVerificationTime = Date.now();
            }
            if (profile.firstName && !existingUser.firstName) {
              updates.firstName = profile.firstName;
            }
            if (profile.lastName && !existingUser.lastName) {
              updates.lastName = profile.lastName;
            }

            if (Object.keys(updates).length > 0) {
              await ctx.db.patch(existingUser._id, updates);
            }
            return existingUser._id;
          }
        } catch {
          // invalid iD, continue
        }
      }

      // link by email if user already exists with verified email
      if (normalizedEmail && profile.emailVerified) {
        const existing = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("email"), normalizedEmail))
          .first();
        if (existing) {
          // update emailVerificationTime if not set
          if (!existing.emailVerificationTime) {
            await ctx.db.patch(existing._id, {
              emailVerificationTime: Date.now(),
            });
          }
          return existing._id;
        }
      }

      // create new user
      return await ctx.db.insert("users", {
        email: profile.email,
        emailVerificationTime: profile.emailVerified ? Date.now() : undefined,
        firstName: profile.firstName,
        lastName: profile.lastName,
        image: profile.image,
        isAnonymous: args.provider?.id === "anonymous",
      });
    },
  },
});
