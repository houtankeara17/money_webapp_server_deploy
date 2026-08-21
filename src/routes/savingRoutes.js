const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getSavings,
  createSaving,
  updateSaving,
  deleteSaving,
  deleteAllSavings,
  exportSavings,
  importSavings,
} = require("../controllers/savingController");

router.use(protect);
router.route("/").get(getSavings).post(createSaving).delete(deleteAllSavings);
router.get("/export", exportSavings);
router.post("/import", importSavings);
router.route("/:id").put(updateSaving).delete(deleteSaving);

module.exports = router;
