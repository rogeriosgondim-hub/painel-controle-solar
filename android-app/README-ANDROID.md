# Controle Solar — Android v2.0

Aplicativo Android offline com sincronização opcional na nuvem via GitHub.

- Pacote: `br.com.controlesolar.residencia`
- Versão: 2.0
- Min SDK: Android 7.0 (API 24)
- Dados locais: armazenados no WebView do aplicativo
- Sincronização: branch `cloud-sync` do repositório GitHub
- Criptografia: AES-GCM com chave derivada por PBKDF2-SHA256
- Credenciais: token GitHub e senha de criptografia ficam somente no aparelho
- Backup JSON e exportação CSV: seletor nativo do Android
- Importação de backup: seletor nativo do Android

Para sincronizar entre celular e PC, configure em cada aparelho:
1. O mesmo repositório/branch.
2. Um token GitHub fine-grained com Contents: Read and write, restrito ao repositório.
3. A mesma senha de criptografia.
