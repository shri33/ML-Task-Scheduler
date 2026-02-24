/**
 * Auth Middleware & RBAC Tests
 * Tests:
 *  - JWT authentication (valid, expired, missing)
 *  - httpOnly cookie fallback
 *  - RBAC authorize() role gating
 *  - CSRF double-submit cookie validation
 */

import { Request, Response, NextFunction } from 'express';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';

// ---- Mock setup ---- //
const JWT_SECRET = 'test-secret-key-for-unit-tests';
process.env.JWT_SECRET = JWT_SECRET;

// Mock prisma
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../lib/prisma';
import { authenticate, authorize, adminOnly, AuthRequest, JwtPayload } from '../middleware/auth.middleware';
import { csrfProtection, setCsrfCookie } from '../middleware/csrf.middleware';

// Helper: create mock Express req/res/next
function mockReqResNext(overrides: Partial<Request> = {}) {
  const req = {
    headers: {},
    cookies: {},
    method: 'POST',
    path: '/api/v1/tasks',
    ...overrides,
  } as unknown as AuthRequest;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
  } as unknown as Response;

  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

function signToken(payload: object, expiresIn: string = '15m') {
  return jwt.sign(payload, JWT_SECRET as Secret, { expiresIn } as SignOptions);
}

// -----------------------------------------------------------------------
// Suite
// -----------------------------------------------------------------------
describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const fakeUser = { id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', isActive: true };
  const fakeJwtPayload: JwtPayload = { userId: 'u1', email: 'a@b.com', role: 'USER' };

  describe('authenticate', () => {
    it('accepts a valid Bearer token and attaches user', async () => {
      const token = signToken({ userId: fakeUser.id, role: fakeUser.role });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(fakeUser);

      const { req, res, next } = mockReqResNext({
        headers: { authorization: `Bearer ${token}` } as any,
      });

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user!.userId).toBe(fakeUser.id);
    });

    it('reads token from httpOnly cookie if no Authorization header', async () => {
      const token = signToken({ userId: fakeUser.id, role: fakeUser.role });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(fakeUser);

      const { req, res, next } = mockReqResNext({
        cookies: { access_token: token } as any,
      });
      // No Authorization header
      req.headers = {};

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user!.userId).toBe(fakeUser.id);
    });

    it('rejects expired tokens with 401', async () => {
      const token = signToken({ userId: 'u1', role: 'USER' }, '0s'); // Already expired

      const { req, res, next } = mockReqResNext({
        headers: { authorization: `Bearer ${token}` } as any,
      });

      // small delay to ensure expiry
      await new Promise(r => setTimeout(r, 50));
      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects missing token with 401', async () => {
      const { req, res, next } = mockReqResNext();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize (RBAC)', () => {
    it('allows user with matching role', () => {
      const middleware = authorize('USER', 'ADMIN');
      const { req, res, next } = mockReqResNext();
      (req as AuthRequest).user = { userId: 'u1', role: 'USER', email: 'a@b.com' };

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('blocks user without matching role', () => {
      const middleware = authorize('ADMIN');
      const { req, res, next } = mockReqResNext();
      (req as AuthRequest).user = { userId: 'u1', role: 'VIEWER', email: 'a@b.com' };

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('adminOnly', () => {
    it('allows ADMIN', () => {
      const { req, res, next } = mockReqResNext();
      (req as AuthRequest).user = { userId: 'u1', role: 'ADMIN', email: 'a@b.com' };

      adminOnly(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('blocks non-ADMIN', () => {
      const { req, res, next } = mockReqResNext();
      (req as AuthRequest).user = { userId: 'u1', role: 'USER', email: 'a@b.com' };

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});

describe('CSRF Middleware', () => {
  it('passes through for GET requests', () => {
    const { req, res, next } = mockReqResNext({ method: 'GET' });

    csrfProtection(req as any, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('passes through for OPTIONS requests', () => {
    const { req, res, next } = mockReqResNext({ method: 'OPTIONS' });

    csrfProtection(req as any, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects POST without CSRF token', () => {
    const { req, res, next } = mockReqResNext({ method: 'POST' });

    csrfProtection(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects POST when cookie and header mismatch', () => {
    const { req, res, next } = mockReqResNext({
      method: 'POST',
      cookies: { 'csrf-token': 'token-a' } as any,
      headers: { 'x-csrf-token': 'token-b' } as any,
    });

    csrfProtection(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('passes POST when cookie and header match', () => {
    const { req, res, next } = mockReqResNext({
      method: 'POST',
      cookies: { 'csrf-token': 'valid-token' } as any,
      headers: { 'x-csrf-token': 'valid-token' } as any,
    });

    csrfProtection(req as any, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('setCsrfCookie sets the cookie on response', () => {
    const res = { cookie: jest.fn() } as unknown as Response;

    const token = setCsrfCookie(res);

    expect(typeof token).toBe('string');
    expect(token.length).toBe(64); // 32 bytes hex
    expect(res.cookie).toHaveBeenCalledWith('csrf-token', token, expect.objectContaining({
      httpOnly: false,
      sameSite: 'strict',
    }));
  });
});
