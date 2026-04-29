$p = "src/utils/i18n.js"
$lines = [System.Collections.Generic.List[string]](Get-Content $p)

Write-Host "Current lines: $($lines.Count)"

# Find the 3 occurrences of min60 (0-based index)
$min60Indices = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '"settings\.security\.min60"') {
    $min60Indices += $i
  }
}
Write-Host "min60 indices: $($min60Indices -join ', ')"
if ($min60Indices.Count -ne 3) {
  Write-Host "ERROR: expected 3 min60 lines, got $($min60Indices.Count)"
  exit 1
}

$secPtBR = @(
  '    "settings.security.changePassword": "Alterar Password",',
  '    "settings.security.newPassword": "Nova password",',
  '    "settings.security.confirmPassword": "Confirmar password",',
  '    "settings.security.savePassword": "Alterar password",',
  '    "settings.security.passwordMismatch": "As passwords nao coincidem.",',
  '    "settings.security.passwordMinLength": "A password deve ter pelo menos 8 caracteres.",',
  '    "settings.security.passwordError": "Erro ao alterar password.",',
  '    "settings.security.passwordSaved": "Password alterada com sucesso.",',
  '    "settings.security.notAvailable": "Alteracao de password requer ligacao ao Supabase."'
)

$secPtPT = $secPtBR  # same text for ptPT

$secEn = @(
  '    "settings.security.changePassword": "Change Password",',
  '    "settings.security.newPassword": "New password",',
  '    "settings.security.confirmPassword": "Confirm password",',
  '    "settings.security.savePassword": "Change password",',
  '    "settings.security.passwordMismatch": "Passwords do not match.",',
  '    "settings.security.passwordMinLength": "Password must be at least 8 characters.",',
  '    "settings.security.passwordError": "Error changing password.",',
  '    "settings.security.passwordSaved": "Password changed successfully.",',
  '    "settings.security.notAvailable": "Password change requires Supabase connection."'
)

# Insert in reverse order (en first, then ptPT, then ptBR) to not shift indices
$insertSets = @(
  @{ idx = $min60Indices[2]; keys = $secEn },
  @{ idx = $min60Indices[1]; keys = $secPtPT },
  @{ idx = $min60Indices[0]; keys = $secPtBR }
)

foreach ($set in $insertSets) {
  $insertAt = $set.idx + 1
  for ($j = $set.keys.Count - 1; $j -ge 0; $j--) {
    $lines.Insert($insertAt, $set.keys[$j])
  }
}

# Now add profile keys: find settings.profile.save in each locale
# The file now has 3 occurrences of settings.profile.save
$profileSaveIndices = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '"settings\.profile\.save"') {
    $profileSaveIndices += $i
  }
}
Write-Host "profile.save indices: $($profileSaveIndices -join ', ')"

$profilePtBR = @(
  '    "settings.profile.loggedAs": "Sessao activa como",',
  '    "settings.profile.error": "Erro ao guardar perfil.",',
  '    "settings.profile.emailReadOnly": "Email gerido pelo Supabase Auth",'
)
$profilePtPT = $profilePtBR
$profileEn = @(
  '    "settings.profile.loggedAs": "Active session as",',
  '    "settings.profile.error": "Error saving profile.",',
  '    "settings.profile.emailReadOnly": "Email managed by Supabase Auth",'
)

if ($profileSaveIndices.Count -eq 3) {
  $profileSets = @(
    @{ idx = $profileSaveIndices[2]; keys = $profileEn },
    @{ idx = $profileSaveIndices[1]; keys = $profilePtPT },
    @{ idx = $profileSaveIndices[0]; keys = $profilePtBR }
  )
  foreach ($set in $profileSets) {
    $insertAt = $set.idx + 1
    for ($j = $set.keys.Count - 1; $j -ge 0; $j--) {
      $lines.Insert($insertAt, $set.keys[$j])
    }
  }
} else {
  Write-Host "WARN: profile.save count = $($profileSaveIndices.Count), skipping profile keys"
}

Set-Content $p $lines -Encoding UTF8
Write-Host "Done. Final lines: $($lines.Count)"
