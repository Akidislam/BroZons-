import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import http from 'http';
import app from './app.js';
import User from './models/user.model.js';
import { generateToken } from './utils/generateToken.js';
import { authenticate, authorize } from './middlewares/auth.middleware.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    throw new Error(message);
  }
}

async function runAuthTests() {
  console.log('====================================================');
  console.log('       BroZons Auth & Authorization Test Suite       ');
  console.log('====================================================');

  const PORT = 5001; // Use test port
  let server;

  try {
    // Phase 1: JWT Utility Tests
    console.log('\n[Phase 1] Testing JWT Token Generation & Verification...');
    const payload = { id: '64b1f2e3d4c5b6a789012345', role: 'customer' };
    const token = generateToken(payload);
    assert(typeof token === 'string' && token.length > 20, 'generateToken produces a valid JWT string');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    assert(decoded.id === payload.id, 'Decoded token contains matching user id');
    assert(decoded.role === payload.role, 'Decoded token contains matching user role');
    assert(decoded.exp > decoded.iat, 'Token has valid expiration timestamp');

    // Phase 2: Start test server
    console.log('\n[Phase 2] Starting Express test server on port 5001...');
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`  ✓ Test server listening at http://localhost:${PORT}`);

    // Helper fetch wrapper
    const request = async (path, options = {}) => {
      const res = await fetch(`http://localhost:${PORT}${path}`, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    };

    // Phase 3: Registration Validation Tests
    console.log('\n[Phase 3] Testing Registration Validation...');
    
    // 3a. Missing required fields
    const resNoFields = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(resNoFields.status === 400, 'Registration rejects missing fields with HTTP 400');
    assert(resNoFields.data.success === false, 'Returns success: false for missing fields');

    // 3b. Invalid email format
    const resBadEmail = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'John Doe', email: 'not-an-email', password: 'password123' }),
    });
    assert(resBadEmail.status === 400, 'Registration rejects invalid email with HTTP 400');
    assert(resBadEmail.data.message.includes('valid email'), 'Returns clear email format error message');

    // 3c. Short password (< 6 chars)
    const resShortPass = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'John Doe', email: 'john@example.com', password: '123' }),
    });
    assert(resShortPass.status === 400, 'Registration rejects short password with HTTP 400');
    assert(resShortPass.data.message.includes('6 characters'), 'Returns password length validation error');

    // Phase 4: Login Validation Tests
    console.log('\n[Phase 4] Testing Login Validation...');
    const resNoLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(resNoLogin.status === 400, 'Login rejects empty credentials with HTTP 400');

    // Phase 5: Authentication Middleware Tests (Missing & Malformed Tokens)
    console.log('\n[Phase 5] Testing JWT Authentication Middleware...');

    // 5a. Missing token on protected /api/auth/me
    const resNoToken = await request('/api/auth/me');
    assert(resNoToken.status === 401, 'Protected /api/auth/me returns 401 when no token is provided');
    assert(resNoToken.data.success === false, 'Returns success: false when token missing');

    // 5b. Malformed token
    const resBadToken = await request('/api/auth/me', {
      headers: { Authorization: 'Bearer this.is.a.fake.jwt.token' },
    });
    assert(resBadToken.status === 401, 'Protected /api/auth/me returns 401 when token is invalid');
    assert(resBadToken.data.message.includes('Invalid authentication token'), 'Returns invalid token message');

    // Phase 6: Role-Based Authorization Middleware Unit & Integration Tests
    console.log('\n[Phase 6] Testing Role-Based Authorization Middleware...');

    // Unit test authorize middleware
    const customerReq = { user: { _id: 'cust123', name: 'Regular User', role: 'customer' } };
    const adminReq = { user: { _id: 'admin123', name: 'Store Admin', role: 'admin' } };
    let customerDenied = false;
    let adminAllowed = false;

    const adminOnlyMiddleware = authorize('admin');

    // Customer test
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 403) customerDenied = true;
        },
      }),
    };
    adminOnlyMiddleware(customerReq, mockRes, () => {});
    assert(customerDenied, 'authorize("admin") denies customer user with HTTP 403');

    // Admin test
    adminOnlyMiddleware(adminReq, {}, () => {
      adminAllowed = true;
    });
    assert(adminAllowed, 'authorize("admin") allows admin user to proceed to next()');

    // Test support for 'user' / 'customer' alias
    let userAllowed = false;
    const userRoleMiddleware = authorize('user');
    userRoleMiddleware(customerReq, {}, () => {
      userAllowed = true;
    });
    assert(userAllowed, 'authorize accepts "user" alias for "customer" role');

    // Phase 7: Protected Route Endpoints Verification
    console.log('\n[Phase 7] Testing Protected Route Response Structure...');

    // Verify /api/auth/admin-test endpoint exists and is protected
    const resAdminWithoutAuth = await request('/api/auth/admin-test');
    assert(resAdminWithoutAuth.status === 401, 'GET /api/auth/admin-test is protected and rejects unauthorized requests');

    // Phase 8: Mock End-to-End User Auth Cycle Simulation
    console.log('\n[Phase 8] Simulating Authenticated End-to-End Cycle...');

    // Create a mock user in memory to test getMe route
    const mockUser = {
      _id: '64b1f2e3d4c5b6a789012345',
      name: 'BroZons Admin',
      email: 'admin@brozons.com',
      role: 'admin',
      phone: '+1-555-0100',
      status: 'active',
      addresses: [],
      createdAt: new Date().toISOString(),
    };

    // Generate valid admin token
    const adminToken = generateToken({ id: mockUser._id, role: mockUser.role });

    // Mock User.findById for this token test
    const originalFindById = User.findById;
    User.findById = function (id) {
      return {
        select: function () {
          return Promise.resolve(mockUser);
        },
      };
    };

    try {
      // Test /api/auth/me with mock token
      const resMe = await request('/api/auth/me', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(resMe.status === 200, 'GET /api/auth/me returns 200 OK with valid token');
      assert(resMe.data.user.email === 'admin@brozons.com', 'GET /api/auth/me returns authenticated user data');
      assert(!resMe.data.user.password, 'GET /api/auth/me does not expose password or hash');

      // Test /api/auth/admin-test with admin token
      const resAdminSuccess = await request('/api/auth/admin-test', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(resAdminSuccess.status === 200, 'GET /api/auth/admin-test allows admin access with 200 OK');
      assert(resAdminSuccess.data.message.includes('Admin access granted'), 'Returns admin welcome message');

      // Test /api/auth/admin-test with customer token (should be 403 Forbidden)
      const customerMockUser = { ...mockUser, role: 'customer' };
      User.findById = function () {
        return {
          select: function () {
            return Promise.resolve(customerMockUser);
          },
        };
      };
      const customerToken = generateToken({ id: customerMockUser._id, role: 'customer' });
      const resAdminDenied = await request('/api/auth/admin-test', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      assert(resAdminDenied.status === 403, 'GET /api/auth/admin-test rejects customer with 403 Forbidden');
      assert(resAdminDenied.data.message.includes('Forbidden'), 'Returns descriptive forbidden message');

    } finally {
      User.findById = originalFindById;
    }

    console.log('\n====================================================');
    console.log(`  ALL ${passedTests}/${totalTests} AUTHENTICATION TESTS PASSED!`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('\n[Auth Tests FAILED]:', error);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

runAuthTests();
