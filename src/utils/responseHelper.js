/**
 * Formats responses for the VAPI AI voice agent.
 * 
 * @param {boolean} success - Whether the operation was successful.
 * @param {string} message - A natural, speakable English sentence for the AI to say.
 * @param {object|null} data - Any data returned by the operation.
 * @param {string|null} errorCode - A SNAKE_CASE error code if the operation failed.
 * @returns {object} The formatted response object.
 */
export const formatResponse = (success, message, data = null, errorCode = null) => {
  return {
    success,
    message,
    data,
    errorCode
  };
};
