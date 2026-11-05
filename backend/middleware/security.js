const config = require('../config/env');

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
}

// Simple in-memory rate limiter to protect command execution endpoints
const rateLimitMap = new Map();
function commandRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 1000; // 1 second window
  const maxRequests = 10; // max 10 command dispatches per second

  const userStats = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
  if (now > userStats.resetTime) {
    userStats.count = 1;
    userStats.resetTime = now + windowMs;
  } else {
    userStats.count++;
  }

  rateLimitMap.set(ip, userStats);

  if (userStats.count > maxRequests) {
    return res.status(429).json({
      detail: 'Rate limit exceeded: Too many motor commands in short interval. Please wait.',
    });
  }

  next();
}

module.exports = {
  securityHeaders,
  commandRateLimiter,
};
