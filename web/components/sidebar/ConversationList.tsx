"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { MoreHorizontal, Pencil, Trash2, Star } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn, formatRelativeDate, groupBy } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

interface ConversationListProps {
  currentConversationId: string | null;
  onSelect: (id: string | null) => void;
}

interface Conversation {
  _id: Id<"conversations">;
  title?: string;
  updatedAt: number;
  isFavorite?: boolean;
}

export function ConversationList({
  currentConversationId,
  onSelect,
}: ConversationListProps) {
  const conversations = useQuery(api.conversations.list) as
    | Conversation[]
    | undefined;
  const updateTitle = useMutation(api.conversations.updateTitle);
  const removeConversation = useMutation(api.conversations.remove);
  const toggleFavorite = useMutation(api.conversations.toggleFavorite);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Hover preview state
  const [committedConversationId, setCommittedConversationId] = useState<
    string | null
  >(currentConversationId);
  const [isHovering, setIsHovering] = useState(false);
  const [isExitingHover, setIsExitingHover] = useState(false);
  const hoverEnterTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync committed ID when current changes from external navigation (e.g., URL change)
  useEffect(() => {
    if (!isHovering && !isExitingHover) {
      setCommittedConversationId(currentConversationId);
    }
  }, [currentConversationId, isHovering, isExitingHover]);

  // Complete the hover exit once URL has updated to match committed
  useEffect(() => {
    if (isExitingHover && currentConversationId === committedConversationId) {
      setIsHovering(false);
      setIsExitingHover(false);
    }
  }, [isExitingHover, currentConversationId, committedConversationId]);

  // Close menu when clicking outside (but not on menu buttons)
  useEffect(() => {
    if (!menuOpenId) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking on a menu button or inside a dropdown menu
      if (
        target.closest("[data-menu-button]") ||
        target.closest("[data-dropdown-menu]")
      ) {
        return;
      }
      setMenuOpenId(null);
    };

    // Use setTimeout to avoid the click that opened the menu from immediately closing it
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [menuOpenId]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Cleanup hover timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverEnterTimeoutRef.current) {
        clearTimeout(hoverEnterTimeoutRef.current);
      }
      if (hoverLeaveTimeoutRef.current) {
        clearTimeout(hoverLeaveTimeoutRef.current);
      }
    };
  }, []);

  // Handle hover enter - preview conversation
  const handleHoverEnter = (convId: string) => {
    // Don't preview if menu is open or editing
    if (menuOpenId || editingId) return;

    // Cancel any pending leave - we're entering a new conversation
    if (hoverLeaveTimeoutRef.current) {
      clearTimeout(hoverLeaveTimeoutRef.current);
      hoverLeaveTimeoutRef.current = null;
    }

    // Cancel exiting state if re-entering
    if (isExitingHover) {
      setIsExitingHover(false);
    }

    // Clear any pending enter timeout
    if (hoverEnterTimeoutRef.current) {
      clearTimeout(hoverEnterTimeoutRef.current);
    }

    // If already in hover/browse mode, switch instantly
    if (isHovering) {
      onSelect(convId);
    } else {
      // Require a brief pause before entering browse mode
      // This prevents accidental triggers when moving through sidebar
      hoverEnterTimeoutRef.current = setTimeout(() => {
        setIsHovering(true);
        onSelect(convId);
      }, 150);
    }
  };

  // Handle hover leave - restore committed conversation after delay
  const handleHoverLeave = () => {
    // Clear pending enter
    if (hoverEnterTimeoutRef.current) {
      clearTimeout(hoverEnterTimeoutRef.current);
      hoverEnterTimeoutRef.current = null;
    }

    // Clear any existing leave timeout
    if (hoverLeaveTimeoutRef.current) {
      clearTimeout(hoverLeaveTimeoutRef.current);
    }

    if (isHovering && !isExitingHover) {
      // Delay restoration to allow moving to another conversation
      hoverLeaveTimeoutRef.current = setTimeout(() => {
        // Start exiting - keep isHovering true until URL updates
        // This prevents flicker where committed loses selected styling
        setIsExitingHover(true);
        onSelect(committedConversationId);
      }, 75);
    }
  };

  // Handle click - commit to this conversation
  const handleCommitSelect = (convId: string) => {
    // Clear all pending timeouts
    if (hoverEnterTimeoutRef.current) {
      clearTimeout(hoverEnterTimeoutRef.current);
      hoverEnterTimeoutRef.current = null;
    }
    if (hoverLeaveTimeoutRef.current) {
      clearTimeout(hoverLeaveTimeoutRef.current);
      hoverLeaveTimeoutRef.current = null;
    }

    setIsHovering(false);
    setIsExitingHover(false);
    setCommittedConversationId(convId);
    onSelect(convId);
  };

  if (!conversations) {
    return (
      <div className="py-4 text-center">
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Loading...
        </span>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="px-3 py-10 text-center">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          No conversations yet
        </p>
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          Start chatting to see history
        </p>
      </div>
    );
  }

  // Group order for date-based grouping
  const groupOrder = ["Today", "Yesterday", "Last 7 days", "Last 30 days"];

  const handleStartEdit = (conv: Conversation) => {
    setEditingId(conv._id);
    setEditTitle(conv.title || "New conversation");
    setMenuOpenId(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (editTitle.trim()) {
      await updateTitle({
        id: id as Id<"conversations">,
        title: editTitle.trim(),
      });
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const handleDelete = async (id: string) => {
    await removeConversation({ id: id as Id<"conversations"> });
    setMenuOpenId(null);
    if (currentConversationId === id || committedConversationId === id) {
      setCommittedConversationId(null);
      onSelect(null);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite({ id: id as Id<"conversations"> });
    setMenuOpenId(null);
  };

  // Separate favorites from regular conversations
  const favorites = conversations.filter((c) => c.isFavorite);
  const regularConversations = conversations.filter((c) => !c.isFavorite);

  // Group only non-favorite conversations by date
  const grouped = groupBy(regularConversations, (c) =>
    formatRelativeDate(c.updatedAt)
  );

  // Get ordered group keys for regular conversations
  const orderedGroupsFiltered = [
    ...groupOrder.filter((g) => grouped[g]),
    ...Object.keys(grouped).filter((g) => !groupOrder.includes(g)),
  ];

  // Render a conversation item
  const renderConversationItem = (conv: Conversation) => {
    const isActive = currentConversationId === conv._id;
    const isCommitted = committedConversationId === conv._id;
    const isEditing = editingId === conv._id;
    const isMenuOpen = menuOpenId === conv._id;

    // When in browse/hover mode (or exiting): show selected styling only for committed conversation
    // When not hovering: show selected styling for URL-active conversation
    // Previewed conversations get hover styling from CSS (not selected styling)
    const showSelectedStyle =
      isHovering || isExitingHover ? isCommitted : isActive;

    return (
      <div
        key={conv._id}
        role="button"
        tabIndex={0}
        className={cn(
          "group relative flex items-center gap-2 px-2 py-2 rounded-sm cursor-pointer",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] focus-visible:ring-offset-1",
          showSelectedStyle
            ? "bg-[var(--color-background-active)]"
            : "[&:hover:not(:has(button:hover))]:bg-[var(--color-background-hover)] [&:focus:not(:has(button:focus))]:bg-[var(--color-background-hover)]"
        )}
        onClick={() => !isEditing && handleCommitSelect(conv._id)}
        onMouseEnter={() => !isEditing && handleHoverEnter(conv._id)}
        onMouseLeave={handleHoverLeave}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!isEditing) handleCommitSelect(conv._id);
          }
        }}
      >
        {isEditing ? (
          <input
            ref={editInputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSaveEdit(conv._id);
              } else if (e.key === "Escape") {
                handleCancelEdit();
              }
            }}
            onBlur={() => handleSaveEdit(conv._id)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-[var(--color-background-input)] px-1 py-0.5 border border-[var(--color-border-focus)] rounded outline-none text-sm"
            style={{ color: "var(--color-text-primary)" }}
          />
        ) : (
          <>
            <span
              className="flex-1 text-sm truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              {conv.title || "New conversation"}
            </span>

            {/* More button with fade */}
            <div className="group/btn right-0 absolute inset-y-0 flex items-center pr-1">
              <div
                className={cn(
                  "flex items-center",
                  !isMenuOpen &&
                    "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-focus:opacity-100 group-hover/btn:opacity-100"
                )}
              >
                <button
                  data-menu-button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId((prev) =>
                      prev === conv._id ? null : conv._id
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      setMenuOpenId((prev) =>
                        prev === conv._id ? null : conv._id
                      );
                    } else if (e.key === "Escape") {
                      setMenuOpenId(null);
                    }
                  }}
                  className="hover:bg-[var(--color-background-tertiary)] p-1.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]"
                  style={{
                    backgroundColor: showSelectedStyle
                      ? "var(--color-background-active)"
                      : "var(--color-background-hover)",
                  }}
                  aria-label="Conversation options"
                  aria-expanded={isMenuOpen}
                  aria-haspopup="menu"
                >
                  <MoreHorizontal
                    className="w-4 h-4 pointer-events-none"
                    style={{ color: "var(--color-text-tertiary)" }}
                  />
                </button>

                {/* Dropdown menu */}
                {isMenuOpen && (
                  <div
                    data-dropdown-menu
                    role="menu"
                    className="top-full right-0 z-[9999] absolute shadow-xl mt-1 py-1 border rounded-sm min-w-[120px]"
                    style={{
                      backgroundColor: "var(--color-background-elevated)",
                      borderColor: "var(--color-border-default)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setMenuOpenId(null);
                      }
                    }}
                  >
                    <button
                      role="menuitem"
                      onClick={() => handleToggleFavorite(conv._id)}
                      className="flex items-center gap-2 hover:bg-[var(--color-background-hover)] focus:bg-[var(--color-background-hover)] px-3 py-1.5 focus:outline-none w-full text-sm transition-colors"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      <Star
                        className={cn(
                          "w-4 h-4",
                          conv.isFavorite && "fill-current"
                        )}
                        style={{
                          color: conv.isFavorite
                            ? "var(--color-accent-primary)"
                            : "currentColor",
                        }}
                      />
                      {conv.isFavorite ? "Unfavorite" : "Favorite"}
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => handleStartEdit(conv)}
                      className="flex items-center gap-2 hover:bg-[var(--color-background-hover)] focus:bg-[var(--color-background-hover)] px-3 py-1.5 focus:outline-none w-full text-sm transition-colors"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      <Pencil className="w-4 h-4" />
                      Rename
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => handleDelete(conv._id)}
                      className="flex items-center gap-2 hover:bg-[var(--color-background-hover)] focus:bg-[var(--color-background-hover)] px-3 py-1.5 focus:outline-none w-full text-red-500 text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4" onMouseLeave={handleHoverLeave}>
      {/* Favorites section */}
      {favorites.length > 0 && (
        <div>
          <div
            className="px-2 py-1.5 font-semibold text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-text-muted)" }}
          >
            Favorites
          </div>
          <div className="space-y-0.5">
            {favorites.map(renderConversationItem)}
          </div>
        </div>
      )}

      {/* Regular conversations grouped by date */}
      {orderedGroupsFiltered.map((group) => (
        <div key={group}>
          {/* Group header */}
          <div
            className="px-2 py-1.5 font-semibold text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-text-muted)" }}
          >
            {group}
          </div>

          {/* Conversations in group */}
          <div className="space-y-0.5">
            {grouped[group].map(renderConversationItem)}
          </div>
        </div>
      ))}
    </div>
  );
}
