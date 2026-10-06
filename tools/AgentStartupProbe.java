import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class AgentStartupProbe {
    public static void main(String[] args) throws Exception {
        Path text = Path.of(args[0], "encoding-probe.txt");
        Files.writeString(text, "encoding initialized", StandardCharsets.UTF_8);
        if (!Files.readString(text).equals("encoding initialized")) throw new AssertionError("File encoding failure");
        PrintStream original = System.out;
        int[] redirected = {0};
        System.setOut(new PrintStream(original) {
            @Override public void println(String line) {
                if (line.startsWith("[Skinwalker]")) {
                    redirected[0]++;
                    // Simulate the game logger accessing IsoDeadBody while it is being defined.
                    try { Class.forName("zombie.iso.objects.IsoDeadBody", false, AgentStartupProbe.class.getClassLoader()); }
                    catch (ClassNotFoundException failure) { throw new AssertionError(failure); }
                }
                super.println(line);
            }
        });
        try {
            for (String name : new String[] {"zombie.core.skinnedmodel.visual.HumanVisual", "zombie.characters.IsoZombie", "zombie.iso.objects.IsoDeadBody"}) {
                Class<?> type = Class.forName(name, false, AgentStartupProbe.class.getClassLoader());
                if (type.getDeclaredMethods().length == 0) throw new AssertionError("Invalid transformed class");
            }
        } finally { System.setOut(original); }
        if (redirected[0] != 0) throw new AssertionError("Transformer used redirected console");
        System.out.println("PASS: engine classes verified, redirected logging bypassed, file encoding initialized; game not launched.");
    }
}
