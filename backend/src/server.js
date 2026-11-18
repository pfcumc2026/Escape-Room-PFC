import { ErroConfiguracao, lerAmbiente } from "./config/ambiente.js";
import { conectar, criarIndices } from "./config/banco.js";
import { criarApp } from "./app.js";
import { criarServicoEmail } from "./services/email.js";
import { criarGoogle } from "./services/google.js";
import { criarFirebaseLegado } from "./services/firebaseLegado.js";
import { criarTempoReal } from "./services/tempoReal.js";

async function iniciar() {
  const config = lerAmbiente();

  let conexao;
  try {
    conexao = await conectar(config.mongo);
  } catch (e) {
    console.error(`Não foi possível conectar ao MongoDB (${e.name}). Confira MONGODB_URI, usuário, senha e o acesso de rede (Network Access) do Atlas.`);
    process.exit(1);
  }
  await criarIndices(conexao.db);
  console.log(`MongoDB conectado (banco "${config.mongo.banco}").`);

  const ctx = {
    config,
    db: conexao.db,
    email: criarServicoEmail(config.email),
    google: criarGoogle(config.google),
    legado: criarFirebaseLegado(config.firebaseLegado, { urlRetorno: config.frontendUrl }),
    tempoReal: criarTempoReal()
  };

  if (!ctx.email.configurado) console.warn("Aviso: BREVO_API_KEY/EMAIL_FROM ausentes. Cadastro e recuperação de senha ficarão indisponíveis.");
  if (!ctx.google) console.warn("Aviso: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI ausentes. Login com Google indisponível.");
  if (!ctx.legado) console.warn("Aviso: FIREBASE_API_KEY/FIREBASE_PROJECT_ID ausentes. Contas antigas do Firebase não serão migradas.");

  const servidor = criarApp(ctx).listen(config.porta, () => {
    console.log(`API ouvindo na porta ${config.porta}. Origens permitidas: ${config.origens.join(", ")}`);
  });

  const encerrar = () => {
    ctx.tempoReal.encerrar();
    servidor.close(() => conexao.cliente.close().finally(() => process.exit(0)));
  };
  process.on("SIGTERM", encerrar);
  process.on("SIGINT", encerrar);
}

iniciar().catch((e) => {
  if (e instanceof ErroConfiguracao) console.error(`Configuração inválida: ${e.message}`);
  else console.error("Falha ao iniciar o servidor:", e);
  process.exit(1);
});
