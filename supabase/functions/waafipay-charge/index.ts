// =====================================================================
//  Edge Function: waafipay-charge
//  Platform Plans only — sandbox by default; switch to live via secrets.
//
//  Public (pay-first): { public_purchase: true, plan_id, billing_cycle, phone }
//    → no JWT; returns claim_token for /create-institution?purchase=
//  Admin renew: Authorization Bearer + { plan_id, billing_cycle, phone }
//  Tenant student charges: rejected (enrollment_id)
//
//  Credentials (priority): Deno.env → platform_runtime_secrets → sandbox defaults
//  Live mode refuses to run without all three live secrets set.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SANDBOX_DEFAULTS = {
  mode: 'sandbox' as const,
  baseUrl: 'https://sandbox.waafipay.com/asm',
  merchantUid: 'M01',
  apiUserId: '1008348',
  apiKey: 'API-8LylZYCuTdonYgjvwzQ2BCcUr5j',
}

const LIVE_BASE = 'https://api.waafipay.net/asm'

type AdminClient = ReturnType<typeof createClient>

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function normalizeSecret(raw: string | undefined | null): string {
  let key = String(raw || '').trim()
  if (/^bearer\s+/i.test(key)) key = key.replace(/^bearer\s+/i, '').trim()
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim()
  }
  return key
}

