# Java Injeto 0.3.0

- Corrigida instalacao Windows do ZombieBuddy: revisao de ZombieBuddy.jar + zbNative.dll originais da Workshop e ativacao unica por agentpath, com policy=prompt preservado.
- Copia do par para a raiz do PZ com backup dos arquivos anteriores, hashes, journal e rollback em falha. Restauracao repoe originais ou remove somente as novas copias. Alteracoes externas e JAR.new pendente bloqueiam operacao automatica.
- Perfis antigos sem DLL exigem nova revisao. Viewpoint permanece na Workshop; instalacao nao equivale a autorizacao pelo ZombieBuddy.
- Detalhes Viewpoint esclarecem autorizacao e teclas O / Shift+O. Nenhuma permissao e apagada ou liberada automaticamente.
- Configuracoes > Atualizacoes: consulta manual/opcional ao abrir, releases estaveis do GitHub fixo, download com progresso/cancelamento, SHA-256 e confirmacao separada de instalacao.
- Auxiliar C# espera a saida do aplicativo, revalida o instalador e abre o assistente sem CMD. Preserva AppData, runtime e backups; nunca inicia o PZ.
- Portatil pode migrar para edicao instalada pelo atualizador; a copia portatil antiga nao e substituida. Mods continuam sendo atualizados pela Workshop.
- Testes de agentes agora verificam classes reais do PZ, encoding e logs redirecionados, inclusive Skinwalker corrigido 0.3.3 combinado com ponte nativa oficial ZombieBuddy.
- Sem certificado Windows. Hash verifica integridade, nao seguranca ou autoria. Gameplay SP/MP e VOIP ainda precisam de homologacao manual.
