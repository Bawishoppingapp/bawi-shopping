import { useStripe } from "@stripe/stripe-react-native";
import { Button, Input, ThemedActivityIndicator } from "@bawi/mobile-ui";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import { CountryPicker } from "@/features/addresses/components/country-picker";
import { findCountry } from "@/features/addresses/data/countries";
import { normalizeEthiopianPhone } from "@/features/addresses/utils/phone-format";
import { useCart } from "@/features/cart/hooks/use-cart";
import {
  checkoutAddressSchema,
  type CheckoutAddressInput,
} from "@/features/checkout/schemas/checkout-address-schema";
import { CheckoutError, startCheckout } from "@/features/checkout/services/checkout-client";
import { generateIdempotencyKey } from "@/features/checkout/utils/idempotency-key";
import { formatMoney } from "@/features/discovery/utils/format-price";

const STRIPE_CONFIGURED = Boolean(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY);

type Phase = "address" | "starting" | "payment" | "paying";

export default function CheckoutScreen() {
  const { customer } = useAuth();
  const { cart, refresh: refreshCart } = useCart();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [phase, setPhase] = useState<Phase>("address");
  const [firstName, setFirstName] = useState(customer?.first_name ?? "");
  const [lastName, setLastName] = useState(customer?.last_name ?? "");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState<string | null>("et");
  const [phone, setPhone] = useState("");
  const [subCity, setSubCity] = useState("");
  const [woreda, setWoreda] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Generated once per screen mount (one checkout attempt), reused across
  // retries of the same attempt - mirrors apps/storefront's checkout page
  // holding one stable idempotency key for the whole page load, so a
  // double-tap or network retry never mints a second PaymentIntent/order.
  const idempotencyKeyRef = useRef(generateIdempotencyKey());

  const selectedCountry = findCountry(countryCode);
  const isEthiopia = countryCode === "et";

  // A cart is single-currency, and only USD carts can go through Stripe
  // today - Stripe has no Ethiopia support, so an ETB-priced seller has
  // no payout mechanism to receive money from a Stripe charge at all
  // (see CLAUDE.md's "Currency and market" section and
  // docs/DECISIONS.md). Blocking ETB checkout here, rather than pretending
  // it works, is the honest behavior until a real Ethiopian payment rail
  // is integrated.
  const etbBlocked = cart?.currency_code === "etb";

  useEffect(() => {
    if (!customer) {
      router.replace("/login");
    }
  }, [customer]);

  async function onContinue() {
    setFormError(null);
    const parsed = checkoutAddressSchema.safeParse({
      first_name: firstName,
      last_name: lastName,
      address_1: addressLine1,
      address_2: addressLine2,
      city,
      province,
      postal_code: postalCode,
      country_code: countryCode ?? "",
      phone: isEthiopia && phone ? normalizeEthiopianPhone(phone) : phone,
      sub_city: subCity,
      woreda,
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
    setPhase("starting");

    try {
      const token = await getSessionToken();
      const result = await startCheckout(token, parsed.data as CheckoutAddressInput, idempotencyKeyRef.current);
      setOrderId(result.order_id);

      if (!result.client_secret) {
        // Already paid (idempotent retry of a completed attempt) - nothing
        // left to charge, go straight to the order.
        await refreshCart();
        router.replace({ pathname: "/order/[id]", params: { id: result.order_id } });
        return;
      }

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Bawi Shopping",
        paymentIntentClientSecret: result.client_secret,
        returnURL: "mobilecustomer://checkout-return",
      });
      if (initError) {
        setFormError(initError.message);
        setPhase("address");
        return;
      }
      setPhase("payment");
    } catch (error) {
      setFormError(error instanceof CheckoutError ? error.message : "Something went wrong. Please try again.");
      setPhase("address");
    }
  }

  async function onPay() {
    if (!orderId) return;
    setPhase("paying");
    setFormError(null);

    const { error } = await presentPaymentSheet();
    if (error) {
      // A user-initiated cancel isn't a real error - let them retry the
      // same payment sheet without re-entering their address.
      if (error.code !== "Canceled") {
        setFormError(error.message);
      }
      setPhase("payment");
      return;
    }

    // Order finalization (capture, per-seller VendorOrder split, cart
    // clearing) happens server-side via the Stripe webhook, not here -
    // same as apps/storefront's payment-step.tsx. This navigation is
    // optimistic; the order screen renders whatever status is on the
    // order by the time it loads.
    await refreshCart();
    router.replace({ pathname: "/order/[id]", params: { id: orderId } });
  }

  const summary = useMemo(() => {
    if (!cart) return null;
    return {
      subtotal: formatMoney(cart.subtotal, cart.currency_code),
      shipping: cart.qualifies_for_free_shipping ? "Free" : formatMoney(cart.shipping_estimate, cart.currency_code),
    };
  }, [cart]);

  if (!customer) {
    return null;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-paper px-6">
        <Stack.Screen options={{ headerShown: true, title: "Checkout" }} />
        <Text className="text-h2 text-ink-950">Your bag is empty</Text>
        <Button onPress={() => router.replace("/(tabs)/cart")}>Back to bag</Button>
      </View>
    );
  }

  if (etbBlocked) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-paper px-6">
        <Stack.Screen options={{ headerShown: true, title: "Checkout" }} />
        <Text className="text-h2 text-ink-950">ETB checkout is coming soon</Text>
        <Text className="text-center text-body text-ink-500">
          Ethiopian Birr orders can&apos;t be paid for yet - Stripe doesn&apos;t support paying out sellers in
          Ethiopia. This is a known gap while an Ethiopian payment option is being integrated. Your bag is saved.
        </Text>
        <Button onPress={() => router.back()}>Back to bag</Button>
      </View>
    );
  }

  if (!STRIPE_CONFIGURED) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-paper px-6">
        <Stack.Screen options={{ headerShown: true, title: "Checkout" }} />
        <Text className="text-h2 text-ink-950">Checkout isn&apos;t configured</Text>
        <Text className="text-center text-body text-ink-500">
          Payments aren&apos;t set up on this build yet. Your bag is saved.
        </Text>
        <Button onPress={() => router.back()}>Back to bag</Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "Checkout" }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}

        {summary ? (
          <View className="gap-1 rounded-md border border-ink-100 p-4">
            <View className="flex-row justify-between">
              <Text className="text-body text-ink-700">Subtotal</Text>
              <Text className="text-body text-ink-950">{summary.subtotal}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-body text-ink-700">Shipping</Text>
              <Text className="text-body text-ink-950">{summary.shipping}</Text>
            </View>
          </View>
        ) : null}

        {phase === "payment" || phase === "paying" ? (
          <View className="gap-4">
            <Text className="text-h2 text-ink-950">Ready to pay</Text>
            <Text className="text-body-sm text-ink-500">
              Tap below to enter your card details and complete your order.
            </Text>
            <Button onPress={onPay} loading={phase === "paying"}>
              Pay now
            </Button>
          </View>
        ) : (
          <>
            <Text className="text-h2 text-ink-950">Shipping address</Text>
            <CountryPicker
              selectedCode={countryCode}
              onSelect={(country) => setCountryCode(country.code)}
              error={fieldErrors.country_code}
            />
            <Input label="First name" value={firstName} onChangeText={setFirstName} error={fieldErrors.first_name} />
            <Input label="Last name" value={lastName} onChangeText={setLastName} error={fieldErrors.last_name} />
            <Input
              label="Address line 1"
              value={addressLine1}
              onChangeText={setAddressLine1}
              error={fieldErrors.address_1}
            />
            <Input label="Address line 2 (optional)" value={addressLine2} onChangeText={setAddressLine2} />
            <Input label="City" value={city} onChangeText={setCity} error={fieldErrors.city} />
            <Input
              label="State / Province / Region (optional)"
              value={province}
              onChangeText={setProvince}
              error={fieldErrors.province}
            />
            {isEthiopia ? (
              <>
                <Input label="Sub-city (optional)" value={subCity} onChangeText={setSubCity} placeholder="e.g. Bole" />
                <Input label="Woreda (optional)" value={woreda} onChangeText={setWoreda} placeholder="e.g. 03" />
              </>
            ) : null}
            <Input
              label={selectedCountry?.postalCodeRequired === false ? "Postal code (optional)" : "Postal code"}
              value={postalCode}
              onChangeText={setPostalCode}
              error={fieldErrors.postal_code}
              autoCapitalize="characters"
            />
            <Input
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              error={fieldErrors.phone}
              keyboardType="phone-pad"
              placeholder={selectedCountry ? `${selectedCountry.phoneCode} …` : undefined}
            />

            <Button onPress={onContinue} loading={phase === "starting"}>
              Continue to payment
            </Button>
          </>
        )}

        {phase === "starting" ? (
          <View className="items-center py-4">
            <ThemedActivityIndicator />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
