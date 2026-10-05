$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$output = Join-Path $root 'native\bin'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Instale o .NET Framework Developer Pack para compilar o auxiliar C#.' }
& $compiler /nologo /target:exe /platform:x64 /optimize+ /r:System.Management.dll /r:System.Web.Extensions.dll /r:System.Core.dll ("/out:" + (Join-Path $output 'OrganicHelper.exe')) (Join-Path $root 'native\OrganicHelper.cs') (Join-Path $root 'native\PowerSession.cs')
if ($LASTEXITCODE -ne 0) { throw 'Falha na compilacao C#.' }
Write-Host 'Auxiliar C# compilado.'
