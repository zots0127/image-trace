; Image Trace NSIS Custom Installer Script
; This file is included by electron-builder during Windows NSIS packaging.

!macro customInstall
  ; Silently install VC++ Redistributable (required by Python/OpenCV backend)
  ; The file is placed in build/ by CI or manually by dev
  IfFileExists "$INSTDIR\resources\vc_redist.x64.exe" 0 +2
    ExecWait '"$INSTDIR\resources\vc_redist.x64.exe" /install /quiet /norestart'
!macroend

!macro customUnInstall
  ; No custom uninstall steps needed
!macroend
