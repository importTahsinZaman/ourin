"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { LucideIcon } from "lucide-react";

// types
export interface FuzzyMatch {
  score: number;
  matchedIndices: number[];
}

export interface SearchableItem {
  id: string;
  label: string;
  keywords?: string[];
  type: "action" | "chat" | "theme";
  icon?: LucideIcon;
  shortcut?: string;
  data?: unknown;
}

export interface SearchResult extends SearchableItem {
  matchedIndices: number[];
  score: number;
}

export interface GroupedResults {
  actions: SearchResult[];
  themes: SearchResult[];
  chats: SearchResult[];
}

/**
 * fuzzy match algorithm - matches characters sequentially with scoring
 * inspired by linear's command palette behavior
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  if (!query) return { score: 0, matchedIndices: [] };

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const matchedIndices: number[] = [];
  let queryIndex = 0;
  let score = 0;
  let lastMatchIndex = -1;

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matchedIndices.push(i);

      // bonus for consecutive matches
      if (lastMatchIndex === i - 1) {
        score += 5;
      }

      // bonus for match at word boundary (start of word)
      if (
        i === 0 ||
        text[i - 1] === " " ||
        text[i - 1] === "-" ||
        text[i - 1] === "_"
      ) {
        score += 10;
      }

      // bonus for exact case match
      if (text[i] === query[queryIndex]) {
        score += 1;
      }

      lastMatchIndex = i;
      queryIndex++;
    }
  }

  // all query characters must be matched
  if (queryIndex !== queryLower.length) {
    return null;
  }

  // base score for matching
  score += 50;

  // penalize by text length (prefer shorter matches)
  score -= text.length * 0.5;

  // bonus if query matches start of text
  if (textLower.startsWith(queryLower)) {
    score += 20;
  }

  return { score, matchedIndices };
}

/**
 * search an item against a query, checking label and keywords
 */
function searchItem(item: SearchableItem, query: string): SearchResult | null {
  // try matching label first
  const labelMatch = fuzzyMatch(query, item.label);
  if (labelMatch) {
    return {
      ...item,
      matchedIndices: labelMatch.matchedIndices,
      score: labelMatch.score,
    };
  }

  // try matching keywords
  if (item.keywords) {
    for (const keyword of item.keywords) {
      const keywordMatch = fuzzyMatch(query, keyword);
      if (keywordMatch) {
        return {
          ...item,
          matchedIndices: [], // no highlighting since match was on keyword
          score: keywordMatch.score - 10, // slightly lower priority than label matches
        };
      }
    }
  }

  return null;
}

interface UseCommandPaletteOptions {
  items: SearchableItem[];
  isOpen: boolean;
}

export function useCommandPalette({ items, isOpen }: UseCommandPaletteOptions) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1); // -1 = no selection, enter creates new chat
  const inputRef = useRef<HTMLInputElement>(null);

  // filter and group results
  const { groupedResults, flatResults } = useMemo(() => {
    const grouped: GroupedResults = {
      actions: [],
      themes: [],
      chats: [],
    };

    const getGroupKey = (type: SearchableItem["type"]) => {
      switch (type) {
        case "action":
          return "actions";
        case "theme":
          return "themes";
        case "chat":
          return "chats";
      }
    };

    if (!query.trim()) {
      // when no query, show all items grouped by type
      for (const item of items) {
        const result: SearchResult = {
          ...item,
          matchedIndices: [],
          score: 0,
        };
        grouped[getGroupKey(item.type)].push(result);
      }
    } else {
      // search and filter
      for (const item of items) {
        const result = searchItem(item, query);
        if (result) {
          grouped[getGroupKey(item.type)].push(result);
        }
      }

      // sort each group by score
      grouped.actions.sort((a, b) => b.score - a.score);
      grouped.themes.sort((a, b) => b.score - a.score);
      grouped.chats.sort((a, b) => b.score - a.score);
    }

    // limit results per section
    grouped.actions = grouped.actions.slice(0, 5);
    grouped.themes = grouped.themes.slice(0, 10);
    grouped.chats = grouped.chats.slice(0, 8);

    // create flat list for keyboard navigation
    const flat: SearchResult[] = [
      ...grouped.actions,
      ...grouped.chats,
      ...grouped.themes,
    ];

    return { groupedResults: grouped, flatResults: flat };
  }, [items, query]);

  // reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(-1);
      // focus input after a tick to ensure dOM is ready
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // reset selection when results change (keep at -1 for new chat behavior)
  useEffect(() => {
    setSelectedIndex(-1);
  }, [flatResults.length]);

  // keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => {
            if (prev < 0) return 0; // from no selection to first item
            return prev < flatResults.length - 1 ? prev + 1 : -1; // wrap to no selection
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => {
            if (prev < 0) return flatResults.length - 1; // from no selection to last item
            return prev > 0 ? prev - 1 : -1; // wrap to no selection
          });
          break;
      }
    },
    [flatResults.length]
  );

  const selectedItem = flatResults[selectedIndex] ?? null;

  return {
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    groupedResults,
    flatResults,
    selectedItem,
    inputRef,
    handleKeyDown,
  };
}
