"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MemoizedMarkdown } from "@/components/ui/MemoizedMarkdown";
import type { ToolInvocationPart, MessagePart } from "@/types/chat";

// types for web search results from different providers
interface AnthropicSearchResult {
  type: "web_search_result";
  url: string;
  title: string;
  page_age?: string;
  encrypted_content?: string;
}

interface AnthropicWebSearchResult {
  type?: "web_search_tool_result";
  content?: AnthropicSearchResult[];
}

interface OpenAISearchResult {
  url: string;
  title: string;
  snippet?: string;
}

interface OpenAIWebSearchResult {
  action?: { query?: string };
  results?: OpenAISearchResult[];
}

// extract search data from tool invocation based on provider format
function extractSearchData(part: ToolInvocationPart): {
  query: string | undefined;
  results: Array<{ url: string; title: string; domain: string }>;
  isSearching: boolean;
} {
  const args = part.args as { query?: string } | undefined;
  const isSearching = part.state !== "result";
  const query = args?.query;

  // helper to extract domain from uRL
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  // helper to map results array to our format
  const mapResults = (
    arr: Array<{ url?: string; title?: string; type?: string }>
  ) =>
    arr
      .filter((r) => r.url && r.title)
      .map((r) => ({
        url: r.url!,
        title: r.title!,
        domain: getDomain(r.url!),
      }));

  // case 1: result is directly an array (anthropic via vercel aI sDK)
  if (Array.isArray(part.result)) {
    return { query, results: mapResults(part.result), isSearching };
  }

  // case 2: result has content array (raw anthropic format)
  const anthropicResult = part.result as AnthropicWebSearchResult | undefined;
  if (anthropicResult?.content && Array.isArray(anthropicResult.content)) {
    return { query, results: mapResults(anthropicResult.content), isSearching };
  }

  // case 3: openAI format with action.query and results array
  const openaiResult = part.result as OpenAIWebSearchResult | undefined;
  if (openaiResult?.action?.query || openaiResult?.results) {
    const openaiQuery = openaiResult.action?.query || query;
    return {
      query: openaiQuery,
      results: mapResults(openaiResult.results || []),
      isSearching,
    };
  }

  return { query, results: [], isSearching };
}

// globe icon sVG (phosphor style)
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 256 256"
      className={className}
    >
      <path d="M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.27,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z" />
    </svg>
  );
}

// chevron icon sVG
function ChevronIcon({
  className,
  expanded,
  style,
}: {
  className?: string;
  expanded?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "transition-transform duration-300 shrink-0",
        expanded && "rotate-180",
        className
      )}
      style={style}
    >
      <path d="M14.128 7.16482C14.3126 6.95983 14.6298 6.94336 14.835 7.12771C15.0402 7.31242 15.0567 7.62952 14.8721 7.83477L10.372 12.835L10.2939 12.9053C10.2093 12.9667 10.1063 13 9.99995 13C9.85833 12.9999 9.72264 12.9402 9.62788 12.835L5.12778 7.83477L5.0682 7.75273C4.95072 7.55225 4.98544 7.28926 5.16489 7.12771C5.34445 6.96617 5.60969 6.95939 5.79674 7.09744L5.87193 7.16482L9.99995 11.7519L14.128 7.16482Z" />
    </svg>
  );
}

// type for steps that can be either search or reasoning
type StepItem =
  | { type: "search"; data: ToolInvocationPart }
  | {
      type: "reasoning";
      text: string;
      isThinking: boolean;
      duration?: number;
      id?: string;
    };

interface StepsAccordionProps {
  parts: MessagePart[];
  isActivelyThinking?: boolean;
  isStreaming?: boolean;
}

