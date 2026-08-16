import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  getProfile,
  getStudentByProfileId,
  getEmailByUsername,
  studentHasPaidRegistrationFee,
} from '@/lib/api';
import { logError } from '@/lib/errorHandler';
import { isValidEmail, setAppCurrency } from '@/lib/utils';
import {
  getInstitutionCurrency,
  getInstitutionCurrencySymbol,
  getRegistrationFeeAmount,
} from '@/lib/institution';

const AuthContext = createContext<any>(null);

const INACTIVITY_MS = 30 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [institution, setInstitution] = useState(null);
  // Only blocks App shell on first boot — NOT during login typing/submit
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const inactivityTimer = useRef(null);
  const initDone = useRef(false);

  // Latest user id without making callbacks depend on `user` (avoids
  // re-subscribing every listener each time the profile object changes).
  const userIdRef = useRef(null);
  userIdRef.current = user?.id ?? null;

  /** When true, SIGNED_IN handler must not set user (platform admin gate rejected). */
  const suppressAuthUserRef = useRef(false);

  // De-dupes concurrent buildUser() calls. supabase-js fires INITIAL_SESSION
  // on subscribe while initializeAuth() is already resolving getSession(), so
  // without this the whole 3-request profile boot ran twice on every page load.
  const inFlightBuild = useRef(null);

  const clearAuthData = useCallback(async () => {
    await supabase.auth.signOut();
    if (mounted.current) {
      setUser(null);
      setInstitution(null);
    }
    setAppCurrency('USD', '$');
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      if (userIdRef.current) {
        console.warn('Session expired due to inactivity.');
        clearAuthData();
      }
    }, INACTIVITY_MS);
  }, [clearAuthData]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    // mousemove fires hundreds of times a second; throttle to one timer reset
    // per 5s instead of clearing/creating a timeout on every pixel of movement.
    let last = 0;
    const reset = () => {
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      resetInactivityTimer();
    };
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  const buildUser = useCallback(async (authUser) => {
    if (!authUser) return null;

    let profile = null;
    try {
      profile = await getProfile(authUser.id);
    } catch {
      profile = null;
    }

    if (!profile) return null;

    // Defense-in-depth: only approved profiles may use the app.
    // Option B already avoids creating auth users until approval; this blocks
    // pending / non-approved profiles that somehow have credentials.
    if (profile.status === 'suspended') {
      throw new Error('AUTH.SUSPENDED');
    }
    if (profile.status !== 'approved') {
      throw new Error('AUTH.PENDING_APPROVAL');
    }

    // Institution + student record are independent of each other — previously
    // these ran sequentially, costing an extra round trip on every boot.
    const [instResult, studentResult] = await Promise.all([
      profile.institution_id
        ? supabase
            .from('institutions')
            .select(
              'id, name, subdomain, logo_url, description, email, phone, address, website, motto, theme_primary, theme_accent, status, affiliate_commission_rate, registration_fee_amount, default_instructor_commission_rate, currency, currency_symbol, signatory_left_title, signatory_right_title, signatory_left_name, signatory_right_name, seal_url, signature_url, certificate_footer_text, transcript_footer_text, invoice_footer_text, settings_completed_at',
            )
            .eq('id', profile.institution_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      profile.role === 'student'
        ? getStudentByProfileId(authUser.id).catch((err) => {
            logError('AuthContext - loadUserProfile (student load)', err);
            return null;
          })
        : Promise.resolve(null),
    ]);

    if (instResult?.error) logError('AuthContext - loadInstitution', instResult.error);
    const institutionRow = instResult?.data ?? null;
    if (mounted.current) setInstitution(institutionRow);
    setAppCurrency(
      getInstitutionCurrency(institutionRow),
      getInstitutionCurrencySymbol(institutionRow),
    );

    // Suspended tenants cannot use the app (Super Admin is platform-scoped)
    if (
      profile.role !== 'super_admin' &&
      institutionRow &&
      institutionRow.status === 'suspended'
    ) {
      throw new Error('AUTH.TENANT_SUSPENDED');
    }

    const studentData = studentResult;

    // Institution registration fee gate: students cannot use the portal until
    // a completed registration-fee payment exists. Fee amount 0 = disabled.
    if (profile.role === 'student' && getRegistrationFeeAmount(institutionRow) > 0) {
      const paid = await studentHasPaidRegistrationFee(authUser.id).catch((err) => {
        logError('AuthContext - registration fee check', err);
        return false;
      });
      if (!paid) {
        throw new Error('AUTH.REGISTRATION_FEE_REQUIRED');
      }
    }

    return {
      id: authUser.id,
      email: authUser.email || profile.email,
      name: profile.name || profile.full_name,
      username: profile.username,
      role: profile.role,
      avatar_url: profile.avatar_url || authUser.user_metadata?.avatar_url,
      phone: profile.phone,
      studentId: studentData?.id || (profile.role === 'student' ? profile.id : undefined),
      studentCode: studentData?.student_code,
      institution_id: profile.institution_id,
      status: profile.status,
    };
  }, []);

  /** Shares one in-flight profile build between concurrent callers. */
  const buildUserOnce = useCallback(
    (authUser) => {
      if (inFlightBuild.current?.id === authUser?.id) return inFlightBuild.current.promise;
      const promise = buildUser(authUser).finally(() => {
        if (inFlightBuild.current?.promise === promise) inFlightBuild.current = null;
      });
      inFlightBuild.current = { id: authUser?.id, promise };
      return promise;
    },
    [buildUser]
  );

  const finishInit = useCallback(() => {
    if (!initDone.current && mounted.current) {
      initDone.current = true;
      setInitializing(false);
    }
  }, []);

  const loadUserProfile = useCallback(
    async (authUser) => {
      if (!authUser) {
        if (mounted.current) {
          setUser(null);
          setInstitution(null);
        }
        finishInit();
        return;
      }
      try {
        const nextUser = await buildUserOnce(authUser);
        if (mounted.current) {
          if (!nextUser) {
            setError(new Error('No profile found for this account.'));
            setUser(null);
          } else {
            setUser(nextUser);
            setError(null);
            resetInactivityTimer();
          }
        }
      } catch (err) {
        logError('AuthContext - loadUserProfile', err);
        await supabase.auth.signOut().catch(() => {});
        if (mounted.current) {
          setError(err);
          setUser(null);
          setInstitution(null);
        }
      } finally {
        finishInit();
      }
    },
    [buildUserOnce, resetInactivityTimer, finishInit]
  );

  useEffect(() => {
    mounted.current = true;

    // Single boot path: onAuthStateChange emits INITIAL_SESSION on subscribe,
    // which covers both "already signed in" and "signed out". Calling
    // getSession() separately duplicated the entire profile fetch.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (mounted.current) {
          setUser(null);
          setInstitution(null);
        }
        finishInit();
        return;
      }

      if (event === 'INITIAL_SESSION') {
        await loadUserProfile(session?.user ?? null);
        return;
      }

      // Avoid remounting the login form: login() already built the user, so a
      // SIGNED_IN echo only needs a quiet refresh (de-duped by buildUserOnce).
      // If status gate fails (pending/suspended), clear the session.
      if (session?.user && event === 'SIGNED_IN' && initDone.current) {
        try {
          if (suppressAuthUserRef.current) {
            return;
          }
          const nextUser = await buildUserOnce(session.user);
          if (suppressAuthUserRef.current) {
            return;
          }
          if (mounted.current && nextUser) setUser(nextUser);
        } catch (err) {
          logError('AuthContext - onAuthStateChange SIGNED_IN', err);
          await supabase.auth.signOut().catch(() => {});
          if (mounted.current) {
            setError(err);
            setUser(null);
            setInstitution(null);
          }
        }
      }
      // TOKEN_REFRESHED: re-check tenant status so a mid-session suspend kicks users out.
      if (session?.user && event === 'TOKEN_REFRESHED' && initDone.current) {
        try {
          const nextUser = await buildUserOnce(session.user);
          if (mounted.current && nextUser) setUser(nextUser);
        } catch (err) {
          logError('AuthContext - onAuthStateChange TOKEN_REFRESHED', err);
          await supabase.auth.signOut().catch(() => {});
          if (mounted.current) {
            setError(err);
            setUser(null);
            setInstitution(null);
          }
        }
      }
      // USER_UPDATED intentionally ignored — profile refetch is handled elsewhere.
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile, finishInit, buildUserOnce]);

  const login = useCallback(
    // options.platformAdminOnly → reject non-admin on platform /login before setUser
    // options.requiredInstitutionId → tenant landing: only that institution's users
    async (identifier, password, options) => {
      setError(null);
      const platformAdminOnly = !!(options && options.platformAdminOnly);
      const requiredInstitutionId = options && options.requiredInstitutionId
        ? String(options.requiredInstitutionId)
        : '';
      const gateBeforeSetUser = platformAdminOnly || Boolean(requiredInstitutionId);
      try {
        let emailToUse = identifier;

        if (!isValidEmail(identifier)) {
          const resolvedEmail = await getEmailByUsername(identifier);
          if (!resolvedEmail) {
            throw new Error('AUTH.INVALID_CREDENTIALS');
          }
          emailToUse = resolvedEmail;
        }

        if (gateBeforeSetUser) {
          suppressAuthUserRef.current = true;
        }

        const { data, error: signErr } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password,
        });
        if (signErr) throw new Error('AUTH.INVALID_CREDENTIALS');

        const nextUser = await buildUserOnce(data.user);
        if (!nextUser) {
          await supabase.auth.signOut();
          throw new Error('NO_PROFILE');
        }

        // Platform /login: only institution admin or super admin — never set session user for others
        if (
          platformAdminOnly &&
          nextUser.role !== 'admin' &&
          nextUser.role !== 'super_admin'
        ) {
          await supabase.auth.signOut().catch(() => {});
          if (mounted.current) {
            setUser(null);
            setInstitution(null);
            setError(new Error('AUTH.PLATFORM_ADMIN_ONLY'));
          }
          suppressAuthUserRef.current = false;
          return { user: null, error: new Error('AUTH.PLATFORM_ADMIN_ONLY') };
        }

        // Tenant landing / ?tenant= login: only users of THIS institution
        if (
          requiredInstitutionId &&
          nextUser.role !== 'super_admin' &&
          String(nextUser.institution_id || '') !== requiredInstitutionId
        ) {
          await supabase.auth.signOut().catch(() => {});
          if (mounted.current) {
            setUser(null);
            setInstitution(null);
            setError(new Error('AUTH.WRONG_INSTITUTION'));
          }
          suppressAuthUserRef.current = false;
          return { user: null, error: new Error('AUTH.WRONG_INSTITUTION') };
        }

        suppressAuthUserRef.current = false;
        if (mounted.current) {
          setUser(nextUser);
          setError(null);
          resetInactivityTimer();
        }
        return { user: nextUser, session: data.session, error: null };
      } catch (err) {
        suppressAuthUserRef.current = false;
        logError('AuthContext - login', err);
        await supabase.auth.signOut().catch(() => {});
        if (mounted.current) {
          setUser(null);
          setInstitution(null);
          setError(err);
        }
        return { user: null, error: err };
      }
    },
    [buildUserOnce, resetInactivityTimer]
  );

  // Public instant signup disabled — Option B registration + admin approve only.
  const signup = useCallback(async () => {
    const err = new Error('PUBLIC_SIGNUP_DISABLED');
    logError('AuthContext - signup', err);
    setError(err);
    throw err;
  }, []);

  const logout = useCallback(() => clearAuthData(), [clearAuthData]);

  const refreshUser = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await loadUserProfile(authUser);
    } else {
      setUser(null);
      setInstitution(null);
      setAppCurrency('USD', '$');
    }
  }, [loadUserProfile]);

  // If Super Admin suspends the tenant while a user is already signed in,
  // re-validate tenant status on tab focus (lightweight — status only).
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      const uid = userIdRef.current;
      if (!uid) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, institution_id')
          .eq('id', uid)
          .maybeSingle();

        if (!profile || profile.role === 'super_admin' || !profile.institution_id) return;

        const { data: inst } = await supabase
          .from('institutions')
          .select('id, status')
          .eq('id', profile.institution_id)
          .maybeSingle();

        if (inst?.status === 'suspended') {
          await supabase.auth.signOut().catch(() => {});
          if (mounted.current) {
            setError(new Error('AUTH.TENANT_SUSPENDED'));
            setUser(null);
            setInstitution(null);
          }
        } else if (inst && mounted.current) {
          // Keep in-memory institution.status in sync after activate/suspend
          setInstitution((prev) => (prev ? { ...prev, status: inst.status } : prev));
        }
      } catch (err) {
        logError('AuthContext - tenant status check', err);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Memoised: this object was rebuilt on every render, so every useAuth()
  // consumer (Sidebar, Header, ProtectedRoute, every page) re-rendered
  // whenever anything in AuthProvider changed.
  const value = useMemo(
    () => ({
      user,
      institution,
      // Alias: App/ProtectedRoute should use initializing; keep loading for compatibility
      initializing,
      loading: initializing,
      error,
      login,
      signup,
      logout,
      refreshUser,
    }),
    [user, institution, initializing, error, login, signup, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
