/**
 * Global Error Handler & Logger Utility
 * Centralizes error logging to prevent infinite console spam
 * and allows for graceful degradation of the UI.
 */

const LOG_HISTORY = [];
const MAX_LOG_HISTORY = 100;
const SUPPRESSED_ERRORS = [
  'Refresh Token Not Found',
  'Invalid Refresh Token',
  'refresh_token_not_found',
  'JWT expired'
];

export const logError = (context, error, metadata: any = {}) => {
  // Extract message
  const message = error?.message || error?.toString() || 'Unknown error';

  // Check if error should be suppressed from noisy logging
  const isSuppressed = SUPPRESSED_ERRORS.some(suppressed => message.includes(suppressed));

  const errorEntry = {
    timestamp: new Date().toISOString(),
    context,
    message,
    metadata,
    stack: error?.stack
  };

  // Keep a history of errors for debugging if needed
  LOG_HISTORY.unshift(errorEntry);
  if (LOG_HISTORY.length > MAX_LOG_HISTORY) {
    LOG_HISTORY.pop();
  }

  // Only log to console if not suppressed, to prevent infinite loops in console
  if (!isSuppressed) {
    console.group(`🚨 Error in [${context}]`);
    console.error(message);
    if (Object.keys(metadata).length > 0) console.info('Metadata:', metadata);
    if (error?.stack) console.debug(error.stack);
    console.groupEnd();
  }

  return errorEntry;
};

export const getErrorHistory = () => [...LOG_HISTORY];

export const clearErrorHistory = () => {
  LOG_HISTORY.length = 0;
};