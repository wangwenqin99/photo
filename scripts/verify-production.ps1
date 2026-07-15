$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$node24 = "C:\Program Files\nvm\v24.9.0"
if (Test-Path -LiteralPath $node24) {
  $env:PATH = "$node24;$env:PATH"
}

$root = Split-Path $PSScriptRoot -Parent
$config = Join-Path $root "wrangler.deploy.jsonc"
$baseUrl = "https://shiguang-photo-album.476875372.workers.dev"
$sessionId = [guid]::NewGuid().ToString()
$albumId = $null
$tempPhoto = Join-Path ([IO.Path]::GetTempPath()) "album-production-verification.png"

$random = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($random)
$token = [Convert]::ToBase64String($random).TrimEnd("=").Replace("+", "-").Replace("/", "_")
$sha = [Security.Cryptography.SHA256]::Create()
$tokenHash = [Convert]::ToBase64String($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($token)))
$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$expires = $now + 3600000

Push-Location $root
try {
  $insertSql = "INSERT INTO admin_sessions (id, token_hash, expires_at, created_at) VALUES ('$sessionId', '$tokenHash', $expires, $now);"
  & npx wrangler d1 execute shiguang-photo-album-db --remote --config $config --command $insertSql | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create the temporary verification session." }

  $handler = New-Object Net.Http.HttpClientHandler
  $handler.AllowAutoRedirect = $true
  $handler.CookieContainer = New-Object Net.CookieContainer
  $handler.CookieContainer.Add([Uri]$baseUrl, (New-Object Net.Cookie("album_admin", $token)))
  $client = New-Object Net.Http.HttpClient($handler)

  $albumBody = New-Object Net.Http.StringContent('{"name":"Production verification"}', [Text.Encoding]::UTF8, "application/json")
  $albumResponse = $client.PostAsync("$baseUrl/api/albums", $albumBody).GetAwaiter().GetResult()
  $albumText = $albumResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if ([int]$albumResponse.StatusCode -ne 201) { throw "Album creation failed: $([int]$albumResponse.StatusCode) $albumText" }
  $albumId = ($albumText | ConvertFrom-Json).album.id

  $png = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=")
  [IO.File]::WriteAllBytes($tempPhoto, $png)
  $uploadResult = & curl.exe --silent --show-error --write-out "`n%{http_code}" --cookie "album_admin=$token" --form "files=@$tempPhoto;type=image/png" "$baseUrl/api/admin/albums/$albumId/photos"
  $uploadStatus = $uploadResult[-1]
  $uploadText = ($uploadResult[0..($uploadResult.Count - 2)] -join "`n")
  if ($uploadStatus -ne "201") { throw "Photo upload failed: $uploadStatus $uploadText" }
  $photoId = ($uploadText | ConvertFrom-Json).uploaded[0].id

  $imageResponse = $client.GetAsync("$baseUrl/api/photos/$photoId").GetAwaiter().GetResult()
  if ([int]$imageResponse.StatusCode -ne 200 -or $imageResponse.Content.Headers.ContentType.MediaType -notlike "image/*") {
    throw "Photo delivery failed: $([int]$imageResponse.StatusCode)"
  }

  Write-Output "Production verification passed: album create, Cloudinary upload, and image delivery are working."
}
finally {
  if ($albumId) {
    try { $client.DeleteAsync("$baseUrl/api/albums/$albumId").GetAwaiter().GetResult() | Out-Null } catch {}
  }
  Remove-Item -LiteralPath $tempPhoto -Force -ErrorAction SilentlyContinue
  $deleteSql = "DELETE FROM admin_sessions WHERE id = '$sessionId';"
  & npx wrangler d1 execute shiguang-photo-album-db --remote --config $config --command $deleteSql | Out-Null
  Pop-Location
}
