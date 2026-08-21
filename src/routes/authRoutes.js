const express = require("express");
const passport = require("passport");
const router = express.Router();
const { protect, optionalAuth } = require("../middleware/auth");
const {
  generateAccessToken,
  generateRefreshToken,
  issueTokenPair,
} = require("../utils/jwt");
const {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateProfile,
  updatePassword,
  verifyUserAndSendCode,
  resetPassword,
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", optionalAuth, logout);

router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/password", protect, updatePassword);

// 3-Step Password Reset Routes
router.post("/forgot-password/verify-user", verifyUserAndSendCode);
router.put("/reset-password", resetPassword);

// Google OAuth
router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      success: false,
      message: "Google login is not configured on this server",
    });
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(
    req,
    res,
    next,
  );
});

router.get(
  "/google/callback",
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.redirect(
        `${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=oauth_not_configured`,
      );
    }
    passport.authenticate("google", {
      failureRedirect: `${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=oauth_failed`,
      session: false,
    })(req, res, next);
  },
  async (req, res) => {
    try {
      if (!req.user) {
        return res.redirect(
          `${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=oauth_failed`,
        );
      }
      const tokens = await issueTokenPair(req.user);
      const q = new URLSearchParams({
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      res.redirect(
        `${process.env.CLIENT_URL || "http://localhost:5173"}/oauth-callback?${q.toString()}`,
      );
    } catch (error) {
      res.redirect(
        `${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=server_error`,
      );
    }
  },
);

module.exports = router;
