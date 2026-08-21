const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getSalaries,
  getSalaryBonusHistory,
  createSalary,
  updateSalary,
  deleteSalary,
  deleteAllSalaries,
  exportSalaries,
  importSalaries,
} = require("../controllers/salaryController");

router.use(protect);

router.get("/export", exportSalaries);
router.post("/import", importSalaries);

router.route("/").get(getSalaries).post(createSalary).delete(deleteAllSalaries);

router.get("/history", getSalaryBonusHistory);

router.route("/:id").put(updateSalary).delete(deleteSalary);

module.exports = router;
