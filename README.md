# Escape Room Educacional — PFC

## Sobre o Projeto

Projeto Final de Curso do Bacharelado em Sistemas de Informação da Universidade de Mogi das Cruzes (UMC).

O projeto consiste no desenvolvimento de um **jogo educacional digital no formato Escape Room**, voltado ao ensino e à prática de **programação em Python**. A proposta utiliza desafios, pistas e enigmas para estimular o raciocínio lógico e a resolução de problemas de forma interativa e colaborativa.

Os jogadores poderão criar suas contas, formar grupos e trabalhar em equipe para solucionar os desafios e avançar pelas diferentes etapas do jogo.

## Objetivos

* Desenvolver um jogo educacional baseado em Escape Room.
* Utilizar desafios de Python como ferramenta de aprendizagem.
* Estimular o raciocínio lógico e a resolução de problemas.
* Permitir a formação de grupos e a resolução colaborativa dos desafios.
* Aplicar conceitos de gamificação ao ensino de programação.
* Avaliar a funcionalidade e a usabilidade da aplicação.

## Arquitetura

```
Navegador (front-end estático)  ──HTTPS/JSON──▶  API REST (Node.js + Express, Render)  ──▶  MongoDB Atlas
   HTML, CSS, JS (ES Modules)    ◀──SSE────────   autenticação, regras do jogo, tempo real
   Pyodide (Python no navegador)
```

* **Front-end:** páginas estáticas (podem continuar no Firebase Hosting ou ir para qualquer hospedagem estática). Fala com o back-end apenas pela API; o endereço fica em `js/config.js`.
* **Back-end:** API REST própria em `backend/`. Autentica os usuários, aplica todas as regras (permissões, limites, transições da partida) e grava no banco.
* **Banco de dados:** MongoDB Atlas, acessado só pelo back-end com o driver oficial.
* **Tempo real:** Server-Sent Events (`GET /api/events`). O servidor avisa que um grupo, chat, partida, convite ou presença mudou, e o front busca os dados de novo pela API.

## Tecnologias

### Front-end

* **HTML5, CSS3 e JavaScript (ES Modules)** — interface e lógica do jogo.
* **Bootstrap 5** e **Lucide** — componentes e ícones.
* **Pyodide** — execução do Python dos jogadores no navegador.
* **DiceBear API** — avatares.

### Back-end

| Pacote | Uso |
| --- | --- |
| `express` | servidor HTTP e rotas REST |
| `mongodb` | driver oficial do MongoDB |
| `bcrypt` | hash das senhas |
| `jsonwebtoken` | emissão e validação do JWT de sessão |
| `cors` | origens autorizadas do front-end |
| `express-rate-limit` | limite de tentativas nas rotas sensíveis |
| `dotenv` | variáveis de ambiente do `.env` |
| `jose` | validação da assinatura do `id_token` do Google (OpenID Connect) |
| `otpauth` | geração e validação dos códigos TOTP do 2FA |
| `mongodb-memory-server` (dev) | MongoDB temporário para os testes automatizados |

O envio de e-mails usa a API HTTP do **Brevo** (com `fetch`, sem biblioteca extra). O plano gratuito do Render bloqueia as portas SMTP desde setembro de 2025.

### Organização

* **GitHub** — versionamento e colaboração no código.
* **Trello / Kanban** — organização e acompanhamento das tarefas do projeto.

## Estrutura da Experiência

A aplicação será organizada em diferentes salas e etapas. Durante a partida, os jogadores deverão:

1. Entrar ou criar uma conta.
2. Formar ou participar de um grupo.
3. Explorar as salas e identificar pistas.
4. Resolver enigmas e desafios relacionados à programação Python.
5. Avançar conforme os desafios forem solucionados.
6. Concluir o Escape Room.

## Escape Room (jogo)

O jogo é uma sala gótico-medieval feita de renders (`assets/renders`) com uma camada SVG de hotspots por cima. O Python dos jogadores roda no navegador com o Pyodide.

* `sala.html?id=<grupo>`: lobby, partida (até 3 jogadores), caderno da equipe e chat do grupo.
* `editor-sala.html`: editor visual de hotspots, restrito a administradores (campo `role: "admin"` no documento do usuário, definido manualmente no Atlas).
* `assets/salas/sala-gotica.json`: sala padrão (renders e hotspots em coordenadas normalizadas). O editor salva a versão publicada pela API (coleção `rooms`).
* Dificuldades: Fácil 25 min (3 enigmas), Médio 45 min (4), Difícil 60 min (5).
* A semente da partida define, de forma determinística, quais objetos viram enigma, pista ou decoração e a cadeia de dependências. A configuração gerada fica na coleção `games`. O servidor define o início e o fim da partida e confere as dependências entre pistas e enigmas.

