# Versão 2.7.0 — 02/10/2026

Criador do projeto: Rogerio Sampaio.

O app Android mantém a origem `file:///android_asset/index.html` e as chaves de armazenamento da versão 2.6.3. A instalação deve ser feita por cima da versão anterior, preservando a assinatura permanente. Exportar um backup JSON antes de atualizar.

O APK contém o painel e a biblioteca Excel para uso offline. Ao abrir, consulta `panel-update.json` no GitHub Pages por HTTPS. Apenas versões compatíveis com o aplicativo são aceitas. A integridade do HTML é conferida com SHA-256 e a cópia é gravada atomicamente. A nova tela é usada na próxima abertura, ou pelo botão Sobre → Aplicar atualização. Uma verificação de inicialização retorna ao painel incluído no APK caso a cópia não consiga iniciar. Não modifica os dados ou a configuração da nuvem.

Para publicar futuras melhorias web compatíveis: atualizar `index.html`, versão/data no painel, aumentar `revision` em `panel-update.json` e recalcular `sha256` dos bytes UTF-8 do HTML. Manter `minNativeVersionCode: 10` enquanto utilizar a ponte nativa e as bibliotecas já presentes. Novas capacidades Android ou novas dependências offline exigem um APK com código superior e a atualização do requisito mínimo. Não basta editar o HTML sem atualizar o manifesto: o app valida o par antes de baixar.

Excel e PDF dos lançamentos incluem também as leituras Enel. CSV mantém os lançamentos mensais. Relatórios exportam somente o período escolhido. Os formatos para consulta não substituem o backup JSON. PDF no Android utiliza a impressão nativa: selecionar “Salvar como PDF”. No navegador utiliza a janela de impressão. Todos os arquivos são produzidos no aparelho.
