/**
 * Maps technical / infrastructure errors to safe, user-facing messages.
 * Detailed errors are logged via logError — never shown to end users.
 */

import { logError } from '@/lib/errorHandler';
import { MESSAGES } from '@/lib/messages';

/**
 * Known application error codes (prefix before ":").
 * Prefer throwing `CODE: optional detail` from API/edge layers.
 */
const CODE_MAP = {
  USER_ACCOUNT_EXISTS: MESSAGES.DUPLICATE.EMAIL,
  EMAIL_EXISTS: MESSAGES.DUPLICATE.EMAIL,
  EMAIL_IN_USE: MESSAGES.DUPLICATE.EMAIL,
  STUDENT_RECORD_EXISTS: MESSAGES.DUPLICATE.EMAIL,
  PHONE_EXISTS: MESSAGES.DUPLICATE.PHONE,
  STUDENT_ID_EXISTS: MESSAGES.DUPLICATE.STUDENT_ID,
  DUPLICATE_INQUIRY: {
    title: 'Already submitted',
    description: 'A registration with this email is already pending. Please wait for approval or contact the institution.',
  },
  PUBLIC_SIGNUP_DISABLED: {
    title: 'Signup closed',
    description: 'Open signup is disabled. Use the institution registration form and wait for approval.',
  },
  INVALID_AFFILIATE: {
    title: 'Invalid referral link',
    description: 'This referral link is invalid or the affiliate is not active. Ask for a fresh referral link.',
  },
  INVALID_CLASS: {
    title: 'Class unavailable',
    description: 'Please choose an active class and try again.',
  },
  INVALID_SUBDOMAIN: {
    title: 'Institution not found',
    description: 'Open registration from your institution link (?tenant=subdomain).',
  },
  SUBDOMAIN_REQUIRED: {
    title: 'Institution required',
    description: 'Open verification from your institution link (?tenant=subdomain) or ID-card QR.',
  },
  PAYMENT_EXCEEDS_BALANCE: {
    title: 'Amount too high',
    description: 'Payment cannot exceed the remaining balance for this enrollment.',
  },
  WITHDRAWAL_EXCEEDS_BALANCE: {
    title: 'Insufficient balance',
    description: 'Withdrawal amount exceeds the available instructor balance.',
  },
  REGISTRATION_FEE_DISABLED: {
    title: 'Registration fee not set',
    description: 'Registration fee is disabled for this institution.',
  },
  INSTITUTION_NOT_FOUND: {
    title: 'Institution not found',
    description: 'Open registration from your institution link (?tenant=subdomain).',
  },
  INVALID_NAME: {
    title: 'Name required',
    description: 'Please enter the student full name.',
  },
  INVALID_EMAIL: {
    title: 'Invalid email',
    description: 'Please provide a valid email address.',
  },
  REGISTRATION_FAILED: {
    title: 'Registration failed',
    description: 'We could not complete registration. Please try again.',
  },
  SESSION_EXPIRED: MESSAGES.SESSION_EXPIRED,
  SERVER_AUTH_MISCONFIGURED: MESSAGES.UNEXPECTED,
  UNEXPECTED: MESSAGES.UNEXPECTED,
  FORBIDDEN: MESSAGES.ACCESS.DENIED_ACTION,
  FORBIDDEN_ROLE: MESSAGES.ACCESS.STAFF_STUDENT_ONLY,
  UNAUTHORIZED: MESSAGES.ACCESS.MUST_LOGIN,
  NOT_FOUND: MESSAGES.NOT_FOUND,
  NO_PROFILE: { title: 'Account incomplete', description: MESSAGES.AUTH.NO_PROFILE },
  'AUTH.INVALID_CREDENTIALS': MESSAGES.AUTH.INVALID_CREDENTIALS,
  AUTH_INVALID_CREDENTIALS: MESSAGES.AUTH.INVALID_CREDENTIALS,
  'AUTH.SUSPENDED': { title: 'Account suspended', description: MESSAGES.AUTH.SUSPENDED },
  AUTH_SUSPENDED: { title: 'Account suspended', description: MESSAGES.AUTH.SUSPENDED },
  'AUTH.TENANT_SUSPENDED': {
    title: 'Institution suspended',
    description: MESSAGES.AUTH.TENANT_SUSPENDED,
  },
  AUTH_TENANT_SUSPENDED: {
    title: 'Institution suspended',
    description: MESSAGES.AUTH.TENANT_SUSPENDED,
  },
  'AUTH.PENDING_APPROVAL': {
    title: 'Approval required',
    description: MESSAGES.AUTH.PENDING_APPROVAL,
  },
  AUTH_PENDING_APPROVAL: {
    title: 'Approval required',
    description: MESSAGES.AUTH.PENDING_APPROVAL,
  },
  'AUTH.REGISTRATION_FEE_REQUIRED': {
    title: 'Registration fee required',
    description: MESSAGES.AUTH.REGISTRATION_FEE_REQUIRED,
  },
  AUTH_REGISTRATION_FEE_REQUIRED: {
    title: 'Registration fee required',
    description: MESSAGES.AUTH.REGISTRATION_FEE_REQUIRED,
  },
  REGISTRATION_FEE_REQUIRED: {
    title: 'Registration fee required',
    description: MESSAGES.DOMAIN.REGISTRATION_FEE_FIRST,
  },
  STUDENT_NOT_FOUND: { title: MESSAGES.NOT_FOUND.title, description: MESSAGES.DOMAIN.STUDENT_NOT_FOUND },
  CASCADE_ERROR: { title: MESSAGES.DELETE_FAILED.title, description: MESSAGES.DOMAIN.DELETION_DEPENDENCIES },
  DELETION_FAILED: MESSAGES.DELETE_FAILED,
  DUPLICATE_RESULT: MESSAGES.DUPLICATE.EXAM_RESULT,
  INSTITUTION_SETTINGS_INCOMPLETE: {
    title: 'Institution settings required',
    description:
      'Complete Institution Settings (name, address, phone, and email) before issuing official documents.',
  },
  CERTIFICATE_ALREADY_ISSUED: {
    title: 'Already issued',
    description: MESSAGES.DOMAIN.CERTIFICATE_ALREADY_ISSUED,
  },
  CLASS_NOT_FINISHED: {
    title: 'Class not finished',
    description: MESSAGES.DOMAIN.CLASS_NOT_FINISHED,
  },
  GRADES_INCOMPLETE: {
    title: 'Grades incomplete',
    description: MESSAGES.DOMAIN.GRADES_INCOMPLETE,
  },
  BALANCE_OUTSTANDING: {
    title: 'Balance outstanding',
    description: MESSAGES.DOMAIN.BALANCE_OUTSTANDING,
  },
  CERTIFICATE_ENROLLMENT_REQUIRED: {
    title: 'Enrollment required',
    description: MESSAGES.DOMAIN.CERTIFICATE_ENROLLMENT_REQUIRED,
  },
  FILE_TOO_LARGE: {
    title: 'File too large',
    description: 'Please upload an image smaller than 2MB.',
  },
  INVALID_FILE_TYPE: {
    title: 'Invalid file type',
    description: 'Please upload a PNG, JPEG, WebP, or SVG image.',
  },
  INVALID_ASSET_KIND: {
    title: 'Upload failed',
    description: 'This asset type is not supported.',
  },
  INVALID_CERTIFICATE_LAYOUT: {
    title: 'Invalid template',
    description: 'Please choose a certificate template from the library.',
  },
  CUSTOM_UPLOAD_MISSING: {
    title: 'Upload required',
    description: 'Upload your own certificate template before activating it.',
  },
  LOGO_BUILDER_EMPTY: {
    title: 'Design required',
    description: 'Save a Certificate Page Builder design first, then activate it for your institution.',
  },
  INVALID_DESIGN: {
    title: 'Invalid design',
    description: 'The logo/page design could not be saved. Please try again.',
  },
  DESIGN_TOO_LARGE: {
    title: 'Design too large',
    description: 'Please remove some layers and try again.',
  },
  INVALID_STORAGE_PATH: {
    title: 'Upload failed',
    description: 'The file path is invalid for this institution.',
  },
  UPLOAD_NOT_FOUND: {
    title: 'Upload not found',
    description: 'We could not find the uploaded certificate template. Please upload again.',
  },
  CERT_TEMPLATE_TOO_LARGE: {
    title: 'File too large',
    description: 'Please upload a certificate template smaller than 10MB.',
  },
  INVALID_CERT_TEMPLATE_TYPE: {
    title: 'Invalid file type',
    description: 'Please upload a PDF, PNG, JPG, or WebP certificate template.',
  },
  INVALID_TRANSCRIPT_LAYOUT: {
    title: 'Invalid template',
    description: 'Please choose a transcript template from the library.',
  },
  UPLOAD_FAILED: {
    title: 'Upload failed',
    description: 'We could not upload your file. Please try again with a different image.',
  },
  ASSIGNMENT_UPLOAD_FAILED: {
    title: 'Upload failed',
    description: 'We could not upload your file. Try PDF, Word, TXT, or an image (max 10MB).',
  },
  ASSIGNMENT_FILE_URL_FAILED: {
    title: 'File unavailable',
    description: 'We could not open this assignment file. Try again or re-upload.',
  },
  ASSIGNMENT_FILE_TOO_LARGE: {
    title: 'File too large',
    description: 'Please choose a file smaller than 10MB.',
  },
  INVALID_IMAGE_TYPE: {
    title: 'Invalid file type',
    description: 'Please upload a PNG, JPG, WEBP, or GIF image.',
  },
  MISSING_FILE: {
    title: 'No file selected',
    description: 'Please choose a file to upload.',
  },
  SAVE_FAILED: MESSAGES.SAVE_FAILED,
  FEATURE_UNAVAILABLE: {
    title: 'Feature unavailable',
    description:
      'This feature is not available yet. Please contact your administrator if you need assistance.',
  },
  WAAFIPAY_TENANT_DISABLED: {
    title: 'WaafiPay not used for institutions',
    description:
      'Record student payments manually in Finance (cash, bank, or other). WaafiPay is reserved for platform Plans & Subscriptions.',
  },
  VALIDATION: {
    title: 'Please check your input',
    description: MESSAGES.VALIDATION.INVALID_INPUT,
  },
};