## Estrutura de diretórios

```
placeholder/
├── *.html                 páginas (cada uma declara data-pagina)
├── css/                   estilos
├── assets/                renders e sala padrão
├── js/
│   ├── config.js          URL da API
│   ├── main.js            ponto de entrada das páginas
│   ├── paginas/           uma classe por página
│   ├── componentes/       partes da interface
│   ├── servicos/          acesso à API (ServicoGrupos, ServicoPartida...) e regras da partida (Partida.js)
│   ├── modelos/           Grupo, Sala, Hotspot, EstadoPartida...
│   └── nucleo/            Api.js, TempoReal.js, gerador procedural, Pyodide...
└── backend/
    ├── src/
    │   ├── server.js      inicialização (lê o .env, conecta ao Atlas, sobe o Express)
    │   ├── app.js         middlewares (CORS, JSON, limites) e rotas
    │   ├── config/        variáveis de ambiente e conexão com o MongoDB
    │   ├── routes/        definição dos endpoints
    │   ├── controllers/   leitura da requisição e montagem da resposta
    │   ├── services/      regras de negócio e acesso às coleções
    │   ├── middleware/    autenticação (JWT), limites e tratamento de erros
    │   └── utils/         validação, erros HTTP e criptografia
    ├── test/              testes automatizados (node:test)
    └── .env.example
```

Os arquivos soltos em `js/` (`login.js`, `guard.js`, `firebase.js`, `grupo.js`...) e `js/nucleo/Firebase.js` são da versão antiga e não são carregados por nenhuma página.

## Como executar localmente

### Pré-requisitos

* Node.js 20.19 ou superior (o Render usa a versão definida em `render.yaml`).
* Uma conta no MongoDB Atlas (plano gratuito M0).
* Para cadastro e recuperação de senha: uma conta no Brevo (plano gratuito) com um remetente verificado.
* Para o login com Google: um OAuth Client do tipo "Aplicativo da Web" no Google Cloud Console.

### 1. Configurar o MongoDB Atlas

1. Crie um cluster gratuito (M0).
2. Em **Database Access**, crie um usuário com permissão de leitura e escrita.
3. Em **Network Access**, libere o IP da sua máquina. Para o Render, que não tem IP fixo no plano gratuito, libere `0.0.0.0/0`; a proteção fica por conta do usuário e da senha.
4. Em **Connect > Drivers**, copie a string de conexão (`mongodb+srv://...`) e use-a em `MONGODB_URI`.

As coleções e os índices (como o e-mail único e o username único) são criados automaticamente quando o servidor inicia.

### 2. Configurar o `.env`

```bash
cd backend
cp .env.example .env
```

Preencha o `.env` seguindo os comentários do `.env.example`:

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `MONGODB_URI`, `MONGODB_DB_NAME` | sim | conexão com o Atlas |
| `JWT_SECRET` | sim | segredo do JWT (mínimo 32 caracteres) |
| `JWT_EXPIRES_IN` | não | validade da sessão (padrão `8h`) |
| `TOTP_ENCRYPTION_KEY` | sim | chave AES-256 que cifra os segredos do 2FA (32 bytes em base64) |
| `FRONTEND_URL` | sim | origens do front-end aceitas no CORS, separadas por vírgula; a primeira é usada nos links dos e-mails |
| `PORT`, `NODE_ENV` | não | porta (padrão 3000) e ambiente |
| `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | para cadastro e recuperação | envio de e-mails |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | para login com Google | OAuth 2.0 / OpenID Connect |
| `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID` | para migrar contas antigas | consulta das contas do Firebase |

Sem as variáveis opcionais, o servidor sobe e avisa no console quais recursos ficarão indisponíveis. Ele não simula esses recursos.

### 3. Iniciar

```bash
cd backend
npm install
npm run dev
```

A API sobe em `http://localhost:3000`; teste com `GET http://localhost:3000/api/health`.

Sirva a pasta do front em `http://localhost:5500` com qualquer servidor estático (por exemplo, a extensão Live Server do VS Code ou `npx http-server -p 5500` na pasta `placeholder`). Em `localhost`, o `js/config.js` aponta automaticamente para `http://localhost:3000/api`.

### Login com Google

No Google Cloud Console, crie um **OAuth Client ID** do tipo "Aplicativo da Web" e cadastre em **URIs de redirecionamento autorizados** o mesmo valor de `GOOGLE_REDIRECT_URI`:

