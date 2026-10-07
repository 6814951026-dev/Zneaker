function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

function errorHandler(error, req, res, next) {
  if (error.code === 11000) {
    return res.status(409).json({ message: "A record with that value already exists", fields: error.keyValue });
  }
  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation failed",
      errors: Object.values(error.errors).map((item) => item.message)
    });
  }
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid resource identifier" });
  console.error(error);
  return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Internal server error" });
}

module.exports = { notFound, errorHandler };
