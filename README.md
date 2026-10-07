# Voe · BASE — Recepção Onda · 1.0.0

PWA da Igreja Onda com React e TypeScript, hospedado em Cloudflare Workers, com dados persistentes em D1 e acessos individuais. Esta versão reúne as funções da prévia 0.4.7 e a API real.

## Hospedar pelo computador

Requer Node.js 22.12 ou superior e sua conta Cloudflare. No Windows, use PowerShell e os comandos abaixo com `.cmd`.

1. Extraia o ZIP. Abra o terminal na pasta `recepcao-onda` que contém `package.json`.
2. Execute `npm.cmd ci`.
3. Execute `npm.cmd run publicar`.

O assistente compila o app, verifica o login e abre o navegador para autorizar a Cloudflare quando necessário. Se houver várias contas, ele pede que você escolha. Cria um banco exclusivo `recepcao-onda-db` ou reutiliza o ID de um banco BASE já criado, aplica as migrações, pede seus dados para criar o primeiro administrador e publica o Worker. O endereço HTTPS aparece no terminal.

Se o nome do banco já existir, copie o ID desse banco no painel D1 e execute novamente; o assistente permite informá-lo. Use somente um banco exclusivo para BASE. Nunca informe o banco de outro projeto, como Videário.

As migrações podem pedir confirmação no terminal. Sua senha é digitada de forma oculta no computador; não envie a senha no chat. O arquivo temporário com hash do administrador é apagado pelo assistente após a aplicação. Se a aplicação falhar, execute novamente e cadastre o administrador outra vez.

No Linux/macOS, use `npm ci` e `npm run publicar`.

## Usar o código do GitHub

Este é o repositório público `igrejaondapaulista-dotcom/Voe`. O código não inclui dados pessoais da equipe. Nomes, cores atribuídas e escalas são consultados no D1 após o login. Para baixar pelo GitHub, clique em **Code → Download ZIP**, extraia e abra o terminal na pasta `Voe-main`, que contém `package.json`. Execute `npm.cmd ci` e `npm.cmd run publicar`. O assistente continua a configuração na sua conta Cloudflare.

Se preferir Git, clone o repositório e abra o terminal na pasta `Voe`. O código no GitHub não cria automaticamente o banco nem publica o aplicativo: a primeira configuração acontece pelo assistente, com sua autorização Cloudflare e seu administrador.

Após publicar, o assistente atualiza `wrangler.jsonc` localmente com o banco e a conta escolhidos. Atualize esse arquivo no repositório para reutilizar o mesmo banco nas próximas versões. Credenciais e arquivos temporários de administrador ficam fora do Git.

## Dados iniciais privados

O assistente pode carregar `dados-iniciais.local.sql` quando esse arquivo for fornecido separadamente e estiver na pasta do projeto. Ele fica fora do Git e não faz parte do repositório público. A carga só acontece quando voluntários e rascunho da escala estão vazios; não sobrescreve registros existentes. Guarde esse arquivo apenas localmente. Sem ele, cadastre os dados pela interface.

## Primeiro acesso

Abra o endereço publicado e entre com o e-mail e a senha criados no assistente. Em **Equipe**, cadastre os acessos de cada voluntário, com nome, e-mail, senha, perfil e cor. Senhas de criação/edição têm mínimo de 3 caracteres, conforme solicitado.

O administrador inicial gerencia os dados; os acessos de voluntários têm vínculo com cada pessoa para informar disponibilidade. O cadastro inicial não cria senhas, contas ou visitantes fictícios. As disponibilidades e os avisos começam vazios. O código público começa sem nomes e sem escala. Cadastre os voluntários em Equipe e organize as datas em Escala. Mudanças são salvas como rascunho e devem ser publicadas pelo mês.

Os dados de teste da prévia não são transferidos. As mudanças feitas nesta versão persistem no D1 após recarregar e em outros celulares.

## Funções e perfis

- **Visitas:** nome, telefone com DDD, autorização opcional para contato, primeira visita, retorno por dia, busca, edição, histórico e acompanhamento. Todos os acessos são da equipe/voluntários; não há cadastro público.
- **Escala:** cartões uniformes, cinco vagas, nomes e cores, vagas livres com escolha e confirmação, edição, cópia e exclusão de datas, rascunho e publicação mensal. Conflitos de edição simultânea pedem atualização da página.
- **Disponibilidade:** cada acesso vinculado responde por seu voluntário. A equipe consulta o resumo e encerra votações. Criar datas deixa as vagas livres; respostas não atribuem nomes automaticamente.
- **Avisos:** equipe autorizada e administrador publicam, editam, fixam e arquivam. Todos podem curtir; uma curtida por voluntário em cada aviso. Sem botão “Li o aviso”.
- **Equipe:** administrador cadastra, edita, desativa e reativa acessos. Desativação encerra sessões. Cores disponíveis incluem preto; cores originais foram preservadas.
- **Exportação:** administrador baixa CSV por categoria, um único Excel com cinco abas ou backup JSON completo sem senhas e sessões. Importação e restauração JSON ainda não estão implementadas.
- **WhatsApp:** compartilha a escala publicada; você escolhe a conversa e confirma o envio no WhatsApp.

