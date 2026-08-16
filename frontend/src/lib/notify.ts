/**
 * Consistent toast helpers for success, validation, permission, and error feedback.
 * Always sanitize unknown errors through mapError before showing them to users.
 */

import { toast } from '@/components/ui/use-toast';
import { mapError, getUserMessage } from '@/lib/mapError';
import { MESSAGES, TOAST_TITLES } from '@/lib/messages';

const resolveText = (value, fallback = '') => {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value?.description === 'string') return value.description;
  return fallback;
};

const resolveTitle = (value, fallback) => {
  if (value && typeof value === 'object' && typeof value.title === 'string') return value.title;
  return fallback;
};

export const notify = {
  /** Success toast — pass a MESSAGES.SUCCESS string or custom text */
  success(message, title = TOAST_TITLES.SUCCESS) {
    toast({
      title: resolveTitle(message, title),
      description: resolveText(message, MESSAGES.SUCCESS.GENERIC),
    });
  },

  /** Validation / input problem (non-destructive styling still uses destructive for visibility) */
  validation(message) {
    toast({
      variant: 'destructive',
      title: TOAST_TITLES.VALIDATION,
      description: resolveText(message, MESSAGES.VALIDATION.INVALID_INPUT),
    });
  },

  /** Permission / authorization denial — never includes technical detail */
  permission(message) {
    const mapped = message
      ? {
          title: TOAST_TITLES.PERMISSION,
          description: resolveText(message, MESSAGES.ACCESS.DENIED_ACTION.description),
        }
      : MESSAGES.ACCESS.DENIED_ACTION;
    toast({
      variant: 'destructive',
      title: mapped.title,
      description: mapped.description,
    });
  },

  /**
   * Error toast — logs internally (when context provided) and shows a safe message.
   * @param {unknown} error
   * @param {{ context?: string, title?: string, fallback?: { title?: string, description?: string } }} [options]
   */
  error(error, options: any = {}) {
    const mapped = mapError(error, {
      context: options.context || 'notify.error',
      log: true,
      fallback: options.fallback,
    });
    toast({
      variant: 'destructive',
      title: options.title || mapped.title,
      description: mapped.description,
    });
    return mapped;
  },

  /** Info / neutral toast */
  info(message, title = 'Notice') {
    toast({
      title,
      description: resolveText(message),
    });
  },
};

export { getUserMessage, mapError, MESSAGES, TOAST_TITLES };
