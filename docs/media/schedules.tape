# Demo video for the README: `make media` renders it. Runs against the invented demo tenant, never a real one.
Output docs/media/schedules.gif
Output docs/media/schedules.mp4

Set Shell "bash"
Set FontSize 16
Set Width 1240
Set Height 400
Set Padding 24
Set Theme "Builtin Dark"
Set TypingSpeed 45ms
Set WindowBar Colorful

Hide
Type "export QCT_QLIK_BIN=tests/fixtures/fake-qlik.mjs QCT_CONFIG=examples/demo.config.json PS1='$ '" Enter
Type "clear" Enter
Show

Sleep 600ms
Type "node tools/schedules.mjs"
Sleep 500ms
Enter
Sleep 5s
