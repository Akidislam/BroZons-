import User from '../models/user.model.js';
import { generateToken } from '../utils/generateToken.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Helper to build safe user response object without secrets
 */
const formatSafeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || '',
  status: user.status,
  addresses: user.addresses || [],
  createdAt: user.createdAt,
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required fields.',
      });
    }

    // Validate email format
    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Check for existing user with identical email
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Determine role (default to 'customer'; allow admin assignment if explicitly passed in development)
    let userRole = 'customer';
    if (role && ['customer', 'admin', 'moderator'].includes(role)) {
      userRole = role;
    }

    // Create user (password will be hashed by pre-save hook in user.model.js)
    const user = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      password,
      phone: phone ? phone.trim() : '',
      role: userRole,
    });

    // Generate JWT
    const token = generateToken({ id: user._id, role: user.role });

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: formatSafeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & return JWT token
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate presence of credentials
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Query user and explicitly select password field
    const user = await User.findOne({ email: trimmedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Verify password against stored bcrypt hash
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Verify account is active
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact customer support.',
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account is currently inactive. Please contact support.',
      });
    }

    // Generate JWT token
    const token = generateToken({ id: user._id, role: user.role });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: formatSafeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user profile
 * @access  Private (Requires valid JWT)
 */
export const getMe = async (req, res) => {
  // req.user is attached by the authenticate middleware
  res.status(200).json({
    success: true,
    user: formatSafeUser(req.user),
  });
};

export default {
  register,
  login,
  getMe,
};
