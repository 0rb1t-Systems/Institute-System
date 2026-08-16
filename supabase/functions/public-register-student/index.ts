// =====================================================================
//  Edge Function: public-register-student (RETIRED)
//  Instant public account creation is disabled (Option B).
//  Public forms must use RPC submit_registration_inquiry (pending only).
//  Admin/Staff approve via approve-registration-inquiry.
// =====================================================================

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  return json(
    {
      error: 'DEPRECATED',
      message:
        'Instant public registration is disabled. Submit a pending inquiry via submit_registration_inquiry; Admin/Staff approve with approve-registration-inquiry.',
    },
    410,
  )
})
