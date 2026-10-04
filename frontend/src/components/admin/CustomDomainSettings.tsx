import React, { useCallback, useEffect, useState } from 'react'
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

function statusBadge(status?: string | null) {
  const s = String(status || 'none').toLowerCase()
  if (s === 'active') {
    return (
      <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/40 hover:bg-emerald-600/20">
        Active
      </Badge>
    )
  }
  if (s === 'pending') {
    return (
      <Badge className="bg-amber-600/20 text-amber-300 border-amber-600/40 hover:bg-amber-600/20">
        Pending DNS
      </Badge>
    )
  }
  if (s === 'error') {
    return (
      <Badge className="bg-red-600/20 text-red-400 border-red-600/40 hover:bg-red-600/20">
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

export default function CustomDomainSettings({ institution, onChanged }: Props) {
  const { toast } = useToast()
  const [domainInput, setDomainInput] = useState('')
  const [state, setState] = useState<CustomDomainStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'start' | 'verify' | 'disconnect' | null>(null)

  const apply = useCallback((data: CustomDomainStatus) => {
    setState(data)
    if (data.custom_domain) setDomainInput(data.custom_domain)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await manageCustomDomain('status')
      apply(data)
    } catch (err) {
      // Fall back to institution row if edge not deployed yet
      if (institution?.custom_domain || institution?.custom_domain_status) {
        setState({
          custom_domain: institution.custom_domain,
          custom_domain_status: institution.custom_domain_status || 'none',
          custom_domain_error: institution.custom_domain_error,
          custom_domain_verified_at: institution.custom_domain_verified_at,
          verification_token: institution.custom_domain_verification_token,
          fallback_subdomain: institution.subdomain,
        })
        if (institution.custom_domain) setDomainInput(institution.custom_domain)
      }
    } finally {
      setLoading(false)
    }
  }, [apply, institution])

  useEffect(() => {
    refresh()
  }, [refresh])

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
      const data = await manageCustomDomain('start', domainInput.trim())
      apply(data)
      await onChanged?.()
      toast({
        title: 'Domain saved',
        description: 'Add the DNS records below, then click Verify DNS.',
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
      const data = await manageCustomDomain('verify')
      apply(data)
      await onChanged?.()
      if (data.verified || data.custom_domain_status === 'active') {
        toast({
          title: 'Domain active',
          description: data.message || 'SSL may take a few minutes.',
        })
      } else {
        toast({
          title: 'DNS not ready yet',
          description: data.message || data.custom_domain_error || 'Wait for DNS to propagate, then try again.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      if (err?.code === 'RATE_LIMITED' || String(err?.message || '').includes('minute')) {
        toast({
          title: 'Please wait',
          description: 'Wait about a minute before checking DNS again.',
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
      const data = await manageCustomDomain('disconnect')
      apply(data)
      setDomainInput('')
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

  // Build local DNS table if edge returned no dns but we have token
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
        Connect a domain you bought (Namecheap, GoDaddy, Cloudflare, etc.). Example:{' '}
        <span className="font-mono text-[var(--tenant-text)]">hankaal.com</span>. Add the DNS
        records, then Verify — no platform support needed. Your subdomain keeps working as a
        fallback (password-reset links also use the subdomain).
      </p>

      {loading ? (
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
                  placeholder="hankaal.com"
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

          {(state?.custom_domain_error || institution?.custom_domain_error) && status !== 'active' ? (
            <Alert className="border-amber-600/40 bg-amber-950/20 py-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-xs text-amber-200/90">
                {state?.custom_domain_error || institution?.custom_domain_error}
              </AlertDescription>
            </Alert>
          ) : null}

          {(showDns || status === 'pending' || status === 'error') && fallbackRecords.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-[var(--tenant-text)]">
                Add these DNS records at your registrar, then Verify:
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
                Cloudflare: set Proxy status to DNS only (grey cloud) for A/CNAME. Propagation can take
                a few minutes up to 48 hours.
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
                <>
                  {' '}
                  · Fallback subdomain still works.
                </>
              ) : null}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
