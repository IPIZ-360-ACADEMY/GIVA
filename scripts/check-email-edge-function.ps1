param(
  [string]$Origin = "http://localhost:5173",
  [string]$Email = "admin@giva.ao",
  [string]$RedirectTo = "http://localhost:5173/GIVA/login"
)

$ErrorActionPreference = "Stop"

Push-Location "e:\Projectos\ipiz\GIVA"

$lines = Get-Content .env
$url = ($lines | Where-Object { $_ -match '^VITE_SUPABASE_URL=' } | Select-Object -First 1).Split('=')[1].Trim()
$publishable = ($lines | Where-Object { $_ -match '^VITE_SUPABASE_PUBLISHABLE_KEY=' } | Select-Object -First 1)
$anon = ($lines | Where-Object { $_ -match '^VITE_SUPABASE_ANON_KEY=' } | Select-Object -First 1)
$clientKey = if ($publishable) { $publishable.Split('=')[1].Trim() } elseif ($anon) { $anon.Split('=')[1].Trim() } else { "" }

if ([string]::IsNullOrWhiteSpace($clientKey)) {
  Write-Host "Missing VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY in .env"
  Pop-Location
  exit 1
}

$fnUrl = "$url/functions/v1/send-account-email"
Write-Host "Function URL: $fnUrl"

$optHeaders = @{
  Origin = $Origin
  'Access-Control-Request-Method' = 'POST'
  'Access-Control-Request-Headers' = 'authorization,x-client-info,apikey,content-type'
}

try {
  $opt = Invoke-WebRequest -UseBasicParsing -Method Options -Uri $fnUrl -Headers $optHeaders
  Write-Host "OPTIONS status: $($opt.StatusCode)"
  Write-Host "OPTIONS allow-origin: $($opt.Headers['Access-Control-Allow-Origin'])"
} catch {
  if ($_.Exception.Response) {
    Write-Host "OPTIONS failed status: $($_.Exception.Response.StatusCode.value__)"
  } else {
    Write-Host "OPTIONS exception: $($_.Exception.Message)"
  }
}

$postHeaders = @{
  apikey = $clientKey
  Authorization = "Bearer $clientKey"
  'Content-Type' = 'application/json'
  Origin = $Origin
}

$body = @{
  purpose = "password-reset"
  email = $Email
  redirectTo = $RedirectTo
} | ConvertTo-Json -Compress

try {
  $post = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $fnUrl -Headers $postHeaders -Body $body
  Write-Host "POST status: $($post.StatusCode)"
  Write-Host "POST body: $($post.Content)"
  Write-Host "POST allow-origin: $($post.Headers['Access-Control-Allow-Origin'])"
} catch {
  if ($_.Exception.Response) {
    $resp = $_.Exception.Response
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $content = $reader.ReadToEnd()
    Write-Host "POST failed status: $($resp.StatusCode.value__)"
    Write-Host "POST failed body: $content"
  } else {
    Write-Host "POST exception: $($_.Exception.Message)"
  }
}

Pop-Location
