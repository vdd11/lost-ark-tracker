# Every check CI runs, in one go: backend lint + tests, frontend tests, types,
# lint and the static build. Run from anywhere: powershell -File scripts\check.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Step([string]$dir, [string]$exe, [string[]]$arguments) {
    Push-Location (Join-Path $root $dir)
    try {
        & $exe @arguments
        if ($LASTEXITCODE -ne 0) { throw "failed: $exe $($arguments -join ' ') (in $dir)" }
    } finally {
        Pop-Location
    }
}

$python = ".venv\Scripts\python.exe"
Write-Host "== backend: ruff + pytest"
Step "backend" $python @("-m", "ruff", "check", ".")
Step "backend" $python @("-m", "pytest", "-q")

Write-Host "== frontend: vitest, tsc, eslint, build"
Step "frontend" "npm.cmd" @("test")
Step "frontend" "npx.cmd" @("tsc", "--noEmit")
Step "frontend" "npm.cmd" @("run", "lint")
Step "frontend" "npm.cmd" @("run", "build")

# next build rewrites this file; it's never committed.
git -C $root checkout -- frontend/next-env.d.ts 2>$null
Write-Host "== all checks passed"
