import React from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { DerivedColors } from "@/providers/ThemeProvider";

interface UsageCardProps {
  accentColor?: string;
  colors: DerivedColors;
  onManageSubscription?: () => void;
  isManaging?: boolean;
}

export function UsageCard({
  accentColor = "#d97756",
  colors,
  onManageSubscription,
  isManaging,
}: UsageCardProps) {
  const usageSummary = useQuery(api.usage.getUsageSummary);

  // Loading state
  if (usageSummary === undefined) {
    return (
      <View
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <View style={{ paddingVertical: 20, alignItems: "center" }}>
          <ActivityIndicator size="small" color={accentColor} />
        </View>
      </View>
    );
  }

  // No subscription (free tier or not signed in)
  if (usageSummary === null) {
    return (
      <View
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            color: colors.textMuted,
            textAlign: "center",
            paddingVertical: 8,
          }}
        >
          Subscribe to view usage details
        </Text>
      </View>
    );
  }

  // Self-hosting mode - just show token usage
  if (usageSummary.isSelfHosting) {
    return (
      <View
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
            Token Usage
          </Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <View style={{ alignItems: "center" }}>
            <Text
              style={{ fontSize: 18, fontWeight: "700", color: colors.text }}
            >
              {formatNumber(usageSummary.totalInputTokens)}
            </Text>
            <Text
              style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}
            >
              Input Tokens
            </Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text
              style={{ fontSize: 18, fontWeight: "700", color: colors.text }}
            >
              {formatNumber(usageSummary.totalOutputTokens)}
            </Text>
            <Text
              style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}
            >
              Output Tokens
            </Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text
              style={{ fontSize: 18, fontWeight: "700", color: colors.text }}
            >
              {usageSummary.messageCount}
            </Text>
            <Text
              style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}
            >
              Messages
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Hosted mode - show credit usage
  const subscriptionCredits = 10000; // Default subscription credits
  const used = usageSummary.totalCreditsUsed ?? 0;
  const remaining = usageSummary.subscriptionBalance ?? 0;
  const percentage = Math.min(100, (used / subscriptionCredits) * 100);
  const isLow = remaining < subscriptionCredits * 0.25;

  // Format period dates
  const periodStart = usageSummary.periodStart
    ? new Date(usageSummary.periodStart).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;
  const periodEnd = usageSummary.periodEnd
    ? new Date(usageSummary.periodEnd).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <View
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
          Monthly Credits
        </Text>
        {periodStart && periodEnd && (
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {periodStart} - {periodEnd}
          </Text>
        )}
      </View>

      {/* Progress bar */}
      <View style={{ marginBottom: 8 }}>
        <View
          style={{
            height: 8,
            backgroundColor: colors.backgroundTertiary,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: "100%",
              borderRadius: 4,
              width: `${percentage}%`,
              backgroundColor: isLow ? colors.error : accentColor,
            }}
          />
        </View>
      </View>

      {/* Credits info */}
      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: isLow ? colors.error : colors.text,
          }}
        >
          {formatNumber(remaining)}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, marginLeft: 4 }}>
          / {formatNumber(subscriptionCredits)} remaining
        </Text>
      </View>

      {/* Purchased credits */}
      {usageSummary.purchasedBalance !== null &&
        usageSummary.purchasedBalance > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 8,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 13, color: colors.textMuted }}>
              + Purchased:
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.success,
                marginLeft: 4,
                fontWeight: "500",
              }}
            >
              {formatNumber(usageSummary.purchasedBalance)} credits
            </Text>
          </View>
        )}

      {/* Manage subscription button */}
      {onManageSubscription && (
        <Pressable
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 12,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            opacity: isManaging ? 0.7 : 1,
          }}
          onPress={onManageSubscription}
          disabled={isManaging}
        >
          {isManaging ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <>
              <Ionicons
                name="settings-outline"
                size={16}
                color={colors.textMuted}
              />
              <Text style={{ fontSize: 14, color: colors.textMuted }}>
                Manage Subscription
              </Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toLocaleString();
}
