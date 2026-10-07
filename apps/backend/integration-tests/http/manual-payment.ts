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

async function readCustomerOrder(options: {
  baseUrl: string
  orderId: string
  customerToken: string
  publishableApiKey?: string
}) {
  const response = await fetch(`${options.baseUrl}/store/orders/${options.orderId}`, {
    headers: {
      Authorization: `Bearer ${options.customerToken}`,
      ...(options.publishableApiKey
        ? { "x-publishable-api-key": options.publishableApiKey }
        : {}),
    },
  })
  if (response.status !== 200) return null
  const data = await responseBody(response)
  return data.order as
    | { payment_status?: string; payment_reference?: string | null }
    | undefined
}

async function readAdminPayment(options: {
  baseUrl: string
  orderId: string
  adminToken: string
}) {
  const response = await fetch(`${options.baseUrl}/admin/payments`, {
    headers: { Authorization: `Bearer ${options.adminToken}` },
  })
  if (response.status !== 200) return null
  const data = await responseBody(response)
  return (data.payments as Array<{ id: string; payment_status: string }> | undefined)?.find(
    (payment) => payment.id === options.orderId
  )
}

async function waitForApprovalToSettle(options: {
  baseUrl: string
  orderId: string
  adminToken: string
}) {
  let payment = await readAdminPayment(options).catch(() => null)
  for (
    let attempt = 0;
    payment?.payment_status === "under_review" && attempt < 40;
    attempt += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    payment = await readAdminPayment(options).catch(() => null)
  }
  return payment
}

export async function submitManualPaymentProof({
  baseUrl,
  orderId,
  customerToken,
  publishableApiKey,
  reference = `TB-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
}: Omit<ManualPaymentOptions, "adminToken">) {
  // Match the API's canonical form so an ambiguous first response can be
  // reconciled against the value persisted by the server.
  const normalizedReference = reference.trim().toUpperCase()
  const submit = () => {
    const form = new FormData()
    form.set("transaction_reference", normalizedReference)
    form.set("file", new Blob(["integration-test-receipt"], { type: "image/png" }), "receipt.png")
    return fetch(`${baseUrl}/store/orders/${orderId}/payment-proof`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${customerToken}`,
        ...(publishableApiKey ? { "x-publishable-api-key": publishableApiKey } : {}),
      },
      body: form,
    })
  }
  let response: Response
  let retriedAfterReset = false
  try {
    response = await submit()
  } catch (firstError) {
    const order = await readCustomerOrder({
      baseUrl,
      orderId,
      customerToken,
      publishableApiKey,
    }).catch(() => null)
    if (
      order?.payment_reference === normalizedReference &&
      ["proof_submitted", "under_review", "succeeded"].includes(order.payment_status ?? "")
    ) {
      return {
        status: 201,
        data: { order_id: orderId, payment_status: order.payment_status },
        reference: normalizedReference,
      }
    }
    retriedAfterReset = true
    try {
      response = await submit()
    } catch {
      const retriedOrder = await readCustomerOrder({
        baseUrl,
        orderId,
        customerToken,
        publishableApiKey,
      }).catch(() => null)
      if (
        retriedOrder?.payment_reference === normalizedReference &&
        ["proof_submitted", "under_review", "succeeded"].includes(
          retriedOrder.payment_status ?? ""
        )
      ) {
        return {
          status: 201,
          data: { order_id: orderId, payment_status: retriedOrder.payment_status },
          reference: normalizedReference,
        }
      }
      throw firstError
    }
  }
  const data = await responseBody(response)
  if (retriedAfterReset && response.status === 409) {
    const order = await readCustomerOrder({
      baseUrl,
      orderId,
      customerToken,
      publishableApiKey,
    }).catch(() => null)
    if (
      order?.payment_reference === normalizedReference &&
      ["proof_submitted", "under_review", "succeeded"].includes(order.payment_status ?? "")
    ) {
      return {
        status: 201,
        data: { order_id: orderId, payment_status: order.payment_status },
        reference: normalizedReference,
      }
    }
  }
  if (response.status !== 201) {
    throw new Error(`Payment proof submission failed (${response.status}): ${JSON.stringify(data)}`)
  }
  return { status: response.status, data, reference: normalizedReference }
}

export async function approveManualPayment({
  baseUrl,
  orderId,
  adminToken,
}: Pick<ManualPaymentOptions, "baseUrl" | "orderId" | "adminToken">) {
  const approve = () =>
    fetch(`${baseUrl}/admin/payments/${orderId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    })
  let response: Response
  let retriedAfterReset = false
  try {
    response = await approve()
  } catch (firstError) {
    // The route persists under_review before awaiting capture. Let that
    // in-flight request reach succeeded or roll back to proof_submitted before
    // deciding whether a retry is safe.
    const payment = await waitForApprovalToSettle({ baseUrl, orderId, adminToken })
    if (payment?.payment_status === "succeeded") {
      return { status: 200, data: { order_id: orderId, payment_status: "succeeded" } }
    }
    if (payment?.payment_status === "under_review") {
      throw firstError
    }
    retriedAfterReset = true
    try {
      response = await approve()
    } catch {
      const retriedPayment = await waitForApprovalToSettle({ baseUrl, orderId, adminToken })
      if (retriedPayment?.payment_status === "succeeded") {
        return { status: 200, data: { order_id: orderId, payment_status: "succeeded" } }
      }
      throw firstError
    }
  }
  const data = await responseBody(response)
  if (retriedAfterReset && response.status === 409) {
    const payment = await waitForApprovalToSettle({ baseUrl, orderId, adminToken })
    if (payment?.payment_status === "succeeded") {
      return { status: 200, data: { order_id: orderId, payment_status: "succeeded" } }
    }
  }
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
