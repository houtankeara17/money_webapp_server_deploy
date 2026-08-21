const express = require("express");
const cors = require("cors");
const passport = require("./config/passport");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { languageMiddleware } = require("./middleware/language");

const authRoutes = require("./routes/authRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const salaryRoutes = require("./routes/salaryRoutes");
const bonusRoutes = require("./routes/bonusRoutes");
const savingRoutes = require("./routes/savingRoutes");
const planRoutes = require("./routes/planRoutes");
const remittanceRoutes = require("./routes/remittanceRoutes");
const exchangeLogRoutes = require("./routes/exchangeLogRoutes");
const noteRoutes = require("./routes/noteRoutes");
const reportRoutes = require("./routes/reportRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const loanRoutes = require("./routes/loanRoutes");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Language negotiation (Accept-Language, X-Language, ?lang=)
app.use(languageMiddleware);
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(passport.initialize());

app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/salaries", salaryRoutes);
app.use("/api/bonuses", bonusRoutes);
app.use("/api/savings", savingRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/remittances", remittanceRoutes);
app.use("/api/exchange-logs", exchangeLogRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/budgets", budgetRoutes);

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "MoneyFlow API is running" });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
