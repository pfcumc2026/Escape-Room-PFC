# Auditoria de entrega — Escape.py

Projeto local: `C:\Users\Dell\Documents\PFC\placeholder` (branch `entrega-1610`). Nada foi enviado ao GitHub.

## 1. Checklist da universidade

| Exigência | Situação |
|---|---|
| ≥ 75% dos requisitos funcionais | Atendida: 21 de 23 verificados (91%) |
| Front e back integrados | Back verificado por testes de API; navegador ainda **não** verificado |
| Validação em formulários e campos | Servidor verificado por testes; validação do cliente não auditada em navegador |
| Tratamento de entradas inválidas | Verificado (400/403/404/409 testados) |
| Dashboard com Big Numbers e gráficos | Implementado e conferido no navegador local (5 KPIs, 2 gráficos, estado vazio); produção não conferida |
| Funcionalidades demonstráveis | Parcial: depende da verificação em navegador |
| Persistência | Verificada em MongoDB em memória; Atlas **não** verificado |
| Regras de negócio | Verificadas por testes |

## 2. Requisitos funcionais (derivados dos objetivos do TCC e do README)

Não há lista oficial de RF no repositório. "Verificado" = código inspecionado e teste automatizado aprovado.

| ID | Requisito | Status |
|---|---|---|
| RF01 | Cadastro com validação e e-mail único | Verificado |
| RF02 | Verificação de e-mail | Verificado |
| RF03 | Login, sessão JWT, logout, expiração | Verificado (logout só registra auditoria; o JWT não é revogado) |
| RF04 | Login com Google | Verificado com dublês; fluxo real não testado |
| RF05 | Recuperação de senha | Verificado |
| RF06 | 2FA (TOTP) | Verificado |
| RF07 | Perfil, username único, avatar | Verificado |
| RF08 | Exclusão de conta | Verificado |
| RF09 | Criar e listar grupos (máx. 4) | Verificado |
| RF10 | Excluir grupo e remover integrante | Verificado |
| RF11 | Entrada por código/link | Verificado |
| RF12 | Convites: enviar, aceitar, recusar, cancelar | Verificado |
| RF13 | Chat do grupo (expira em 24 h) | Verificado |
| RF14 | Tempo real (SSE) | Verificado |
| RF15 | Ciclo da partida | Verificado |
| RF16 | Dificuldade e cronômetro no servidor | Verificado |
| RF17 | Progressão e dependência de pistas | Verificado |
| RF18 | Validação das respostas Python | Parcial: o Pyodide confere no navegador; o servidor só impõe ordem e dependências |
| RF19 | Editor de salas (admin) | Verificado |
| RF20 | Auditoria de operações | Verificado (login, cadastro, convites, grupos, partida, sala) |
| RF21 | Dashboard com KPIs e gráficos | Verificado: endpoint testado (104 testes) e painel conferido no navegador com dados reais de um banco em memória |
| RF22 | Histórico persistente de partidas | Verificado (`gameHistory`) |
| RF23 | Pontuação | Parcial: pontuação calculada no servidor; dicas e tentativas ainda vêm do cliente |

**Cálculo:** 21 verificados / 23 aplicáveis = **91,3%**. A migração do Firebase foi excluída por ser infraestrutura.

## 3. Correções feitas

- `gameHistory`: partida encerrada (concluída, desistência ou tempo esgotado) é gravada com `_id` próprio, jogadores, dificuldade, pontuação, dicas, tentativas e datas. Idempotente pelo índice único `(groupId, createdAt)`. Reiniciar a partida ou excluir o grupo não apaga o histórico. Partida em andamento ao excluir o grupo não vira registro. Ao excluir a conta, o jogador sai do histórico e registros sem jogadores são apagados.
- Pontuação: o servidor recalcula (`services/pontuacao.js`) com os enigmas resolvidos, dicas, tentativas e tempo restante do relógio do servidor. O `score` enviado pelo cliente é validado e ignorado. Resultado concluído não pode ser alterado.
- Índices: `games(players, status)`, `gameHistory(players, finishedAt)`, `gameHistory(groupId, createdAt)` único. `games.finishedAt` e `games.status` isolados foram dispensados: as estatísticas leem `gameHistory`.
- Auditoria: `partida_iniciada`, `partida_concluida`, `partida_desistencia`, `partida_expirada`. A exclusão de grupo (`grupo_excluido`) já era registrada.
- `GET /api/users/me/stats`: só devolve dados de partidas em que o usuário é jogador.

## 4. Testes executados (local, MongoDB em memória)

`npm test` em `backend/`: **104 testes, 104 aprovados, 0 falhas** (84 anteriores + 20 em `test/historico.test.js`). Um teste existente (`jogo.test.js`) foi ajustado: antes exigia o score do cliente (950); agora exige o score calculado pelo servidor. As demais asserções foram mantidas.

Novos testes: logout, JWT expirado/adulterado, remoção de integrante, exclusão de grupo, recusa e cancelamento de convite, transições inválidas da partida, entradas inválidas, pontuação, histórico (duplicidade, replay, exclusão de grupo e de conta, expiração), índices, estatísticas (vazio, isolamento, sem dupla contagem), auditoria e acesso administrativo.

## 5. KPIs e gráficos (definições)

- Concluídas: histórico com `COMPLETED`.
- Em andamento: `PLAYING` com `expiresAt` futuro.
- Enigmas resolvidos: soma do histórico mais as partidas atuais.
- Taxa de conclusão: concluídas ÷ (concluídas + desistências + expiradas); sem partidas encerradas, `null`.
- Tempo médio: média de `finishedAt − startedAt` só das concluídas.
- Gráficos: concluídas por semana (8 semanas) e concluídas × não concluídas por dificuldade.

Status da interface: **aprovada e implementada**. Mudanças: card "Meu desempenho" ao fim de `dashboard.html` (mais o script do Chart.js 4.4.1 fixado), `PainelDesempenho.js` e `ServicoEstatisticas.js` novos, duas linhas em `PaginaDashboard.js` e poucas regras em `css/style.css`. O layout anterior não foi alterado. Conferido no navegador local: estado vazio, números e gráficos corretos, sem erros de console causados pela aplicação.

## 6. Limitações e riscos

- `firebase.json` passou a ignorar `docs/**` para que a documentação não seja publicada no Hosting.

- Dicas e tentativas continuam informadas pelo cliente (o Python roda no navegador). O servidor limita os valores, mas não consegue provar que são verdadeiros.
- Tentativas em enigmas não resolvidos não são gravadas; por isso não há razão "resolvidos ÷ tentativas" real.
- Partida com tempo esgotado que ninguém encerrou só entra no histórico quando alguém a encerra ou o grupo é excluído; nas estatísticas já conta como não concluída.
- Não verificados: navegador (console, formulários), MongoDB Atlas, CORS e SSE em produção (Render), login Google real, envio de e-mail (Brevo).
- Existem alterações locais não commitadas anteriores a esta auditoria (textos dos enigmas e `ambiente.js`); não foram tocadas.

## 7. Prontidão

Pronto para demonstração local, com 91% dos requisitos verificados. Para afirmar que toda a exigência da universidade está atendida, falta conferir em produção (Atlas, Render, CORS, SSE) e percorrer as telas de cadastro, grupo e sala no navegador.
