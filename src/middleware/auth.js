const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const { verifyAccessToken } = require("../utils/jwt");

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = verifyAccessToken(token);
      req.user = await User.findById(decoded.id).select("-password");
      if (!req.user) {
        res.status(401);
        throw new Error("Not authorized, user not found");
      }
      return next();
    } catch (err) {
      res.status(401);
      throw new Error(
        err.message?.includes("expired")
          ? "Access token expired — use POST /auth/refresh"
          : "Not authorized, token failed"
      );
    }
  }

  res.status(401);
  throw new Error(
    "Not authorized, no token. Login first and send Authorization: Bearer <accessToken>"
  );
});

/** Optional auth — attach user if token present, never fail */
const optionalAuth = asyncHandler(async (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      const token = req.headers.authorization.split(" ")[1];
      const decoded = verifyAccessToken(token);
      req.user = await User.findById(decoded.id).select("-password");
    } catch {
      req.user = null;
    }
  }
  next();
});

module.exports = { protect, optionalAuth };
