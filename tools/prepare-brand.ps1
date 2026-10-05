param([string]$Logo)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$assets = Join-Path $root 'assets'
New-Item -ItemType Directory -Path $assets -Force | Out-Null
Add-Type -AssemblyName System.Drawing
if ($Logo) {
    $source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Logo).Path)
    try { $source.Save((Join-Path $assets 'Logo_Organic.png'), [System.Drawing.Imaging.ImageFormat]::Png) } finally { $source.Dispose() }
}
$image = [System.Drawing.Image]::FromFile((Join-Path $assets 'Logo_Organic.png'))
$stream = [System.IO.File]::Create((Join-Path $assets 'app.ico'))
$writer = New-Object System.IO.BinaryWriter($stream)
try {
    $data = @()
    foreach ($size in @(16, 32, 48, 64, 128, 256)) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $buffer = New-Object System.IO.MemoryStream
        try {
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($image, 0, 0, $size, $size)
            $bitmap.Save($buffer, [System.Drawing.Imaging.ImageFormat]::Png)
            $data += ,@{ Size = $size; Bytes = $buffer.ToArray() }
        } finally { $buffer.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
    }
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$data.Count)
    $offset = 6 + 16 * $data.Count
    foreach ($entry in $data) {
        $dimension = if ($entry.Size -eq 256) { 0 } else { $entry.Size }
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension); $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$entry.Bytes.Length); $writer.Write([uint32]$offset)
        $offset += $entry.Bytes.Length
    }
    foreach ($entry in $data) { $writer.Write([byte[]]$entry.Bytes) }
} finally { $writer.Dispose(); $image.Dispose() }
Write-Host 'Logo e icone preparados.'
