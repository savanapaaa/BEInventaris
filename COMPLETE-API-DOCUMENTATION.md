# � SISTEM PEMINJAMAN INVENTARIS - COMPLETE API DOCUMENTATION

## 🌐 BASE URL
```
http://localhost:5000
```

## 🔐 AUTHENTICATION & AUTHORIZATION
Sebagian besar endpoint memerlukan JWT Bearer Token:
```javascript
headers: {
  'Authorization': 'Bearer <your_jwt_token>',
  'Content-Type': 'application/json'
}
```

**Role Levels:**
- 🟢 **Public**: No authentication required
- 🔵 **User**: Any logged-in user
- 🔴 **Admin**: Admin role required

---

## 📋 **COMPLETE API ROUTES OVERVIEW**

### 🔑 **AUTHENTICATION** (`/api/auth` & `/api/login`)

| Method | Endpoint | Description | Auth | Body Example |
|--------|----------|-------------|------|--------------|
| POST | `/api/login` | Main login endpoint | 🟢 | `{email, kata_sandi}` |
| POST | `/api/auth/login` | Alternative login | 🟢 | `{email, kata_sandi}` |
| POST | `/api/auth/register` | Register new user | 🔴 | `{nama_pengguna, email, kata_sandi, peran}` |

**Login Response:**
```json
{
  "success": true,
  "message": "Login berhasil",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "pengguna": {
    "id": 1,
    "nama_pengguna": "admin",
    "email": "admin@inventaris.com",
    "peran": "admin"
  }
}
```

---

### 👥 **USER MANAGEMENT** (`/api/pengguna`)

| Method | Endpoint | Description | Auth | Query/Body |
|--------|----------|-------------|------|------------|
| GET | `/api/pengguna` | Get all users with pagination | 🔴 | `?halaman=1&batas=10&search=name` |
| GET | `/api/pengguna/profile` | Get current user profile | 🔵 | - |
| GET | `/api/pengguna/:id` | Get user by ID | 🔵 | - |
| PUT | `/api/pengguna/:id` | Update user profile | 🔵 | `{nama_pengguna, email, ...}` |
| DELETE | `/api/pengguna/:id` | Delete user | 🔴 | - |

---

### 📦 **PRODUCT/BARANG MANAGEMENT** (`/api/produk`)

| Method | Endpoint | Description | Auth | Query/Body |
|--------|----------|-------------|------|------------|
| GET | `/api/produk` | Get all products with pagination | 🟢 | `?halaman=1&batas=10&kategori_id=1&search=name` |
| GET | `/api/produk/:id` | Get product by ID | 🟢 | - |
| GET | `/api/produk/status/tersedia` | Get available products only | 🔵 | `?kategori_id=1&search=name` |
| POST | `/api/produk` | Create new product | 🔴 | `{nama, kode, deskripsi, kategori_id}` |
| PUT | `/api/produk/:id` | Update product | 🔴 | `{nama, kode, deskripsi, kategori_id}` |
| DELETE | `/api/produk/:id` | Delete product | 🔴 | - |

