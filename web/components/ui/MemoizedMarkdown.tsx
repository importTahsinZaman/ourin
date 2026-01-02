"use client";

import { memo, useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Copy, Check } from "lucide-react";
import {
  highlightCode,
  highlightCodeSync,
  isLanguageLoaded,
} from "@/lib/shiki";
import { useTheme } from "@/components/providers/ThemeProvider";
import "katex/dist/katex.min.css";

/**
 * escape currency dollar signs to prevent them from being interpreted as laTeX math.
 * uses pandoc's rule: a closing $ followed by a digit is likely currency, not math.
 * this escapes patterns like $10, $2.1b, $410m, etc.
 */
function escapeCurrencyDollarSigns(content: string): string {
  // match $ followed by a digit (currency pattern like $10, $2.5, $410m)
  // this covers: $10, $2.1b, $410m, $1,000, etc.
  // note: in jS regex replacement, $$ = literal $, $1 = captured group
  // so "\\$$$1" = backslash + literal $ + captured digit
  return content.replace(/\$(\d)/g, "\\$$$1");
}

interface MemoizedMarkdownProps {
  content: string;
  id: string;
}

function CodeBlock({
  language,
  children,
}: {
  language?: string;
  children: string;
}) {
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();
  const themeType = theme.type;

  // try synchronous highlighting first (instant after shiki initializes)
  // this runs during render, so no flash if highlighter is ready
  const syncHtml = useMemo(
    () => highlightCodeSync(children, language, themeType),
    [children, language, themeType]
  );

  // check if the requested language is loaded (for non-preloaded languages)
  const languageReady = isLanguageLoaded(language);

  // async fallback for:
  // 1. before shiki initializes (syncHtml is null)
  // 2. when language isn't loaded (need to load it dynamically)
  const [asyncHtml, setAsyncHtml] = useState<string | null>(null);

  useEffect(() => {
    // skip async if sync worked aND the language was properly loaded
    // (not falling back to plaintext for an unloaded language)
    if (syncHtml && languageReady) {
      setAsyncHtml(null);
      return;
    }

    let cancelled = false;

    highlightCode(children, language, themeType)
      .then((html) => {
        if (!cancelled) {
          setAsyncHtml(html);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [children, language, themeType, syncHtml, languageReady]);

  // use sync result if available, otherwise async result
  const highlightedHtml = syncHtml || asyncHtml;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-4">
      {/* language label - above code block */}
      {language && (
        <div
          className="px-3 pt-2 pb-0 rounded-t-md font-mono text-xs"
          style={{
            backgroundColor: "var(--color-code-background)",
            color: "var(--color-text-muted)",
          }}
        >
          {language}
        </div>
      )}

      {highlightedHtml ? (
        // syntax-highlighted code from shiki
        // background is overridden in globals.css to use --color-code-background
        <div
          className={`shiki-wrapper overflow-x-auto text-sm [&_pre]:p-4 [&_pre]:m-0 [&_pre]:overflow-x-auto [&_code]:font-mono ${
            language ? "rounded-b-md" : "rounded-sm"
          }`}
          style={{
            fontVariantLigatures: "none",
            fontFeatureSettings: '"liga" 0, "calt" 0',
            backgroundColor: "var(--color-code-background)",
          }}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        // fallback: plain code while loading (same background to prevent flash)
        <pre
          className={`p-4 overflow-x-auto text-sm ${
            language ? "rounded-b-md" : "rounded-sm"
          }`}
          style={{
            backgroundColor: "var(--color-code-background)",
            color: "var(--color-code-text)",
            whiteSpace: "pre",
            tabSize: 4,
          }}
        >
          <code
            className="font-mono"
            style={{
              fontVariantLigatures: "none",
              fontFeatureSettings: '"liga" 0, "calt" 0',
              letterSpacing: 0,
              wordSpacing: 0,
            }}
          >
            {children}
          </code>
        </pre>
      )}

      {/* copy button */}
      <button
        onClick={handleCopy}
        className="top-2 right-2 z-10 absolute opacity-0 group-hover:opacity-100 p-1 rounded text-xs transition-opacity"
        style={{
          color: "var(--color-text-muted)",
        }}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  // preprocess content to escape currency dollar signs
  const processedContent = useMemo(
    () => escapeCurrencyDollarSigns(content),
    [content]
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        // code blocks
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const isBlock = String(children).includes("\n");

          if (isBlock) {
            return (
              <CodeBlock language={match?.[1]}>
                {String(children).replace(/\n$/, "")}
              </CodeBlock>
            );
          }

          return (
            <code
              className="px-1.5 py-0.5 rounded font-mono text-sm"
              style={{
                backgroundColor: "var(--color-code-background)",
                color: "var(--color-code-text)",
                fontVariantLigatures: "none",
                fontFeatureSettings: '"liga" 0, "calt" 0',
                letterSpacing: 0,
                wordSpacing: 0,
              }}
              {...props}
            >
              {children}
            </code>
          );
        },

        // paragraphs
        p({ children }) {
          return <p className="my-2 break-words leading-relaxed">{children}</p>;
        },

        // headings
        h1({ children }) {
          return (
            <h1
              className="mt-6 mb-3 font-bold text-2xl"
              style={{ color: "var(--color-text-primary)" }}
            >
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2
              className="mt-5 mb-2 font-semibold text-xl"
              style={{ color: "var(--color-text-primary)" }}
            >
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3
              className="mt-4 mb-2 font-semibold text-lg"
              style={{ color: "var(--color-text-primary)" }}
            >
              {children}
            </h3>
          );
        },

        // lists
        ul({ children }) {
          return <ul className="space-y-1 my-2 pl-6 list-disc">{children}</ul>;
        },
        ol({ children }) {
          return (
            <ol className="space-y-1 my-2 pl-6 list-decimal">{children}</ol>
          );
        },
        li({ children }) {
          return (
            <li className="[&>p]:inline [&>p]:m-0 leading-relaxed">
              {children}
            </li>
          );
        },

        // links
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
              style={{ color: "var(--color-text-link)" }}
            >
              {children}
            </a>
          );
        },

        // blockquote
        blockquote({ children }) {
          return (
            <blockquote
              className="my-3 pl-4 border-l-4 italic"
              style={{
                borderColor: "var(--color-border-default)",
                color: "var(--color-text-secondary)",
              }}
            >
              {children}
            </blockquote>
          );
        },

        // tables
        table({ children }) {
          return (
            <div className="my-4 overflow-x-auto">
              <table
                className="w-full text-sm"
                style={{ border: "1px solid var(--color-border-default)" }}
              >
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return (
            <thead
              style={{ backgroundColor: "var(--color-background-secondary)" }}
            >
              {children}
            </thead>
          );
        },
        th({ children }) {
          return (
            <th
              className="px-4 py-2 font-semibold text-left"
              style={{
                color: "var(--color-text-primary)",
                borderBottom: "1px solid var(--color-border-default)",
              }}
            >
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td
              className="px-4 py-2"
              style={{
                color: "var(--color-text-secondary)",
                borderBottom: "1px solid var(--color-border-muted)",
              }}
            >
              {children}
            </td>
          );
        },

        // horizontal rule
        hr() {
          return (
            <hr
              className="my-4"
              style={{ borderColor: "var(--color-border-default)" }}
            />
          );
        },

        // strong
        strong({ children }) {
          return <strong className="font-semibold">{children}</strong>;
        },

        // emphasis
        em({ children }) {
          return <em className="italic">{children}</em>;
        },
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
}

export const MemoizedMarkdown = memo(
  function MemoizedMarkdown({ content, id: _id }: MemoizedMarkdownProps) {
    return <MarkdownRenderer content={content} />;
  },
  (prevProps, nextProps) => {
    // only re-render if content changed
    return (
      prevProps.content === nextProps.content && prevProps.id === nextProps.id
    );
  }
);
