"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  Check,
  X,
  Trash2,
  Loader2,
  Lock,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { validateKeyFormat } from "@/lib/encryption";
import { toast } from "sonner";
import { SettingsSection } from "../SettingsModal";

interface Provider {
  id: string;
  name: string;
  icon: string;
  placeholder: string;
}

const PROVIDERS: Provider[] = [
  {
    id: "openai",
    name: "OpenAI",
    icon: "/icons/providers/openai.svg",
    placeholder: "sk-...",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: "/icons/providers/anthropic.svg",
    placeholder: "sk-ant-...",
  },
  {
    id: "google",
    name: "Google",
    icon: "/icons/providers/google.svg",
    placeholder: "AIza...",
  },
];

interface LocalKeyState {
  value: string;
  isEditing: boolean;
  showValue: boolean;
  isSaving: boolean;
}

export function ApiKeysTab() {
  // Fetch existing API keys and tier info from backend
  const existingKeys = useQuery(api.apiKeys.getApiKeys);
  const tierInfo = useQuery(api.billing.getUserTier);
  const deleteApiKeyMutation = useMutation(api.apiKeys.deleteApiKey);
  const generateChatToken = useMutation(api.chatAuth.generateChatToken);

  // Local state for input values and UI state
  const [localState, setLocalState] = useState<Record<string, LocalKeyState>>({
    openai: { value: "", isEditing: false, showValue: false, isSaving: false },
    anthropic: {
      value: "",
      isEditing: false,
      showValue: false,
      isSaving: false,
    },
    google: { value: "", isEditing: false, showValue: false, isSaving: false },
  });

  const isSubscriber = tierInfo?.tier === "subscriber";

  // Check if a provider has a configured key
  const isKeyConfigured = (providerId: string) => {
    return existingKeys?.some((k) => k.provider === providerId) ?? false;
  };

  // Get the key hint for a provider
  const getConfiguredKeyHint = (providerId: string) => {
    return existingKeys?.find((k) => k.provider === providerId)?.keyHint ?? "";
  };

  const handleEdit = (providerId: string) => {
    setLocalState((prev) => ({
      ...prev,
      [providerId]: { ...prev[providerId], isEditing: true },
    }));
  };

  const handleSave = async (providerId: string) => {
    const state = localState[providerId];
    if (!state.value.trim()) return;

    // Validate key format
    if (!validateKeyFormat(providerId, state.value)) {
      toast.error("Invalid API key format", {
        description: `The key doesn't match the expected format for ${providerId}.`,
      });
      return;
    }

    setLocalState((prev) => ({
      ...prev,
      [providerId]: { ...prev[providerId], isSaving: true },
    }));

    try {
      // Get auth token for API route
      const tokenResult = await generateChatToken();
      if (!tokenResult?.token) {
        throw new Error("Failed to get auth token");
      }

      // Send to API route for server-side encryption
      const response = await fetch("/api/keys/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenResult.token}`,
        },
        body: JSON.stringify({
          provider: providerId,
          apiKey: state.value,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        // Handle subscription required error specifically
        if (data.code === "SUBSCRIPTION_REQUIRED") {
          toast.error("Subscription required", {
            description:
              "BYOK is a subscriber-only feature. Subscribe to unlock.",
          });
        } else {
          throw new Error(data.error || "Failed to save API key");
        }
        setLocalState((prev) => ({
          ...prev,
          [providerId]: { ...prev[providerId], isSaving: false },
        }));
        return;
      }

      toast.success("API key saved", {
        description: `Your ${
          PROVIDERS.find((p) => p.id === providerId)?.name
        } key has been saved securely.`,
      });

      // Reset local state
      setLocalState((prev) => ({
        ...prev,
        [providerId]: {
          value: "",
          isEditing: false,
          showValue: false,
          isSaving: false,
        },
      }));
    } catch (error) {
      console.error("Failed to save API key:", error);
      toast.error("Failed to save API key", {
        description: "Please try again.",
      });
      setLocalState((prev) => ({
        ...prev,
        [providerId]: { ...prev[providerId], isSaving: false },
      }));
    }
  };

  const handleCancel = (providerId: string) => {
    setLocalState((prev) => ({
      ...prev,
      [providerId]: { ...prev[providerId], isEditing: false, value: "" },
    }));
  };

  const handleRemove = async (providerId: string) => {
    try {
      await deleteApiKeyMutation({ provider: providerId });
      toast.success("API key removed", {
        description: `Your ${
          PROVIDERS.find((p) => p.id === providerId)?.name
        } key has been removed.`,
      });
    } catch (error) {
      console.error("Failed to remove API key:", error);
      toast.error("Failed to remove API key", {
        description: "Please try again.",
      });
    }
  };

  const toggleShowValue = (providerId: string) => {
    setLocalState((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        showValue: !prev[providerId].showValue,
      },
    }));
  };

  // Loading state
  if (existingKeys === undefined || tierInfo === undefined) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2
          className="w-6 h-6 animate-spin"
          style={{ color: "var(--color-text-muted)" }}
        />
      </div>
    );
  }

  // Non-subscriber: show upgrade prompt
  if (!isSubscriber) {
    return (
      <div className="space-y-6">
        <SettingsSection
          title="API Keys"
          description="Bring your own API keys to use your preferred AI providers."
        >
          <div
            className="p-6 border rounded-sm text-center"
            style={{
              backgroundColor: "var(--color-background-tertiary)",
              borderColor: "var(--color-border-default)",
            }}
          >
            <div
              className="flex justify-center items-center mx-auto mb-4 rounded-full w-12 h-12"
              style={{ backgroundColor: "var(--color-background-hover)" }}
            >
              <Lock
                className="w-6 h-6"
                style={{ color: "var(--color-accent-primary)" }}
              />
            </div>
            <h4
              className="mb-2 font-medium text-lg"
              style={{ color: "var(--color-text-primary)" }}
            >
              Subscriber Feature
            </h4>
            <p
              className="mb-4 text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Bring Your Own Key (BYOK) is available for subscribers. Use your
              own OpenAI, Anthropic, or Google API keys to bypass credit usage
              and access all models directly.
            </p>
            <div
              className="space-y-2 mb-4 text-left text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                <span>Use your own API keys from any supported provider</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Messages using your keys don't consume credits</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Keys are encrypted and stored securely</span>
              </div>
            </div>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Go to the Account tab to subscribe and unlock BYOK.
            </p>
          </div>
        </SettingsSection>
      </div>
    );
  }

  // Subscriber: show full API key management UI
  return (
    <div className="space-y-6">
      <SettingsSection
        title="API Keys"
        description="Add your API keys to use different AI providers. Messages using your keys don't consume credits."
      >
        <div className="space-y-4">
          {PROVIDERS.map((provider) => {
            const state = localState[provider.id];
            const configured = isKeyConfigured(provider.id);
            const hint = getConfiguredKeyHint(provider.id);

            return (
              <div
                key={provider.id}
                className="p-4 border rounded-sm"
                style={{
                  backgroundColor: "var(--color-background-tertiary)",
                  borderColor: "var(--color-border-default)",
                }}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    {/* Provider icon */}
                    <div
                      className="w-6 h-6"
                      style={{
                        backgroundColor: "var(--color-text-primary)",
                        mask: `url(${provider.icon}) center/contain no-repeat`,
                        WebkitMask: `url(${provider.icon}) center/contain no-repeat`,
                      }}
                    />
                    <div>
                      <h4
                        className="font-medium"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {provider.name}
                      </h4>
                      {configured && !state.isEditing && (
                        <span className="flex items-center gap-1 text-green-500 text-xs">
                          <Check className="w-3 h-3" />
                          Configured
                          <span
                            className="font-mono"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            (****{hint})
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {configured && !state.isEditing && (
                    <button
                      onClick={() => handleRemove(provider.id)}
                      className="hover:bg-red-500/10 px-3 py-1.5 rounded-sm text-red-500 text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Input field */}
                {(state.isEditing || !configured) && (
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={state.showValue ? "text" : "password"}
                        value={state.value}
                        onChange={(e) =>
                          setLocalState((prev) => ({
                            ...prev,
                            [provider.id]: {
                              ...prev[provider.id],
                              value: e.target.value,
                            },
                          }))
                        }
                        placeholder={provider.placeholder}
                        disabled={state.isSaving}
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore
                        data-form-type="other"
                        name={`apikey_${provider.id}_input`}
                        className={cn(
                          "px-3 py-2 pr-10 rounded-sm w-full font-mono text-sm",
                          "transition-colors",
                          "placeholder:text-[var(--color-text-muted)]",
                          "focus:outline-none focus:border-[var(--color-border-focus)]",
                          "disabled:opacity-50"
                        )}
                        style={{
                          backgroundColor: "var(--color-background-input)",
                          border: "1px solid var(--color-border-default)",
                          color: "var(--color-text-primary)",
                        }}
                      />
                      <button
                        onClick={() => toggleShowValue(provider.id)}
                        className="top-1/2 right-2 absolute p-1 rounded -translate-y-1/2"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {state.showValue ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {state.isEditing ? (
                      <>
                        <button
                          onClick={() => handleCancel(provider.id)}
                          disabled={state.isSaving}
                          className="hover:bg-[var(--color-background-hover)] disabled:opacity-50 p-2 rounded-sm transition-colors"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSave(provider.id)}
                          disabled={!state.value.trim() || state.isSaving}
                          className="flex items-center gap-2 disabled:opacity-50 px-3 py-2 rounded-sm font-medium text-sm transition-colors"
                          style={{
                            backgroundColor: "var(--color-accent-primary)",
                            color: "var(--color-text-inverse)",
                          }}
                        >
                          {state.isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleSave(provider.id)}
                        disabled={!state.value.trim() || state.isSaving}
                        className="flex items-center gap-2 disabled:opacity-50 px-4 py-2 rounded-sm font-medium text-sm transition-colors"
                        style={{
                          backgroundColor: state.value.trim()
                            ? "var(--color-accent-primary)"
                            : "var(--color-background-hover)",
                          color: state.value.trim()
                            ? "var(--color-text-inverse)"
                            : "var(--color-text-muted)",
                        }}
                      >
                        {state.isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </button>
                    )}
                  </div>
                )}

                {configured && !state.isEditing && (
                  <button
                    onClick={() => handleEdit(provider.id)}
                    className="text-sm transition-colors"
                    style={{ color: "var(--color-text-link)" }}
                  >
                    Update key
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        Your API keys are encrypted and stored securely. We never log or share
        your keys. Messages sent using your own keys don't consume subscription
        credits.
      </p>
    </div>
  );
}
