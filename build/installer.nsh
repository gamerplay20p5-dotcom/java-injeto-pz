!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Java Injeto - PZ"
  !define MUI_WELCOMEPAGE_TEXT "Instale o utilitario da Organic para revisar e configurar agentes Java com backup.$\r$\n$\r$\nEste instalador nao baixa mods, nao modifica o jogo e nao abre o Project Zomboid. Baixe os mods normalmente pela Workshop.$\r$\n$\r$\nA instalacao e local, para sua conta do Windows."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customInit
  ${If} ${isForAllUsers}
    MessageBox MB_OK|MB_ICONSTOP "Instale para sua conta do Windows, sem /allusers." /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Desinstalar Java Injeto"
  !define MUI_WELCOMEPAGE_TEXT "O aplicativo e os atalhos serao removidos. Configuracoes, backups e copias Java em AppData serao preservados.$\r$\n$\r$\nDesinstalar o utilitario NAO desfaz a injecao no jogo. Para reverter, feche o PZ e use Backup > Restaurar backup no aplicativo antes de continuar.$\r$\n$\r$\nSe ativou o Otimizador, use tambem Restaurar sessao."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

!macro customUnInit
  ; Os agentes podem continuar referenciados pelo JSON do jogo.
  ClearErrors
  ${GetParameters} $R0
  ${GetOptions} $R0 "--delete-app-data" $R1
  ${IfNot} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "A exclusao de AppData foi bloqueada para proteger agentes e backups. Restaure a injecao pelo aplicativo antes de remover os dados." /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend
