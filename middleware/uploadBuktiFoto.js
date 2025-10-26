const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Pastikan directory upload exists
const uploadDir = 'uploads/bukti-pengembalian';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration untuk foto bukti pengembalian
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Format: pengembalian_peminjamanId_timestamp_originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const peminjamanId = req.params.id || 'unknown';
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    
    cb(null, `pengembalian_${peminjamanId}_${uniqueSuffix}_${baseName}${ext}`);
  }
});

// File filter untuk validasi
const fileFilter = (req, file, cb) => {
  // Allowed mime types
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File harus berupa gambar (JPG, PNG, GIF, WEBP)'), false);
  }
};

// Multer configuration
const uploadBuktiFoto = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1 // Only 1 file
  }
});

// Middleware wrapper dengan error handling
const uploadBuktiFotoMiddleware = (req, res, next) => {
  const upload = uploadBuktiFoto.single('foto_bukti');
  
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File terlalu besar. Maksimal 5MB'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          error: 'Hanya boleh upload 1 file'
        });
      }
      return res.status(400).json({
        success: false,
        error: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    
    // File upload success atau tidak ada file
    next();
  });
};

module.exports = { uploadBuktiFotoMiddleware };