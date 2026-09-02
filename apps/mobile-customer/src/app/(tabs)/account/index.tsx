import { Button, Card, ThemedActivityIndicator, ThemedIcon } from "@bawi/mobile-ui";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useAppearance } from "@/features/appearance/hooks/use-appearance";
import { useCurrency } from "@/features/currency/hooks/use-currency";
import { LOCALE_NAMES } from "@bawi/i18n/locales";
import { LEGAL_DOCUMENTS, type LegalDocumentSlug } from "@/features/legal/content";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";

const LEGAL_ROWS: { slug: LegalDocumentSlug; icon: keyof typeof Ionicons.glyphMap }[] = [
  { slug: "terms", icon: "document-text-outline" },
  { slug: "privacy", icon: "shield-checkmark-outline" },
  { slug: "returns", icon: "return-down-back-outline" },
  { slug: "cookies", icon: "server-outline" },
  { slug: "acceptable-use", icon: "checkmark-circle-outline" },
  { slug: "dmca", icon: "warning-outline" },
];

function AccountRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-ink-100 px-4 py-3.5 active:bg-ink-100"
    >
      <ThemedIcon name={icon} size={20} tone="ink700" />
      <Text className="flex-1 text-body text-ink-950">{label}</Text>
      {value ? <Text className="text-body-sm text-ink-500">{value}</Text> : null}
      <ThemedIcon name="chevron-forward" size={18} tone="ink400" />
    </Pressable>
  );
}

function AccountSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="px-1 text-caption font-medium uppercase tracking-wide text-ink-500">{title}</Text>
      <Card padded={false} className="overflow-hidden">
        {children}
      </Card>
    </View>
  );
}

function AppearanceRow() {
  const { appearance, setAppearance } = useAppearance();
  const isDark = appearance === "dark";
  const t = useTranslations();

  return (
    <View className="flex-row items-center gap-3 border-b border-ink-100 px-4 py-3.5">
      <ThemedIcon name={isDark ? "moon-outline" : "sunny-outline"} size={20} tone="ink700" />
      <View className="flex-1">
        <Text className="text-body text-ink-950">{t("account.darkMode")}</Text>
        <Text className="text-body-sm text-ink-500">{isDark ? t("common.on") : t("common.off")}</Text>
      </View>
      <Switch
        accessibilityLabel={t("account.darkMode")}
        accessibilityHint={t("account.darkModeHint")}
        value={isDark}
        onValueChange={(enabled) => setAppearance(enabled ? "dark" : "light")}
        trackColor={{ false: "#8C8175", true: "#B8863B" }}
        ios_backgroundColor="#8C8175"
      />
    </View>
  );
}

function LegalSection() {
  const t = useTranslations();
  return (
    <AccountSection title={t("account.legal")}>
      {LEGAL_ROWS.map(({ slug, icon }) => (
        <AccountRow
          key={slug}
          icon={icon}
          label={t(LEGAL_DOCUMENTS[slug].titleKey)}
          onPress={() => router.push({ pathname: "/(tabs)/account/legal/[slug]", params: { slug } })}
        />
      ))}
    </AccountSection>
  );
}

export default function AccountScreen() {
  const { customer, isLoading, logout, deleteAccount } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const locale = useLocale();
  const { currency } = useCurrency();
  const t = useTranslations();

  function confirmDeleteAccount() {
    Alert.alert(t("account.deleteAccount"), t("account.deleteAccountConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("account.deleteAccountAction"),
        style: "destructive",
        onPress: () => {
          deleteAccount().catch(() => Alert.alert(t("common.error"), t("account.deleteAccountFailed")));
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <ThemedActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 16, gap: 20, flexGrow: 1, justifyContent: "center" }}>
          <View className="gap-1">
            <Text className="text-h1 text-ink-950">{t("account.yourAccount")}</Text>
            <Text className="text-body text-ink-500">{t("account.loginHint")}</Text>
          </View>
          <Button onPress={() => router.push("/login")}>{t("login.submit")}</Button>
          <Button variant="secondary" onPress={() => router.push("/register")}>
            {t("register.submit")}
          </Button>
          <AccountSection title={t("account.preferences")}>
            <AccountRow
              icon="language-outline"
              label={t("common.language")}
              value={LOCALE_NAMES[locale]}
              onPress={() => router.push("/(tabs)/account/language")}
            />
            <AccountRow
              icon="cash-outline"
              label={t("account.currency")}
              value={currency.toUpperCase()}
              onPress={() => router.push("/(tabs)/account/currency")}
            />
            <AppearanceRow />
          </AccountSection>
          <LegalSection />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: tabBarHeight + 32 }}>
        <View className="gap-1 px-1 pt-2">
          <Text className="text-h1 text-ink-950">
            {customer.first_name ? t("account.hello", { name: customer.first_name }) : t("account.yourAccount")}
          </Text>
          <Text className="text-body text-ink-500">{customer.email}</Text>
        </View>

        <AccountSection title={t("account.shopping")}>
          <AccountRow icon="receipt-outline" label={t("account.myOrders")} onPress={() => router.push("/(tabs)/account/orders")} />
        </AccountSection>

        <AccountSection title={t("account.details")}>
          <AccountRow icon="location-outline" label={t("account.addresses")} onPress={() => router.push("/(tabs)/account/addresses")} />
          <AccountRow
            icon="notifications-outline"
            label={t("account.notifications")}
            onPress={() => router.push("/(tabs)/account/notifications")}
          />
        </AccountSection>

        <AccountSection title={t("account.preferences")}>
          <AccountRow
            icon="language-outline"
            label={t("common.language")}
            value={LOCALE_NAMES[locale]}
            onPress={() => router.push("/(tabs)/account/language")}
          />
          <AccountRow
            icon="cash-outline"
            label={t("account.currency")}
            value={currency.toUpperCase()}
            onPress={() => router.push("/(tabs)/account/currency")}
          />
          <AppearanceRow />
        </AccountSection>

        <LegalSection />

        <Button variant="secondary" onPress={() => logout()}>
          {t("account.logout")}
        </Button>
        <Button variant="destructive" onPress={confirmDeleteAccount}>
          {t("account.deleteAccount")}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
