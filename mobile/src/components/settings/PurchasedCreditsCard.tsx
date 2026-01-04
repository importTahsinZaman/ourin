import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { DerivedColors } from "@/providers/ThemeProvider";

interface PurchasedCreditsCardProps {
  colors: DerivedColors;
  creditPackAmount: number;
  creditPackPriceCents: number;
  isLoading: boolean;
  onBuyCredits: () => void;
}

export function PurchasedCreditsCard({
  colors,
  creditPackAmount,
  creditPackPriceCents,
  isLoading,
  onBuyCredits,
}: PurchasedCreditsCardProps) {
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const purchasedBalance = useQuery(api.creditPurchases.getPurchasedBalance);
  const purchaseHistory = useQuery(api.creditPurchases.getPurchaseHistory);

  const balance = purchasedBalance?.balance ?? 0;
  const hasCredits = balance > 0;
  const hasHistory = purchaseHistory && purchaseHistory.length > 0;

  return (
    <View
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
          Purchased Credits
        </Text>
        {hasCredits && (
          <View
            style={{
              backgroundColor: colors.success + "20",
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 4,
            }}
          >
            <Text
              style={{ fontSize: 11, color: colors.success, fontWeight: "500" }}
            >
              Never expire
            </Text>
          </View>
        )}
      </View>

      {/* Balance */}
      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: hasCredits ? colors.text : colors.textMuted,
          }}
        >
          {formatNumber(balance)}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
          credits remaining
        </Text>
      </View>

      {/* Purchase history toggle */}
      {hasHistory && (
        <Pressable
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            borderBottomWidth: historyExpanded ? 1 : 0,
            borderBottomColor: colors.border,
          }}
          onPress={() => setHistoryExpanded(!historyExpanded)}
        >
          <Text style={{ fontSize: 13, color: colors.textMuted }}>
            Purchase History
          </Text>
          <Ionicons
            name={historyExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textMuted}
          />
        </Pressable>
      )}

      {/* Purchase history list */}
      {historyExpanded && purchaseHistory && (
        <View style={{ paddingTop: 8 }}>
          {purchaseHistory.slice(0, 10).map((purchase) => (
            <PurchaseHistoryRow
              key={purchase._id}
              purchase={purchase}
              colors={colors}
            />
          ))}
        </View>
      )}

      {/* Buy credits button */}
      <Pressable
        style={{
          backgroundColor: colors.backgroundTertiary,
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
          marginTop: 12,
          opacity: isLoading ? 0.7 : 1,
        }}
        onPress={onBuyCredits}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.text} />
        ) : (
          <>
            <Ionicons name="add-circle" size={18} color={colors.text} />
            <Text
              style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}
            >
              Buy Credits — ${creditPackPriceCents / 100} for{" "}
              {formatNumber(creditPackAmount)}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

interface Purchase {
  _id: string;
  creditsAmount: number;
  creditsRemaining: number;
  status: string;
  purchasedAt: number;
}

function PurchaseHistoryRow({
  purchase,
  colors,
}: {
  purchase: Purchase;
  colors: DerivedColors;
}) {
  const isActive =
    purchase.status === "active" && purchase.creditsRemaining > 0;
  const date = new Date(purchase.purchasedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: isActive ? colors.success : colors.textTertiary,
          }}
        />
        <Text style={{ fontSize: 13, color: colors.textMuted }}>{date}</Text>
      </View>
      <Text
        style={{
          fontSize: 13,
          color: isActive ? colors.text : colors.textTertiary,
        }}
      >
        {formatNumber(purchase.creditsRemaining)} /{" "}
        {formatNumber(purchase.creditsAmount)}
      </Text>
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
