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

Write-Host "请依次输入 Cloudinary 配置。输入内容由 Wrangler 安全保存，不会写入项目文件。"
foreach ($secretName in $secretNames) {
  Write-Host "正在配置 $secretName"
  & npx wrangler secret put $secretName --config $config
  if ($LASTEXITCODE -ne 0) {
    throw "配置 $secretName 失败，请检查网络或重新登录 Cloudflare。"
  }
}

Write-Host "Cloudinary 配置完成，可以关闭此窗口。"
