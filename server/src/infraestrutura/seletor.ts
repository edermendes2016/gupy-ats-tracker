// Seletor nativo de arquivo. Só existe no Windows (PowerShell); nas outras plataformas
// a interface pede o caminho digitado.
import { execFile } from "node:child_process";

export function escolherXlsxWindows(): Promise<string | null> {
  const script =
    "Add-Type -AssemblyName System.Windows.Forms; " +
    "$d = New-Object System.Windows.Forms.OpenFileDialog; " +
    "$d.Filter = 'Planilha Excel (*.xlsx)|*.xlsx'; " +
    "if ($d.ShowDialog() -eq 'OK') { Write-Output $d.FileName }";
  return new Promise((resolve, reject) =>
    execFile("powershell", ["-NoProfile", "-STA", "-Command", script], (erro, saida) =>
      erro ? reject(erro) : resolve(saida.trim() || null),
    ),
  );
}
