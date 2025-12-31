import type { Metadata } from "next";
import {
  Inter,
  IBM_Plex_Sans,
  Source_Sans_3,
  Nunito,
  Lato,
  Open_Sans,
  Roboto,
  Plus_Jakarta_Sans,
} from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { CoreEditorProviderWrapper } from "@/components/providers/CoreEditorProviderWrapper";
import {
  getThemeById,
  defaultTheme,
  generateThemeCSS,
  generateThemeCSSBlock,
} from "@ourin/core";
import "./globals.css";

// Font definitions
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  display: "swap",
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlex = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

import { getFontFamily } from "@/lib/fonts";

export const metadata: Metadata = {
  title: {
    default: "Ourin | The modern AI chat",
    template: "%s - Ourin",
  },
  description:
    "A minimal, customizable AI chat interface with deep theming support",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read theme and font preferences from cookies (SSR-safe)
  const cookieStore = await cookies();
  const themeIdCookie = cookieStore.get("ourin-theme")?.value;
  const fontId = cookieStore.get("ourin-font")?.value || "lato";
  const customThemeDataStr = cookieStore.get("ourin-custom-theme-data")?.value;

  // Check if this is a first-time visitor (no theme cookie)
  const isFirstVisit = !themeIdCookie;
  const themeId = themeIdCookie || defaultTheme.id;

  // Get theme object - for custom themes, reconstruct from cookie data
  let theme = getThemeById(themeId);
  if (!theme && themeId.startsWith("custom-") && customThemeDataStr) {
    try {
      const customData = JSON.parse(decodeURIComponent(customThemeDataStr));
      theme = {
        id: themeId,
        name: "Custom Theme",
        type: customData.type || "light",
        colors: customData.colors,
      };
    } catch {
      theme = defaultTheme;
    }
  }
  if (!theme) {
    theme = defaultTheme;
  }

  // Generate theme CSS
  // For first visit, use media queries to match system preference
  let themeCSS: string;
  if (isFirstVisit) {
    const lightTheme = getThemeById("ourin-light") || defaultTheme;
    const darkTheme = getThemeById("ourin-dark") || defaultTheme;
    const lightVars = generateThemeCSS(lightTheme);
    const darkVars = generateThemeCSS(darkTheme);
    themeCSS = `
      @media (prefers-color-scheme: light) {
        :root { ${lightVars} }
      }
      @media (prefers-color-scheme: dark) {
        :root { ${darkVars} }
      }
    `;
  } else {
    themeCSS = generateThemeCSSBlock(theme);
  }

  // Script to set theme cookie on first visit based on system preference
  const firstVisitScript = isFirstVisit
    ? `(function(){
        var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var themeId = dark ? 'ourin-dark' : 'ourin-light';
        document.cookie = 'ourin-theme=' + themeId + ';path=/;max-age=31536000';
      })();`
    : "";

  // Get font CSS variable
  const fontFamily = getFontFamily(fontId);

  // Combine all font variables
  const fontClasses = [
    inter.variable,
    GeistSans.variable,
    ibmPlex.variable,
    sourceSans.variable,
    nunito.variable,
    lato.variable,
    openSans.variable,
    roboto.variable,
    plusJakarta.variable,
  ].join(" ");

  return (
    <html lang="en" className={fontClasses} suppressHydrationWarning>
      <head>
        {/* Inject theme CSS to prevent flash */}
        <style
          id="ourin-theme"
          dangerouslySetInnerHTML={{ __html: themeCSS }}
        />
        {/* Set font family */}
        <style
          id="ourin-font"
          dangerouslySetInnerHTML={{
            __html: `:root { --font-family: ${fontFamily}; }`,
          }}
        />
        {/* Set theme cookie on first visit based on system preference */}
        {firstVisitScript && (
          <script dangerouslySetInnerHTML={{ __html: firstVisitScript }} />
        )}
      </head>
      <body>
        <ConvexClientProvider>
          <ThemeProvider initialThemeId={themeId} initialFontId={fontId}>
            <CoreEditorProviderWrapper>{children}</CoreEditorProviderWrapper>
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  background: "var(--color-background-elevated)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-default)",
                },
              }}
            />
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
