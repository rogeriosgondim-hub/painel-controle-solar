# Proteção administrativa do Controle Solar

As correções do aplicativo não ativam regras administrativas da conta GitHub.

1. No repositório, Settings → Rules → Rulesets → New ruleset → Import a ruleset. Importe main-security-ruleset.json, confira que aponta para main e está Active. Se a opção de importar não aparecer, crie um branch ruleset com as mesmas opções abaixo.
2. Alvo: branch main. Ativar Require a pull request before merging (0 aprovações para o único responsável), Require conversation resolution before merging, Block force pushes e Restrict deletions. Não adicionar exceções/bypass. Esta regra limita escrita direta pelo token de sincronização; cloud-sync continua gravável.
3. Conferir a regra em uma tentativa controlada de alteração pela interface e verificar que exige pull request. Não ativar checks obrigatórios sem ajustar os workflows: o build Android só roda quando seus arquivos mudam.
4. Ativar autenticação em duas etapas na conta e guardar códigos de recuperação fora do celular.
5. Token fine-grained: somente painel-controle-solar, Contents Read and write, validade definida; renovar antes de expirar. Não conceder Workflows ou Administration. Nunca publicar token ou chave de assinatura. Ao renovar, atualizar os aparelhos.

Backup com senha deve ter senha longa e única. O backup simples, Excel, CSV e PDF contêm registros legíveis; guardar em local privado. Exportar backup antes de trocar aparelho, limpar dados do navegador ou atualizar o APK.

A versão atual remove padrões pessoais e previews antigos do estado corrente. O histórico Git e APKs antigos podem conservar cópias anteriores. Excluir definitivamente o histórico é uma operação separada que exige planejamento e autorização explícita.

Os dados locais do painel continuam no armazenamento do aparelho; o arquivo sincronizado é criptografado antes de enviado. Proteja o bloqueio de tela. O cofre de credenciais e a CSP reduzem riscos, mas não garantem proteção contra aparelho ou conta comprometidos.
