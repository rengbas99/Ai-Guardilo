/**
 * Context Scoring Utility
 * Provides context-aware scoring to reduce false positives in legitimate business communications
 */

/**
 * Get context score (0.0-1.0, higher = safer context)
 * @param {Object} context - Context object with channel, domain, text
 * @returns {number} Context score
 */
export function getContextScore(context) {
  if (!context) return 0;
  
  let score = 0;
  
  // Safe channel patterns (Slack channels, project channels)
  // Note: context.channel comes from pathname which starts with "/", not "#"
  if (context.channel) {
    if (/^\/client-|\/project-|\/team-|\/internal-/i.test(context.channel)) {
      score += 0.4;
    }
  }
  
  // Team mentions (@username)
  if (context.text && /@[\w]+/.test(context.text)) {
    score += 0.2;
  }
  
  // Internal keywords
  if (context.text) {
    const lowerText = context.text.toLowerCase();
    if (/internal|team|discuss|meeting|internal discussion|team chat/i.test(lowerText)) {
      score += 0.2;
    }
  }
  
  // Domain whitelist (support platforms, internal tools)
  // Use anchored patterns to match exact hostnames or valid subdomains
  if (context.domain) {
    const whitelistPatterns = [
      /(^|\.)intercom\.com$/i,
      /(^|\.)zendesk\.com$/i,
      /(^|\.)hubspot\.com$/i,
      /(^|\.)slack\.com$/i
    ];
    if (whitelistPatterns.some(pattern => pattern.test(context.domain))) {
      score += 0.1;
    }
  }
  
  return Math.min(score, 1.0);
}

/**
 * Extract context from current page
 * @returns {Object} Context object
 */
export function getContext() {
  return {
    channel: window.location.pathname, // e.g., /client-acme, /project-xyz
    domain: window.location.hostname,
    text: document.body?.innerText || ''
  };
}
