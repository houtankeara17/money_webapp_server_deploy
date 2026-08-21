const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    err.message = "Invalid ID format";
  }
  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    err.message = "Duplicate field value entered";
  }
  // Validation
  if (err.name === "ValidationError") {
    statusCode = 400;
    err.message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || "Server Error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = { errorHandler, notFound };