* local: `http://localhost:3000/api/auth/google/callback`
* produção: `https://<seu-servico>.onrender.com/api/auth/google/callback`

Para migrar contas antigas que entravam com Google, crie esse client no mesmo projeto do Google Cloud do Firebase (`pfc-2026-f8fb8`). Se ele estiver em outro projeto, adicione o Client ID em Firebase Console > Authentication > Google > "Lista de permissões de IDs de clientes de projetos externos".

## Principais endpoints

Todas as rotas começam com `/api`. Rotas marcadas com 🔒 exigem `Authorization: Bearer <JWT>`; as de jogo também exigem e-mail verificado e perfil completo.

| Método e rota | Descrição |
| --- | --- |
| `GET /health` | saúde da API e do banco |
| `GET /time` | relógio do servidor (sincroniza o cronômetro) |
| `POST /auth/register` | cadastro (`name`, `email`, `password`, `acceptTerms`) |
| `POST /auth/login` | login; responde com a sessão ou com a próxima etapa (`2fa`, `2fa-legado`, `configurar-2fa`) |
| `POST /auth/logout` 🔒 | registra a saída |
| `POST /auth/email/verify`, `POST /auth/email/resend` 🔒 | confirmação de e-mail |
| `POST /auth/password/forgot`, `POST /auth/password/reset` | recuperação de senha com token de uso único |
| `POST /auth/2fa/verify` | segundo fator no login (código TOTP ou código de recuperação) |
| `POST /auth/2fa/setup`, `/enable`, `/disable` 🔒 | ativar e desativar o 2FA |
| `POST /auth/2fa/recovery-codes` 🔒 | novos códigos de recuperação (senha + código do aplicativo; os antigos deixam de valer) |
| `POST /auth/2fa/legacy/verify`, `/2fa/migration/setup`, `/2fa/migration/enable` | migração de contas que tinham 2FA no Firebase |
| `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/google/exchange` | login com Google (Authorization Code + PKCE) |
| `GET /users/me`, `PATCH /users/me`, `DELETE /users/me` 🔒 | conta própria (o PATCH aceita só `username`, `avatarStyle`, `avatarSeed` e `name`) |
| `GET /users/:uid`, `GET /users/:uid/presence`, `GET /users/username-available/:username` 🔒 | perfil público, presença e disponibilidade de username |
| `GET/POST /groups`, `GET/DELETE /groups/:id` 🔒 | grupos |
| `POST /groups/:id/join`, `POST /groups/:id/invite-code`, `DELETE /groups/:id/members/:uid` 🔒 | entrada por link/QR Code, novo código, saída e remoção |
| `GET/POST /groups/:id/invites`, `GET /invites/received`, `GET /invites/sent`, `POST /invites/:id/response`, `DELETE /invites/:id` 🔒 | convites |
| `GET/POST /groups/:id/messages` 🔒 | chat (mensagens expiram em 24 h) |
| `GET/POST/DELETE /games/:gid`, `POST /games/:gid/players`, `/start`, `/clues/:objeto`, `/puzzles/:chave`, `/end` 🔒 | partida |
| `GET /rooms/:id` 🔒, `PUT /rooms/:id` 🔒 (admin) | sala publicada e edição |
| `GET /audit` 🔒 (admin) | logs de auditoria |
| `GET /events` 🔒 | fluxo de eventos em tempo real (SSE) |

### Decisões de segurança

* Senhas com bcrypt (custo 12); o JWT leva só o id e a versão da sessão, e papel e permissões são lidos do banco a cada requisição. Redefinir a senha invalida as sessões anteriores.
* O JWT fica no `localStorage`, porque front e back estão em domínios diferentes e cookies de terceiros são bloqueados por vários navegadores. Para reduzir o risco de XSS, a sessão expira em poucas horas e todo conteúdo dos usuários é inserido com `textContent`.
* Tokens de e-mail, de redefinição e das etapas do login são aleatórios, de uso único, guardados como hash e apagados automaticamente ao expirar (índice TTL).
* 2FA: segredo TOTP cifrado com AES-256-GCM, código de uso único (não pode ser reaproveitado), 5 tentativas por desafio e 10 códigos de recuperação guardados como hash. A sessão só é emitida depois de todos os fatores.
* Google: `state` ligado ao navegador por cookie, `nonce`, PKCE e validação da assinatura, emissor e audiência do `id_token`. Uma conta já vinculada a outra conta Google não é sobrescrita.
* Entradas validadas no servidor e consultas montadas só com valores primitivos validados. As chaves da partida que viram caminhos de campo seguem um formato rígido.
* CORS restrito às origens de `FRONTEND_URL`; ele não substitui a autenticação das rotas.

