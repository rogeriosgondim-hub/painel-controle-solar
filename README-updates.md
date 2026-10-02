# Painel e Android 2.8.2 — carregamento corrigido

O Android usa uma origem HTTPS virtual atendida somente pelos arquivos locais do APK ou pelo HTML com assinatura verificada. A primeira abertura lê os dados na origem file original, guarda uma cópia de migração criptografada pelo Keystore e transfere os registros para a nova origem. Credenciais antigas em texto aberto são retiradas da origem anterior depois que a cópia protegida é gravada. A migração não requer internet e não substitui dados que já existam na nova origem. A versão exibida precisa corresponder ao manifesto; divergência mantém a cópia offline e não informa atualização concluída.

Instalar o APK 2.8.2 por cima do anterior, sem desinstalar. As versões anteriores não conseguem aplicar esta correção do carregamento nativo. Publicações compatíveis futuras usam minNativeVersionCode 12.

# Painel 2.8.1 — correção de acesso à nuvem

O APK 2.8.0 permanece compatível (código nativo 11). No Android, o botão Desbloquear usa o cofre nativo. No navegador, distingue ausência de credenciais de falha ao abrir pela senha. Reconfigurar acesso preserva os registros e a configuração anterior; o token e a senha são conferidos na nuvem antes de gravar novas credenciais. Mostrar senha facilita conferir o preenchimento. Não é necessário instalar outro APK: Sobre → Buscar atualização → Aplicar atualização.

# Versão 2.8.0 — 02/10/2026

Criador do projeto: Rogerio Sampaio.

Instale o APK por cima da versão anterior, sem desinstalar. A assinatura, o pacote, a origem file:///android_asset/index.html e as chaves de armazenamento são mantidos. Exporte um backup antes de atualizar.

## Proteções implementadas

- Validação dos registros antes de restaurar backup, carregar armazenamento e aplicar sincronização. Conteúdo exibido é escapado; identificadores, números e datas são verificados.
- Política CSP com hash do script principal, sem manipuladores inline nem eval. A biblioteca Excel permanece local para uso offline.
- Backup JSON opcional com senha, AES-256-GCM, sal/IV aleatórios e PBKDF2-SHA256 com 600.000 iterações. Senhas não podem ser recuperadas. Backup JSON antigo continua compatível. Credenciais nunca entram no backup dos registros.
- No Android, token e senha da nuvem são criptografados com chave AES do Android Keystore. Backup automático Android desabilitado; backup manual continua disponível. Não há garantia contra aparelho ou processo comprometido.
- No navegador, token criptografado pela senha existente de sincronização; senha fica apenas na memória da sessão. Após reabrir, use Nuvem → Desbloquear sincronização. Credenciais antigas são migradas após a proteção ser gravada com sucesso.
- Criptografia da nuvem compatível com envelopes anteriores de 150.000 iterações; novas gravações usam 600.000. Limites de tamanho e derivação impedem envelopes excessivos. Use a mesma senha nos aparelhos.
- Atualização do painel Android exige assinatura RSA/SHA-256 pela chave permanente do APK, além do hash do HTML. Manifesto e cache são verificados antes de aplicar. HTTPS sem redirecionamentos. Falha conserva o painel offline.
- Publicação Pages inclui apenas index.html, vendor e manifesto assinado. Valores pessoais foram retirados dos padrões e exemplos publicados; registros existentes não são substituídos. Versões históricas do Git podem reter dados anteriores.

## Publicação de futuras versões

Atualizar versão/data e revision em panel-update.json. Manter minNativeVersionCode 11 para mudanças compatíveis. A publicação Pages recalcula o hash e assina o payload com os secrets da assinatura permanente; eles não entram no artefato público. Mudanças na ponte Android exigem APK novo. O painel incluído no APK deve ser igual ao index.html publicado. Recalcular o hash CSP ao modificar o script principal.

## Administração pendente

Consulte SECURITY.md. A proteção da branch exige que o titular configure o GitHub. A assinatura dos painéis não substitui a proteção do repositório e da conta: a automação assina o conteúdo aprovado na main.
