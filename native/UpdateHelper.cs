using System;
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace Organic {
    // The launcher exits first; only the user-confirmed, verified NSIS installer is run.
    public static class UpdateHelper {
        public sealed class TaskInfo { public string file; public string hash; public long size; public int pid; public long createdAt; }
        static string Hash(string file) {
            using (var input = File.OpenRead(file)) using (var sha = SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(input)).Replace("-", "").ToLowerInvariant();
        }
        static void Regular(string file) {
            if ((File.GetAttributes(file) & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
                throw new IOException("Arquivo de atualizacao irregular.");
        }
        static TaskInfo Validate(string taskFile) {
            taskFile = Path.GetFullPath(taskFile);
            string root = Path.GetDirectoryName(taskFile);
            if (Path.GetFileName(root) != "updates" || !Regex.IsMatch(Path.GetFileName(taskFile), @"^[a-f0-9-]{36}\.task\.json$"))
                throw new IOException("Tarefa fora da pasta de atualizacoes.");
            if ((File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) throw new IOException("Pasta irregular.");
            Regular(taskFile);
            if (new FileInfo(taskFile).Length > 8192) throw new IOException("Tarefa grande demais.");
            var task = new JavaScriptSerializer().Deserialize<TaskInfo>(File.ReadAllText(taskFile));
            long now = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds;
            if (task == null || task.hash == null || !Regex.IsMatch(task.hash, "^[a-f0-9]{64}$") || task.pid <= 0
                || task.createdAt > now + 5000 || now - task.createdAt > 300000 || task.size < 10485760 || task.size > 268435456
                || Path.GetFullPath(task.file) != Path.Combine(root, task.hash + ".exe")) throw new IOException("Tarefa invalida ou expirada.");
            Regular(task.file);
            if (new FileInfo(task.file).Length != task.size || Hash(task.file) != task.hash) throw new IOException("Instalador adulterado.");
            using (var input = File.OpenRead(task.file)) if (input.ReadByte() != 77 || input.ReadByte() != 90) throw new IOException("Instalador invalido.");
            return task;
        }
        public static int Main(string[] args) {
            string taskFile = args.Length > 0 ? args[0] : null;
            bool validated = false;
            try {
                if (args.Length < 1 || args.Length > 2 || (args.Length == 2 && args[1] != "--validate-only")) throw new IOException("Comando invalido.");
                var task = Validate(taskFile);
                validated = true;
                if (args.Length == 2) return 0;
                try { using (var parent = Process.GetProcessById(task.pid)) if (!parent.WaitForExit(60000)) throw new IOException("Feche o Java Injeto para atualizar."); }
                catch (ArgumentException) { /* Parent already exited. */ }
                task = Validate(taskFile);
                var start = new ProcessStartInfo(task.file, "/currentuser") { UseShellExecute = false, CreateNoWindow = true };
                using (var installer = Process.Start(start)) {
                    installer.WaitForExit();
                    if (installer.ExitCode != 0) throw new IOException("Instalacao cancelada ou nao concluida.");
                }
                File.WriteAllText(Path.Combine(Path.GetDirectoryName(taskFile), "last-result.json"), "{\"status\":\"installed\"}");
                File.Delete(taskFile);
                return 0;
            } catch (Exception) {
                // No paths, account IDs, or console dumps are written to diagnostics.
                if (validated && taskFile != null && File.Exists(taskFile)) {
                    try { File.WriteAllText(Path.Combine(Path.GetDirectoryName(Path.GetFullPath(taskFile)), "last-result.json"), "{\"status\":\"failed\"}"); } catch { }
                }
                return 1;
            }
        }
    }
}
