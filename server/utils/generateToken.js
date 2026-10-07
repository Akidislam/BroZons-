import jwt from 'jsonwebtoken';

/**
 * Generate a signed JWT for an authenticated user
 * @param {Object} payload - User identification payload (e.g. { id, role })
 * @returns {string} - Signed JWT token
 */
export const generateToken = (payload) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(payload, secret, {
    expiresIn,
  });
};

export default generateToken;
