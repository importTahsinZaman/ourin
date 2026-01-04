import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

interface UsageCardProps {
  accentColor?: string;
}

export function UsageCard({ accentColor = "#d97756" }: UsageCardProps) {
  const usageSummary = useQuery(api.usage.getUsageSummary);

  // Loading state
  if (usageSummary === undefined) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={accentColor} />
        </View>
      </View>
    );
  }

  // No subscription (free tier or not signed in)
  if (usageSummary === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>Subscribe to view usage details</Text>
      </View>
    );
  }

  // Self-hosting mode - just show token usage
  if (usageSummary.isSelfHosting) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Token Usage</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatNumber(usageSummary.totalInputTokens)}
            </Text>
            <Text style={styles.statLabel}>Input Tokens</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatNumber(usageSummary.totalOutputTokens)}
            </Text>
            <Text style={styles.statLabel}>Output Tokens</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{usageSummary.messageCount}</Text>
            <Text style={styles.statLabel}>Messages</Text>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Monthly Credits</Text>
        {periodStart && periodEnd && (
          <Text style={styles.period}>
            {periodStart} - {periodEnd}
          </Text>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${percentage}%`,
                backgroundColor: isLow ? "#ef4444" : accentColor,
              },
            ]}
          />
        </View>
      </View>

      {/* Credits info */}
      <View style={styles.creditsRow}>
        <Text style={[styles.creditsRemaining, isLow && styles.creditsLow]}>
          {formatNumber(remaining)}
        </Text>
        <Text style={styles.creditsTotal}>
          / {formatNumber(subscriptionCredits)} remaining
        </Text>
      </View>

      {/* Purchased credits */}
      {usageSummary.purchasedBalance !== null &&
        usageSummary.purchasedBalance > 0 && (
          <View style={styles.purchasedRow}>
            <Text style={styles.purchasedLabel}>+ Purchased:</Text>
            <Text style={styles.purchasedValue}>
              {formatNumber(usageSummary.purchasedBalance)} credits
            </Text>
          </View>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#262626",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  noDataText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f5f5f4",
  },
  period: {
    fontSize: 12,
    color: "#9ca3af",
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#404040",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  creditsRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  creditsRemaining: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f5f5f4",
  },
  creditsLow: {
    color: "#ef4444",
  },
  creditsTotal: {
    fontSize: 14,
    color: "#9ca3af",
    marginLeft: 4,
  },
  purchasedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  purchasedLabel: {
    fontSize: 13,
    color: "#9ca3af",
  },
  purchasedValue: {
    fontSize: 13,
    color: "#22c55e",
    marginLeft: 4,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f5f5f4",
  },
  statLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
});
