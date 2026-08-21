const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  deleteAllExpenses,
  exportExpenses,
  importExpenses,
} = require("../controllers/expenseController");

// 1. Apply authentication middleware FIRST for all routes below
router.use(protect);

// 2. Static export/import routes
router.get("/export", exportExpenses);
router.post("/import", importExpenses);

// 3. Root Collection routes
router
  .route("/")
  .get(getExpenses)
  .post(createExpense)
  .delete(deleteAllExpenses);

// 4. Parameterized routes
router.route("/:id").put(updateExpense).delete(deleteExpense);

module.exports = router;
