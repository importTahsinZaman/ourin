import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuth, useBilling } from "@/hooks";
import { useTheme, type DerivedColors } from "@/providers/ThemeProvider";
import { ThemePickerModal } from "@/components/ThemePickerModal";
import { FontPickerModal } from "@/components/FontPickerModal";
import { UsageCard } from "@/components/settings/UsageCard";
import { SubscriptionCard } from "@/components/settings/SubscriptionCard";
import { PurchasedCreditsCard } from "@/components/settings/PurchasedCreditsCard";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { signOut } = useAuthActions();
  const { theme, currentFont, colors } = useTheme();
  const {
    tier,
    billingConfig,
    isLoading: billingLoading,
    isSelfHosting,
    openSubscribeCheckout,
    openBuyCreditsCheckout,
    openManageSubscription,
  } = useBilling();

  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const [fontPickerVisible, setFontPickerVisible] = useState(false);

  const isSubscriber = tier === "subscriber";
  const isFree = tier === "free";

  const handleSignOut = async () => {
    await signOut();
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 8,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          style={{
            width: 44,
            height: 44,
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text }}>
          Settings
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 8,
            marginTop: 8,
            paddingLeft: 4,
          }}
        >
          Account
        </Text>
        <View
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Ionicons
              name="person-circle-outline"
              size={24}
              color={colors.textMuted}
            />
            <Text style={{ fontSize: 16, color: colors.text }}>
              {user?.email || "Not signed in"}
            </Text>
          </View>
          <Pressable
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 16,
            }}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={{ fontSize: 16, color: colors.error }}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Billing/Usage Section - only show if not self-hosting */}
        {!isSelfHosting && (
          <>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
                marginTop: 8,
                paddingLeft: 4,
              }}
            >
              {isSubscriber ? "Usage" : "Subscription"}
            </Text>

            {/* Free tier - show upgrade card */}
            {isFree && billingConfig && (
              <SubscriptionCard
                colors={colors}
                subscriptionPriceCents={billingConfig.subscriptionPriceCents}
                subscriptionCredits={billingConfig.subscriptionCredits}
                isLoading={billingLoading}
                onSubscribe={openSubscribeCheckout}
              />
            )}

            {/* Subscriber - show usage and purchased credits */}
            {isSubscriber && (
              <>
                <UsageCard
                  accentColor={theme.colors.accent}
                  colors={colors}
                  onManageSubscription={openManageSubscription}
                  isManaging={billingLoading}
                />
                {billingConfig && (
                  <PurchasedCreditsCard
                    colors={colors}
                    creditPackAmount={billingConfig.creditPackAmount}
                    creditPackPriceCents={billingConfig.creditPackPriceCents}
                    isLoading={billingLoading}
                    onBuyCredits={openBuyCreditsCheckout}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* Self-hosting mode - just show token usage */}
        {isSelfHosting && (
          <>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
                marginTop: 8,
                paddingLeft: 4,
              }}
            >
              Usage
            </Text>
            <UsageCard accentColor={theme.colors.accent} colors={colors} />
          </>
        )}

        {/* Appearance Section */}
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 8,
            marginTop: 8,
            paddingLeft: 4,
          }}
        >
          Appearance
        </Text>
        <View
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          <SettingsRow
            label="Theme"
            value={theme.name}
            onPress={() => setThemePickerVisible(true)}
            colors={colors}
          />
          <SettingsRow
            label="Font"
            value={currentFont.name}
            onPress={() => setFontPickerVisible(true)}
            isLast
            colors={colors}
          />
        </View>

        {/* App Section */}
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 8,
            marginTop: 8,
            paddingLeft: 4,
          }}
        >
          App
        </Text>
        <View
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 16, color: colors.text }}>Version</Text>
            <Text style={{ fontSize: 16, color: colors.textMuted }}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <ThemePickerModal
        visible={themePickerVisible}
        onClose={() => setThemePickerVisible(false)}
      />
      <FontPickerModal
        visible={fontPickerVisible}
        onClose={() => setFontPickerVisible(false)}
      />
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  isLast = false,
  colors,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  isLast?: boolean;
  colors: DerivedColors;
}) {
  return (
    <Pressable
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
      onPress={onPress}
    >
      <Text style={{ fontSize: 16, color: colors.text }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {value && (
          <Text style={{ fontSize: 16, color: colors.textMuted }}>{value}</Text>
        )}
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textTertiary}
        />
      </View>
    </Pressable>
  );
}
