export async function upload(req, res) {
  // Phase 1+ will implement Excel upload + parsing + processing.
  if (!req.file) {
    return res.status(400).json({
      message: "No file uploaded. Use form-data with key 'file' and a .xlsx file.",
    });
  }

  return res.status(201).json({
    message: "File uploaded successfully",
    file: {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      filename: req.file.filename,
      path: req.file.path,
    },
  });
}

