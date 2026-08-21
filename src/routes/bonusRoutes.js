const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getBonuses,
  createBonus,
  updateBonus,
  deleteBonus,
  deleteAllBonuses,
  exportBonuses,
  importBonuses,
} = require("../controllers/bonusController");

router.use(protect);

router.route("/").get(getBonuses).post(createBonus).delete(deleteAllBonuses);

router.get("/export", exportBonuses);
router.post("/import", importBonuses);

router.route("/:id").put(updateBonus).delete(deleteBonus);

module.exports = router;
