import { Button, Card, ThemedActivityIndicator, ThemedIcon } from "@bawi/mobile-ui";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/use-auth";
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

function LegalSection() {
  const t = useTranslations();
  return (
    <AccountSection title="Legal">
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
  const { customer, isLoading, logout } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const locale = useLocale();

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
            <Text className="text-h1 text-ink-950">Your account</Text>
            <Text className="text-body text-ink-500">Log in to view orders, save favorites, and check out faster.</Text>
          </View>
          <Button onPress={() => router.push("/login")}>Log in</Button>
          <Button variant="secondary" onPress={() => router.push("/register")}>
            Create account
          </Button>
          <AccountSection title="Preferences">
            <AccountRow
              icon="language-outline"
              label="Language"
              value={LOCALE_NAMES[locale]}
              onPress={() => router.push("/(tabs)/account/language")}
            />
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
            {customer.first_name ? `Hi, ${customer.first_name}` : "Your account"}
          </Text>
          <Text className="text-body text-ink-500">{customer.email}</Text>
        </View>

        <AccountSection title="Shopping">
          <AccountRow icon="receipt-outline" label="My Orders" onPress={() => router.push("/(tabs)/account/orders")} />
        </AccountSection>

        <AccountSection title="Details">
          <AccountRow icon="location-outline" label="Addresses" onPress={() => router.push("/(tabs)/account/addresses")} />
          <AccountRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push("/(tabs)/account/notifications")}
          />
        </AccountSection>

        <AccountSection title="Preferences">
          <AccountRow
            icon="language-outline"
            label="Language"
            value={LOCALE_NAMES[locale]}
            onPress={() => router.push("/(tabs)/account/language")}
          />
        </AccountSection>

        <LegalSection />

        <Button variant="secondary" onPress={() => logout()}>
          Log out
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
