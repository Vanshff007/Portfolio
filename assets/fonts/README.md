# Fonts

Self-hosted latin subsets of two variable fonts, both under the SIL Open Font License 1.1:

- `syne-latin.woff2`: [Syne](https://github.com/bonjour-monde/syne-typeface) by Bonjour Monde
- `jetbrains-mono-latin.woff2`: [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) by JetBrains

Downloaded from Google Fonts, then trimmed with fontTools to the characters and weights the site uses (Syne 700–800, JetBrains Mono 400–700). Hosting them with the site avoids two extra connections (fonts.googleapis.com and fonts.gstatic.com) before the hero text can render.
