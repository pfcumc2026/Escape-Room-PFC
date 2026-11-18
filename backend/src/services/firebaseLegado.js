import { indisponivel, muitasTentativas } from "../utils/erros.js";

// Consulta as contas antigas pela API REST pública do Firebase Authentication.
// Usada somente na migração: depois que a conta passa para o MongoDB, o Firebase não é mais consultado.
const V1 = "https://identitytoolkit.googleapis.com/v1";
const V2 = "https://identitytoolkit.googleapis.com/v2";
const CREDENCIAIS_INVALIDAS = ["EMAIL_NOT_FOUND", "INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS", "USER_DISABLED", "INVALID_EMAIL"];
const CODIGO_INVALIDO = ["INVALID_VERIFICATION_CODE", "INVALID_MFA_PENDING_CREDENTIAL", "MISSING_MFA_PENDING_CREDENTIAL", "INVALID_CODE"];

export function criarFirebaseLegado(config, { fetchImpl = fetch, urlRetorno = "http://localhost" } = {}) {
  if (!config) return null;

  async function chamar(url, corpo) {
    const resposta = await fetchImpl(`${url}?key=${encodeURIComponent(config.chave)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo)
    });
    const dados = await resposta.json().catch(() => ({}));
    if (resposta.ok) return dados;
    const codigo = String(dados?.error?.message || `HTTP_${resposta.status}`).split(/[ :]/)[0];
    if (codigo.startsWith("TOO_MANY_ATTEMPTS")) throw muitasTentativas();
    const erro = new Error(codigo);
    erro.codigoFirebase = codigo;
    throw erro;
  }

  function resultadoDeEntrada(dados) {
    if (dados.mfaPendingCredential) {
      const fator = (dados.mfaInfo || []).find((f) => f.totpInfo) || dados.mfaInfo?.[0];
      return { situacao: "mfa", pendente: dados.mfaPendingCredential, inscricao: fator?.mfaEnrollmentId || "" };
    }
    return { situacao: "ok", idToken: dados.idToken };
  }

  function falhaInesperada(erro) {
    if (erro.status) return erro;
    console.error("[firebase-legado]", erro.codigoFirebase || erro.message);
    return indisponivel("A migração de contas antigas está indisponível no momento. Tente novamente mais tarde.", "MIGRACAO_INDISPONIVEL");
  }

  return {
    async entrarComSenha(email, senha) {
      try {
        return resultadoDeEntrada(await chamar(`${V1}/accounts:signInWithPassword`, { email, password: senha, returnSecureToken: true }));
      } catch (e) {
        if (CREDENCIAIS_INVALIDAS.includes(e.codigoFirebase)) return { situacao: "invalida" };
        throw falhaInesperada(e);
      }
    },

    // signInWithIdp cria a conta quando ela não existe: nesse caso a conta recém-criada é apagada
    async entrarComGoogle(idTokenGoogle) {
      let dados;
      try {
        dados = await chamar(`${V1}/accounts:signInWithIdp`, {
          postBody: `id_token=${encodeURIComponent(idTokenGoogle)}&providerId=google.com`,
          requestUri: urlRetorno,
          returnSecureToken: true
        });
      } catch (e) {
        throw falhaInesperada(e);
      }
      if (dados.isNewUser && dados.idToken) {
        await chamar(`${V1}/accounts:delete`, { idToken: dados.idToken }).catch((e) => console.error("[firebase-legado] remoção", e.message));
        return { situacao: "inexistente" };
      }
      return resultadoDeEntrada(dados);
    },

    async concluirSegundoFator(pendente, inscricao, codigo) {
      try {
        const dados = await chamar(`${V2}/accounts/mfaSignIn:finalize`, {
          mfaPendingCredential: pendente,
          mfaEnrollmentId: inscricao,
          totpVerificationInfo: { verificationCode: codigo }
        });
        return dados.idToken;
      } catch (e) {
        if (CODIGO_INVALIDO.includes(e.codigoFirebase)) return null;
        throw falhaInesperada(e);
      }
    },

    async conta(idToken) {
      let dados;
      try {
        dados = await chamar(`${V1}/accounts:lookup`, { idToken });
      } catch (e) {
        throw falhaInesperada(e);
      }
      const u = dados.users?.[0];
      if (!u) throw falhaInesperada(new Error("conta sem dados"));
      const google = (u.providerUserInfo || []).find((p) => p.providerId === "google.com");
      return {
        firebaseUid: u.localId,
        email: String(u.email || "").toLowerCase(),
        emailVerified: !!u.emailVerified,
        name: u.displayName || "",
        googleSub: google?.rawId || null
      };
    },

    // Lê o perfil do Firestore com o token do próprio usuário, respeitando as Security Rules existentes
    async perfil(idToken, uid) {
      const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projeto)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
      const ler = async (url) => {
        const resposta = await fetchImpl(url, { headers: { authorization: `Bearer ${idToken}` } });
        return resposta.ok ? (await resposta.json()).fields || {} : null;
      };
      const [publico, privado] = await Promise.all([ler(base), ler(`${base}/private/profile`)]);
      if (!publico) return null;
      const valor = (campos, nome) => campos?.[nome]?.stringValue ?? campos?.[nome]?.booleanValue;
      return {
        username: valor(publico, "username"),
        avatarStyle: valor(publico, "avatarStyle"),
        avatarSeed: valor(publico, "avatarSeed"),
        profileComplete: valor(publico, "profileComplete") === true,
        name: valor(privado, "name") || ""
      };
    },

    // O próprio Firebase envia o e-mail; a nova senha passa a valer no próximo login, que migra a conta
    async enviarRedefinicao(email) {
      try {
        await chamar(`${V1}/accounts:sendOobCode`, { requestType: "PASSWORD_RESET", email });
      } catch (e) {
        if (!CREDENCIAIS_INVALIDAS.includes(e.codigoFirebase)) console.error("[firebase-legado] redefinição", e.codigoFirebase || e.message);
      }
    }
  };
}
