// =====================================================================
//  Edge Function: waafipay-charge
//
//  Tenant (institution) student payments do NOT use WaafiPay — institutions
//  record payments manually (cash / bank / other) in Finance.
//
//  WaafiPay is reserved for platform / super-admin Plans & Subscriptions
//  (deferred). This endpoint rejects all tenant enrollment charges and
//  never inserts MOCK payments.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: uErr } = await asCaller.auth.getUser()
    if (uErr || !user) return json({ error: 'Unauthorized' }, 401)

    // Tenant enrollment charging disabled — no MOCK, no payment rows.
    return json(
      {
        error: 'WAAFIPAY_TENANT_DISABLED',
        message:
          'WaafiPay is not available for institution student payments. Record payments manually in Finance. Platform subscription billing is handled separately by super admin.',
      },
      410,
    )
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
