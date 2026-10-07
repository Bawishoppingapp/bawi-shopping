import { Button, Input } from "@bawi/mobile-ui";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { getSellerSessionToken } from "@/features/seller-auth/services/seller-token-storage";

const fields = ["category", "color", "material", "pattern", "sleeves", "neckline", "length", "fit", "sizes"];
interface Workflow {
  status: string; imageUrl?: string; sellerApproved?: boolean; error?: string;
  sources: { front: string; back: string }; validation?: { reasons: string[] };
}
export function SellerImageWorkflow({ id, originals }: { id: string; originals: string[] }) {
  const [state, setState] = useState<Workflow | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [detail, setDetail] = useState("");
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const request = useCallback(async (command?: object) => {
    const token = await getSellerSessionToken();
    if (!token) throw new Error("Sign in again to continue.");
    const response = await fetch(`${process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"}/seller/products/${encodeURIComponent(id)}/image-workflow`, {
      method: command ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(command ? { body: JSON.stringify(command) } : {}),
    });
    if (!response.ok) throw new Error("Could not update image workflow. Check your photos and attributes, then try again.");
    const data = await response.json();
    setState(data.workflow); setConfigured(data.configured); setLoaded(true);
  }, [id]);
  useEffect(() => { request().catch(() => setError("Could not load image workflow.")); }, [request]);
  const pending = state && ["validating", "queued", "generating"].includes(state.status);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => { request().catch(() => {}); }, 5000);
    return () => clearInterval(timer);
  }, [pending, request]);
  async function act(action: string) {
    setBusy(true); setError("");
    try { await request({ action, ...(action === "request" ? { sources: { front, back, ...(detail ? { detail } : {}), attributes } } : { reason }) }); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update image workflow."); }
    finally { setBusy(false); }
  }
  return <View className="gap-3 rounded-xl border border-ink-100 p-4">
    <Text className="text-h3 text-ink-950">Bawi image studio</Text>
    <Text className="text-body-sm text-ink-500">Choose separate front and back photos. A detail/fabric photo is recommended. Show one complete garment, centered, straight-on, in even lighting on a neutral background. At least 1024 pixels per side; true colors; no filters, screenshots, watermarks, text, borders, obstructions or extreme folds.</Text>
    <Text className="text-body-sm text-ink-500">Originals stay in the customer gallery. Compare all garment details before approval. Bawi reviews the hero before publication.</Text>
    {error ? <Text accessibilityRole="alert" className="text-body-sm text-danger">{error}</Text> : null}
    {!loaded ? <Text>Loading image workflow…</Text> : !configured ? <Text className="text-body-sm text-ink-500">AI generation is not configured yet. You can still submit your product with original photos.</Text> : null}
    <Text accessibilityLiveRegion="polite" className="text-body text-ink-950">{state?.status.replaceAll("_", " ") ?? "No AI image requested"}</Text>
    {state?.validation?.reasons.map((r) => <Text key={r} className="text-body-sm text-ink-500">{r}</Text>)}
    {state?.sellerApproved ? <Text>Seller approved — awaiting Bawi review.</Text> : null}
    {state?.imageUrl ? <View className="flex-row gap-2">{[state.sources.front, state.sources.back, state.imageUrl].map((uri, i) => <View key={`${i}:${uri}`} className="flex-1"><Image source={{ uri }} style={{ width: "100%", aspectRatio: 0.75 }} contentFit="contain" /><Text className="text-caption text-ink-500">{i === 2 ? "Generated" : i === 0 ? "Original front" : "Original back"}</Text></View>)}</View> : null}
    {configured && !pending && (!state || ["needs_correction", "rejected", "failed"].includes(state.status)) ? <View className="gap-3">
      {([ ["Front", front, setFront], ["Back", back, setBack], ["Detail (optional)", detail, setDetail] ] as const).map(([label, selected, select]) => <View key={label} className="gap-2"><Text className="text-body text-ink-950">{label}</Text><View className="flex-row flex-wrap gap-2">{originals.map((uri, i) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected === uri }} accessibilityLabel={`${label} photo ${i + 1}`} onPress={() => select(uri)} key={uri} style={{ borderWidth: selected === uri ? 3 : 1, borderColor: selected === uri ? "#A8864C" : "#ddd" }}><Image source={{ uri }} style={{ width: 64, height: 80 }} contentFit="contain" /></Pressable>)}</View></View>)}
      {fields.map((field) => <Input key={field} label={field} value={attributes[field] ?? ""} maxLength={100} onChangeText={(value) => setAttributes((prev) => ({ ...prev, [field]: value }))} />)}
      <Button disabled={busy || !front || !back || front === back || fields.some((f) => !attributes[f]?.trim())} onPress={() => act("request")}>Check photos and generate</Button>
    </View> : null}
    <Button disabled={busy} onPress={() => request().catch(() => setError("Could not refresh image workflow."))}>Refresh status</Button>
    {configured && state?.status === "failed" ? <Button disabled={busy} onPress={() => act("retry")}>Retry same job</Button> : null}
    {state?.status === "review" ? <Button disabled={busy} onPress={() => act("approve")}>Garment matches — approve</Button> : null}
    {configured && state && ["review", "rejected"].includes(state.status) ? <Button disabled={busy} onPress={() => act("regenerate")}>Regenerate one hero</Button> : null}
    {state && ["review", "approved"].includes(state.status) ? <View className="gap-2"><Input label="Describe the mismatch" value={reason} onChangeText={setReason} maxLength={500} /><Button disabled={busy || reason.trim().length < 3} onPress={() => act("mismatch")}>Report mismatch to Bawi</Button></View> : null}
  </View>;
}