function bearerToken(authHeader: string): string | null {
  const m = authHeader.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

function normalizePhone(raw: string): string | null {
  let digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return null
  // Local with trunk 0: 061xxxxxxx / 063xxxxxxx → 25261… / 25263…
  if (digits.length === 10 && digits.startsWith('0') && /^0[67]/.test(digits)) {
    digits = `252${digits.slice(1)}`
  }
  // Local 9-digit Hormuud / Telesom style
  if (digits.length === 9 && /^[67]/.test(digits)) return `252${digits}`
  // Already international Somalia
  if (digits.length === 12 && digits.startsWith('252')) return digits
  // Sandbox / other intl test numbers (10–15 digits, no leading 0)
  if (digits.length >= 10 && digits.length <= 15 && !digits.startsWith('0')) return digits
  return null
}

function addBillingPeriod(from: Date, cycle: 'monthly' | 'yearly'): Date {
  const d = new Date(from.getTime())
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d
}

function waafiSuccess(body: any): boolean {
  const code = String(body?.responseCode ?? '')
  const msg = String(body?.responseMsg ?? '')
  const state = String(body?.params?.state ?? '').toUpperCase()
  if (code === '2001' || msg === 'RCS_SUCCESS') {
    // APPROVED, empty, or sandbox variants after PIN confirm
    return state === 'APPROVED' || state === '' || state === 'SUCCESS'
  }
  return false
}

async function loadRuntimeSecret(admin: AdminClient, key: string): Promise<string> {
  try {
    const { data } = await admin
      .from('platform_runtime_secrets')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    return normalizeSecret(data?.value)
  } catch {
    return ''
  }
}

async function resolveWaafiConfig(admin: AdminClient) {
  const modeRaw =
    normalizeSecret(Deno.env.get('WAAFIPAY_MODE')) ||
    (await loadRuntimeSecret(admin, 'WAAFIPAY_MODE')) ||
    SANDBOX_DEFAULTS.mode
  const mode = modeRaw.toLowerCase() === 'live' ? 'live' : 'sandbox'

  const merchantUid =
    normalizeSecret(Deno.env.get('WAAFIPAY_MERCHANT_UID')) ||
    (await loadRuntimeSecret(admin, 'WAAFIPAY_MERCHANT_UID')) ||
    (mode === 'sandbox' ? SANDBOX_DEFAULTS.merchantUid : '')
  const apiUserId =
    normalizeSecret(Deno.env.get('WAAFIPAY_API_USER_ID')) ||
    (await loadRuntimeSecret(admin, 'WAAFIPAY_API_USER_ID')) ||
    (mode === 'sandbox' ? SANDBOX_DEFAULTS.apiUserId : '')
  const apiKey =
    normalizeSecret(Deno.env.get('WAAFIPAY_API_KEY')) ||
    (await loadRuntimeSecret(admin, 'WAAFIPAY_API_KEY')) ||
    (mode === 'sandbox' ? SANDBOX_DEFAULTS.apiKey : '')
  const baseUrl =
    normalizeSecret(Deno.env.get('WAAFIPAY_BASE_URL')) ||
    (await loadRuntimeSecret(admin, 'WAAFIPAY_BASE_URL')) ||
    (mode === 'live' ? LIVE_BASE : SANDBOX_DEFAULTS.baseUrl)

  if (!merchantUid || !apiUserId || !apiKey) {
    return { error: 'WAAFIPAY_NOT_CONFIGURED' as const, mode, merchantUid, apiUserId, apiKey, baseUrl }
  }

  // Safety: live mode must not accidentally hit sandbox URL with live keys (or vice versa)
  if (mode === 'live' && /sandbox\.waafipay\.com/i.test(baseUrl)) {
    return {
      error: 'WAAFIPAY_NOT_CONFIGURED' as const,
      mode,
      merchantUid,
      apiUserId,
      apiKey,
      baseUrl,
      message: 'Live mode requires the production WaafiPay URL.',
    }
  }

  return { error: null, mode: mode as 'sandbox' | 'live', merchantUid, apiUserId, apiKey, baseUrl }
}

async function callWaafiPay(
  cfg: { merchantUid: string; apiUserId: string; apiKey: string; baseUrl: string },
  args: { phone: string; amount: number; referenceId: string; description: string },
) {
  const requestId = crypto.randomUUID()
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 23)
  const waafiPayload = {
    schemaVersion: '1.0',
    requestId,
    timestamp,
    channelName: 'WEB',
    serviceName: 'API_PURCHASE',
    serviceParams: {
      merchantUid: cfg.merchantUid,
      apiUserId: cfg.apiUserId,
      apiKey: cfg.apiKey,
      paymentMethod: 'MWALLET_ACCOUNT',
      payerInfo: { accountNo: args.phone },
      transactionInfo: {
        referenceId: args.referenceId,
        invoiceId: args.referenceId,
        amount: args.amount.toFixed(2),
        currency: 'USD',
        description: args.description,
      },
    },
  }
  const waafiRes = await fetch(cfg.baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(waafiPayload),
  })
  const rawText = await waafiRes.text()
  let waafiBody: any
  try {
    waafiBody = JSON.parse(rawText)
  } catch {
    waafiBody = { raw: rawText }
  }
  return { waafiHttpOk: waafiRes.ok, waafiBody }
}

function wrapRaw(waafiBody: any, mode: string, extra?: Record<string, unknown>) {
  return {
    gateway_env: mode,
    ...extra,
    waafi: waafiBody,
  }
}

function normalizePayerName(raw: unknown): string | null {
  const name = String(raw || '').trim().replace(/\s+/g, ' ')
  if (name.length < 2) return null
  if (name.length > 120) return name.slice(0, 120)
  return name
}

