const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  deleteAllPlans,
  exportPlans,
  importPlans,
  addInvestmentReturn,
} = require("../controllers/planController");

router.use(protect);
router.route("/").get(getPlans).post(createPlan).delete(deleteAllPlans);
router.get("/export", exportPlans);
router.post("/import", importPlans);
router.post("/:id/returns", addInvestmentReturn);
router.route("/:id").put(updatePlan).delete(deletePlan);
