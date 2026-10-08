import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Copy, CheckCircle2, AlertCircle, Globe, Unplug } from 'lucide-react'
import {
  manageCustomDomain,
  type CustomDomainStatus,
} from '@/lib/api'
import { getUserMessage } from '@/lib/mapError'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

type Props = {
  institution?: {
    custom_domain?: string | null
    custom_domain_status?: string | null
    custom_domain_verification_token?: string | null
    custom_domain_error?: string | null
    custom_domain_verified_at?: string | null
    subdomain?: string | null
  } | null
  onChanged?: () => void | Promise<void>
}

type DnsCheck = NonNullable<CustomDomainStatus['dns_check']>

function statusBadge(status?: string | null) {
  const s = String(status || 'none').toLowerCase()
  if (s === 'active') {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/35 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15"
      >
        Active
      </Badge>
    )
  }
  if (s === 'pending') {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/35 bg-amber-500/15 text-amber-200 hover:bg-amber-500/15"
      >
        Pending DNS
      </Badge>
    )
  }
  if (s === 'error') {
    return (
      <Badge
        variant="outline"
        className="border-red-500/35 bg-red-500/15 text-red-300 hover:bg-red-500/15"
      >
        Error
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-[var(--tenant-line)] text-[var(--tenant-muted)]">
      Not connected
    </Badge>
  )
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(label)), ms)
    promise.then(
      (v) => {
        window.clearTimeout(t)
        resolve(v)
      },
      (e) => {
        window.clearTimeout(t)
        reject(e)
      },
    )
  })
}

function institutionFallback(institution: Props['institution']): CustomDomainStatus | null {
  if (!institution?.custom_domain && !institution?.custom_domain_status) return null
  return {
    custom_domain: institution.custom_domain,
    custom_domain_status: institution.custom_domain_status || 'none',
    custom_domain_error: institution.custom_domain_error,
    custom_domain_verified_at: institution.custom_domain_verified_at,
    verification_token: institution.custom_domain_verification_token,
    fallback_subdomain: institution.subdomain,
  }
}

