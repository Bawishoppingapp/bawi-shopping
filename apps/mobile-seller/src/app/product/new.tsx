import { Button, Input } from "@bawi/mobile-ui";
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { getSessionToken } from "@/features/auth/services/token-storage";
import { CategoryPicker } from "@/features/products/components/category-picker";
import { VariantEditor } from "@/features/products/components/variant-editor";
import { productDraftSchema } from "@/features/products/schemas/product-draft-schema";
import {
  type CategoryOption,
  type ProductVariantInput,
  ProductsClientError,
  createProduct,
  listCategories,
} from "@/features/products/services/products-client";

export default function NewProductScreen() {
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [basePrice, setBasePrice] = useState("");
  const [variants, setVariants] = useState<ProductVariantInput[]>([{ color: "", size: "", inventory_quantity: 0 }]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getSessionToken();
      if (!token) return;
      const result = await listCategories(token);
      setCategories(result);
    })();
  }, []);

  async function onSubmit() {
    setFormError(null);
    const dollars = Number(basePrice);
    const parsed = productDraftSchema.safeParse({
      title,
      description,
      category_id: categoryId ?? "",
      base_price: Number.isNaN(dollars) ? 0 : Math.round(dollars * 100),
      variants,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const token = await getSessionToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const { listing } = await createProduct(token, parsed.data);
      router.replace({ pathname: "/product/[id]", params: { id: listing.id } });
    } catch (error) {
      setFormError(error instanceof ProductsClientError ? error.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-paper">
      <Stack.Screen options={{ title: "New product" }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}

        <Input label="Title" value={title} onChangeText={setTitle} error={fieldErrors.title} />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          error={fieldErrors.description}
          multiline
          numberOfLines={4}
        />

        {categories === null ? (
          <ActivityIndicator color="#151210" />
        ) : (
          <CategoryPicker
            categories={categories}
            selectedId={categoryId}
            onSelect={setCategoryId}
            error={fieldErrors.category_id}
          />
        )}

        <Input
          label="Base price ($)"
          value={basePrice}
          onChangeText={setBasePrice}
          error={fieldErrors.base_price}
          keyboardType="decimal-pad"
          helperText="Used for any variant without its own price override."
        />

        <VariantEditor variants={variants} onChange={setVariants} />
        {fieldErrors.variants ? <Text className="text-body-sm text-danger">{fieldErrors.variants}</Text> : null}

        <Button onPress={onSubmit} loading={submitting}>
          Create product
        </Button>
        <Text className="text-center text-caption text-ink-500">
          Saved as a draft - you can add photos and submit for review next.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
