# Test API Inventory Backend
Write-Host "🧪 Testing Inventory Backend API..." -ForegroundColor Green

# Test 1: Server Health Check
Write-Host "`n1. Testing Server Health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000" -Method GET -TimeoutSec 10
    Write-Host "✅ Server is running! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Server health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Login Test
Write-Host "`n2. Testing Login Endpoint..." -ForegroundColor Yellow
try {
    $loginData = @{
        email = "admin@inventaris.com"
        kata_sandi = "admin123"
    } | ConvertTo-Json

    $headers = @{
        "Content-Type" = "application/json"
    }

    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" -Method POST -Body $loginData -Headers $headers -TimeoutSec 10
    
    Write-Host "✅ Login successful! Status: $($response.StatusCode)" -ForegroundColor Green
    $responseData = $response.Content | ConvertFrom-Json
    Write-Host "Token received: $($responseData.token.Substring(0, 50))..." -ForegroundColor Cyan
    
    # Save token for further tests
    $global:authToken = $responseData.token
    
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorResponse = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorResponse)
        $errorContent = $reader.ReadToEnd()
        Write-Host "Error details: $errorContent" -ForegroundColor Red
    }
}

# Test 3: Get Profile (if login was successful)
if ($global:authToken) {
    Write-Host "`n3. Testing Get Profile..." -ForegroundColor Yellow
    try {
        $headers = @{
            "Authorization" = "Bearer $global:authToken"
            "Content-Type" = "application/json"
        }

        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/pengguna/profil" -Method GET -Headers $headers -TimeoutSec 10
        
        Write-Host "✅ Profile retrieved! Status: $($response.StatusCode)" -ForegroundColor Green
        $profileData = $response.Content | ConvertFrom-Json
        Write-Host "User: $($profileData.data.nama_pengguna) ($($profileData.data.peran))" -ForegroundColor Cyan
        
    } catch {
        Write-Host "❌ Profile retrieval failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 4: Get Categories
if ($global:authToken) {
    Write-Host "`n4. Testing Get Categories..." -ForegroundColor Yellow
    try {
        $headers = @{
            "Authorization" = "Bearer $global:authToken"
            "Content-Type" = "application/json"
        }

        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/kategori" -Method GET -Headers $headers -TimeoutSec 10
        
        Write-Host "✅ Categories retrieved! Status: $($response.StatusCode)" -ForegroundColor Green
        $categoriesData = $response.Content | ConvertFrom-Json
        Write-Host "Found $($categoriesData.data.Count) categories" -ForegroundColor Cyan
        
    } catch {
        Write-Host "❌ Categories retrieval failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🏁 API Test Complete!" -ForegroundColor Green
Write-Host "`n📋 Next Steps:" -ForegroundColor Blue
Write-Host "1. Import database.sql ke MySQL" -ForegroundColor White
Write-Host "2. Pastikan .env file sudah benar" -ForegroundColor White
Write-Host "3. Test dengan frontend login page" -ForegroundColor White