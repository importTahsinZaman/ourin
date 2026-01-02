import {
  createHighlighter,
  type Highlighter,
  type BundledLanguage,
} from "shiki";

// common languages to preload for better performance
const PRELOADED_LANGS: BundledLanguage[] = [
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "python",
  "bash",
  "shell",
  "json",
  "html",
  "css",
  "sql",
  "markdown",
  "yaml",
  "go",
  "rust",
  "java",
  "c",
  "cpp",
  // additional common languages
  "ruby",
  "php",
  "swift",
  "kotlin",
  "csharp",
  "toml",
  "dockerfile",
  "diff",
  "graphql",
  "lua",
  "perl",
  "r",
  "scala",
  "xml",
];

// language aliases for common variations
const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  zsh: "bash",
  yml: "yaml",
  text: "plaintext",
  txt: "plaintext",
  "": "plaintext",
  cs: "csharp",
  rb: "ruby",
};

// normalize language name using aliases
function normalizeLanguage(lang?: string): string {
  const normalized = lang?.toLowerCase().trim() || "plaintext";
  return LANG_ALIASES[normalized] || normalized;
}

// check if a language is available for synchronous highlighting
export function isLanguageLoaded(lang?: string): boolean {
  if (!highlighterInstance) return false;
  const normalizedLang = normalizeLanguage(lang);
  if (normalizedLang === "plaintext") return true;
  return highlighterInstance
    .getLoadedLanguages()
    .includes(normalizedLang as BundledLanguage);
}

let highlighterPromise: Promise<Highlighter> | null = null;
let highlighterInstance: Highlighter | null = null;

// initialize highlighter eagerly on module load
if (typeof window !== "undefined") {
  getHighlighter().then((h) => {
    highlighterInstance = h;
  });
}

// synchronous highlight - returns hTML immediately if highlighter is ready, null otherwise
export function highlightCodeSync(
  code: string,
  lang?: string,
  themeType: "light" | "dark" = "dark"
): string | null {
  if (!highlighterInstance) return null;

  let normalizedLang = normalizeLanguage(lang);

  // check if language is loaded - if not, fall back to plaintext
  // (async path will load the language properly)
  const loadedLangs = highlighterInstance.getLoadedLanguages();
  if (!loadedLangs.includes(normalizedLang as BundledLanguage)) {
    normalizedLang = "plaintext";
  }

  const shikiTheme = themeType === "light" ? "github-light" : "github-dark";

  try {
    return highlighterInstance.codeToHtml(code, {
      lang: normalizedLang,
      theme: shikiTheme,
    });
  } catch {
    return null;
  }
}

export async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: PRELOADED_LANGS,
    }).then((h) => {
      highlighterInstance = h;
      return h;
    });
  }
  return highlighterPromise;
}

export async function highlightCode(
  code: string,
  lang?: string,
  themeType: "light" | "dark" = "dark"
): Promise<string> {
  let normalizedLang = normalizeLanguage(lang);

  const highlighter = await getHighlighter();

  // check if language is loaded, try to load if not
  const loadedLangs = highlighter.getLoadedLanguages();
  if (!loadedLangs.includes(normalizedLang as BundledLanguage)) {
    try {
      await highlighter.loadLanguage(normalizedLang as BundledLanguage);
    } catch {
      // language not supported, fallback to plaintext
      normalizedLang = "plaintext";
    }
  }

  const shikiTheme = themeType === "light" ? "github-light" : "github-dark";

  return highlighter.codeToHtml(code, {
    lang: normalizedLang,
    theme: shikiTheme,
  });
}
