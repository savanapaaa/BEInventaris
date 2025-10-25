const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureUploadDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Storage configuration for return photos
const returnPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/pengembalian/';
    ensureUploadDirExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-peminjaman_id-original_name
    const peminjamanId = req.params.id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const fileName = `${timestamp}-peminjaman_${peminjamanId}-return${ext}`;
    cb(null, fileName);
  }
});

// File filter for images only
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);

  if (mimeType && extName) {
    return cb(null, true);
  } else {
    cb(new Error('Hanya file gambar yang diperbolehkan (JPEG, JPG, PNG, GIF, WebP)'));
  }
};

// Multer configuration for return photos
const uploadReturnPhoto = multer({
  storage: returnPhotoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// General storage for other uploads
const generalStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/general/';
    ensureUploadDirExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const fileName = `${timestamp}-${file.originalname}`;
    cb(null, fileName);
  }
});

const uploadGeneral = multer({
  storage: generalStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Error handling middleware
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File terlalu besar. Maksimal 5MB untuk foto pengembalian.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Field file tidak sesuai yang diharapkan.'
      });
    }
  }
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.message || 'Error saat upload file'
    });
  }
  
  next();
};

module.exports = {
  uploadReturnPhoto,
  uploadGeneral,
  handleMulterError,
  ensureUploadDirExists
};