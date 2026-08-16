import { notify } from '@/lib/notify';
import { MESSAGES } from '@/lib/messages';

/**
 * Standardized error handling for exam-result operations.
 * Logs details internally via notify/mapError; shows only user-friendly toasts.
 */

export const handleDuplicateKeyError = (err, context = '') => {
  notify.error(err, {
    context: `Duplicate Key Error - ${context}`,
    fallback: MESSAGES.DUPLICATE.EXAM_RESULT,
    title: MESSAGES.DUPLICATE.EXAM_RESULT.title,
  });
  return MESSAGES.DUPLICATE.EXAM_RESULT.description;
};

export const handleFetchError = (err, context = '') => {
  notify.error(err, {
    context: `Fetch Error - ${context}`,
    fallback: {
      title: MESSAGES.LOAD_FAILED.title,
      description: MESSAGES.DOMAIN.RESULTS_LOAD,
    },
  });
  return MESSAGES.DOMAIN.RESULTS_LOAD;
};

export const handleValidationError = (customMessage, context = '') => {
  const msg = customMessage || MESSAGES.VALIDATION.INVALID_INPUT;
  console.warn(`[Validation Error - ${context}]:`, msg);
  notify.validation(msg);
  return msg;
};
