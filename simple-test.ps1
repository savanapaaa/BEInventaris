# Test API sederhana
Write-Host "Testing API..." -ForegroundColor Green

# Test server health
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000" -Method GET -TimeoutSec 5
    Write-Host "Server OK: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Server Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test login
try {
    $body = '{"email":"admin@inventaris.com","kata_sandi":"admin123"}'
    $headers = @{"Content-Type"="application/json"}
    
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" -Method POST -Body $body -Headers $headers -TimeoutSec 5
    Write-Host "Login OK: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "Login Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host "Test selesai" -ForegroundColor Blue