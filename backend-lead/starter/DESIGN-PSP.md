# DESIGN-PSP.md — The 50th PSP

## The problem
Each PSP has its own callback format, signature scheme, status vocabulary, and quirks. Today there is one mock PSP baked into the callback route. Adding the 50th PSP should be a safe, one-day task for a junior engineer.

---

## Interface

```typescript
// src/lib/psp/types.ts

export interface NormalizedCallback {
  pspRef: string;
  status: 'completed' | 'failed';
  amount: string; // decimal string, always in major units
}

export interface PspAdapter {
  /** Provider identifier matching config key, e.g. "stripe", "vnpay" */
  readonly providerId: string;

  /**
   * Verify the request authenticity (HMAC, RSA, IP allowlist, etc.).
   * Throws if invalid — caller should respond 401 and not process.
   */
  verifySignature(rawBody: Buffer, headers: Record<string, string>): void;

  /**
   * Normalize the provider-specific payload to our internal format.
   * Converts minor units to major, maps status vocabulary, etc.
   */
  normalize(rawBody: Buffer): NormalizedCallback;
}
```

---

## Where verification and normalization live

```
src/lib/psp/
  types.ts          ← interface above
  registry.ts       ← maps providerId → PspAdapter, loaded from config
  adapters/
    mockPsp.ts      ← current mock
    stripe.ts       ← example real adapter
    vnpay.ts
    ...
```

Each adapter is a single file implementing `PspAdapter`. The registry is a `Map<string, PspAdapter>` populated at startup from `config.psp.providers` (see below).

---

## How config drives it

```jsonc
// .env / secret manager
PSP_PROVIDERS=mock,stripe,vnpay

PSP_MOCK_WEBHOOK_SECRET=dev-secret
PSP_STRIPE_WEBHOOK_SECRET=whsec_...
PSP_VNPAY_HASH_SECRET=abc123
PSP_VNPAY_AMOUNT_UNIT=minor   // signals divide-by-100
```

At startup, `registry.ts` reads `PSP_PROVIDERS`, imports each adapter by name, and passes its env-namespaced secrets to the constructor. Adding a new PSP = add one line to `PSP_PROVIDERS` and its secrets — no code change required to the registry or route.

---

## The callback route with the registry

```typescript
// src/routes/psp.ts  (updated)
pspRouter.post('/callbacks/:providerId', async (req, res, next) => {
  const adapter = pspRegistry.get(req.params.providerId);
  if (!adapter) return res.status(404).json({ error: 'unknown_provider' });

  try {
    adapter.verifySignature(req.rawBody, req.headers as any);
  } catch {
    return res.status(401).json({ error: 'invalid_signature' });
  }

  const normalized = adapter.normalize(req.rawBody);
  const result = await handlePspCallback(
    normalized.pspRef,
    normalized.status,
    normalized.amount,
  );
  res.json(result);
});
```

The core `handlePspCallback` service never changes when a new PSP is added.

---

## Testing a new adapter without calling the real PSP in CI

Each adapter gets a `__tests__/adapters/stripe.test.ts` that:

1. **Unit tests `verifySignature`** with recorded valid and tampered payloads (static fixtures committed to the repo). No network call.
2. **Unit tests `normalize`** with recorded callback bodies (raw JSON/form captured from sandbox once). Asserts correct `pspRef`, `status`, and amount in major units.
3. **Contract tests** (optional, skip in CI): a Jest `describe.skip` block that calls the real sandbox if `PSP_STRIPE_SANDBOX_URL` is set. Run manually before first go-live.

The fixture files are the key: a junior engineer copies an existing adapter, replaces the fixture bodies with ones captured from the new PSP's sandbox docs, and the test structure guides them through verification and normalization without ever needing to call a live endpoint in CI.

---

## Sketch

```
adapter/stripe.ts:
  verifySignature: stripe.webhooks.constructEvent(rawBody, sig, secret)
  normalize: {
    pspRef: event.data.object.metadata.pspRef,
    status: event.type === 'payment_intent.succeeded' ? 'completed' : 'failed',
    amount: new BigNumber(event.data.object.amount).div(100).toFixed(18)
  }

adapter/vnpay.ts:
  verifySignature: compare HMAC-SHA512 of sorted params with vnp_SecureHash
  normalize: {
    pspRef: params.vnp_TxnRef,
    status: params.vnp_ResponseCode === '00' ? 'completed' : 'failed',
    amount: new BigNumber(params.vnp_Amount).div(100).toFixed(18)
  }
```

The pattern is identical. Differences are entirely contained in the adapter file.
