using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace Organic
{
    // Executor recebido como argumento permite testar restauracao sem alterar o Windows.
    internal static class PowerSession
    {
        static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        static string FileName(string root) { return Path.Combine(root, "power.json"); }
        static string Active(Func<string, string> run)
        {
            var match = Regex.Match(run("/getactivescheme"), @"[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}");
            if (!match.Success) throw new IOException("Plano original desconhecido.");
            return match.Value.ToLowerInvariant();
        }
        public static void Start(string root, string profile, Func<string, string> run)
        {
            string file = FileName(root);
            if (File.Exists(file)) throw new IOException("Recupere a sessao de energia anterior.");
            string original = Active(run), created = Guid.NewGuid().ToString();
            // O original nunca e editado: todas as alteracoes pertencem a uma copia.
            File.WriteAllText(file, Json.Serialize(new { original, created }), new UTF8Encoding(false));
            run("/duplicatescheme " + original + " " + created);
            run("/changename " + created + " \"Java Injeto Session\"");
            run("/setacvalueindex " + created + " SUB_PROCESSOR PROCTHROTTLEMIN " + (profile == "performance" ? "20" : "5"));
            run("/setacvalueindex " + created + " SUB_PROCESSOR PROCTHROTTLEMAX " + (profile == "economy" ? "85" : "100"));
            run("/setactive " + created);
        }
        public static void Restore(string root, Func<string, string> run)
        {
            string file = FileName(root);
            if (!File.Exists(file)) return;
            if (new FileInfo(file).Length > 4096 || (File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0) throw new IOException("Registro de energia invalido.");
            var data = Json.Deserialize<Dictionary<string, string>>(File.ReadAllText(file)); Guid original, created;
            if (data == null || !data.ContainsKey("original") || !data.ContainsKey("created") || !Guid.TryParse(data["original"], out original)
                || !Guid.TryParse(data["created"], out created) || original == created) throw new IOException("Registro de energia invalido.");
            string line = run("/list").Split('\n').FirstOrDefault(value => value.IndexOf(created.ToString(), StringComparison.OrdinalIgnoreCase) >= 0);
            if (line != null)
            {
                if (!line.Contains("Java Injeto Session")) throw new IOException("Plano nao identificado como temporario. Registro preservado para revisao.");
                if (Active(run) == created.ToString()) run("/setactive " + original);
                run("/delete " + created);
            }
            File.Delete(file);
        }
    }
}
