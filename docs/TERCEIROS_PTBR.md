# Créditos e Bibliotecas

## Mods e Jogo

- Project Zomboid: The Indie Stone. O launcher é uma ferramenta independente, não um produto oficial.
- Steam e OpenID Steam: Valve. Não existe afiliação ou promessa de controle sobre a conta do usuário.
- Skinwalker: projeto Organic/DuckStudio; não é redistribuído por este launcher.
- ZombieBuddy: zed-0xff e colaboradores. [Código oficial](https://github.com/zed-0xff/ZombieBuddy), [Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3619862853).
- Viewpoint: seus autores e colaboradores indicados na publicação original. [Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3809306528).

Nenhum código-fonte, Lua, JAR ou DLL desses mods foi copiado para a distribuição. O aplicativo apenas encontra instalações existentes e, com autorização, prepara cópias dos agentes no computador do próprio usuário. Não assume autoria dos mods. As permissões/licenças dos autores continuam válidas.

## Dependências do Aplicativo

As versões exatas estão em `package.json` e `package-lock.json`; as licenças correspondentes permanecem nos pacotes e na distribuição Electron.

| Biblioteca | Uso | Licença declarada |
| --- | --- | --- |
| Electron | Janela desktop e APIs nativas | MIT, com componentes Chromium e avisos próprios |
| React / React DOM | Interface | MIT |
| Vite / plugin-react | Compilação e desenvolvimento | MIT |
| Lucide React | Ícones | ISC |
| adm-zip | Leitura de manifesto ZIP/JAR | MIT |
| vdf-parser | Bibliotecas Steam | MIT |
| electron-builder | Empacotamento Windows | MIT |
| Playwright | Testes da interface | Apache-2.0 |

Para distribuição pública, mantenha os avisos de licença Electron/Chromium e os avisos das dependências empacotadas. Assinatura de código e licenciamento comercial são decisões separadas; o primeiro executável ainda não tem certificado de editor.

## Referências Técnicas

- [Autenticação Steam/OpenID](https://partner.steamgames.com/doc/features/auth)
- [Segurança Electron](https://www.electronjs.org/docs/latest/tutorial/security)
- [Protocolo local Electron](https://www.electronjs.org/docs/latest/api/protocol)
- [Documentação Java: agentes de instrumentação](https://docs.oracle.com/en/java/javase/25/docs/api/java.instrument/java/lang/instrument/package-summary.html)

Foi usada a estrutura e documentação local dos mods para identificar seus caminhos e requisitos. Não afirmamos que a estratégia de launcher altere regras, licença ou suporte oficial de cada mod.

## Licença do Launcher

O código próprio do Java Injeto - PZ é publicado sob licença MIT, no arquivo `LICENSE` da raiz. Esse aviso acompanha o aplicativo empacotado. A permissão não se estende a arquivos do Project Zomboid, Steam ou mods listados no catálogo; seus autores e licenças continuam independentes.
