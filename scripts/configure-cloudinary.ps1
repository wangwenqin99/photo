$ErrorActionPreference = "Stop"

$node24 = "C:\Program Files\nvm\v24.9.0"
if (Test-Path -LiteralPath $node24) {
  $env:PATH = "$node24;$env:PATH"
}

$config = Join-Path $PSScriptRoot "..\wrangler.deploy.jsonc"
$secretNames = @(
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET"
)

Write-Host "Enter the three Cloudinary values when prompted. Wrangler stores them as encrypted secrets."
foreach ($secretName in $secretNames) {
  Write-Host "Configuring $secretName"
  & npx wrangler secret put $secretName --config $config
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to configure $secretName. Check the network connection and Cloudflare login."
  }
}

Write-Host "Cloudinary configuration completed. You can close this window."
