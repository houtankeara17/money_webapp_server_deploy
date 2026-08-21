const asyncHandler = require("express-async-handler");
const path = require("path");
const { success, error } = require("../utils/response");

/**
 * POST /api/upload
 * multipart field: "file"
 * Returns public URL path for the saved file
 */
const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return error(res, "No file uploaded", 400);
  }

  // Optional Cloudinary path when credentials exist
  let url = `/uploads/${req.file.filename}`;

  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    try {
      const cloudinary = require("../config/cloudinary");
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "moneyflow/receipts",
        resource_type: "auto",
      });
      url = result.secure_url;
      // remove local copy after cloud upload
      try {
        require("fs").unlinkSync(req.file.path);
      } catch (_) {}
    } catch (err) {
      console.error("Cloudinary upload failed, using local file:", err.message);
    }
  }

  return success(
    res,
    {
      url,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
    "File uploaded successfully",
  );
});

module.exports = { uploadFile };
