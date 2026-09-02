import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { LEGAL_DOCUMENTS, type LegalDocumentSlug } from "@/features/legal/content";
import { renderMarkdownLite } from "@/features/legal/markdown-lite";
import { useTranslations } from "@/features/i18n/hooks/use-locale";

function isLegalSlug(slug: string | undefined): slug is LegalDocumentSlug {
  return !!slug && slug in LEGAL_DOCUMENTS;
}

export default function LegalDocumentScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const tabBarHeight = useBottomTabBarHeight();
  const t = useTranslations();

  if (!isLegalSlug(slug)) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6">
        <Text className="text-body text-ink-500">{t("legal.unavailable")}</Text>
      </View>
    );
  }

  const doc = LEGAL_DOCUMENTS[slug];

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: t(doc.titleKey) }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 40 }}>
        <View className="mb-4 rounded-md bg-ink-100 px-4 py-3">
          <Text className="text-body-sm text-ink-700">{t("footer.legalDraftNotice")}</Text>
        </View>
        {renderMarkdownLite(doc.source)}
      </ScrollView>
    </View>
  );
}
