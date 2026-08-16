import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutTemplate, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPublicInstitutionBySubdomain, updateInstitution } from '@/lib/api';
import {
  resolvePublicTenantSubdomain,
  getInstitutionPrimary,
} from '@/lib/institution';
import { useAuth } from '@/contexts/AuthContext';
import { getUserMessage } from '@/lib/mapError';
import { MESSAGES } from '@/lib/messages';
import TenantLandingRenderer from '@/components/landing/TenantLandingRenderer';
import LandingLoginModal from '@/components/landing/LandingLoginModal';
import LandingTemplateSwitcher from '@/components/landing/LandingTemplateSwitcher';
import { dashboardPathForRole } from '@/components/landing/types';
import {
  getLandingTemplate,
  isLandingTemplateId,
  type LandingTemplateId,
} from '@/lib/landingTemplates';

/**
 * Public tenant landing — loads saved default template; admins can switch & persist.
 */
const TenantHomePage = ({ subdomain: subdomainProp }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, login, refreshUser } = useAuth();
  const subdomain =
    subdomainProp ||
    searchParams.get('tenant') ||
    searchParams.get('subdomain') ||
    resolvePublicTenantSubdomain();

  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(!!subdomain);
  const [error, setError] = useState(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<LandingTemplateId>('classic');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!subdomain) {
        setLoading(false);
        setError('missing');
        return;
      }
      setLoading(true);
      try {
        const inst = await getPublicInstitutionBySubdomain(subdomain);
        if (cancelled) return;
        if (!inst) {
          setError('not_found');
          setInstitution(null);
        } else {
          setInstitution(inst);
          // Always use the institution's saved default template
          setActiveTemplateId(getLandingTemplate(inst.landing_template_id).id);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('load_failed');
          setInstitution(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subdomain]);

  useEffect(() => {
    if (!loginOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLoginOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [loginOpen]);

  const primary = getInstitutionPrimary(institution);
  const q = encodeURIComponent(subdomain || '');
  const verifyHref = `/verify-credential?tenant=${q}`;
  const sameTenant =
    user &&
    institution &&
    user.institution_id &&
    String(user.institution_id) === String(institution.id);

  const canSaveTemplate = !!(sameTenant && user?.role === 'admin');

  const openLogin = () => {
    setLoginError('');
    setLoginOpen(true);
  };

  const closeLogin = () => {
    if (signingIn) return;
    setLoginOpen(false);
    setLoginError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const id = identifier.trim();
    const pw = password.trim();
    if (!id || !pw) {
      setLoginError(MESSAGES.AUTH.MISSING_CREDENTIALS);
      return;
    }
    if (!institution?.id) {
      setLoginError('Institution not ready. Refresh the page or open a valid institution link (?tenant=slug).');
      return;
    }
    setSigningIn(true);
    try {
      const { user: signedIn, error: loginErr } = await login(id, pw, {
        requiredInstitutionId: String(institution.id),
      });
      if (loginErr || !signedIn) {
        throw loginErr || new Error('AUTH.INVALID_CREDENTIALS');
      }
      setIdentifier('');
      setPassword('');
      setLoginOpen(false);
      navigate(dashboardPathForRole(signedIn.role), { replace: true });
    } catch (err) {
      setLoginError(
        getUserMessage(err, { context: 'TenantHomeLogin', fallback: MESSAGES.AUTH.INVALID_CREDENTIALS }),
      );
    } finally {
      setSigningIn(false);
    }
  };

  /** Preview only while browsing templates. */
  const handleSelectTemplate = (id: LandingTemplateId) => {
    if (!isLandingTemplateId(id)) return;
    setSaveError('');
    setActiveTemplateId(id);
  };

  /** Done → save the last selected template as the institution default. */
  const handleDoneTemplates = async () => {
    setSaveError('');

    if (!canSaveTemplate) {
      setSwitcherOpen(false);
      return;
    }

    const id = activeTemplateId;
    const alreadySaved =
      getLandingTemplate(institution.landing_template_id).id === id;

    if (alreadySaved) {
      setSwitcherOpen(false);
      return;
    }

    setSavingTemplate(true);
    try {
      const meta = getLandingTemplate(id);
      const updated = await updateInstitution({
        landing_template_id: id,
        theme_primary: institution.theme_primary || meta.defaultPrimary,
        theme_accent: institution.theme_accent || meta.defaultAccent,
      });
      setInstitution((prev) => ({
        ...(prev || {}),
        ...(updated || {}),
        landing_template_id: id,
      }));
      setActiveTemplateId(id);
      await refreshUser?.();
      setSwitcherOpen(false);
    } catch (err) {
      setSaveError(
        getUserMessage(err, { context: 'SaveLandingTemplate', fallback: MESSAGES.UNEXPECTED }),
      );
    } finally {
      setSavingTemplate(false);
    }
  };

  /** Cancel closes without saving — restore the previously saved default. */
  const handleCancelTemplates = () => {
    if (savingTemplate) return;
    setSaveError('');
    setActiveTemplateId(getLandingTemplate(institution?.landing_template_id).id);
    setSwitcherOpen(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1628] text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primary }} />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a1628] p-6 text-slate-100">
        <Helmet>
          <title>Institution not found</title>
        </Helmet>
        <p className="mb-4 text-slate-400">
          {error === 'missing'
            ? 'Open this page with a valid institution link (?tenant=subdomain).'
            : 'Institution not found or inactive.'}
        </p>
        <Button asChild variant="outline" className="border-slate-700">
          <Link to="/">Back to TvetFlow</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{institution.name}</title>
      </Helmet>

      <TenantLandingRenderer
        institution={{ ...institution, landing_template_id: activeTemplateId }}
        templateId={activeTemplateId}
        verifyHref={verifyHref}
        sameTenant={!!sameTenant}
        userRole={user?.role}
        onOpenLogin={openLogin}
        onChangeTemplate={() => {
          setSaveError('');
          setSwitcherOpen(true);
        }}
      />

      <button
        type="button"
        onClick={() => {
          setSaveError('');
          setSwitcherOpen(true);
        }}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#0c1a32]/92 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md hover:bg-[#12243f]"
      >
        <LayoutTemplate className="h-3.5 w-3.5 text-teal-300" />
        Templates
      </button>

      <LandingTemplateSwitcher
        open={switcherOpen}
        onClose={handleCancelTemplates}
        onDone={handleDoneTemplates}
        institution={institution}
        activeId={activeTemplateId}
        onSelect={handleSelectTemplate}
        canSave={canSaveTemplate}
        saving={savingTemplate}
        saveError={saveError}
      />

      <LandingLoginModal
        open={loginOpen}
        institutionName={institution.name}
        logoUrl={institution.logo_url}
        primary={primary}
        identifier={identifier}
        password={password}
        loginError={loginError}
        signingIn={signingIn}
        onIdentifier={(v) => {
          setIdentifier(v);
          setLoginError('');
        }}
        onPassword={(v) => {
          setPassword(v);
          setLoginError('');
        }}
        onClose={closeLogin}
        onSubmit={handleLogin}
      />
    </>
  );
};

export default TenantHomePage;
