; Hook do instalador (electron-builder → nsis.include).
; Windows "N" vem sem o Media Feature Pack: sem ele áudio/vídeo podem falhar.
; O instalador detecta e oferece instalar (o Windows pede permissão de administrador).
; Se o usuário recusar, o app oferece o mesmo botão em "Verificar se está tudo pronto".
!macro customInstall
  IfSilent luzo_media_done
  ; Instalador é 32 bits: $SYSDIR aponta para SysWOW64, que também não tem mfplat.dll no Windows N.
  IfFileExists "$SYSDIR\mfplat.dll" luzo_media_done
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "Este Windows é uma edição $\"N$\" e não tem o Media Feature Pack, necessário para transmitir o áudio e o vídeo.$\r$\n$\r$\nInstalar agora? (leva alguns minutos e pode pedir para reiniciar)" IDNO luzo_media_done
    ; Sysnative = DISM de 64 bits (o de 32 bits não serve um Windows de 64 bits).
    ExecShellWait "runas" "$WINDIR\Sysnative\dism.exe" "/Online /Add-Capability /CapabilityName:Media.MediaFeaturePack~~~~0.0.1.0 /NoRestart" SW_SHOW
  luzo_media_done:
!macroend
