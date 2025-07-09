/**
 * Centralized configuration management for Cat Flap Stats CloudFlare Workers.
 * 
 * This module provides a centralized location for all configuration values,
 * constants, and settings used in the CloudFlare Workers web interface.
 */

/**
 * Time-based constants for behavioral analysis and session classification.
 */
export const TIME_THRESHOLDS = {
  // Morning/afternoon boundary for timestamp classification (hours)
  MORNING_HOUR_THRESHOLD: 12,
  
  // Short duration threshold for session classification (hours)
  SHORT_DURATION_HOURS: 12,
  
  // Tolerance for duration-based timestamp matching (hours)
  TOLERANCE_HOURS: 0.5,
  
  // Late evening threshold for cross-midnight detection (hours)
  LATE_EVENING_HOUR: 20,
  
  // Early morning threshold for cross-midnight detection (hours)
  EARLY_MORNING_HOUR: 8,
  
  // Minutes in a day for midnight calculations
  MINUTES_PER_DAY: 24 * 60,
  
  // Seconds in an hour for conversion
  SECONDS_PER_HOUR: 3600,
  
  // Milliseconds in a day for JavaScript Date calculations
  MILLISECONDS_PER_DAY: 24 * 60 * 60 * 1000
};

/**
 * Settings for behavioral analytics and pattern detection.
 */
export const ANALYTICS_SETTINGS = {
  // Morning activity period definition (hours)
  MORNING_START_HOUR: 5,
  MORNING_END_HOUR: 10,
  
  // Evening activity period definition (hours)
  EVENING_START_HOUR: 17,
  EVENING_END_HOUR: 22,
  
  // Seasonal month definitions
  SPRING_MONTHS: [3, 4, 5],
  SUMMER_MONTHS: [6, 7, 8],
  AUTUMN_MONTHS: [9, 10, 11],
  WINTER_MONTHS: [12, 1, 2],
  
  // Significant seasonal variation threshold (hours)
  SEASONAL_VARIATION_THRESHOLD: 2
};

/**
 * UI layout constants for consistent styling.
 */
export const UI_CONSTANTS = {
  // Maximum container width
  MAX_CONTAINER_WIDTH: '1200px',
  
  // Minimum grid column width
  MIN_GRID_COLUMN_WIDTH: '250px',
  
  // Standard border radius
  BORDER_RADIUS: '8px',
  
  // Standard spacing unit
  SPACING_UNIT: '1rem'
};

/**
 * Base configuration that applies to all environments.
 */
const BASE_CONFIG = {
  // Authentication settings
  AUTH: {
    // Magic link expiration time (milliseconds)
    MAGIC_LINK_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
    
    // Auth token TTL (seconds)
    TOKEN_TTL: 86400, // 24 hours
    
    // Cookie max age (seconds)
    COOKIE_MAX_AGE: 86400, // 24 hours
    
    // Authorized user emails
    AUTHORIZED_EMAILS: [
      'magnus.hultberg@gmail.com',
      'test@example.com' // For testing purposes
    ]
  },
  
  // Security headers
  SECURITY: {
    CSP_DIRECTIVES: [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net https://d3js.org 'unsafe-inline'",
      "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
      "font-src https://fonts.gstatic.com",
      "connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://api.resend.com",
      "img-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "report-uri /api/csp-report"
    ],
    
    ADDITIONAL_HEADERS: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-XSS-Protection': '1; mode=block'
    }
  },
  
  // GitHub integration
  GITHUB: {
    REPO_OWNER: 'mannepanne',
    REPO_NAME: 'cat-flap-stats',
    WEBHOOK_SECRET: 'temp-webhook-secret'
  }
};

/**
 * Development environment configuration.
 */
const DEVELOPMENT_CONFIG = {
  ...BASE_CONFIG,
  
  // Rate limiting (more permissive for development)
  RATE_LIMITS: {
    '/api/upload': { requests: 10, window: 3600 }, // 10 uploads per hour
    '/api/annotations': { requests: 50, window: 3600 }, // 50 annotation ops per hour
    'default': { requests: 200, window: 3600 } // 200 requests per hour for other APIs
  },
  
  // File processing settings
  FILE_PROCESSING: {
    MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB for development
    MIN_FILE_SIZE: 500, // 500 bytes minimum
    UPLOAD_TTL: 7200, // 2 hours TTL for uploaded files
    ALLOWED_MIME_TYPES: ['application/pdf']
  },
  
  // Cache settings (shorter cache for development)
  CACHE: {
    DATASET_MAX_AGE: 60, // 1 minute
    ANALYTICS_MAX_AGE: 30, // 30 seconds
    ANNOTATIONS_MAX_AGE: 10, // 10 seconds
    STATIC_MAX_AGE: 60 // 1 minute
  }
};

/**
 * Production environment configuration.
 */
const PRODUCTION_CONFIG = {
  ...BASE_CONFIG,
  
  // Rate limiting (stricter for production)
  RATE_LIMITS: {
    '/api/upload': { requests: 5, window: 3600 }, // 5 uploads per hour
    '/api/annotations': { requests: 30, window: 3600 }, // 30 annotation ops per hour
    'default': { requests: 100, window: 3600 } // 100 requests per hour for other APIs
  },
  
  // File processing settings
  FILE_PROCESSING: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB for production
    MIN_FILE_SIZE: 1000, // 1KB minimum
    UPLOAD_TTL: 3600, // 1 hour TTL for uploaded files
    ALLOWED_MIME_TYPES: ['application/pdf']
  },
  
  // Cache settings (longer cache for production)
  CACHE: {
    DATASET_MAX_AGE: 300, // 5 minutes
    ANALYTICS_MAX_AGE: 600, // 10 minutes
    ANNOTATIONS_MAX_AGE: 60, // 1 minute
    STATIC_MAX_AGE: 3600 // 1 hour
  }
};

