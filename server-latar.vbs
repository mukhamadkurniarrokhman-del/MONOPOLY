' Menjalankan server Monopoli Antariksa di latar belakang (tanpa jendela).
' Disalin ke folder Startup Windows agar otomatis menyala saat laptop hidup.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "D:\OPUS\space-monopoly"
sh.Run "cmd /c set NODE_ENV=production&& ""C:\Program Files\nodejs\node.exe"" server\src\index.js >> server.log 2>&1", 0, False
