import { indisponivel } from "../utils/erros.js";

const URL_BREVO = "https://api.brevo.com/v3/smtp/email";

export function criarServicoEmail(config, fetchImpl = fetch) {
  return {
    configurado: !!config,

    async enviar({ para, assunto, texto, html }) {
      if (!config) throw indisponivel("O envio de e-mails não está configurado no servidor.", "EMAIL_INDISPONIVEL");
      const resposta = await fetchImpl(URL_BREVO, {
        method: "POST",
        headers: { "api-key": config.chave, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: config.remetente, name: config.nome },
          to: [{ email: para }],
          subject: assunto,
          textContent: texto,
          htmlContent: html
        })
      });
      if (!resposta.ok) {
        console.error("[email] Brevo respondeu", resposta.status, await resposta.text().catch(() => ""));
        throw indisponivel("Não foi possível enviar o e-mail agora. Tente novamente em instantes.", "EMAIL_FALHOU");
      }
    }
  };
}

function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function mensagem({ saudacao, corpo, acao, link, rodape }) {
  const texto = `${saudacao}\n\n${corpo}\n\n${acao}: ${link}\n\n${rodape}`;
  const html = `<p>${escaparHtml(saudacao)}</p><p>${escaparHtml(corpo)}</p>
<p><a href="${escaparHtml(link)}">${escaparHtml(acao)}</a></p>
<p style="color:#666;font-size:13px">${escaparHtml(rodape)}</p>`;
  return { texto, html };
}

export function emailVerificacao(nome, link) {
  return {
    assunto: "Confirme seu e-mail · Escape.py",
    ...mensagem({
      saudacao: `Olá${nome ? `, ${nome}` : ""}!`,
      corpo: "Confirme seu endereço de e-mail para liberar o acesso ao Escape.py. O link vale por 24 horas.",
      acao: "Confirmar e-mail",
      link,
      rodape: "Se você não criou esta conta, ignore esta mensagem."
    })
  };
}

export function emailRedefinicao(nome, link) {
  return {
    assunto: "Redefinição de senha · Escape.py",
    ...mensagem({
      saudacao: `Olá${nome ? `, ${nome}` : ""}!`,
      corpo: "Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora e só pode ser usado uma vez.",
      acao: "Redefinir senha",
      link,
      rodape: "Se você não pediu a redefinição, ignore esta mensagem: sua senha continua a mesma."
    })
  };
}
