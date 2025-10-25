const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads/products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created uploads/products directory');
}

// Storage configuration for product images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: productimg_timestamp_random.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const fileName = `productimg_${uniqueSuffix}${fileExtension}`;
    cb(null, fileName);
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  // Allowed image types
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
  }
};

// Configure multer for product image uploads
const uploadProductImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only one file at a time
  }
});

// Middleware to handle single product image upload
const uploadSingleProductImage = uploadProductImage.single('productImage');

// Custom middleware wrapper with better error handling
const handleProductImageUpload = (req, res, next) => {
  uploadSingleProductImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File terlalu besar. Maksimum ukuran file adalah 5MB.'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Hanya bisa upload satu gambar dalam satu waktu.'
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Field name harus "productImage".'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada file yang diupload. Pastikan menggunakan field "productImage".'
      });
    }
    
    // Add file info to request for further processing
    req.uploadedFile = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      relativePath: `/uploads/products/${req.file.filename}`,
      url: `${req.protocol}://${req.get('host')}/uploads/products/${req.file.filename}`
    };
    
    next();
  });
};

// Utility function to delete uploaded file
const deleteUploadedFile = (filename) => {
  try {
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Utility function to get file URL
const getImageUrl = (req, gambarValue) => {
  try {
    if (!gambarValue) return null;
    
    // If it's already a full URL (like placeholder), return as is
    if (gambarValue.startsWith('http://') || gambarValue.startsWith('https://')) {
      return gambarValue;
    }
    
    // If it's a relative path starting with /uploads/, construct full URL
    if (gambarValue.startsWith('/uploads/')) {
      return `${req.protocol}://${req.get('host')}${gambarValue}`;
    }
    
    // If it's just a filename, construct full URL with /uploads/products/
    return `${req.protocol}://${req.get('host')}/uploads/products/${gambarValue}`;
  } catch (error) {
    console.error('Error in getImageUrl:', error);
    return null;
  }
};

module.exports = {
  handleProductImageUpload,
  deleteUploadedFile,
  getImageUrl,
  uploadDir
};