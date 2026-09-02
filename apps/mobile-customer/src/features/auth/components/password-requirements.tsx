import { useThemeColors } from "@bawi/mobile-ui";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { PASSWORD_RULES } from "../schemas/register-schema";
import { useTranslations } from "@/features/i18n/hooks/use-locale";

interface PasswordRequirementsProps {
  password: string;
}

/** Live checklist, updates on every keystroke - rules come from
 * PASSWORD_RULES (schemas/register-schema.ts), the same array the actual
 * Zod validation uses, so this can never drift from what the backend
 * really requires. */
export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const themeColors = useThemeColors();
  const t = useTranslations();

  return (
    <View className="gap-1 rounded-md bg-ink-100 p-3">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <View key={rule.key} className="flex-row items-center gap-2">
            <Ionicons
              name={met ? "checkmark-circle" : "ellipse-outline"}
              size={16}
              color={met ? themeColors.success : themeColors.ink400}
            />
            <Text className={`flex-1 text-body-sm ${met ? "text-success" : "text-ink-500"}`}>{t(rule.labelKey)}</Text>
          </View>
        );
      })}
    </View>
  );
}
