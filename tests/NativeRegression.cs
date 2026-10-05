using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;
using Organic;

internal static class NativeRegression
{
    sealed class FakePower
    {
        public string original = Guid.NewGuid().ToString(), active, fail;
        public Dictionary<string, string> plans = new Dictionary<string, string>();
        public List<string> commands = new List<string>();
        public FakePower() { active = original; plans.Add(original, "Meu plano original"); }
        public string Run(string text)
        {
            commands.Add(text); string[] args = text.Split(' ');
            if (text == "/getactivescheme") return active;
            if (text == "/list") return String.Join("\n", plans.Select(p => p.Key + " (" + p.Value + ")"));
            if (fail != null && args[0] == fail) throw new IOException("Falha simulada");
            if (args[0] == "/duplicatescheme") plans.Add(args[2], plans[args[1]]);
            else if (args[0] == "/changename") plans[args[1]] = "Java Injeto Session";
            else if (args[0] == "/setactive") { Check(plans.ContainsKey(args[1]), "Plano existe"); active = args[1]; }
            else if (args[0] == "/delete") { Check(args[1] != active && args[1] != original, "Nao remove plano ativo/original"); plans.Remove(args[1]); }
            else if (args[0] == "/setacvalueindex") Check(args[1] != original, "Nao modifica plano original");
            return "";
        }
    }
    static void Check(bool value, string description) { if (!value) throw new Exception(description); }
    static void Reject(Action action) { try { action(); } catch (IOException) { return; } throw new Exception("Deveria recusar registro adulterado"); }
    static int Main(string[] args)
    {
        string root = args[0]; Directory.CreateDirectory(root);
        try {
            var power = new FakePower(); PowerSession.Start(root, "performance", power.Run);
            Check(power.active != power.original && power.commands.Any(c => c.EndsWith("PROCTHROTTLEMIN 20")), "Perfil performance");
            PowerSession.Restore(root, power.Run); Check(power.active == power.original && power.plans.Count == 1, "Restaura original e remove apenas copia");
            power = new FakePower(); PowerSession.Start(root, "economy", power.Run);
            string manual = Guid.NewGuid().ToString(); power.plans.Add(manual, "Escolha manual"); power.active = manual;
            PowerSession.Restore(root, power.Run); Check(power.active == manual && power.plans.Count == 2, "Preserva escolha manual durante sessao");
            power = new FakePower { fail = "/setacvalueindex" }; Reject(() => PowerSession.Start(root, "balanced", power.Run));
            PowerSession.Restore(root, power.Run); Check(power.active == power.original && power.plans.Count == 1, "Recupera falha parcial");
            power = new FakePower(); string file = Path.Combine(root, "power.json");
            File.WriteAllText(file, new JavaScriptSerializer().Serialize(new { original = power.original, created = power.original }));
            Reject(() => PowerSession.Restore(root, power.Run)); Check(power.commands.Count == 0, "Registro adulterado nao executa comandos");
            File.Delete(file);
            Console.WriteLine("PASS: 4 cenarios C# de energia com Windows simulado."); return 0;
        } catch (Exception e) { Console.Error.WriteLine(e); return 1; }
    }
}
