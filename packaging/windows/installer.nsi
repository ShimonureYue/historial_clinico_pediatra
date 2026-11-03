; Instalador de Historia Clinica Pediatrica para Windows 10/11.
; Lo compila scripts/build_installer.py (no se usa directo), que define:
;   VERSION, VERSION_NUMERIC, STAGING (carpeta con python/ y app/), OUTFILE
;
; Se instala por usuario (sin pedir permisos de administrador) en
; %LOCALAPPDATA%\Programs\HistorialPediatrico. Los datos viven aparte, en
; %LOCALAPPDATA%\HistorialPediatrico, y ni la instalacion ni la
; desinstalacion los tocan. Correr un Setup nuevo encima = actualizar.

Unicode true
SetCompressor /SOLID lzma
RequestExecutionLevel user
ManifestDPIAware true

!define APP_NAME "Historia Clínica Pediátrica"   ; = TITLE en launcher.pyw
!define APP_ID "HistorialPediatrico"
!define EXE "HistorialPediatrico.exe"
!define DATA_DIR "$LOCALAPPDATA\${APP_ID}"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"

Name "${APP_NAME}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP_ID}"
BrandingText "${APP_NAME} ${VERSION}"

!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ICON "${STAGING}/app/icon.ico"
!define MUI_UNICON "${STAGING}/app/icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "Se instalará ${APP_NAME} ${VERSION}.$\r$\n$\r$\nSi ya tenías una versión instalada, solo se actualiza el programa: la base de datos y los respaldos no se modifican.$\r$\n$\r$\nPresiona Siguiente para continuar."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Abrir ${APP_NAME}"
!define MUI_FINISHPAGE_RUN_FUNCTION AbrirPrograma

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

VIProductVersion "${VERSION_NUMERIC}"
VIAddVersionKey /LANG=${LANG_SPANISH} "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=${LANG_SPANISH} "FileDescription" "Instalador de ${APP_NAME}"
VIAddVersionKey /LANG=${LANG_SPANISH} "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_SPANISH} "FileVersion" "${VERSION}"

; Los archivos del programa no se pueden reemplazar mientras esta abierto.
!macro CERRAR_SI_ESTA_ABIERTO un
Function ${un}CerrarSiEstaAbierto
  revisar:
    FindWindow $0 "" "${APP_NAME}"
    StrCmp $0 0 listo
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "${APP_NAME} está abierto.$\n$\nCiérralo y presiona Reintentar." /SD IDCANCEL IDRETRY revisar
    Abort
  listo:
FunctionEnd
!macroend
!insertmacro CERRAR_SI_ESTA_ABIERTO ""
!insertmacro CERRAR_SI_ESTA_ABIERTO "un."

Function AbrirPrograma
  ExecShell "open" "$SMPROGRAMS\${APP_NAME}.lnk"
FunctionEnd

Section
  SetShellVarContext current
  Call CerrarSiEstaAbierto

  ; Se reemplaza el programa completo para no dejar archivos de la version anterior
  RMDir /r "$INSTDIR\python"
  RMDir /r "$INSTDIR\app"
  SetOutPath "$INSTDIR"
  File /r "${STAGING}/python"
  File /r "${STAGING}/app"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"

  CreateDirectory "${DATA_DIR}"

  ; Carpeta de trabajo de los accesos directos
  SetOutPath "$INSTDIR\app"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\python\${EXE}" '"$INSTDIR\app\launcher.pyw"' "$INSTDIR\app\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}.lnk" "$INSTDIR\python\${EXE}" '"$INSTDIR\app\launcher.pyw"' "$INSTDIR\app\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\${APP_NAME} - Datos y respaldos.lnk" "${DATA_DIR}"

  ; Aparece en Configuracion > Aplicaciones instaladas
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\app\icon.ico"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Desinstalar.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" $0
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Call un.CerrarSiEstaAbierto

  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME} - Datos y respaldos.lnk"
  RMDir /r "$INSTDIR\python"
  RMDir /r "$INSTDIR\app"
  Delete "$INSTDIR\Desinstalar.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${UNINST_KEY}"

  IfSilent +2
    MessageBox MB_ICONINFORMATION "Se desinstaló el programa.$\n$\nLa base de datos y los respaldos se conservan en:$\n${DATA_DIR}"
SectionEnd
