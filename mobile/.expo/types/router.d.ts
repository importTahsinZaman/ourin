import * as Router from "expo-router";

export * from "expo-router";

declare module "expo-router" {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams:
        | {
            pathname: Router.RelativePathString;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: Router.ExternalPathString;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(auth)"}/login` | `/login`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(auth)"}/verify` | `/verify`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(tabs)"}/history` | `/history`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(tabs)"}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(tabs)"}/settings` | `/settings`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/c/[id]`;
            params: Router.UnknownInputParams & { id: string | number };
          };
      hrefOutputParams:
        | {
            pathname: Router.RelativePathString;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: Router.ExternalPathString;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(auth)"}/login` | `/login`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(auth)"}/verify` | `/verify`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(tabs)"}/history` | `/history`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(tabs)"}` | `/`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(tabs)"}/settings` | `/settings`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/c/[id]`;
            params: Router.UnknownOutputParams & { id: string };
          };
      href:
        | Router.RelativePathString
        | Router.ExternalPathString
        | `/_sitemap${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/login${`?${string}` | `#${string}` | ""}`
        | `/login${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/verify${`?${string}` | `#${string}` | ""}`
        | `/verify${`?${string}` | `#${string}` | ""}`
        | `${"/(tabs)"}/history${`?${string}` | `#${string}` | ""}`
        | `/history${`?${string}` | `#${string}` | ""}`
        | `${"/(tabs)"}${`?${string}` | `#${string}` | ""}`
        | `/${`?${string}` | `#${string}` | ""}`
        | `${"/(tabs)"}/settings${`?${string}` | `#${string}` | ""}`
        | `/settings${`?${string}` | `#${string}` | ""}`
        | {
            pathname: Router.RelativePathString;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: Router.ExternalPathString;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(auth)"}/login` | `/login`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(auth)"}/verify` | `/verify`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(tabs)"}/history` | `/history`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(tabs)"}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(tabs)"}/settings` | `/settings`;
            params?: Router.UnknownInputParams;
          }
        | `/c/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | {
            pathname: `/c/[id]`;
            params: Router.UnknownInputParams & { id: string | number };
          };
    }
  }
}
