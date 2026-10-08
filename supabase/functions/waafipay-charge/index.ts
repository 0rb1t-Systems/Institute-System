// =====================================================================
//  Edge Function: waafipay-charge
//  Platform Plans only (sandbox / production).
//
//  Public (pay-first): { public_purchase: true, plan_id, billing_cycle, phone }
//    → no JWT; returns claim_token for /create-institution?purchase=
//  Admin renew: Authorization Bearer + { plan_id, billing_cycle, phone }
//  Tenant student charges: rejected (enrollment_id)
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 9 && /^[67]/.test(digits)) return `252${digits}`
  if (digits.length === 12 && digits.startsWith('252')) return digits
  if (digits.length >= 10 && digits.length <= 15) return digits
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
    return state === 'APPROVED' || state === ''
  }
  return false
}

function waafiCreds() {
  return {
    merchantUid: normalizeSecret(Deno.env.get('WAAFIPAY_MERCHANT_UID')) || 'M01',
    apiUserId: normalizeSecret(Deno.env.get('WAAFIPAY_API_USER_ID')) || '1008348',
    apiKey:
      normalizeSecret(Deno.env.get('WAAFIPAY_API_KEY')) || 'API-8LylZYCuTdonYgjvwzQ2BCcUr5j',
    waafiBase:
      normalizeSecret(Deno.env.get('WAAFIPAY_BASE_URL')) || 'https://sandbox.waafipay.com/asm',
  }
}

async function callWaafiPay(args: {
  phone: string
  amount: number
  referenceId: string
  description: string
}) {
  const { merchantUid, apiUserId, apiKey, waafiBase } = waafiCreds()
  const requestId = crypto.randomUUID()
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 23)
  const waafiPayload = {
    schemaVersion: '1.0',
    requestId,
    timestamp,
    channelName: 'WEB',
    serviceName: 'API_PURCHASE',
    serviceParams: {
      merchantUid,
      apiUserId,
      apiKey,
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
  const waafiRes = await fetch(waafiBase, {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

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
    const publicPurchase = body?.public_purchase === true

    if (!planId) return json({ error: 'PLAN_REQUIRED', message: 'Select a plan to purchase.' }, 400)
    if (billingCycle !== 'monthly' && billingCycle !== 'yearly') {
      return json({ error: 'INVALID_BILLING_CYCLE', message: 'Choose monthly or yearly billing.' }, 400)
    }
    if (!phone) {
      return json(
        { error: 'PHONE_REQUIRED', message: 'Enter a valid mobile number (e.g. 25261xxxxxxx).' },
        400,
      )
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

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
      const referenceId = `prep-${claimToken.slice(0, 8)}-${Date.now()}`

      const { data: pendingRow, error: pendingErr } = await admin
        .from('platform_subscription_payments')
        .insert({
          institution_id: null,
          plan_id: plan.id,
          amount,
          currency: 'USD',
          billing_cycle: billingCycle,
          payer_phone: phone,
          reference_id: referenceId,
          claim_token: claimToken,
          status: 'pending',
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
        const r = await callWaafiPay({
          phone,
          amount,
          referenceId,
          description: `TvetFlow ${plan.name} (${billingCycle}) prepaid`,
        })
        waafiHttpOk = r.waafiHttpOk
        waafiBody = r.waafiBody
      } catch (e) {
        await admin
          .from('platform_subscription_payments')
          .update({
            status: 'failed',
            raw_response: { error: String(e) },
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
            raw_response: waafiBody,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pendingRow.id)
        const msg =
          String(waafiBody?.responseMsg || waafiBody?.params?.description || '').trim() ||
          'Payment was declined. Check your balance and try again.'
        return json(
          { error: 'WAAFIPAY_DECLINED', message: msg, responseCode: waafiBody?.responseCode ?? null },
          402,
        )
      }

      const now = new Date()
      await admin
        .from('platform_subscription_payments')
        .update({
          status: 'completed',
          waafi_transaction_id: transactionId,
          raw_response: waafiBody,
          paid_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', pendingRow.id)

      return json({
        ok: true,
        public_purchase: true,
        payment_id: pendingRow.id,
        claim_token: claimToken,
        transaction_id: transactionId,
        reference_id: referenceId,
        amount,
        currency: 'USD',
        billing_cycle: billingCycle,
        plan: { id: plan.id, name: plan.name, slug: plan.slug },
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
    const referenceId = `plat-${institutionId.slice(0, 8)}-${Date.now()}`

    const { data: pendingRow, error: pendingErr } = await admin
      .from('platform_subscription_payments')
      .insert({
        institution_id: institutionId,
        plan_id: plan.id,
        amount,
        currency: 'USD',
        billing_cycle: billingCycle,
        payer_phone: phone,
        reference_id: referenceId,
        status: 'pending',
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
      const r = await callWaafiPay({
        phone,
        amount,
        referenceId,
        description: `TvetFlow ${plan.name} (${billingCycle})`,
      })
      waafiHttpOk = r.waafiHttpOk
      waafiBody = r.waafiBody
    } catch (e) {
      await admin
        .from('platform_subscription_payments')
        .update({
          status: 'failed',
          raw_response: { error: String(e) },
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
          raw_response: waafiBody,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendingRow.id)
      const msg =
        String(waafiBody?.responseMsg || waafiBody?.params?.description || '').trim() ||
        'Payment was declined. Check your balance and try again.'
      return json(
        { error: 'WAAFIPAY_DECLINED', message: msg, responseCode: waafiBody?.responseCode ?? null },
        402,
      )
    }

    const now = new Date()
    const endsAt = addBillingPeriod(now, billingCycle as 'monthly' | 'yearly')

    await admin
      .from('platform_subscription_payments')
      .update({
        status: 'completed',
        waafi_transaction_id: transactionId,
        raw_response: waafiBody,
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
          notes: `WaafiPay ${referenceId}`,
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
        payment_id: pendingRow.id,
        transaction_id: transactionId,
        reference_id: referenceId,
        amount,
        warning: 'SUBSCRIPTION_SYNC_PENDING',
        message: 'Payment received. Subscription activation may need a moment.',
      })
    }

    return json({
      ok: true,
      payment_id: pendingRow.id,
      transaction_id: transactionId,
      reference_id: referenceId,
      amount,
      currency: 'USD',
      billing_cycle: billingCycle,
      plan: { id: plan.id, name: plan.name, slug: plan.slug },
      subscription: sub,
    })
  } catch (e) {
    console.error('waafipay-charge error', e)
    return json({ error: 'UNEXPECTED', message: String(e) }, 500)
  }
})
