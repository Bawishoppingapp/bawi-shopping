import { Button, Input, StatusBadge, ThemedActivityIndicator } from "@bawi/mobile-ui";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { ImageUploader } from "@/features/seller-products/components/image-uploader";
import { CategoryPicker } from "@/features/seller-products/components/category-picker";
import { VariantEditor } from "@/features/seller-products/components/variant-editor";
import { productDraftSchema } from "@/features/seller-products/schemas/product-draft-schema";
import {
  type CategoryOption,
  type ProductVariantInput,
  type SellerProductDetail,
  ProductsClientError,
  getMyProduct,
  listCategories,
  submitProductForReview,
  updateProduct,
} from "@/features/seller-products/services/seller-products-client";
import { isProductEditable, productStatusBadge } from "@/features/seller-products/utils/status";
import { useSellerAuth } from "@/features/seller-auth/hooks/use-seller-auth";
import { getSellerSessionToken } from "@/features/seller-auth/services/seller-token-storage";

const CURRENCY_SYMBOL: Record<string, string> = { usd: "$", etb: "Br" };

export default function SellProductDetailScreen() {
  const { seller } = useSellerAuth();
  const currencySymbol = CURRENCY_SYMBOL[seller?.seller.currency_code ?? "etb"] ?? "Br";
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<SellerProductDetail | null | undefined>(undefined);
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [basePrice, setBasePrice] = useState("");
  const [variants, setVariants] = useState<ProductVariantInput[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const token = await getSellerSessionToken();
    if (!token) return;
    const [result, categoryList] = await Promise.all([
      getMyProduct(token, id).catch(() => null),
      listCategories(token),
    ]);
    setDetail(result);
    setCategories(categoryList);
    if (result) {
      setTitle(result.product.title);
      setDescription(result.product.description);
      setCategoryId(result.product.category_id);
      const firstPriced = result.product.variants.find((v) => v.price !== null);
      setBasePrice(firstPriced ? String((firstPriced.price as number) / 100) : "");
      setVariants(
        result.product.variants.map((v) => ({
          color: v.color ?? "",
          size: v.size ?? "",
          price: v.price ?? undefined,
          inventory_quantity: v.inventory_quantity,
        }))
      );
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave() {
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

    const token = await getSellerSessionToken();
    if (!token) return;
    setSaving(true);
    try {
      await updateProduct(token, id, parsed.data);
      await load();
    } catch (error) {
      setFormError(error instanceof ProductsClientError ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitForReview() {
    const token = await getSellerSessionToken();
    if (!token) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await submitProductForReview(token, id);
      await load();
    } catch (error) {
      setFormError(error instanceof ProductsClientError ? error.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (detail === undefined || categories === null) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ThemedActivityIndicator />
      </View>
    );
  }

  if (detail === null) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-paper px-6">
        <Stack.Screen options={{ title: "Product" }} />
        <Text className="text-h2 text-ink-950">Not found</Text>
      </View>
    );
  }

  const editable = isProductEditable(detail.listing.status);
  const badge = productStatusBadge(detail.listing.status);
  const existingColors = new Set(detail.product.variants.map((v) => v.color).filter(Boolean) as string[]);
  const existingSizes = new Set(detail.product.variants.map((v) => v.size).filter(Boolean) as string[]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-paper">
      <Stack.Screen options={{ title: detail.product.title }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-h1 text-ink-950">{detail.product.title}</Text>
          <StatusBadge label={badge.label} tone={badge.tone} />
        </View>
        <Text className="text-caption text-ink-500">{detail.listing.product_code}</Text>

        {detail.listing.status === "rejected" && detail.listing.rejection_reason ? (
          <View className="gap-1 rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm font-medium text-danger">Rejected</Text>
            <Text className="text-body-sm text-danger">{detail.listing.rejection_reason}</Text>
            <Text className="text-caption text-danger">Editing and resubmitting will move it back into review.</Text>
          </View>
        ) : null}
        {detail.listing.status === "pending_review" ? (
          <View className="rounded-md bg-warning/10 p-3">
            <Text className="text-body-sm text-warning">
              Submitted for review - editing is disabled until an admin approves or rejects it.
            </Text>
          </View>
        ) : null}
        {detail.listing.status === "approved" ? (
          <View className="rounded-md bg-success/10 p-3">
            <Text className="text-body-sm text-success">Approved and live on the storefront.</Text>
          </View>
        ) : null}

        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}

        <ImageUploader
          listingId={id}
          images={detail.product.images}
          editable={editable}
          onUploaded={load}
        />

        <Input
          label="Title"
          value={title}
          onChangeText={setTitle}
          error={fieldErrors.title}
          editable={editable}
        />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          error={fieldErrors.description}
          multiline
          numberOfLines={4}
          editable={editable}
          helperText={editable ? "Include material, exact color, pattern, fit, length, sleeves, neckline, closures, pockets, lining, stretch, care, condition, and every included piece. These details guide the AI preview." : undefined}
        />

        {editable ? (
          <CategoryPicker
            categories={categories}
            selectedId={categoryId}
            onSelect={setCategoryId}
            error={fieldErrors.category_id}
          />
        ) : (
          <View className="gap-1">
            <Text className="text-body-sm font-medium text-ink-800">Category</Text>
            <Text className="text-body text-ink-700">
              {categories.find((c) => c.id === categoryId)?.name ?? categoryId}
            </Text>
          </View>
        )}

        <Input
          label={`Base price (${currencySymbol})`}
          value={basePrice}
          onChangeText={setBasePrice}
          error={fieldErrors.base_price}
          keyboardType="decimal-pad"
          editable={editable}
        />

        {editable ? (
          <>
            <VariantEditor
              variants={variants}
              onChange={setVariants}
              lockedColorsAndSizes={{ colors: existingColors, sizes: existingSizes }}
              currencySymbol={currencySymbol}
            />
            {fieldErrors.variants ? (
              <Text className="text-body-sm text-danger">{fieldErrors.variants}</Text>
            ) : null}
          </>
        ) : (
          <View className="gap-2">
            <Text className="text-body-sm font-medium text-ink-800">Color / size variants</Text>
            {detail.product.variants.map((variant) => (
              <View key={variant.id} className="flex-row justify-between rounded-md border border-ink-100 p-3">
                <Text className="text-body-sm text-ink-950">
                  {variant.color} / {variant.size}
                </Text>
                <Text className="text-body-sm text-ink-500">{variant.inventory_quantity} in stock</Text>
              </View>
            ))}
          </View>
        )}

        {editable ? (
          <>
            <Button onPress={onSave} loading={saving}>
              Save changes
            </Button>
            <Pressable
              accessibilityRole="button"
              onPress={onSubmitForReview}
              disabled={submitting}
              className="items-center py-2"
            >
              <Text className="text-body-sm font-medium text-ink-950">
                {submitting ? "Submitting…" : "Submit for review"}
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
