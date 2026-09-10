# Placeholder — Etapa 2: RN03

Continuação da base do Escape Room de Python (PFC). Esta etapa acrescenta à Etapa 1 (RN01 e RN02):

- **RN03 — Participação em grupos**: um usuário entra em um grupo por **convite** enviado pelo
  proprietário ou por **código de acesso** (link e QR Code).

A próxima etapa acrescenta o limite de participantes (RN04).

Tecnologias: HTML5, CSS3, JavaScript (ES Modules, sem framework), Firebase (Authentication,
Firestore, Realtime Database), Bootstrap 5, Lucide Icons, Google Fonts, DiceBear API e qrcodejs.

> **Placeholder** é um nome temporário, assim como o logo (ícone `door-open` do Lucide).

---

## O que entrou nesta etapa

```
entrar.html          página de entrada por link/QR Code            [RN03]
js/entrar.js         apresenta o código e entra no grupo           [RN03]
grupo.html           bloco "Convidar" + modal de link e QR Code    [RN03]
js/grupo.js          envio e cancelamento de convites, QR Code     [RN03]
dashboard.html       cartões de convites recebidos e enviados      [RN03]
js/dashboard.js      aceitar/recusar convite                       [RN03]
firestore.rules      coleção invites, subcoleção joins e a regra
                     de entrada em grupo                           [RN03]
```

O restante dos arquivos vem da Etapa 1.

---

## Como funciona o RN03

**Por convite.** O proprietário busca o usuário pelo username (`usernames/{nome}` → uid) e cria
`invites/{grupoId}_{uid}` com status `pending`. O ID determinístico evita convites duplicados. O
convidado vê o convite no painel e pode aceitar ou recusar; ao aceitar, o mesmo lote de escrita
atualiza o convite e adiciona o usuário a `members`. A regra do grupo confere o convite pendente
antes de permitir a entrada.

**Por código de acesso.** O proprietário gera um `inviteCode` de 8 caracteres, exibido como link e
como QR Code, e pode gerar um novo código a qualquer momento — o anterior deixa de valer. Quem abre
o link entra por `entrar.html`, que grava `groups/{gid}/joins/{uid}` com o código e o carimbo de
tempo do servidor **na mesma transação** da entrada. A regra usa `getAfter()` e só aceita se
`at == request.time` e o código bater com o atual, de modo que um código antigo não pode ser
reaproveitado.

---

## Coleções acrescentadas

| Caminho | Conteúdo |
|---|---|
| `invites/{gid}_{uid}` | `groupId`, `groupName`, `fromUid`, `fromUsername`, `toUid`, `toUsername`, `status`, `createdAt`, `respondedAt` |
| `groups/{gid}/joins/{uid}` | `code`, `at` — prova de que o código foi apresentado |
| `groups/{gid}` | ganha o campo `inviteCode` |

Nenhum índice composto é necessário: as consultas de convites usam apenas filtros de igualdade.

> Grupos criados na Etapa 1 não têm `inviteCode`. Para testar o convite por código, crie um grupo
> novo depois de publicar estas regras.

---

## Configuração do Firebase

A mesma da Etapa 1 (`firebaseConfig` em `js/firebase.js`, Authentication com E-mail/senha e Google,
Firestore, Realtime Database). Depois de atualizar o código, republique as regras:

```bash
firebase deploy --only firestore:rules
```

---

## Segurança do RN03

- Só o **dono do grupo** cria convites, e a regra confere no servidor: remetente é o dono, o
  convidado ainda não está no grupo, o nome do grupo bate com o documento e o username do remetente
  bate com o perfil dele (não dá para se passar por outra pessoa).
- O convidado só pode mudar o status de `pending` para `accepted`/`declined` — mais nada.
- Ninguém lê convites de terceiros: só remetente e destinatário.
- Entrar no grupo exige convite pendente **ou** código válido apresentado na mesma transação;
  alterar o JavaScript no navegador não contorna nenhuma das duas condições.
- O usuário adiciona apenas a si mesmo a `members`, e `memberCount` precisa bater com o tamanho
  real da lista.
