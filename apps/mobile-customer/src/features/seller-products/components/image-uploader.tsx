import { Button } from "@bawi/mobile-ui";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { getSellerSessionToken } from "@/features/seller-auth/services/seller-token-storage";
import { ProductsClientError, uploadProductImages } from "@/features/seller-products/services/seller-products-client";

interface ImageUploaderProps {
  listingId: string;
  images: string[];
  editable: boolean;
  onUploaded: () => void;
}

/**
 * The upload route itself doesn't gate on listing status (see
 * seller-products-client.ts's doc comment) - `editable` here is a UI-only
 * restriction matching the web seller-portal's own behavior, not a
 * backend constraint we're relying on for correctness.
 */
export function ImageUploader({ listingId, images, editable, onUploaded }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAndUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to add product images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    setError(null);
    setUploading(true);
    try {
      const token = await getSellerSessionToken();
      if (!token) return;
      const files = result.assets.map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName ?? `photo-${index}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      }));
      await uploadProductImages(token, listingId, files, images.length === 0);
      onUploaded();
    } catch (err) {
      setError(err instanceof ProductsClientError ? err.message : "Couldn't upload those photos.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <View className="gap-2">
      <Text className="text-body-sm font-medium text-ink-800">Photos</Text>
      {images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {images.map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={{ width: 96, height: 120, borderRadius: 8 }}
              contentFit="cover"
            />
          ))}
        </ScrollView>
      ) : (
        <Text className="text-body-sm text-ink-500">No photos yet.</Text>
      )}
      {error ? <Text className="text-body-sm text-danger">{error}</Text> : null}
      {editable ? (
        <Button variant="secondary" onPress={pickAndUpload} loading={uploading}>
          Add photos
        </Button>
      ) : null}
    </View>
  );
}
