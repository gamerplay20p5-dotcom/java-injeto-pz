using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Management;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

namespace Organic
{
    internal static class Helper
    {
        static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 131072 };
        static readonly string[] Allowed = { "Spotify", "Teams", "ms-teams", "chrome", "msedge", "firefox", "brave", "opera" };
        [StructLayout(LayoutKind.Sequential)] struct Memory { public uint length, load; public ulong total, available, pageTotal, pageAvailable, virtualTotal, virtualAvailable, extended; }
        [StructLayout(LayoutKind.Sequential)] struct Power { public byte ac, flag, percent, status; public uint lifetime, full; }
        [DllImport("kernel32.dll")] static extern bool GlobalMemoryStatusEx(ref Memory value);
        [DllImport("kernel32.dll")] static extern bool GetSystemPowerStatus(out Power value);
        static Memory Ram() { var value = new Memory { length = (uint)Marshal.SizeOf(typeof(Memory)) }; if (!GlobalMemoryStatusEx(ref value)) throw new IOException("RAM indisponivel."); return value; }
        static void Print(object value) { Console.OutputEncoding = new UTF8Encoding(false); Console.WriteLine(Json.Serialize(value)); }
        static void Query(string scope, string query, Action<ManagementObject> visit)
        {
            try { using (var search = new ManagementObjectSearcher(scope, query)) { search.Options.Timeout = TimeSpan.FromSeconds(3); using (var rows = search.Get()) foreach (ManagementObject row in rows) using (row) visit(row); } } catch { }
        }
        static object Hardware()
        {
            var ram = Ram(); string cpu = "Nao identificado"; var gpus = new List<string>(); var disks = new List<string>();
            Query("root\\cimv2", "SELECT Name FROM Win32_Processor", row => cpu = Convert.ToString(row["Name"]).Trim());
            Query("root\\cimv2", "SELECT Name FROM Win32_VideoController", row => gpus.Add(Convert.ToString(row["Name"])));
            Query("root\\Microsoft\\Windows\\Storage", "SELECT FriendlyName,MediaType FROM MSFT_PhysicalDisk", row => disks.Add(Convert.ToString(row["FriendlyName"]) + (Convert.ToInt32(row["MediaType"]) == 4 ? " (SSD)" : Convert.ToInt32(row["MediaType"]) == 3 ? " (HDD)" : " (tipo nao informado)")));
            Power power; bool known = GetSystemPowerStatus(out power) && power.ac != 255;
            return new { cpu, threads = Environment.ProcessorCount, gpus, disks, ramGb = Math.Round(ram.total / 1073741824.0, 1), availableGb = Math.Round(ram.available / 1073741824.0, 1), onBattery = known && power.ac == 0, powerKnown = known };
        }
        static List<Process> Games(string game)
        {
            game = Path.GetFullPath(game).TrimEnd('\\') + "\\"; var result = new List<Process>(); int session = Process.GetCurrentProcess().SessionId;
            foreach (string name in new[] { "ProjectZomboid64", "ProjectZomboid32", "java", "javaw" }) foreach (var process in Process.GetProcessesByName(name))
            {
                bool retain = false;
                try {
                    if (process.SessionId != session || !process.MainModule.FileName.StartsWith(game, StringComparison.OrdinalIgnoreCase)) continue;
                    if (name.StartsWith("java")) {
                        bool client = false, queried = false;
                        Query("root\\cimv2", "SELECT CommandLine FROM Win32_Process WHERE ProcessId=" + process.Id, row => { queried = row["CommandLine"] != null; client = Convert.ToString(row["CommandLine"]).Contains("zombie.gameStates.MainScreenState"); });
                        if (!queried && !process.HasExited) throw new IOException("Windows nao permitiu verificar o processo Java. Feche o PZ antes de alterar arquivos.");
                        if (!client) continue;
                    }
                    result.Add(process); retain = true;
                } catch (System.ComponentModel.Win32Exception) {
                    foreach (var item in result) item.Dispose();
                    throw new IOException("Nao foi possivel verificar os processos do PZ. Feche o jogo antes de alterar arquivos.");
                } catch (InvalidOperationException) { } finally { if (!retain) process.Dispose(); }
            }
            return result;
        }
        static bool Running(string game) { var games = Games(game); try { return games.Count > 0; } finally { foreach (var item in games) item.Dispose(); } }
        static object Processes()
        {
            var result = new List<object>(); int session = Process.GetCurrentProcess().SessionId;
            foreach (var p in Process.GetProcesses()) using (p) try {
                if (p.SessionId == session && Allowed.Contains(p.ProcessName, StringComparer.OrdinalIgnoreCase) && p.MainWindowHandle != IntPtr.Zero)
                    result.Add(new { pid = p.Id, name = p.ProcessName, memoryMb = p.WorkingSet64 / 1048576, started = p.StartTime.ToUniversalTime().Ticks.ToString() });
            } catch { }
            return new { processes = result };
        }
        static object Close(int pid, string started)
        {
            using (var p = Process.GetProcessById(pid)) {
                if (p.SessionId != Process.GetCurrentProcess().SessionId || !Allowed.Contains(p.ProcessName, StringComparer.OrdinalIgnoreCase)
                    || p.StartTime.ToUniversalTime().Ticks.ToString() != started) throw new IOException("Processo mudou ou nao e permitido.");
                return new { requested = p.CloseMainWindow() };
            }
        }
        static string Root(string root)
        {
            root = Path.GetFullPath(root);
            if (Path.GetFileName(root) != "optimizer") throw new IOException("Pasta do otimizador invalida.");
            Directory.CreateDirectory(root);
            if ((File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) throw new IOException("Links nao permitidos.");
            return root;
        }
        static void Write(string file, object value)
        {
            string temporary = file + ".tmp";
            File.WriteAllText(temporary, Json.Serialize(value), new UTF8Encoding(false));
            if (File.Exists(file)) File.Replace(temporary, file, null); else File.Move(temporary, file);
        }
        static string PowerCfg(string args)
        {
            using (var p = Process.Start(new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "powercfg.exe"), args) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true })) {
                var output = p.StandardOutput.ReadToEndAsync(); var error = p.StandardError.ReadToEndAsync();
                if (!p.WaitForExit(6000)) { p.Kill(); throw new IOException("Tempo excedido no plano de energia."); }
                if (p.ExitCode != 0) throw new IOException("Windows nao permitiu ajustar energia. " + error.Result.Trim());
                return output.Result;
            }
        }
        static void StartPower(string root, string profile)
        {
            Power power;
            if (!GetSystemPowerStatus(out power) || power.ac != 1) throw new IOException("Energia temporaria somente na tomada.");
            PowerSession.Start(root, profile, PowerCfg);
        }
        static void RestorePower(string root)
        {
            PowerSession.Restore(root, PowerCfg);
        }
        sealed class Tracked : IDisposable
        {
            public Process process; public ProcessPriorityClass original, assigned; public bool changed;
            public void Dispose() { try { if (changed && !process.HasExited && process.PriorityClass == assigned) process.PriorityClass = original; } catch { } process.Dispose(); }
        }
        static string MutexName(string root) { using (var sha = SHA256.Create()) return "Local\\JavaInjetoOptimizer-" + BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(root.ToLowerInvariant()))).Replace("-", ""); }
        static object Stop(string root)
        {
            root = Root(root); File.WriteAllText(Path.Combine(root, "stop"), "stop");
            using (var mutex = new Mutex(false, MutexName(root))) {
                bool owns = false;
                try { try { owns = mutex.WaitOne(0); } catch (AbandonedMutexException) { owns = true; }
                    if (owns) { RestorePower(root); Write(Path.Combine(root, "status.json"), new { status = "idle" }); }
                } finally { if (owns) mutex.ReleaseMutex(); }
                return new { status = owns ? "idle" : "stopping" };
            }
        }
        static void Watch(string game, string root, string profile, bool priority, bool power, bool monitor)
        {
            root = Root(root); game = Path.GetFullPath(game);
            if (!File.Exists(Path.Combine(game, "ProjectZomboid64.json")) || !new[] { "balanced", "performance", "economy" }.Contains(profile)) throw new IOException("Configuracao de sessao invalida.");
            using (var mutex = new Mutex(false, MutexName(root))) {
                bool owns; try { owns = mutex.WaitOne(0); } catch (AbandonedMutexException) { owns = true; } if (!owns) return;
                var tracked = new Dictionary<string, Tracked>(); bool seen = false, powerStarted = false; string warning = null; var timeout = DateTime.UtcNow.AddMinutes(30);
                try {
                    RestorePower(root);
                    while (!File.Exists(Path.Combine(root, "stop")) && DateTime.UtcNow < timeout) {
                        foreach (string key in tracked.Keys.ToArray()) {
                            bool exited; try { exited = tracked[key].process.HasExited; } catch { exited = true; }
                            if (exited) { tracked[key].Dispose(); tracked.Remove(key); }
                        }
                        var games = Games(game); bool live = games.Count > 0; long resident = 0;
                        foreach (var p in games) {
                            bool retained = false;
                            try {
                                resident += p.WorkingSet64; string key = p.Id + ":" + p.StartTime.ToUniversalTime().Ticks;
                                if (!tracked.ContainsKey(key)) {
                                    var t = new Tracked { process = p }; tracked.Add(key, t); retained = true;
                                    if (priority) try { t.original = p.PriorityClass; t.assigned = profile == "performance" ? ProcessPriorityClass.AboveNormal : ProcessPriorityClass.Normal;
                                        if (t.original == ProcessPriorityClass.Normal || t.original == ProcessPriorityClass.BelowNormal) { p.PriorityClass = t.assigned; t.changed = true; }
                                    } catch { warning = "Windows nao permitiu alterar prioridade."; }
                                }
                            } catch { } finally { if (!retained) p.Dispose(); }
                        }
                        if (live) {
                            timeout = DateTime.UtcNow.AddSeconds(30); seen = true;
                            if (power && !powerStarted) { powerStarted = true; try { StartPower(root, profile); } catch (Exception e) { warning = e.Message; } }
                            // Reverte energia imediatamente ao retirar a tomada.
                            Power source; if (power && (!GetSystemPowerStatus(out source) || source.ac != 1)) RestorePower(root);
                        }
                        var memory = Ram();
                        Write(Path.Combine(root, "status.json"), new { status = live ? "active" : "watching", pid = Process.GetCurrentProcess().Id,
                            updatedAt = DateTime.UtcNow.ToString("o"), availableGb = Math.Round(memory.available / 1073741824.0, 2), gameMb = resident / 1048576,
                            helperMb = Process.GetCurrentProcess().WorkingSet64 / 1048576,
                            pressure = monitor && memory.available < Math.Max(1073741824UL, memory.total / 10), warning });
                        if (seen && !live && DateTime.UtcNow >= timeout) break;
                        // Sem loop por frame e sem interface Chromium no segundo plano.
                        for (int i = 0; i < 20 && !File.Exists(Path.Combine(root, "stop")); i++) Thread.Sleep(500);
                    }
                } finally {
                    foreach (var t in tracked.Values) t.Dispose();
                    try { RestorePower(root); } catch (Exception e) { warning = e.Message; }
                    Write(Path.Combine(root, "status.json"), new { status = warning == null ? "idle" : "warning", warning }); mutex.ReleaseMutex();
                }
            }
        }
        static int Main(string[] args)
        {
            try {
                if (args.Length == 1 && args[0] == "--hardware") Print(Hardware());
                else if (args.Length == 2 && args[0] == "--running") Print(new { running = Running(args[1]) });
                else if (args.Length == 1 && args[0] == "--processes") Print(Processes());
                else if (args.Length == 3 && args[0] == "--close") Print(Close(int.Parse(args[1]), args[2]));
                else if (args.Length == 2 && args[0] == "--stop") Print(Stop(args[1]));
                else if (args.Length == 7 && args[0] == "--watch") Watch(args[1], args[2], args[3], bool.Parse(args[4]), bool.Parse(args[5]), bool.Parse(args[6]));
                else throw new ArgumentException("Comando invalido.");
                return 0;
            } catch (Exception e) { Print(new { error = e.Message }); return 1; }
        }
    }
}