## Testes

```bash
cd backend
npm test
```

São 84 testes com `node:test` sobre a API real e um MongoDB em memória. Na primeira execução, o `mongodb-memory-server` baixa o binário do MongoDB. E-mail, Google e Firebase são substituídos por dublês que registram as chamadas. A validação do `id_token` é testada com chaves RSA geradas no próprio teste.

Os testes cobrem: saúde, CORS, cadastro (válido, duplicado, simultâneo, inválido, campos privilegiados), verificação de e-mail, login correto e incorreto, rotas protegidas com token ausente, inválido e válido, senha nunca armazenada em texto, perfil, recuperação de senha, 2FA completo, limite de tentativas, Google, migração de contas antigas (inclusive com a migração desligada), grupos, convites, chat, partida, salas, tempo real, auditoria e exclusão de conta.

## Deploy no Render

1. Envie o repositório ao GitHub e, no Render, use **New > Blueprint**: o `render.yaml` cria o serviço `escape-py-api` (pasta `backend`, `npm ci --omit=dev`, `npm start`, health check em `/api/health`). Também é possível criar um **Web Service** manualmente com esses mesmos valores e **Root Directory** `backend`.
2. Preencha as variáveis pedidas (as mesmas do `.env`). O `JWT_SECRET` é gerado pelo Render. Em `FRONTEND_URL`, use a origem do front publicado (por exemplo, `https://pfc-2026-f8fb8.web.app`).
3. Em `js/config.js`, troque `https://escape-py-api.onrender.com/api` pela URL real do serviço e republique o front.
4. No Atlas, libere o acesso de rede (veja acima). Se o banco estiver inacessível, o servidor encerra com uma mensagem explicando o que conferir, e o Render tenta novamente.

Limitações do plano gratuito do Render: o serviço hiberna após cerca de 15 minutos sem acesso, e o primeiro acesso depois disso pode levar perto de um minuto (a página mostra "Carregando…" e avisa se a conexão falhar). As portas SMTP são bloqueadas, por isso o envio usa a API HTTP do Brevo. O tempo real fica em memória, então o serviço deve rodar com uma única instância.

## Migração do Firebase

| Funcionalidade | Situação |
| --- | --- |
| Cadastro, login, sessão | API própria (bcrypt + JWT) |
| Verificação de e-mail e recuperação de senha | API própria + Brevo |
| 2FA (TOTP) | API própria |
| Login com Google | OIDC direto com o Google, validado pela API |
| Perfil, grupos, convites, chat, partida, salas, auditoria | MongoDB Atlas, via API |
| Presença online | API (conexões SSE) |
| Hospedagem do front | continua podendo usar o Firebase Hosting (apenas arquivos estáticos) |

**Contas antigas:** nada foi apagado do Firebase. Quando uma conta que ainda não existe no MongoDB entra com e-mail e senha, a API confere a senha **uma vez** na API REST do Firebase Authentication, cria a conta com o hash bcrypt e copia o perfil (username e avatar) do Firestore. Se a conta tinha 2FA, o código do autenticador antigo é conferido pelo Firebase, e a conta continua usando esse fluxo até cadastrar um novo autenticador no sistema próprio. O segredo TOTP não pode ser exportado do Firebase. Quem esqueceu a senha de uma conta ainda não migrada recebe o e-mail de redefinição do próprio Firebase e migra no login seguinte. Contas antigas que entravam com Google migram no primeiro login com Google.

**Ainda dependem do Firebase:** somente a consulta das contas antigas durante a migração (variáveis `FIREBASE_*`). Grupos, convites e partidas antigos que ficaram no Firestore **não** foram copiados; os grupos precisam ser recriados. As regras `firestore.rules` e `database.rules.json` continuam no repositório porque o projeto Firebase segue ativo, mas não são mais usadas pelo jogo.

## Equipe

* **Luiza Helena Tardelli Marçulli Espíndola**
* **Munir Terranova Abou Zenni**
* **Renan do Nascimento Martins**

**Orientador:** Prof. Pedro Henrique Miho de Souza
**Coorientador:** Prof. Alessandro Aparecido da Silva Horas

---

> Projeto desenvolvido como parte do Projeto Final de Curso do Bacharelado em Sistemas de Informação — Universidade de Mogi das Cruzes (UMC), 2026.
