/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as apiKeys from "../apiKeys.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as chatAuth from "../chatAuth.js";
import type * as config from "../config.js";
import type * as conversations from "../conversations.js";
import type * as cores from "../cores.js";
import type * as creditPurchases from "../creditPurchases.js";
import type * as defaultCores from "../defaultCores.js";
import type * as files from "../files.js";
import type * as freeUsage from "../freeUsage.js";
import type * as generatedPricing from "../generatedPricing.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as pricing from "../pricing.js";
import type * as settings from "../settings.js";
import type * as subscriptions from "../subscriptions.js";
import type * as usage from "../usage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  apiKeys: typeof apiKeys;
  auth: typeof auth;
  billing: typeof billing;
  chatAuth: typeof chatAuth;
  config: typeof config;
  conversations: typeof conversations;
  cores: typeof cores;
  creditPurchases: typeof creditPurchases;
  defaultCores: typeof defaultCores;
  files: typeof files;
  freeUsage: typeof freeUsage;
  generatedPricing: typeof generatedPricing;
  http: typeof http;
  messages: typeof messages;
  pricing: typeof pricing;
  settings: typeof settings;
  subscriptions: typeof subscriptions;
  usage: typeof usage;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
