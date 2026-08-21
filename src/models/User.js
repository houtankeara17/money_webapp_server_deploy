const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 6,
    },
    googleId: {
      type: String,
      default: null,
    },
    githubId: {
      type: String,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ["local", "google", "github"],
      default: "local",
    },
    avatar: {
      type: String,
      default: "",
    },
    theme: {
      type: String,
      default: "system",
      enum: ["dark", "light", "system"],
    },
    language: {
      type: String,
      default: "en",
      enum: ["en", "km"],
    },
    currency: {
      type: String,
      default: "USD",
      enum: ["USD", "KHR", "THB"],
    },
    exchangeRateKhr: {
      type: Number,
      default: 4100,
    },
    exchangeRateThb: {
      type: Number,
      default: 36.5,
    },
    resetPasswordToken: {
      type: String,
      required: false,
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    refreshTokenExpires: {
      type: Date,
      default: null,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  if (!this.password) return false;
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  delete obj.refreshTokenHash;
  delete obj.refreshTokenExpires;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
