import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { env } from '@/utils/environment';

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
    // let swagger UI load its styles
    scriptSrcElem: ["'self' ", 'https:', "'unsafe-inline'"],
    styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
    styleSrcAttr: ["'none'"],
    styleSrcElem: ["'self'", 'https:', "'unsafe-inline'"],
    upgradeInsecureRequests: [],
    workerSrc: ["'self'"],
  },
});

export const corsMiddleware = cors({
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  origin: env.mode === 'development' ? '*' : env.baseUrl,
});