**Product Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nama": "Proyektor Epson",
      "nama_barang": "Proyektor Epson",        // Updated terminology
      "kode": "PRJ001",
      "kode_barang": "PRJ001",                 // Updated terminology  
      "deskripsi": "Proyektor untuk presentasi",
      "kategori_id": 2,
      "kategori_nama": "Elektronik",
      "status_peminjaman": "tersedia" | "dipinjam",
      "gambar_url": "http://localhost:5000/uploads/products/image.jpg"
    }
  ],
  "pagination": {
    "halaman": 1,
    "batas": 10,
    "total": 45,
    "totalHalaman": 5
  }
}
```

---

### 🏷️ **CATEGORY MANAGEMENT** (`/api/kategori`)

| Method | Endpoint | Description | Auth | Body |
|--------|----------|-------------|------|------|
| GET | `/api/kategori` | Get all categories | 🟢 | - |
| GET | `/api/kategori/:id` | Get category by ID | 🟢 | - |
| POST | `/api/kategori` | Create new category | 🔴 | `{nama, deskripsi?}` |
| PUT | `/api/kategori/:id` | Update category | 🔴 | `{nama, deskripsi?}` |
| DELETE | `/api/kategori/:id` | Delete category | 🔴 | - |

---

### 📋 **BORROWING MANAGEMENT** (`/api/peminjaman`)

| Method | Endpoint | Description | Auth | Body/Query |
|--------|----------|-------------|------|------------|
| GET | `/api/peminjaman/test` | Test database connection | 🟢 | - |
| GET | `/api/peminjaman` | Get borrowings (filtered by user) | 🔵 | `?halaman=1&batas=10&status=dipinjam` |
| GET | `/api/peminjaman/user` | Get user's current borrowings | 🔵 | `?halaman=1&batas=10&status=all` |
| GET | `/api/peminjaman/:id` | Get borrowing by ID | 🔵 | - |
| GET | `/api/peminjaman/user/riwayat` | Get user's borrowing history | 🔵 | `?halaman=1&batas=10` |
| POST | `/api/peminjaman` | Create new borrowing (Pinjam) | 🔵 | `{produk_id, tanggal_kembali_rencana, keperluan}` |
| PUT | `/api/peminjaman/:id/selesai` | Mark borrowing as completed | 🔵 | `{tanggal_selesai, foto_pengembalian?}` |
| POST | `/api/peminjaman/:id/kembalikan-foto` | Return with photo upload | 🔵 | `{foto_pengembalian, catatan?}` |
| PUT | `/api/peminjaman/:id/kembalikan` | Traditional return (no photo) | 🔵 | `{kondisi_kembali, catatan?}` |
| POST | `/api/peminjaman/:id/perpanjang` | Extend borrowing period | 🔵 | `{tanggal_kembali_baru, alasan}` |

**Borrowing Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "produk_id": 14,
      "nama_barang": "Proyektor Epson",        // Updated terminology
      "peminjam_id": 3,
      "nama_peminjam": "savana",
      "tanggal_pinjam": "2025-10-21",
      "tanggal_kembali_rencana": "2025-10-31",
      "tanggal_selesai": null,
      "status": "dipinjam" | "completed" | "terlambat",
      "status_pengembalian": "not_returned" | "returned_pending" | "returned_approved",
      "keperluan": "Presentasi project",
      "kondisi_pinjam": "Baik",
      "foto_pengembalian": null,
      "konfirmasi_admin": "pending" | "approved" | "rejected",
      "hari_terlambat": -6
    }
  ],
  "pagination": {...}
}
```

#### 🔴 **ADMIN PEMINJAMAN ROUTES**

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/peminjaman/admin/terlambat` | Get overdue borrowings | 🔴 |
| GET | `/api/peminjaman/admin/pending-returns` | Get returns pending confirmation | 🔴 |
| PUT | `/api/peminjaman/admin/:id/konfirmasi-pengembalian` | Approve/reject return | 🔴 |
| GET | `/api/peminjaman/admin/debug-routes` | Debug admin routes | 🔴 |

**Admin Confirmation Example:**
```json
// PUT /api/peminjaman/admin/1/konfirmasi-pengembalian
{
  "status": "approved",  // or "rejected"
  "catatan_admin": "Barang dikembalikan dalam kondisi baik"
}

// Response:
{
  "success": true,
  "message": "Pengembalian berhasil disetujui",
  "data": {
    "id": "1",
    "status": "completed",
    "status_pengembalian": "returned_approved",
    "konfirmasi_admin": "approved"
  }
}
```

---

### 📜 **ACTIVITY HISTORY** (`/api/riwayat`)

| Method | Endpoint | Description | Auth | Query |
|--------|----------|-------------|------|-------|
| GET | `/api/riwayat` | Get activity history (auto-filtered) | 🔵 | `?halaman=1&batas=20&tabel=peminjaman&aksi=buat&showAll=true` |
| GET | `/api/riwayat/saya` | Get own activity history | 🔵 | `?halaman=1&batas=20` |
| GET | `/api/riwayat/tabel/:tabel/:id` | Get specific record history | 🔵 | - |

**Important**: Data JSON sudah otomatis di-parse! ✨

**Riwayat Response (JSON Pre-Parsed):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tabel_terkait": "peminjaman",
      "aksi": "buat" | "ubah" | "hapus" | "selesai",
      "deskripsi": "Meminjam Proyektor Epson untuk Presentasi",
      "detail_aktivitas": "Enhanced description with product info",
      "data_lama": null,  // Already parsed JSON object or null
      "data_baru": {      // Already parsed JSON object
        "produk_id": 14,
        "tanggal_pinjam": "2025-10-21",
        "keperluan": "Presentasi"
      },
      "pengguna_id": 3,
      "nama_pengguna": "savana",
      "dibuat_pada": "2025-10-21T09:59:00.000Z"
    }
  ],
  "pagination": {...}
}
```

