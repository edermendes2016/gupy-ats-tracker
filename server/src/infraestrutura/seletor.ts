// Seletores nativos. Só existem no Windows (PowerShell); nas outras plataformas
// a interface pede o caminho digitado.
import { execFile } from "node:child_process";

function rodarPowerShell(script: string): Promise<string | null> {
  return new Promise((resolve, reject) =>
    execFile("powershell", ["-NoProfile", "-STA", "-Command", script], (erro, saida) =>
      erro ? reject(erro) : resolve(saida.trim() || null),
    ),
  );
}

export function escolherXlsxWindows(): Promise<string | null> {
  return rodarPowerShell(
    "Add-Type -AssemblyName System.Windows.Forms; " +
      "$d = New-Object System.Windows.Forms.OpenFileDialog; " +
      "$d.Filter = 'Planilha Excel (*.xlsx)|*.xlsx'; " +
      "if ($d.ShowDialog() -eq 'OK') { Write-Output $d.FileName }",
  );
}

/** Caixa "Escolher pasta" do Windows. Devolve o caminho da pasta ou null se cancelada. */
export function escolherPastaWindows(): Promise<string | null> {
  return rodarPowerShell(
    "Add-Type -AssemblyName System.Windows.Forms; " +
      "$d = New-Object System.Windows.Forms.FolderBrowserDialog; " +
      "$d.Description = 'Escolha a pasta onde criar a planilha'; " +
      "$d.ShowNewFolderButton = $true; " +
      "if ($d.ShowDialog() -eq 'OK') { Write-Output $d.SelectedPath }",
  );
}
