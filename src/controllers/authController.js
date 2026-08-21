const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const User = require("../models/User");
const {
  issueTokenPair,
  revokeRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require("../utils/jwt");
const { success, error } = require("../utils/response");
const { msg } = require("../utils/i18n");

/** Public user payload + tokens */
const authPayload = (user, tokens) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  theme: user.theme,
  language: user.language,
  currency: user.currency,
  exchangeRateKhr: user.exchangeRateKhr,
  exchangeRateThb: user.exchangeRateThb,
  // access token (also as `token` for older clients)
  token: tokens.accessToken,
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  expiresIn: tokens.expiresIn,
  tokenType: tokens.tokenType || "Bearer",
});

// @desc    Register new user
// @route   POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return error(res, msg(req, "auth.registerRequired"), 400);
  }

  const exists = await User.findOne({ email });
  if (exists) {
    return error(res, msg(req, "auth.exists"), 400);
  }

  const user = await User.create({
    name,
    email,
    password,
    authProvider: "local",
  });

  if (!user) {
    return error(res, msg(req, "auth.invalidData"), 400);
  }

  // optional language from client on register
  if (req.body.language === "km" || req.body.language === "en") {
    user.language = req.body.language;
    await user.save({ validateBeforeSave: false });
  }
  const tokens = await issueTokenPair(user);
  req.user = user;
  return success(
    res,
    authPayload(user, tokens),
    msg(req, "auth.registerOk"),
    201,
  );
});

// @desc    Login user
// @route   POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return error(res, msg(req, "auth.loginRequired"), 400);
  }

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    const tokens = await issueTokenPair(user);
    // Use stored user language for response message
    req.user = user;
    return success(res, authPayload(user, tokens), msg(req, "auth.loginOk"));
  }

  return error(res, msg(req, "auth.invalidCredentials"), 401);
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return error(res, msg(req, "auth.refreshRequired"), 400);
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return error(res, msg(req, "auth.refreshInvalid"), 401);
  }

  const user = await User.findById(decoded.id).select(
    "+refreshTokenHash +refreshTokenExpires",
  );
  if (!user) {
    return error(res, msg(req, "auth.userNotFound"), 401);
  }

  if (!user.refreshTokenHash || !user.refreshTokenExpires) {
    return error(res, msg(req, "auth.refreshRevoked"), 401);
  }

  if (user.refreshTokenExpires.getTime() < Date.now()) {
    await revokeRefreshToken(user);
    return error(res, msg(req, "auth.refreshExpired"), 401);
  }

  const incomingHash = hashToken(refreshToken);
  if (incomingHash !== user.refreshTokenHash) {
    // possible reuse / theft → revoke
    await revokeRefreshToken(user);
    return error(res, msg(req, "auth.refreshMismatch"), 401);
  }

  // Rotate refresh token
  const tokens = await issueTokenPair(user);
  return success(
    res,
    {
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: "Bearer",
    },
    msg(req, "auth.tokenRefreshed"),
  );
});

// @desc    Logout — revoke refresh token
// @route   POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  // Prefer authenticated user; optional body.refreshToken for soft logout
  if (req.user?._id) {
    const user = await User.findById(req.user._id).select(
      "+refreshTokenHash +refreshTokenExpires",
    );
    if (user) await revokeRefreshToken(user);
  } else if (req.body?.refreshToken) {
    try {
      const decoded = verifyRefreshToken(req.body.refreshToken);
      const user = await User.findById(decoded.id).select(
        "+refreshTokenHash +refreshTokenExpires",
      );
      if (user) await revokeRefreshToken(user);
    } catch {
      // ignore invalid token on logout
    }
  }
  return success(res, null, msg(req, "auth.logoutOk"));
});

// @desc    Get current user
// @route   GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  return success(res, req.user, msg(req, "auth.profileOk"));
});

// @desc    Update profile / preferences
// @route   PUT /api/auth/profile
const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return error(res, msg(req, "auth.userNotFound"), 404);
  }

  const fields = [
    "name",
    "avatar",
    "theme",
    "language",
    "currency",
    "exchangeRateKhr",
    "exchangeRateThb",
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) user[f] = req.body[f];
  });

  const updated = await user.save();
  return success(res, updated, msg(req, "auth.profileUpdated"));
});

// @desc    Update password
// @route   PUT /api/auth/password
const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return error(res, msg(req, "auth.passwordRequired"), 400);
  }
  if (String(newPassword).length < 6) {
    return error(res, msg(req, "auth.passwordShort"), 400);
  }

  const user = await User.findById(req.user._id);
  if (!user || !(await user.matchPassword(currentPassword))) {
    return error(res, msg(req, "auth.passwordWrong"), 401);
  }

  user.password = newPassword;
  await user.save();
  // Force re-login on other devices by rotating tokens
  const tokens = await issueTokenPair(user);
  return success(
    res,
    {
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    },
    msg(req, "auth.passwordUpdated"),
  );
});

// @desc    Step 1: Verify user email & last/current password, then send reset code
// @route   POST /api/auth/forgot-password/verify-user
const verifyUserAndSendCode = asyncHandler(async (req, res) => {
  const { email, lastPassword } = req.body;

  if (!email || !lastPassword) {
    return error(res, msg(req, "auth.loginRequired"), 400);
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user || user.authProvider !== "local") {
    return error(res, msg(req, "auth.invalidCredentials"), 400);
  }

  const isMatch = await user.matchPassword(lastPassword);
  if (!isMatch) {
    return error(res, msg(req, "auth.invalidCredentials"), 400);
  }

  const resetCode = String(Math.floor(100000 + Math.random() * 900000));

  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetCode)
    .digest("hex");
  user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const payload =
    process.env.NODE_ENV === "development"
      ? { resetCode, message: "Use this code on the reset page (dev only)" }
      : null;

  console.log(`[forgot-password] OTP code for ${email}: ${resetCode}`);

  return success(res, payload, msg(req, "auth.resetSent"));
});

// @desc    Step 2/3: Verify code and update password (with auto-login payload)
// @route   PUT /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { email, token, code, password, newPassword } = req.body;
  const plain = code || token;
  const pwd = password || newPassword;

  if (!plain) return error(res, msg(req, "auth.resetCodeRequired"), 400);
  if (!pwd || String(pwd).length < 6) {
    return error(res, msg(req, "auth.passwordShort"), 400);
  }

  const hashed = crypto
    .createHash("sha256")
    .update(String(plain).trim())
    .digest("hex");

  // Query by hashed token and expiry, plus email if provided
  const query = {
    resetPasswordToken: hashed,
    resetPasswordExpire: { $gt: Date.now() },
  };

  if (email) {
    query.email = email.toLowerCase().trim();
  }

  const user = await User.findOne(query);

  if (!user) {
    return error(res, msg(req, "auth.resetInvalid"), 400);
  }

  user.password = pwd;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  // Issue new tokens for auto-login
  const tokens = await issueTokenPair(user);
  req.user = user;

  return success(res, authPayload(user, tokens), msg(req, "auth.resetOk"));
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateProfile,
  updatePassword,
  verifyUserAndSendCode,
  resetPassword,
};