---

### 📊 **STATISTICS & DASHBOARD** (`/api/stats` atau `/api/dashboard`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/stats` | Get comprehensive dashboard stats | 🔵 |
| GET | `/api/dashboard` | Alias for `/api/stats` | 🔵 |
| GET | `/api/stats/quick` | Get quick stats for widgets | 🔵 |

**Stats Response Example:**
```json
{
  "success": true,
  "data": {
    "total_barang": 50,              // Updated terminology
    "barang_tersedia": 45,           // Updated terminology
    "barang_dipinjam": 5,            // Updated terminology
    "total_peminjaman": 120,
    "peminjaman_aktif": 8,
    "peminjaman_terlambat": 2,
    "pending_returns": 3,            // For admin approval
    "total_pengguna": 25,
    "aktivitas_hari_ini": 12,
    "recent_activities": [...],
    "trend_peminjaman": [...]
  }
}
```

---

### 📞 **CONTACT PERSON** (`/api/contact-person`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/contact-person` | Get all active contacts | 🟢 |
| GET | `/api/contact-person/primary` | Get primary contact | 🟢 |
| PUT | `/api/contact-person` | Update contact info | 🔴 |

**Contact Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nama": "Admin Inventaris",
      "no_whatsapp": "6281234567890",
      "jabatan": "Penanggung Jawab Inventaris",
      "status": "aktif"
    }
  ]
}
```

---

### 📄 **REPORTS** (`/api/laporan`)

| Method | Endpoint | Description | Auth | Query |
|--------|----------|-------------|------|-------|
| GET | `/api/laporan/bulanan` | Get monthly report data | 🔴 | `?month=10&year=2025` |
| GET | `/api/laporan/generate-pdf` | Generate PDF report | 🔴 | `?month=10&year=2025` |

**Monthly Report Response:**
```json
{
  "success": true,
  "data": {
    "periode": {
      "bulan": 10,
      "tahun": 2025,
      "nama_bulan": "Oktober"
    },
    "statistik": {
      "total_peminjaman": 25,
      "selesai": 20,
      "aktif": 3,
      "terlambat": 2,
      "total_denda": 50000
    },
    "peminjaman": [...],
    "produk_terpopuler": [...],
    "berdasarkan_kategori": [...]
  }
}
```

---

### 📁 **FILE UPLOAD** (`/api/upload`)

| Method | Endpoint | Description | Auth | Body |
|--------|----------|-------------|------|------|
| POST | `/api/upload/product-image` | Upload product image | 🔵 | `multipart/form-data` with `productImage` |
| DELETE | `/api/upload/product-image/:filename` | Delete product image | 🔵 | - |

---

## 🔧 **STANDARD RESPONSE FORMATS**

### ✅ Success Response:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {...},
  "pagination": {
    "halaman": 1,
    "batas": 10,
    "total": 100,
    "totalHalaman": 10
  }
}
```

### ❌ Error Response:
```json
{
  "success": false,
  "error": "Error message description",
  "details": "Additional error context (optional)"
}
```

---

## 🚀 **FRONTEND INTEGRATION EXAMPLES**

### Complete Login Flow:
```javascript
// 1. Login API Call
const login = async (email, password) => {
  try {
    const response = await axios.post('/api/login', {
      email: email,
      kata_sandi: password
    });
    
    // Store token
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.pengguna));
    
    return response.data;
  } catch (error) {
    console.error('Login failed:', error.response.data.error);
    throw error;
  }
};

// 2. Setup axios defaults
axios.defaults.baseURL = 'http://localhost:5000';
axios.defaults.headers.common['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
```

