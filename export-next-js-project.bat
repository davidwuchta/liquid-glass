@echo off
setlocal
cd /d "%~dp0"

echo Exporting project files...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-ChildItem -Recurse -File | Where-Object { " ^
  "  $_.FullName -notmatch '[\\/](\.next|\.git|node_modules|public|dist|out)[\\/]' -and " ^
  "  $_.Name -notmatch '^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|combined_project\.txt|export-project\.bat)$' -and " ^
  "  $_.Extension -match '^\.(tsx?|jsx?|css|json|mjs|fsh|vsh|glsl|properties)$' " ^
  "} | ForEach-Object { " ^
  "  \"=== FILE: $($_.FullName) ===`n\"; " ^
  "  Get-Content -LiteralPath $_.FullName; " ^
  "  \"`n`n\" " ^
  "} | Out-File -FilePath 'combined_project.txt' -Encoding utf8"

echo Done! Output saved to combined_project.txt.
timeout /t 2 >nul