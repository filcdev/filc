import { secureHeaders } from 'hono/secure-headers';

export const securityMiddleware = secureHeaders({
  contentSecurityPolicy: {
    baseUri: ["'self'"],
    childSrc: ["'self'"],
    connectSrc: ["'self'"],
    defaultSrc: ["'self'"],
    fontSrc: ["'self'", 'https:', 'data:'],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
    frameSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'],
    manifestSrc: ["'self'"],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    reportTo: 'endpoint-1',
    sandbox: ['allow-same-origin', 'allow-scripts'],
    scriptSrc: ["'self'"],
    scriptSrcAttr: ["'none'"],
    scriptSrcElem: ["'self'"],
    styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
    styleSrcAttr: ['none'],
    styleSrcElem: ["'self'", 'https:', "'unsafe-inline'"],
    upgradeInsecureRequests: [],
    workerSrc: ["'self'"],
  },
});
