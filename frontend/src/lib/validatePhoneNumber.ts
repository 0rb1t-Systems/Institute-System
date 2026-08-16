/**
 * Utility functions for phone number validation and normalization.
 */

/**
 * Normalizes a phone number by trimming whitespace.
 * Returns an empty string if the input is null or undefined.
 * @param {string} phone 
 * @returns {string}
 */
export const normalizePhoneNumber = (phone) => {
    if (!phone) return '';
    return phone.trim();
};

/**
 * Validates a phone number format.
 * - Allows empty/null values (optional field).
 * - Must contain only digits, spaces, hyphens, parentheses, and plus sign.
 * - Must have between 10 and 15 digits after removing formatting characters.
 * @param {string} phone 
 * @returns {boolean}
 */
export const isValidPhoneFormat = (phone) => {
    const normalized = normalizePhoneNumber(phone);
    
    // Optional field, so empty is valid
    if (normalized === '') return true;

    // Check for allowed characters
    const allowedCharsRegex = /^[0-9\s\-()+]+$/;
    if (!allowedCharsRegex.test(normalized)) {
        return false;
    }

    // Check digit count
    const digitCount = normalized.replace(/\D/g, '').length;
    return digitCount >= 10 && digitCount <= 15;
};