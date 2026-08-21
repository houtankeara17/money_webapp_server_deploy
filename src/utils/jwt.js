const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

const accessSecret = () => process.env.JWT_SECRET || "dev_access_secret_change_me";
const refreshSecret = () =>
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev_refresh_secret_change_me";

/** Short-lived access token (API calls) */
const generateAccessToken = (id) =>
  jwt.sign({ id, type: "access" }, accessSecret(), { expiresIn: ACCESS_EXPIRES });

/** Long-lived refresh token (get new access tokens) */
const generateRefreshToken = (id) =>
  jwt.sign({ id, type: "refresh" }, refreshSecret(), { expiresIn: REFRESH_EXPIRES });

const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, accessSecret());
  if (decoded.type && decoded.type !== "access") {
    throw new Error("Invalid token type");
  }
  return decoded;
};

const verifyRefreshToken = (token) => {
  const decoded = jwt.verify(token, refreshSecret());
  if (decoded.type && decoded.type !== "refresh") {
    throw new Error("Invalid token type");
  }
  return decoded;
};

/** Hash refresh token before storing on user */
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

/** Parse expiresIn like 7d / 15m to Date */
const expiresAtFrom = (expiresIn) => {
  const m = String(expiresIn).match(/^(\d+)([smhd])$/i);
  if (!m) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  const ms =
    u === "s" ? n * 1000 :
    u === "m" ? n * 60 * 1000 :
    u === "h" ? n * 60 * 60 * 1000 :
    n * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
};

/**
 * Create access + refresh pair and persist refresh hash on user doc
 * @param {import('mongoose').Document} user
 */
const issueTokenPair = async (user) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpires = expiresAtFrom(REFRESH_EXPIRES);
  await user.save({ validateBeforeSave: false });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_EXPIRES,
    tokenType: "Bearer",
  };
};

/** Clear stored refresh token (logout) */
const revokeRefreshToken = async (user) => {
  user.refreshTokenHash = null;
  user.refreshTokenExpires = null;
  await user.save({ validateBeforeSave: false });
};

// Back-compat alias used by older imports
const generateToken = generateAccessToken;

module.exports = {
  generateToken,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  issueTokenPair,
  revokeRefreshToken,
  ACCESS_EXPIRES,
  REFRESH_EXPIRES,
};