### Borrowing Flow:
```javascript
// 1. Get available products
const availableProducts = await axios.get('/api/produk/status/tersedia?kategori_id=1');

// 2. Create borrowing
const createBorrowing = await axios.post('/api/peminjaman', {
  produk_id: 1,
  tanggal_kembali_rencana: '2025-11-01',
  keperluan: 'Presentasi project akhir',
  kondisi_pinjam: 'Baik'
});

// 3. Return with photo
const returnWithPhoto = await axios.post(`/api/peminjaman/${id}/kembalikan-foto`, {
  foto_pengembalian: base64PhotoString,
  catatan: 'Dikembalikan dalam kondisi baik'
});

// 4. Admin approval (admin only)
const adminApproval = await axios.put(`/api/peminjaman/admin/${id}/konfirmasi-pengembalian`, {
  status: 'approved',
  catatan_admin: 'Barang diterima dengan baik'
});
```

### Activity History (Pre-parsed JSON):
```javascript
// Get activity history - JSON already parsed!
const history = await axios.get('/api/riwayat?halaman=1&batas=20');

history.data.data.forEach(activity => {
  // No need for JSON.parse() - already done by backend!
  if (activity.data_baru) {
    console.log('New data:', activity.data_baru.produk_id);
  }
  if (activity.data_lama) {
    console.log('Old data:', activity.data_lama.status);
  }
});
```

### WhatsApp Contact Integration:
```javascript
// Get contact and open WhatsApp
const openWhatsApp = async () => {
  const contact = await axios.get('/api/contact-person/primary');
  const whatsappUrl = `https://wa.me/${contact.data.data.no_whatsapp}?text=Halo, saya ingin bertanya tentang inventaris`;
  window.open(whatsappUrl, '_blank');
};
```

### Dashboard Statistics:
```javascript
// Get dashboard stats
const loadDashboard = async () => {
  const stats = await axios.get('/api/stats');
  
  // Updated field names
  const {
    total_barang,        // Total items
    barang_tersedia,     // Available items
    barang_dipinjam,     // Borrowed items
    peminjaman_aktif,    // Active borrowings
    peminjaman_terlambat, // Overdue borrowings
    pending_returns      // For admin notifications
  } = stats.data.data;
  
  // Update UI components
  updateDashboardCards(stats.data.data);
};
```

---

## ⚠️ **IMPORTANT NOTES FOR FRONTEND DEVELOPERS**

### 1. **Updated Field Names**
Backend now uses consistent "barang" terminology:
- ✅ `nama_barang` (recommended)
- ✅ `kode_barang` (recommended)  
- ✅ `deskripsi_barang` (recommended)
- ⚠️ Legacy `nama_produk`, `kode_produk` still supported

### 2. **JSON Parsing Already Done**
- ✅ `data_lama` and `data_baru` in `/api/riwayat` are pre-parsed objects
- ❌ No need for `JSON.parse()` in frontend
- ✅ Safe fallback to `null` if parsing fails

### 3. **Authentication Flow**
```javascript
// Always include token in headers
const token = localStorage.getItem('token');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Check for 401 responses and redirect to login
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 4. **Admin Features**
Admin-only endpoints (🔴) require JWT token with `peran: "admin"`:
- Pending returns confirmation
- User management
- Category management
- Product management
- Reports generation

### 5. **Error Handling**
All endpoints return consistent error format:
```javascript
try {
  const response = await axios.get('/api/endpoint');
} catch (error) {
  // Always check error.response.data.error for message
  const errorMessage = error.response?.data?.error || 'Unknown error';
  showNotification(errorMessage, 'error');
}
```

### 6. **File Upload**
For product images, use FormData:
```javascript
const formData = new FormData();
formData.append('productImage', file);

const upload = await axios.post('/api/upload/product-image', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

---

## 🎯 **FRONTEND IMPLEMENTATION CHECKLIST**

- [ ] Setup axios with base URL `http://localhost:5000`
- [ ] Implement JWT token storage and auto-include in headers  
- [ ] Handle 401 responses with automatic logout
- [ ] Use updated field names (`nama_barang`, `kode_barang`)
- [ ] Remove JSON.parse() calls for riwayat data - already parsed!
- [ ] Implement admin route guards for 🔴 endpoints
- [ ] Add WhatsApp contact integration
- [ ] Handle photo upload for returns
- [ ] Implement admin approval workflow for returns
- [ ] Add pagination support for list endpoints

---

**🎉 Backend API sudah production-ready dan siap untuk integrasi frontend!**

All routes tested and working with consistent response formats! 🚀