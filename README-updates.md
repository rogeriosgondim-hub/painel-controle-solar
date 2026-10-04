# Painel 2.10.1 — captura no fechamento e edição do mês correto

Fotografia, seleção de imagem e câmera ao vivo no bloco Fechar o ciclo pela fatura. A revisão desse bloco mostra somente referência, datas, leituras e multiplicador.

Ao aplicar uma referência diferente, o reconhecimento pede confirmação e carrega o lançamento desse mês antes de aplicar somente os campos selecionados. Assim preserva geração, créditos e demais valores do mês de destino, sem renomear o mês anteriormente aberto. Uma referência nova abre um lançamento separado. Cancelar mantém o formulário e os dados salvos. O registro continua exigindo Salvar mês/Salvar alterações.

Painel 2.10.1, revisão 21002, compatível com Android 2.10.0/código 14: Sobre → Buscar atualização → Aplicar atualização. Nenhuma mudança de armazenamento, permissões ou assinatura.

Validação: `node test-ocr.cjs` e `node test-ocr-flow.cjs` (Playwright com Chromium). Testados transferência para mês existente, criação de referência nova, salvamento e reabertura, preservação dos valores não marcados, cancelamento, captura parcial e casas decimais do medidor. A câmera física continua dependendo do teste no aparelho.

# Refinamento visual do ciclo — painel 2.10.0, revisão 21001

Separa Fechar o ciclo pela fatura de Acompanhar o ciclo em andamento (opcional). Consumo calculado em destaque, botão com o valor exato a transferir, orientação conforme o campo ausente e lembrete de Salvar mês. Fórmula, compatibilidade das leituras 03 e detalhes completos ficam em expansões. O acompanhamento mostra consumo parcial e projeção como estimativa quando houver dados válidos. Mantém cálculo, confirmação de substituição, registros, OCR e sincronização.

Atualização compatível com Android 2.10.0/código 14: Sobre → Buscar atualização → Aplicar atualização. Não exige novo APK. A revisão do painel passa a 21001; as versões do painel e do Android permanecem 2.10.0.

# Painel e Android 2.10.0 — câmera e reconhecimento local

Lançamentos: Fotografar fatura, Câmera ao vivo e Selecionar foto. Reconhece datas, leituras, multiplicador, referência e total quando identificáveis. O reconhecimento não presume o multiplicador nem deriva consumos de números incertos. Campos ausentes podem ser preenchidos manualmente ou em outra foto da mesma fatura.

Relógio Enel: captura separada de 03/rede recebida e 103/energia injetada. Código ausente, divergente ou múltiplos números sem candidato claro não preselecionam leitura. As casas decimais devem ser conferidas no visor. O modo ao vivo apresenta o resultado após duas leituras consistentes e confiantes; também há Ler quadro agora e Conferir resultado atual. A câmera é encerrada ao sair da tela ou fechar.

Tela de conferência: imagem, texto reconhecido, valores corrigíveis e seleção individual de campos. Confirmação obrigatória antes de usar no formulário. Substituição de valores existentes exige confirmação. Nenhum registro é salvo pelo OCR; permanece necessário Salvar no formulário. Recortar, girar, restaurar a foto e reconhecer novamente ajudam em imagens difíceis. Fotos e texto ficam apenas em memória; foto da câmera Android usa arquivo temporário privado, removido após decodificação ou cancelamento.

Tesseract 6.0.1, core 6.0.0 e modelos rápidos por/eng são gerados por prepare-ocr.py com URLs imutáveis e integridade verificada em ocr-packages.json. Assets locais no site e no APK; fotos não são enviadas a serviços externos. No navegador, a primeira leitura exige carregar os arquivos. No APK, o motor e modelos estão incluídos para uso offline. A câmera ao vivo exige permissão e suporte do navegador/aparelho. Reconhecimento depende de foco, iluminação e enquadramento; resultado é sempre conferido.

Novo APK 2.10.0, código 14: instalar por cima do anterior, com a mesma assinatura permanente e pacote. Mantém dados, migração e credenciais protegidas. O manifesto do painel passa a exigir código 14 por depender dos novos assets e permissões nativas. Não desinstalar o app para atualizar. Runtime CAMERA restrito ao pedido de vídeo na origem HTTPS virtual confiável; nenhum áudio. Fotografia usa FileProvider limitado à pasta privada temporária da câmera, sem permissão de galeria.

Validação: testes de parsing/cálculo/ambiguidade, casas decimais e ausência de salvamento automático; teste Android de OCR WASM real com imagem sintética offline, assinatura, migração, persistência e atualização. Câmera física requer verificação no aparelho.

# Painel 2.9.0 — ciclos de leitura e cobrança

Lançamentos inclui um bloco opcional com início/data anterior, leitura anterior, fechamento efetivo/data atual, leitura atual, multiplicador, vencimento e próxima leitura prevista. Os dias são a diferença entre as datas; o consumo da rede é a diferença das leituras multiplicada pelo fator da fatura. O botão de transferência permite conferir antes de preencher Rede importada. Datas previstas não fecham automaticamente um ciclo.

Histórico dos ciclos permite editar e remover somente o ciclo, preservando os valores mensais. Usar fechamento anterior reaproveita a data e leitura finais como novo início. O Painel exibe início, fechamento previsto e dias decorridos/restantes. Acompanhamento pelas leituras 03 precisa ser habilitado pelo usuário para o mesmo medidor e escala; mostra consumo parcial e projeção explicitamente estimada. Leituras incompatíveis bloqueiam a estimativa. A produção solar considera os dias após a leitura inicial até o fechamento, com cobertura dos dias disponíveis; dados incompletos permanecem identificados como parciais.

Ciclos fazem parte do mesmo armazenamento, backup e envelope de sincronização. Backups antigos sem ciclos continuam válidos. CSV inclui os campos; Excel possui a aba Ciclos de leitura; PDF inclui uma tabela de ciclos. Valores existentes não são preenchidos nem modificados automaticamente. Nenhum dado pessoal da fatura de referência foi incluído nos padrões publicados.

Atualização do painel compatível com Android de código 12 ou superior: Sobre → Buscar atualização → Aplicar atualização. O painel passa a 2.9.0; a versão nativa do APK permanece a instalada. Não há alteração da ponte Android nem necessidade de novo APK para este recurso. A leitura por câmera/OCR continua como proposta para uma próxima etapa e não foi incluída nesta versão.

# Painel 2.8.3 — edição de registros

Produção diária e histórico de uso inteligente possuem Editar, Salvar alterações e Cancelar. O nome dos equipamentos também pode ser alterado, mantendo os vínculos com os usos. Correções manuais ficam identificadas e a importação pede confirmação antes de substituí-las. Datas duplicadas e intervalos inválidos são bloqueados. As ações permanecem visíveis ao percorrer as tabelas no celular. Relógio Enel e lançamentos mensais usam o rótulo Salvar alterações durante a edição.

Atualização compatível com APK 2.8.2 (código 12): Sobre → Buscar atualização → Aplicar atualização. A versão do painel passa a 2.8.3; o aplicativo Android pode continuar mostrando 2.8.2. Armazenamento, sincronização e assinatura continuam no fluxo existente.

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


