# Controle Solar — Android v2.6.3

Aplicativo Android offline com sincronização opcional na nuvem via GitHub.

- Pacote: `br.com.controlesolar.residencia`
- Versão: 2.6.3 (versionCode 9)
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

## Atualizar o app instalado

1. Antes de atualizar, sincronize os dados ou exporte um backup JSON no app atual.
2. Instale Controle-Solar-v2.6.3.apk sobre a versão anterior e escolha Atualizar. Não desinstale o app nem limpe seus dados.
3. Abra o app e confirme a versão 2.6.3 e a seção Relógio Enel.
4. Se houve lançamentos no link web, use a sincronização com o mesmo repositório e senha de criptografia para trazê-los ao app.

O pacote, a assinatura permanente, a origem file:///android_asset/index.html e as chaves de armazenamento local foram mantidos. A atualização acrescenta as leituras Enel à estrutura existente sem apagar os lançamentos mensais, produção diária ou Uso Inteligente.