export default function CustomDomainSettings({ institution, onChanged }: Props) {
  const { toast } = useToast()
  const [domainInput, setDomainInput] = useState(institution?.custom_domain || '')
  const [state, setState] = useState<CustomDomainStatus | null>(() => institutionFallback(institution))
  const [dnsCheck, setDnsCheck] = useState<DnsCheck | null>(null)
  const [loading, setLoading] = useState(!institution?.custom_domain && !institution?.custom_domain_status)
  const [busy, setBusy] = useState<'start' | 'verify' | 'disconnect' | null>(null)
  const institutionRef = useRef(institution)
  institutionRef.current = institution

  const apply = useCallback((data: CustomDomainStatus) => {
    setState(data)
    if (data.custom_domain) setDomainInput(data.custom_domain)
    if (data.dns_check) setDnsCheck(data.dns_check)
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const hasLocal = Boolean(
        institutionRef.current?.custom_domain || institutionRef.current?.custom_domain_status,
      )
      // Soft load when we already show pending DNS — avoid full-screen spinner loops.
      if (!hasLocal) setLoading(true)
      try {
        const data = await withTimeout(
          manageCustomDomain('status'),
          12_000,
          'Domain status timed out. Try again.',
        )
        if (!cancelled) apply(data)
      } catch {
        const fallback = institutionFallback(institutionRef.current)
        if (!cancelled && fallback) apply(fallback)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // Mount-only: parent institution object identity changes often and must not re-trigger loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: 'Copied', description: text })
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }

  const onConnect = async () => {
    setBusy('start')
    try {
      const data = await withTimeout(
        manageCustomDomain('start', domainInput.trim()),
        20_000,
        'Connect timed out. Try again.',
      )
      apply(data)
      setDnsCheck(null)
      await onChanged?.()
      toast({
        title: 'Domain saved',
        description: 'Add the DNS records below at the provider that owns your nameservers, then Verify.',
      })
    } catch (err) {
      toast({
        title: 'Could not connect domain',
        description: getUserMessage(err, { fallback: 'Check the domain and try again.' }),
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  const onVerify = async () => {
    setBusy('verify')
    try {
      const data = await withTimeout(
        manageCustomDomain('verify'),
        25_000,
        'DNS check timed out. Try again in a moment.',
      )
      apply(data)
      await onChanged?.()
      if (data.verified || data.custom_domain_status === 'active') {
        setDnsCheck(null)
        toast({
          title: 'Domain active',
          description: data.message || 'SSL may take a few minutes.',
        })
      } else {
        toast({
          title: 'DNS not ready yet',
          description: data.message || data.custom_domain_error || 'Fix the records below, then try again.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      if (err?.code === 'RATE_LIMITED' || String(err?.message || '').includes('Wait about')) {
        toast({
          title: 'Please wait',
          description: err?.message || 'Wait a few seconds before checking DNS again.',
        })
      } else {
        toast({
          title: 'Verification failed',
          description: getUserMessage(err, { fallback: 'DNS check failed.' }),
          variant: 'destructive',
        })
      }
    } finally {
      setBusy(null)
    }
  }

  const onDisconnect = async () => {
    if (!window.confirm('Disconnect this custom domain? Your subdomain portal will keep working.')) {
      return
    }
    setBusy('disconnect')
    try {
      const data = await withTimeout(
        manageCustomDomain('disconnect'),
        20_000,
        'Disconnect timed out. Try again.',
      )
      apply(data)
      setDomainInput('')
      setDnsCheck(null)
      await onChanged?.()
      toast({ title: 'Domain disconnected' })
    } catch (err) {
      toast({
        title: 'Disconnect failed',
        description: getUserMessage(err, { fallback: 'Try again.' }),
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  const status = state?.custom_domain_status || institution?.custom_domain_status || 'none'
  const records = state?.dns?.records || []
  const showDns = status === 'pending' || status === 'error' || (status === 'active' && records.length > 0)
  const token = state?.verification_token || institution?.custom_domain_verification_token
  const apex = state?.custom_domain || institution?.custom_domain
  const errorText = state?.custom_domain_error || institution?.custom_domain_error

  const fallbackRecords =
    records.length === 0 && apex && token
      ? [
          { type: 'A', host: '@', hostFull: apex, value: '76.76.21.21', note: 'Apex' },
          {
            type: 'CNAME',
            host: 'www',
            hostFull: `www.${apex}`,
            value: 'cname.vercel-dns.com',
            note: 'www',
          },
          { type: 'TXT', host: '@', hostFull: apex, value: token, note: 'Verification' },
        ]
      : records

  const nsObserved = dnsCheck?.observed?.ns?.length ? dnsCheck.observed.ns.join(', ') : null

  return (
    <div className="mt-5 rounded-lg border border-[var(--tenant-line)] bg-[var(--tenant-bg-2)] p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-[var(--tenant-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--tenant-text)]">Custom domain</h3>
          {statusBadge(status)}
        </div>
        {status !== 'none' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-[var(--tenant-muted)] hover:text-red-400"
            disabled={!!busy}
            onClick={onDisconnect}
          >
            {busy === 'disconnect' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unplug className="h-3.5 w-3.5" />
            )}
            <span className="ml-1.5">Disconnect</span>
          </Button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--tenant-muted)]">
        Every institution can connect their own domain free — no platform support ticket needed.
        Buy a domain (Namecheap, GoDaddy, Hostinger, Cloudflare, etc.), then add DNS at the provider
        that owns your <span className="font-medium text-[var(--tenant-text)]">nameservers</span>.
        Your subdomain keeps working as a fallback (password-reset links also use the subdomain).
      </p>

      {loading && !apex ? (
        <div className="flex items-center gap-2 text-xs text-[var(--tenant-muted)] py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading domain status…
        </div>
      ) : (
        <>
          {status === 'none' || !apex ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="custom_domain_input" className="text-xs text-[var(--tenant-muted)]">
                  Domain
                </Label>
                <Input
                  id="custom_domain_input"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="yourdomain.com"
                  className="bg-[var(--tenant-bg)] border-[var(--tenant-line)] text-[var(--tenant-text)] h-9 font-mono"
                />
              </div>
              <Button
                type="button"
                className="h-9"
                disabled={!!busy || !domainInput.trim()}
                onClick={onConnect}
              >
                {busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span className={cn(busy === 'start' && 'ml-2')}>Connect</span>
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-[var(--tenant-text)]">{apex}</span>
              {status === 'active' ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Live at https://{apex}
                </span>
              ) : null}
            </div>
          )}

          {errorText && status !== 'active' ? (
            <Alert className="border-amber-600/40 bg-amber-950/20 py-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-xs text-amber-200/90 whitespace-pre-wrap break-words">
                {errorText}
              </AlertDescription>
            </Alert>
          ) : null}

          {nsObserved && status !== 'active' ? (
            <p className="text-[10px] text-[var(--tenant-muted)] font-mono">
              Live nameservers: {nsObserved}
            </p>
          ) : null}

          {(showDns || status === 'pending' || status === 'error') && fallbackRecords.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-[var(--tenant-text)]">
                Add these DNS records where nameservers point, then Verify:
              </p>
              <div className="overflow-x-auto rounded border border-[var(--tenant-line)]">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-[var(--tenant-bg)] text-[var(--tenant-muted)]">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Type</th>
                      <th className="px-2 py-1.5 font-medium">Host</th>
                      <th className="px-2 py-1.5 font-medium">Value</th>
                      <th className="px-2 py-1.5 w-8" />
                    </tr>
                  </thead>
                  <tbody className="text-[var(--tenant-text)]">
                    {fallbackRecords.map((r) => (
                      <tr key={`${r.type}-${r.host}-${r.value}`} className="border-t border-[var(--tenant-line)]">
                        <td className="px-2 py-1.5 font-mono">{r.type}</td>
                        <td className="px-2 py-1.5 font-mono">{r.host}</td>
                        <td className="px-2 py-1.5 font-mono break-all max-w-[220px]">{r.value}</td>
                        <td className="px-1 py-1">
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-[var(--tenant-bg)] text-[var(--tenant-muted)]"
                            onClick={() => copy(r.value)}
                            aria-label={`Copy ${r.type} value`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-[var(--tenant-muted)]">
                Hostinger tip: if nameservers are not Hostinger&apos;s, change NS to Hostinger first — or
                edit DNS in Contabo/Cloudflare/wherever NS currently point. Cloudflare proxy must be DNS
                only (grey cloud). Propagation: minutes to 48h after NS change; record-only edits are
                usually faster.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="h-9"
                disabled={!!busy}
                onClick={onVerify}
              >
                {busy === 'verify' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verify DNS
              </Button>
            </div>
          ) : null}

          {status === 'active' && apex ? (
            <p className="text-[11px] text-[var(--tenant-muted)]">
              Institution portal:{' '}
              <a
                href={`https://${apex}`}
                target="_blank"
                rel="noreferrer"
                className="text-teal-400 hover:underline break-all"
              >
                https://{apex}
              </a>
              {state?.fallback_subdomain || institution?.subdomain ? (
                <> · Fallback subdomain still works.</>
              ) : null}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
