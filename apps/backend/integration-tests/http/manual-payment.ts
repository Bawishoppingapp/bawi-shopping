type ManualPaymentOptions = {
  baseUrl: string
  orderId: string
  customerToken: string
  adminToken: string
  publishableApiKey?: string
  reference?: string
}

async function responseBody(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

export async function submitManualPaymentProof({
  baseUrl,
  orderId,
  customerToken,
  publishableApiKey,
  reference = `TB-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
}: Omit<ManualPaymentOptions, "adminToken">) {
  const form = new FormData()
  form.set("transaction_reference", reference)
  form.set("file", new Blob(["integration-test-receipt"], { type: "image/png" }), "receipt.png")

  const response = await fetch(`${baseUrl}/store/orders/${orderId}/payment-proof`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${customerToken}`,
      ...(publishableApiKey ? { "x-publishable-api-key": publishableApiKey } : {}),
    },
    body: form,
  })
  const data = await responseBody(response)
  if (response.status !== 201) {
    throw new Error(`Payment proof submission failed (${response.status}): ${JSON.stringify(data)}`)
  }
  return { status: response.status, data, reference }
}

export async function approveManualPayment({
  baseUrl,
  orderId,
  adminToken,
}: Pick<ManualPaymentOptions, "baseUrl" | "orderId" | "adminToken">) {
  const response = await fetch(`${baseUrl}/admin/payments/${orderId}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
  })
  const data = await responseBody(response)
  if (response.status !== 200) {
    throw new Error(`Payment approval failed (${response.status}): ${JSON.stringify(data)}`)
  }
  return { status: response.status, data }
}

export async function settleManualPayment(options: ManualPaymentOptions) {
  const proof = await submitManualPaymentProof(options)
  const approval = await approveManualPayment(options)
  return { proof, approval }
}