// collapsible steps container for reasoning and tool calls
export function StepsAccordion({
  parts,
  isActivelyThinking,
  isStreaming,
}: StepsAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // accordion behavior - only one step can be expanded at a time
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  // build steps from parts array in order - this preserves interleaving
  const steps: StepItem[] = [];

  for (const part of parts) {
    if (part.type === "reasoning") {
      const reasoningPart = part as {
        type: "reasoning";
        text: string;
        id?: string;
        duration?: number;
      };
      if (reasoningPart.text.trim()) {
        // mark as thinking if streaming and no duration yet (still being generated)
        const isStillThinking = !!(isStreaming && !reasoningPart.duration);
        steps.push({
          type: "reasoning",
          text: reasoningPart.text,
          isThinking: isStillThinking,
          duration: reasoningPart.duration,
          id: reasoningPart.id,
        });
      }
    } else if (part.type === "tool-invocation") {
      const toolPart = part as ToolInvocationPart;
      // only include web search tools
      if (toolPart.toolName.toLowerCase().includes("search")) {
        steps.push({ type: "search", data: toolPart });
      }
    }
  }

  // add actively thinking indicator as last reasoning step if needed
  if (isActivelyThinking) {
    const lastStep = steps[steps.length - 1];
    if (lastStep && lastStep.type === "reasoning") {
      lastStep.isThinking = true;
    } else {
      steps.push({
        type: "reasoning",
        text: "",
        isThinking: true,
      });
    }
  }

  // don't render if no steps at all
  if (steps.length === 0) return null;

  // accordion toggle
  const toggleStepExpanded = (stepId: string) => {
    setExpandedStep((prev) => (prev === stepId ? null : stepId));
  };

  // determine which steps to show based on collapsed/expanded state
  // if 2 or fewer steps, always show all (no collapse behavior needed)
  // if 3+ steps: collapsed shows last 2 (most recent), expanded shows all
  const canCollapse = steps.length > 2;
  const visibleSteps = canCollapse && !isExpanded ? steps.slice(-2) : steps;
  const showHeader = canCollapse;

  // for single item, skip the extra left padding
  const isSingleItem = steps.length === 1;

  return (
    <div
      className="mb-4 rounded-sm overflow-hidden"
      style={{ backgroundColor: "var(--color-background-steps)" }}
    >
      {/* header - only show if more than 2 steps */}
      {showHeader && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex flex-row justify-between items-center hover:bg-[var(--color-background-hover)] px-3 py-2 w-full transition-colors duration-200 cursor-pointer"
        >
          <span
            className="text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            {isExpanded ? "Hide steps" : `${steps.length} steps`}
          </span>
          <ChevronIcon
            expanded={isExpanded}
            className="w-5 h-5"
            style={{ color: "var(--color-text-muted)" }}
          />
        </button>
      )}

      {/* steps list */}
      <div className="overflow-hidden shrink-0">
        {visibleSteps.map((step, index) => {
          if (step.type === "reasoning") {
            const stepId = step.id || `reasoning-${index}`;
            const stepExpanded = expandedStep === stepId;
            const hasContent = step.text.length > 0;

            return (
              <div
                key={stepId}
                className={cn(
                  "flex flex-row overflow-hidden shrink-0",
                  !isSingleItem && "pl-3"
                )}
              >
                {/* content column */}
                <div className="flex flex-col w-full min-w-0">
                  {/* header */}
                  <div
                    className={cn(
                      "group/row flex flex-row justify-between items-center gap-4 px-3 py-2 h-[2.625rem]",
                      hasContent &&
                        "hover:bg-[var(--color-background-hover)] cursor-pointer"
                    )}
                    onClick={() => hasContent && toggleStepExpanded(stepId)}
                  >
                    <div className="flex flex-row items-center gap-2 min-w-0">
                      <div
                        className="bottom-[0.5px] relative flex flex-grow gap-2 overflow-hidden text-sm text-left text-ellipsis leading-tight whitespace-nowrap"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {step.isThinking
                          ? "Thinking..."
                          : stepExpanded
                            ? "Thought process"
                            : step.duration
                              ? `Thought for ${step.duration} second${
                                  step.duration !== 1 ? "s" : ""
                                }`
                              : "Thought process"}
                      </div>
                    </div>
                    {hasContent && (
                      <div className="flex flex-row items-center gap-1.5 min-w-0 shrink-0">
                        <ChevronIcon
                          expanded={stepExpanded}
                          className="w-5 h-5"
                          style={{ color: "var(--color-text-secondary)" }}
                        />
                      </div>
                    )}
                  </div>

                  {/* expanded reasoning content */}
                  {stepExpanded && hasContent && (
                    <div
                      className="min-h-0"
                      style={{
                        maskImage:
                          "linear-gradient(transparent 0%, black 0px, black calc(100% - 16px), transparent 100%)",
                      }}
                    >
                      <div
                        className="h-full min-h-0 overflow-x-hidden overflow-y-auto"
                        style={{
                          maxHeight: "238px",
                          scrollbarGutter: "stable",
                        }}
                      >
                        <div
                          className="relative gap-0.5 px-3 pr-8 pb-3 max-w-none font-normal text-sm prose prose-sm"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          <MemoizedMarkdown content={step.text} id={stepId} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          } else {
            // search step
            const { query, results, isSearching } = extractSearchData(
              step.data
            );
            const stepId = step.data.toolInvocationId;
            const stepExpanded = expandedStep === stepId;
            const hasResults = results.length > 0;

            return (
              <div
                key={stepId}
                className={cn(
                  "flex flex-row overflow-hidden shrink-0",
                  !isSingleItem && "pl-3"
                )}
              >
                {/* content column */}
                <div className="flex flex-col w-full min-w-0">
                  {/* header */}
                  <div
                    className={cn(
                      "group/row flex flex-row justify-between items-center gap-4 px-3 py-2 h-[2.625rem]",
                      !isSearching &&
                        hasResults &&
                        "hover:bg-[var(--color-background-hover)] cursor-pointer"
                    )}
                    onClick={() =>
                      !isSearching && hasResults && toggleStepExpanded(stepId)
                    }
                  >
                    <div className="flex flex-row items-center gap-2 min-w-0">
                      {/* inline globe icon */}
                      <div
                        className="flex justify-center items-center shrink-0"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        <GlobeIcon className="w-4 h-4" />
                      </div>
                      <div
                        className="bottom-[0.5px] relative flex flex-grow gap-2 overflow-hidden text-sm text-left text-ellipsis leading-tight whitespace-nowrap"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {query
                          ? `"${query}"`
                          : isSearching
                            ? "Searching..."
                            : "Web search"}
                      </div>
                    </div>
                    <div className="flex flex-row items-center gap-1.5 min-w-0 shrink-0">
                      {!isSearching && hasResults && (
                        <>
                          <p
                            className="bottom-[0.5px] relative pl-1 text-xs leading-tight whitespace-nowrap shrink-0"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            {results.length} result
                            {results.length !== 1 ? "s" : ""}
                          </p>
                          <ChevronIcon
                            expanded={stepExpanded}
                            className="w-5 h-5"
                            style={{ color: "var(--color-text-secondary)" }}
                          />
                        </>
                      )}
                      {isSearching && (
                        <Loader2
                          className="w-4 h-4 animate-spin"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                      )}
                    </div>
                  </div>

                  {/* expanded search results */}
                  {stepExpanded && hasResults && (
                    <div
                      className="min-h-0"
                      style={{
                        maskImage:
                          "linear-gradient(transparent 0%, black 0px, black calc(100% - 16px), transparent 100%)",
                      }}
                    >
                      <div
                        className="h-full min-h-0 overflow-x-hidden overflow-y-auto"
                        style={{
                          maxHeight: "238px",
                          scrollbarGutter: "stable",
                        }}
                      >
                        <div className="flex flex-col flex-nowrap p-2 pt-0">
                          {results.map((result, i) => (
                            <a
                              key={i}
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-row justify-between items-center gap-4 hover:bg-[var(--color-background-hover)] mx-0.5 px-1.5 rounded-sm w-full min-w-0 h-8 transition-colors shrink-0"
                            >
                              <div className="flex flex-row items-center gap-2 min-w-0">
                                {/* favicon */}
                                <div className="flex justify-center items-center w-5 h-5 shrink-0">
                                  <img
                                    alt=""
                                    loading="lazy"
                                    width="16"
                                    height="16"
                                    className="rounded transition duration-500"
                                    src={`https://www.google.com/s2/favicons?sz=64&domain=${result.domain}`}
                                    style={{
                                      maxWidth: "16px",
                                      maxHeight: "16px",
                                    }}
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = "none";
                                    }}
                                  />
                                </div>
                                {/* title */}
                                <p
                                  className="relative overflow-hidden text-sm text-ellipsis whitespace-nowrap shrink"
                                  style={{ color: "var(--color-text-primary)" }}
                                >
                                  {result.title}
                                </p>
                                {/* domain */}
                                <p
                                  className="bottom-[1px] relative text-xs line-clamp-1 shrink-0"
                                  style={{ color: "var(--color-text-muted)" }}
                                >
                                  {result.domain}
                                </p>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}