/** Patterns that indicate a technical / unsafe message must never reach the UI */
const TECHNICAL_PATTERNS = [
  /\bjwt\b/i,
  /refresh.?token/i,
  /access.?token/i,
  /\brls\b/i,
  /row.?level.?security/i,
  /security.?policy/i,
  /permission denied for/i,
  /violates.+policy/i,
  /postgres/i,
  /postgrest/i,
  /pgrst/i,
  /\bsql\b/i,
  /syntax error/i,
  /relation ["'].+["']/i,
  /column ["'].+["']/i,
  /constraint/i,
  /foreign key/i,
  /unique.?constraint/i,
  /duplicate key/i,
  /null value in column/i,
  /violates not-null/i,
  /stack trace/i,
  /at\s+\S+\s+\(/i,
  /supabase/i,
  /service.?role/i,
  /anon.?key/i,
  /edge.?function/i,
  /SUPABASE_/i,
  /process\.env/i,
  /failed to fetch/i,
  /networkerror/i,
  /typeerror:/i,
  /referenceerror:/i,
  /internal server error/i,
  /status code/i,
  /http\/\d/i,
  /bad_jwt/i,
  /unrecognized jwt/i,
  /invalid api key/i,
  /schema cache/i,
  /could not find the/i,
  /function .+ does not exist/i,
  /operator does not exist/i,
  /infinite recursion/i,
  /new row violates/i,
];

/** Auth / known messages we intentionally rewrite */
const MESSAGE_REWRITES = [
  {
    test: /invalid login credentials|invalid credentials|email not confirmed/i,
    mapped: MESSAGES.AUTH.INVALID_CREDENTIALS,
  },
  {
    test: /user already registered|already been registered|already registered|email.*already|already exists/i,
    mapped: MESSAGES.DUPLICATE.EMAIL,
  },
  {
    test: /phone.*(exists|already)|already.*phone/i,
    mapped: MESSAGES.DUPLICATE.PHONE,
  },
  {
    test: /jwt expired|invalid jwt|refresh.?token/i,
    mapped: MESSAGES.SESSION_EXPIRED,
  },
  {
    test: /not allowed|forbidden|permission denied|insufficient.?privilege|row-level security/i,
    mapped: MESSAGES.ACCESS.DENIED_ACTION,
  },
  {
    test: /staff may only create student/i,
    mapped: MESSAGES.ACCESS.STAFF_STUDENT_ONLY,
  },
  {
    test: /only (tenant )?admin|only admin/i,
    mapped: MESSAGES.ACCESS.ADMIN_ONLY,
  },
  {
    test: /must be logged in|not authenticated|unauthorized/i,
    mapped: MESSAGES.ACCESS.MUST_LOGIN,
  },
  {
    test: /failed to fetch|network request failed|load failed|net::err/i,
    mapped: MESSAGES.NETWORK,
  },
  {
    test: /duplicate key|unique constraint|23505/i,
    mapped: MESSAGES.DUPLICATE.GENERIC,
  },
  {
    test: /foreign key|23503|still referenced/i,
    mapped: { title: MESSAGES.DELETE_FAILED.title, description: MESSAGES.DOMAIN.DELETION_DEPENDENCIES },
  },
  {
    test: /pending.?approval|waiting for approval|not yet approved|AUTH\.PENDING_APPROVAL/i,
    mapped: { title: 'Approval required', description: MESSAGES.AUTH.PENDING_APPROVAL },
  },
  {
    test: /AUTH\.REGISTRATION_FEE_REQUIRED/i,
    mapped: {
      title: 'Registration fee required',
      description: MESSAGES.AUTH.REGISTRATION_FEE_REQUIRED,
    },
  },
  {
    test: /REGISTRATION_FEE_REQUIRED|registration fee.*(required|first)/i,
    mapped: {
      title: 'Registration fee required',
      description: MESSAGES.DOMAIN.REGISTRATION_FEE_FIRST,
    },
  },
  {
    test: /SUBDOMAIN_REQUIRED/i,
    mapped: {
      title: 'Institution required',
      description: 'Open verification from your institution link (?tenant=subdomain) or ID-card QR.',
    },
  },
  {
    test: /PAYMENT_EXCEEDS_BALANCE/i,
    mapped: {
      title: 'Amount too high',
      description: 'Payment cannot exceed the remaining balance for this enrollment.',
    },
  },
  {
    test: /WITHDRAWAL_EXCEEDS_BALANCE|ka badan yahay balance/i,
    mapped: {
      title: 'Insufficient balance',
      description: 'Withdrawal amount exceeds the available instructor balance.',
    },
  },
  {
    test: /REGISTRATION_FEE_DISABLED/i,
    mapped: {
      title: 'Registration fee not set',
      description: 'Registration fee is disabled for this institution.',
    },
  },
  {
    test: /CERTIFICATE_ALREADY_ISSUED/i,
    mapped: {
      title: 'Already issued',
      description: MESSAGES.DOMAIN.CERTIFICATE_ALREADY_ISSUED,
    },
  },
  {
    test: /CLASS_NOT_FINISHED/i,
    mapped: {
      title: 'Class not finished',
      description: MESSAGES.DOMAIN.CLASS_NOT_FINISHED,
    },
  },
  {
    test: /GRADES_INCOMPLETE/i,
    mapped: {
      title: 'Grades incomplete',
      description: MESSAGES.DOMAIN.GRADES_INCOMPLETE,
    },
  },
  {
    test: /BALANCE_OUTSTANDING/i,
    mapped: {
      title: 'Balance outstanding',
      description: MESSAGES.DOMAIN.BALANCE_OUTSTANDING,
    },
  },
  {
    test: /CERTIFICATE_ENROLLMENT_REQUIRED/i,
    mapped: {
      title: 'Enrollment required',
      description: MESSAGES.DOMAIN.CERTIFICATE_ENROLLMENT_REQUIRED,
    },
  },
  {
    test: /AUTH\.TENANT_SUSPENDED|institution has been suspended|tenant.*(suspended|inactive)/i,
    mapped: { title: 'Institution suspended', description: MESSAGES.AUTH.TENANT_SUSPENDED },
  },
  {
    test: /AUTH\.SUSPENDED|account has been suspended/i,
    mapped: { title: 'Account suspended', description: MESSAGES.AUTH.SUSPENDED },
  },
  {
    test: /no profile found/i,
    mapped: { title: 'Account incomplete', description: MESSAGES.AUTH.NO_PROFILE },
  },
];

const extractRawMessage = (error) => {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  if (typeof error?.error === 'string') return error.error;
  if (typeof error?.error_description === 'string') return error.error_description;
  if (typeof error?.details === 'string') return error.details;
  if (typeof error?.hint === 'string') return error.hint;
  try {
    return String(error);
  } catch {
    return '';
  }
};

const extractCode = (error, raw) => {
  if (error?.appCode && typeof error.appCode === 'string') return error.appCode;
  // Prefer PostgREST/Postgres codes only when they look like known DB codes
  if (typeof error?.code === 'string' && /^(PGRST|\d{5}|[A-Z][A-Z0-9_.]+)$/.test(error.code)) {
    if (CODE_MAP[error.code]) return error.code;
  }
  if (!raw) return null;
  const prefixed = /^([A-Z][A-Z0-9_.]+)\s*:/.exec(raw);
  if (prefixed) return prefixed[1];
  const bare = raw.trim();
  if (CODE_MAP[bare]) return bare;
  return null;
};

const isTechnical = (message) => {
  if (!message || typeof message !== 'string') return true;
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (trimmed.length > 280) return true;
  return TECHNICAL_PATTERNS.some((re) => re.test(trimmed));
};

const asFeedback = (mapped, fallbackTitle = undefined) => {
  if (!mapped) return { ...MESSAGES.UNEXPECTED };
  if (typeof mapped === 'string') {
    return { title: fallbackTitle || MESSAGES.UNEXPECTED.title, description: mapped };
  }
  return {
    title: mapped.title || fallbackTitle || MESSAGES.UNEXPECTED.title,
    description: mapped.description || MESSAGES.UNEXPECTED.description,
  };
};

/**
 * Convert any thrown value into a safe { title, description } for UI.
 * Optionally log the original error when context is provided.
 */
export const mapError = (error, options: any = {}) => {
  const { context, log = Boolean(context), fallback } = options;
  const raw = extractRawMessage(error);
  const pgCode = error?.code || error?.code === 0 ? String(error.code) : null;

  if (log && context) {
    logError(context, error);
  }

  // Prefer explicit application codes
  const appCode = extractCode(error, raw);
  if (appCode && CODE_MAP[appCode]) {
    return asFeedback(CODE_MAP[appCode]);
  }

  // Postgres / PostgREST codes
  if (pgCode === '23505' || raw.includes('23505')) {
    return asFeedback(MESSAGES.DUPLICATE.GENERIC);
  }
  if (pgCode === '23503' || raw.includes('23503')) {
    return asFeedback({
      title: MESSAGES.DELETE_FAILED.title,
      description: MESSAGES.DOMAIN.DELETION_DEPENDENCIES,
    });
  }
  if (pgCode === '42501' || pgCode === 'PGRST301' || /row-level security|RLS/i.test(raw)) {
    return asFeedback(MESSAGES.ACCESS.DENIED_ACTION);
  }
  if (pgCode === 'PGRST116') {
    return asFeedback(MESSAGES.NOT_FOUND);
  }
  if (error?.status === 401 || pgCode === '401') {
    return asFeedback(MESSAGES.SESSION_EXPIRED);
  }
  if (error?.status === 403 || pgCode === '403') {
    return asFeedback(MESSAGES.ACCESS.DENIED_ACTION);
  }
  if (error?.status === 404 || pgCode === '404') {
    return asFeedback(MESSAGES.NOT_FOUND);
  }
  if (error?.status === 409 || pgCode === '409') {
    return asFeedback(MESSAGES.DUPLICATE.GENERIC);
  }

  // Known message rewrites
  for (const rule of MESSAGE_REWRITES) {
    if (rule.test.test(raw)) {
      return asFeedback(rule.mapped);
    }
  }

  // Strip CODE: prefix for display when remainder looks safe
  const withoutCode = raw.replace(/^[A-Z][A-Z0-9_]+\s*:\s*/, '').trim();

  // Allow through only short, non-technical, already-friendly messages
  if (withoutCode && !isTechnical(withoutCode)) {
    return {
      title: fallback?.title || MESSAGES.UNEXPECTED.title,
      description: withoutCode,
    };
  }

  if (fallback) return asFeedback(fallback);

  return { ...MESSAGES.UNEXPECTED };
};

/** Convenience: return only the description string for inline Alerts / form errors */
export const getUserMessage = (error, options: any = {}) => {
  return mapError(error, options).description;
};

/**
 * Returns true when a string is safe to show as-is (validation copy we authored).
 * Technical strings are rejected.
 */
export const isSafeUserMessage = (message) => {
  if (!message || typeof message !== 'string') return false;
  return !isTechnical(message);
};