Equipe autorizada organiza escala, disponibilidade e avisos. Voluntário consulta a escala publicada e informa disponibilidade. Exclusão de visitantes, gerenciamento de acessos e exportação são do administrador.

## Instalar no celular

Android/Chrome: abra o endereço HTTPS e use **Instalar aplicativo** ou **Adicionar à tela inicial**. iPhone/Safari: Compartilhar → Adicionar à Tela de Início. O app exige internet para consultar/gravar dados; o cache guarda somente arquivos da interface, sem respostas da API.

O Google Agenda abre um evento para salvar, com indicação de manhã. O sistema do celular decide se abre o app ou navegador; o login com Google e uma integração direta ficaram para depois.

## Atualizar sem perder dados

Guarde `wrangler.jsonc` após a publicação: contém os IDs da conta e do banco, sem senhas. Mantenha o nome do Worker e o ID do banco nas versões futuras. Para atualizar o código, use `npm.cmd run publicar` novamente. O assistente reutiliza o banco e o administrador existentes.

As migrações novas são numeradas; não altere/apague migrações já aplicadas. Antes de mudanças estruturais, faça backup completo D1 com `npx.cmd wrangler d1 export DB --remote --output=backup.sql`. A exportação JSON do app é para consulta e cópia dos registros, não uma restauração integral da autenticação.

## Comandos manuais e desenvolvimento

`npm run build` compila; `npm test` valida a API com D1 temporário; `npm run db:local` aplica migrações locais; `npm run worker` inicia o Worker local; `npm run dev` desenvolve a interface encaminhando `/api` ao Worker. Para criar um administrador local, use `npm run admin`, aplique `admin.local.sql` com `wrangler d1 execute DB --local --file=admin.local.sql` e apague o arquivo.

Publicação manual: `npx wrangler login`, crie/reutilize o banco, preencha `wrangler.jsonc`, execute `npm run db:remote`, crie/aplique o administrador e execute `npm run deploy`.

## Validação e limites

Verificados: TypeScript/Vite, migrações D1, API em Miniflare, autenticação/cookies/perfis, visitas, publicação e conflitos da escala, disponibilidade sem atribuição, avisos/curtidas, exportações, cores e reativação. O empacotamento de publicação usa Wrangler em dry-run, sem publicar. A publicação remota e a inspeção nos seus celulares precisam acontecer na sua conta.

A busca retorna até 200 visitantes. O telefone é único por cadastro. A escala aceita até 500 datas. Sessões expiram em 12 horas. Ainda não há recuperação automática de senha, integração OAuth Google ou importação de backup JSON.



## v1.1.0 — Integrações

Administrador: Mais → Integrações. Crie uma chave por sistema, copie-a no momento da criação e envie por um canal privado ao responsável pela integração. Somente o hash é persistido; a chave não pode ser recuperada. Revogar bloqueia consultas seguintes. O link usa o domínio atual do aplicativo. Não inclua chaves no endereço. Nenhuma migração nova é necessária: as chaves usam registros `integration:` em `app_records`, fora dos exports.

Consultas GET com `Authorization: Bearer SUA_CHAVE`:

- `/api/integracao/visitantes`: `id`, `nome`, `telefone`, `cadastrado_em`, `atualizado_em`, `total_visitas`, `ultima_visita`.
- `/api/integracao/presencas`: `id` da presença, `visitante_id`, `data` (AAAA-MM-DD), `registrado_em`. O identificador vincula a presença ao cadastro.

Filtros opcionais `inicio` e `fim` (datas inclusivas AAAA-MM-DD); visitantes são selecionados se possuem presença no intervalo. Total e última visita sempre refletem todo o histórico. `limite` entre 1 e 100, padrão 50. A resposta contém `dados` e `paginacao.proximo_link`. Consulte o próximo link usando a mesma chave até retornar null. A ordenação é pelo id, com cursor exclusivo. Presenças são paginadas separadamente para evitar histórico ilimitado por visitante.

Exemplo (substitua domínio e chave; execute no servidor do sistema de destino):

```js
const response = await fetch('https://SEU-DOMINIO/api/integracao/visitantes?limite=100', {
  headers: {Authorization: 'Bearer ' + process.env.VOE_INTEGRATION_KEY}
});
if (!response.ok) throw new Error('Consulta recusada: ' + response.status);
const page = await response.json();
```

Respostas: 401 sem chave válida ou revogada; 400 para filtros inválidos; 405 para escrita. Cookies não substituem a chave. Sem CORS público, sem cache de respostas. Dados internos de acompanhamento, consentimento, equipe e credenciais não são expostos.

Este é acesso de consulta, sem envio automático ou sincronização incremental. O destino deve consultar os dois conjuntos completos periodicamente, deduplicar por id e substituir a cópia anterior apenas após terminar todas as páginas para refletir exclusões. Não há snapshot entre páginas; alterações simultâneas podem exigir nova leitura completa. Quando ambos sistemas estiverem definidos, considerar versão/snapshot ou log de alterações para sincronização mais exigente.
