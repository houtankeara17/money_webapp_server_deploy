const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  deleteAllBudgets,
  exportBudgets,
  importBudgets,
} = require("../controllers/budgetController");

router.use(protect);

router.route("/").get(getBudgets).post(createBudget).delete(deleteAllBudgets);
router.get("/export", exportBudgets);
router.post("/import", importBudgets);
router.route("/:id").put(updateBudget).delete(deleteBudget);

module.exports = router;