/**
 * Testing environment configuration.
 */
const TESTING_CONFIG = {
  ...BASE_CONFIG,
  
  // Rate limiting (very permissive for testing)
  RATE_LIMITS: {
    '/api/upload': { requests: 100, window: 3600 },
    '/api/annotations': { requests: 200, window: 3600 },
    'default': { requests: 500, window: 3600 }
  },
  
  // File processing settings
  FILE_PROCESSING: {
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB for testing
    MIN_FILE_SIZE: 100, // 100 bytes minimum
    UPLOAD_TTL: 300, // 5 minutes TTL for uploaded files
    ALLOWED_MIME_TYPES: ['application/pdf', 'text/plain'] // Allow text files for testing
  },
  
  // Cache settings (minimal cache for testing)
  CACHE: {
    DATASET_MAX_AGE: 1,
    ANALYTICS_MAX_AGE: 1,
    ANNOTATIONS_MAX_AGE: 1,
    STATIC_MAX_AGE: 1
  }
};

/**
 * Environment detection utility.
 */
export function detectEnvironment(env = {}) {
  // Check for CloudFlare Workers environment variables
  if (env.ENVIRONMENT) {
    return env.ENVIRONMENT.toLowerCase();
  }
  
  // Check for development indicators
  if (env.DEVELOPMENT || env.DEV) {
    return 'development';
  }
  
  // Check for testing indicators
  if (env.TESTING || env.TEST) {
    return 'testing';
  }
  
  // Default to production for safety
  return 'production';
}

/**
 * Get configuration for the specified environment.
 * 
 * @param {string|Object} environment - Environment name or CloudFlare Workers env object
 * @returns {Object} Configuration object for the environment
 */
export function getConfig(environment = 'production') {
  let env = environment;
  
  // If passed an object (CloudFlare Workers env), detect environment
  if (typeof environment === 'object') {
    env = detectEnvironment(environment);
  }
  
  switch (env) {
    case 'development':
      return DEVELOPMENT_CONFIG;
    case 'testing':
      return TESTING_CONFIG;
    case 'production':
    default:
      return PRODUCTION_CONFIG;
  }
}

/**
 * Configuration validation utility.
 * 
 * @param {Object} config - Configuration object to validate
 * @returns {boolean} True if configuration is valid
 */
export function validateConfig(config) {
  try {
    // Validate required sections
    if (!config.RATE_LIMITS || !config.FILE_PROCESSING || !config.CACHE || !config.AUTH) {
      return false;
    }
    
    // Validate rate limits
    for (const [endpoint, limits] of Object.entries(config.RATE_LIMITS)) {
      if (!limits.requests || !limits.window || limits.requests <= 0 || limits.window <= 0) {
        return false;
      }
    }
    
    // Validate file processing
    if (config.FILE_PROCESSING.MAX_FILE_SIZE <= 0 || 
        config.FILE_PROCESSING.MIN_FILE_SIZE <= 0 ||
        config.FILE_PROCESSING.UPLOAD_TTL <= 0) {
      return false;
    }
    
    // Validate cache settings
    for (const [key, value] of Object.entries(config.CACHE)) {
      if (value <= 0) {
        return false;
      }
    }
    
    // Validate auth settings
    if (config.AUTH.MAGIC_LINK_EXPIRY <= 0 || 
        config.AUTH.TOKEN_TTL <= 0 || 
        config.AUTH.COOKIE_MAX_AGE <= 0) {
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('Configuration validation error:', error);
    return false;
  }
}

/**
 * Get Content Security Policy string.
 * 
 * @param {Object} config - Configuration object
 * @returns {string} CSP header value
 */
export function getCSP(config) {
  return config.SECURITY.CSP_DIRECTIVES.join('; ');
}

/**
 * Get all security headers.
 * 
 * @param {Object} config - Configuration object
 * @returns {Object} Security headers object
 */
export function getSecurityHeaders(config) {
  return {
    'Content-Security-Policy': getCSP(config),
    ...config.SECURITY.ADDITIONAL_HEADERS
  };
}

/**
 * Get cache headers for a specific content type.
 * 
 * @param {Object} config - Configuration object
 * @param {string} contentType - Content type ('dataset', 'analytics', 'annotations', 'static')
 * @returns {Object} Cache headers object
 */
export function getCacheHeaders(config, contentType = 'static') {
  const cacheKey = `${contentType.toUpperCase()}_MAX_AGE`;
  const maxAge = config.CACHE[cacheKey] || config.CACHE.STATIC_MAX_AGE;
  
  return {
    'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    'Vary': 'Accept-Encoding'
  };
}

/**
 * Default configuration instance for backward compatibility.
 */
export const CONFIG = getConfig('production');

/**
 * Export constants for direct access.
 */
// Note: Constants are already exported above

/**
 * Export configuration presets.
 */
export { DEVELOPMENT_CONFIG, PRODUCTION_CONFIG, TESTING_CONFIG };

// Default export for ES modules
export default {
  getConfig,
  validateConfig,
  getCSP,
  getSecurityHeaders,
  getCacheHeaders,
  detectEnvironment,
  TIME_THRESHOLDS,
  ANALYTICS_SETTINGS,
  UI_CONSTANTS,
  CONFIG
};