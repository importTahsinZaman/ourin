import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { DerivedColors } from "@/providers/ThemeProvider";

interface SubscriptionCardProps {
  colors: DerivedColors;
  subscriptionPriceCents: number;
  subscriptionCredits: number;
  isLoading: boolean;
  onSubscribe: () => void;
}

export function SubscriptionCard({
  colors,
  subscriptionPriceCents,
  subscriptionCredits,
  isLoading,
  onSubscribe,
}: SubscriptionCardProps) {
  const freeUsage = useQuery(api.freeUsage.getFreeUsage);

  const messageCount = freeUsage?.messageCount ?? 0;
  const remainingMessages = freeUsage?.remainingMessages ?? 10;
  const totalMessages = 10;
  const usedPercentage = (messageCount / totalMessages) * 100;
  const isLow = remainingMessages <= 3;

  return (
    <View
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Current Plan */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
          Current Plan: Free
        </Text>
      </View>

      {/* Message usage */}
      <View style={{ marginBottom: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <Text style={{ fontSize: 13, color: colors.textMuted }}>
            Free messages
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: isLow ? colors.error : colors.textMuted,
            }}
          >
            {remainingMessages} of {totalMessages} remaining
          </Text>
        </View>
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
              width: `${usedPercentage}%`,
              backgroundColor: isLow ? colors.error : colors.textMuted,
            }}
          />
        </View>
      </View>

      {/* Upgrade button */}
      <Pressable
        style={{
          backgroundColor: colors.accent,
          borderRadius: 10,
          paddingVertical: 14,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
          opacity: isLoading ? 0.7 : 1,
        }}
        onPress={onSubscribe}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="star" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
              Upgrade to Pro — ${subscriptionPriceCents / 100}/month
            </Text>
          </>
        )}
      </Pressable>

      {/* Features list */}
      <View style={{ marginTop: 16, gap: 8 }}>
        <FeatureRow
          icon="infinite"
          text={`${formatNumber(subscriptionCredits)} credits/month`}
          colors={colors}
        />
        <FeatureRow
          icon="apps"
          text="Access to all AI models"
          colors={colors}
        />
        <FeatureRow icon="flash" text="Priority processing" colors={colors} />
        <FeatureRow
          icon="cart"
          text="Buy additional credit packs"
          colors={colors}
        />
      </View>
    </View>
  );
}

function FeatureRow({
  icon,
  text,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  colors: DerivedColors;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Ionicons name={icon} size={16} color={colors.success} />
      <Text style={{ fontSize: 13, color: colors.textMuted }}>{text}</Text>
    </View>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}k`;
  }
  return num.toLocaleString();
}