function makeInvoiceNumber(paymentId: string, when = new Date()): string {
  const ymd = when.toISOString().slice(0, 10).replace(/-/g, '')
  const short = paymentId.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `TF-${ymd}-${short}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = normalizeSecret(Deno.env.get('SUPABASE_ANON_KEY'))
    const serviceKey = normalizeSecret(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    if (!url || !anonKey || !serviceKey) {
      return json({ error: 'SERVER_MISCONFIGURED', message: 'Unable to process payment.' }, 500)
    }

    const body = await req.json().catch(() => ({}))
    if (body?.enrollment_id) {
      return json(
        {
          error: 'WAAFIPAY_TENANT_DISABLED',
          message:
            'WaafiPay is not available for institution student payments. Record payments manually in Finance.',
        },
        410,
      )
    }

    const planId = String(body?.plan_id || '').trim()
    const billingCycle = String(body?.billing_cycle || 'monthly').toLowerCase()
    const phone = normalizePhone(String(body?.phone || ''))
    const payerName = normalizePayerName(body?.payer_name ?? body?.full_name)
    const publicPurchase = body?.public_purchase === true

    if (!planId) return json({ error: 'PLAN_REQUIRED', message: 'Select a plan to purchase.' }, 400)
    if (billingCycle !== 'monthly' && billingCycle !== 'yearly') {
      return json({ error: 'INVALID_BILLING_CYCLE', message: 'Choose monthly or yearly billing.' }, 400)
    }
    if (!payerName) {
      return json(
        { error: 'PAYER_NAME_REQUIRED', message: 'Enter the full name for the payment invoice.' },
        400,
      )
    }
    if (!phone) {
      return json(
        {
          error: 'PHONE_REQUIRED',
          message: 'Enter a valid mobile number (e.g. 25261xxxxxxx).',
        },
        400,
      )
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const cfg = await resolveWaafiConfig(admin)
    if (cfg.error) {
      return json(
        {
          error: 'WAAFIPAY_NOT_CONFIGURED',
          message:
            cfg.message ||
            'WaafiPay is not configured. Set sandbox secrets or switch WAAFIPAY_MODE.',
        },
        503,
      )
    }

    const { data: plan, error: planErr } = await admin
      .from('platform_plans')
      .select('id, name, slug, price_monthly, price_yearly, is_active')
      .eq('id', planId)
      .maybeSingle()

    if (planErr || !plan || !plan.is_active) {
      return json({ error: 'PLAN_NOT_FOUND', message: 'This plan is not available.' }, 404)
    }

    const amount =
      billingCycle === 'yearly' ? Number(plan.price_yearly) : Number(plan.price_monthly)
    if (!Number.isFinite(amount) || amount <= 0) {
      return json(
        {
          error: 'CONTACT_SALES',
          message: 'This plan requires a custom quote. Please contact Support.',
        },
        400,
      )
    }

    // ----- Public pay-first (no institution yet) -----
    if (publicPurchase) {
      const claimToken = crypto.randomUUID()
      const receiptToken = crypto.randomUUID()
      const referenceId = `prep-${claimToken.slice(0, 8)}-${Date.now()}`

      const { data: pendingRow, error: pendingErr } = await admin
        .from('platform_subscription_payments')
        .insert({
          institution_id: null,
          plan_id: plan.id,
          amount,
          currency: 'USD',
          billing_cycle: billingCycle,
          payer_name: payerName,
          payer_phone: phone,
          reference_id: referenceId,
          claim_token: claimToken,
          receipt_token: receiptToken,
          status: 'pending',
          gateway_env: cfg.mode,
          created_by: null,
        })
        .select('id')
        .single()

      if (pendingErr || !pendingRow) {
        console.error('pending insert failed', pendingErr)
        return json({ error: 'PAYMENT_INIT_FAILED', message: 'Could not start payment.' }, 500)
      }

      let waafiBody: any
      let waafiHttpOk = false
      try {
        const r = await callWaafiPay(
          {
            merchantUid: cfg.merchantUid,
            apiUserId: cfg.apiUserId,
            apiKey: cfg.apiKey,
            baseUrl: cfg.baseUrl,
          },
          {
            phone,
            amount,
            referenceId,
            description: `TvetFlow ${plan.name} (${billingCycle}) prepaid`,
          },
        )
        waafiHttpOk = r.waafiHttpOk
        waafiBody = r.waafiBody
      } catch (e) {
        await admin
          .from('platform_subscription_payments')
          .update({
            status: 'failed',
            raw_response: wrapRaw({ error: String(e) }, cfg.mode),
            updated_at: new Date().toISOString(),
          })
          .eq('id', pendingRow.id)
        return json(
          { error: 'WAAFIPAY_NETWORK', message: 'Could not reach the payment gateway. Try again.' },
          502,
        )
      }

      const approved =
        waafiSuccess(waafiBody) && (waafiHttpOk || String(waafiBody?.responseCode) === '2001')
      const transactionId = waafiBody?.params?.transactionId
        ? String(waafiBody.params.transactionId)
        : null

      if (!approved) {
        await admin
          .from('platform_subscription_payments')
          .update({
            status: 'failed',
            waafi_transaction_id: transactionId,
            raw_response: wrapRaw(waafiBody, cfg.mode),
            updated_at: new Date().toISOString(),
          })
          .eq('id', pendingRow.id)
        const state = String(waafiBody?.params?.state || '').toLowerCase()
        const msg =
          state === 'forapproval'
            ? 'Approve the charge on your phone, then try again if needed.'
            : String(waafiBody?.responseMsg || waafiBody?.params?.description || '').trim() ||
              'Payment was declined. Check your balance and try again.'
        return json(
          {
            error: 'WAAFIPAY_DECLINED',
            message: msg,
            responseCode: waafiBody?.responseCode ?? null,
            gateway_env: cfg.mode,
          },
          402,
        )
      }

      const now = new Date()
      const invoiceNumber = makeInvoiceNumber(pendingRow.id, now)
      await admin
        .from('platform_subscription_payments')
        .update({
          status: 'completed',
          invoice_number: invoiceNumber,
          waafi_transaction_id: transactionId,
          raw_response: wrapRaw(waafiBody, cfg.mode),
          paid_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', pendingRow.id)

      return json({
        ok: true,
        public_purchase: true,
        gateway_env: cfg.mode,
        payment_id: pendingRow.id,
        invoice_number: invoiceNumber,
        receipt_token: receiptToken,
        claim_token: claimToken,
        payer_name: payerName,
        transaction_id: transactionId,
        reference_id: referenceId,
        amount,
        currency: 'USD',
        billing_cycle: billingCycle,
        plan: { id: plan.id, name: plan.name, slug: plan.slug },
        receipt_path: `/payment-receipt?token=${receiptToken}`,
        create_institution_path: `/create-institution?purchase=${claimToken}`,
      })
    }

    // ----- Logged-in institution admin renew -----
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = bearerToken(authHeader)
    if (!token) return json({ error: 'Unauthorized' }, 401)

    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const {
      data: { user },
      error: uErr,
    } = await asCaller.auth.getUser(token)
    if (uErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile, error: pErr } = await admin
      .from('profiles')
      .select('id, role, institution_id')
      .eq('id', user.id)
      .maybeSingle()

    if (pErr || !profile) {
      return json({ error: 'PROFILE_NOT_FOUND', message: 'Unable to verify your account.' }, 403)
    }
    if (profile.role !== 'admin' || !profile.institution_id) {
      return json(
        {
          error: 'ADMIN_REQUIRED',
          message: 'Only institution admins can renew a platform plan.',
        },
        403,
      )
    }

    const institutionId = profile.institution_id as string
    const receiptToken = crypto.randomUUID()
    const referenceId = `plat-${institutionId.slice(0, 8)}-${Date.now()}`

    const { data: pendingRow, error: pendingErr } = await admin
      .from('platform_subscription_payments')
      .insert({
        institution_id: institutionId,
        plan_id: plan.id,
        amount,
        currency: 'USD',
        billing_cycle: billingCycle,
        payer_name: payerName,
        payer_phone: phone,
        reference_id: referenceId,
        receipt_token: receiptToken,
        status: 'pending',
        gateway_env: cfg.mode,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (pendingErr || !pendingRow) {
      console.error('pending insert failed', pendingErr)
      return json({ error: 'PAYMENT_INIT_FAILED', message: 'Could not start payment.' }, 500)
    }

    let waafiBody: any
    let waafiHttpOk = false
    try {
      const r = await callWaafiPay(
        {
          merchantUid: cfg.merchantUid,
          apiUserId: cfg.apiUserId,
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl,
        },
        {
          phone,
          amount,
          referenceId,
          description: `TvetFlow ${plan.name} (${billingCycle})`,
        },
      )
      waafiHttpOk = r.waafiHttpOk
      waafiBody = r.waafiBody
    } catch (e) {
      await admin
        .from('platform_subscription_payments')
        .update({
          status: 'failed',
          raw_response: wrapRaw({ error: String(e) }, cfg.mode),
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendingRow.id)
      return json(
        { error: 'WAAFIPAY_NETWORK', message: 'Could not reach the payment gateway. Try again.' },
        502,
      )
    }

    const approved =
      waafiSuccess(waafiBody) && (waafiHttpOk || String(waafiBody?.responseCode) === '2001')
    const transactionId = waafiBody?.params?.transactionId
      ? String(waafiBody.params.transactionId)
      : null

    if (!approved) {
      await admin
        .from('platform_subscription_payments')
        .update({
          status: 'failed',
          waafi_transaction_id: transactionId,
          raw_response: wrapRaw(waafiBody, cfg.mode),
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendingRow.id)
      const state = String(waafiBody?.params?.state || '').toLowerCase()
      const msg =
        state === 'forapproval'
          ? 'Approve the charge on your phone, then try again if needed.'
          : String(waafiBody?.responseMsg || waafiBody?.params?.description || '').trim() ||
            'Payment was declined. Check your balance and try again.'
      return json(
        {
          error: 'WAAFIPAY_DECLINED',
          message: msg,
          responseCode: waafiBody?.responseCode ?? null,
          gateway_env: cfg.mode,
        },
        402,
      )
    }

    const now = new Date()
    const endsAt = addBillingPeriod(now, billingCycle as 'monthly' | 'yearly')
    const invoiceNumber = makeInvoiceNumber(pendingRow.id, now)

    await admin
      .from('platform_subscription_payments')
      .update({
        status: 'completed',
        invoice_number: invoiceNumber,
        waafi_transaction_id: transactionId,
        raw_response: wrapRaw(waafiBody, cfg.mode),
        paid_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', pendingRow.id)

    const { data: sub, error: subErr } = await admin
      .from('tenant_subscriptions')
      .upsert(
        {
          institution_id: institutionId,
          plan_id: plan.id,
          status: 'active',
          billing_cycle: billingCycle,
          started_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
          notes: `WaafiPay ${cfg.mode} ${referenceId}`,
          updated_at: now.toISOString(),
        },
        { onConflict: 'institution_id' },
      )
      .select('id, plan_id, status, billing_cycle, started_at, ends_at')
      .single()

    if (subErr) {
      console.error('subscription upsert failed after payment', subErr)
      return json({
        ok: true,
        gateway_env: cfg.mode,
        payment_id: pendingRow.id,
        invoice_number: invoiceNumber,
        receipt_token: receiptToken,
        payer_name: payerName,
        transaction_id: transactionId,
        reference_id: referenceId,
        amount,
        receipt_path: `/payment-receipt?token=${receiptToken}`,
        warning: 'SUBSCRIPTION_SYNC_PENDING',
        message: 'Payment received. Subscription activation may need a moment.',
      })
    }

    return json({
      ok: true,
      gateway_env: cfg.mode,
      payment_id: pendingRow.id,
      invoice_number: invoiceNumber,
      receipt_token: receiptToken,
      payer_name: payerName,
      transaction_id: transactionId,
      reference_id: referenceId,
      amount,
      currency: 'USD',
      billing_cycle: billingCycle,
      plan: { id: plan.id, name: plan.name, slug: plan.slug },
      subscription: sub,
      receipt_path: `/payment-receipt?token=${receiptToken}`,
    })
  } catch (e) {
    console.error('waafipay-charge error', e)
    return json({ error: 'UNEXPECTED', message: String(e) }, 500)
  }
})
