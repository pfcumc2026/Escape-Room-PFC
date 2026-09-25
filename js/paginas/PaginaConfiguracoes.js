// Configurações: tema, dados, 2FA (TOTP), senha e exclusão de conta

import { PaginaProtegida } from "./PaginaProtegida.js";
import { Dom } from "../nucleo/Dom.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoConta } from "../servicos/ServicoConta.js";
import { InterruptorTema } from "../componentes/InterruptorTema.js";
import { ItemLista } from "../componentes/ItemLista.js";
import { Lista } from "../componentes/Lista.js";
import { PainelDoisFatores } from "../componentes/PainelDoisFatores.js";
import { PainelExclusaoConta } from "../componentes/PainelExclusaoConta.js";

export class PaginaConfiguracoes extends PaginaProtegida {
  async montar() {
    this.conta = new ServicoConta(this.sessao.usuario);

    new InterruptorTema(this.el("switch-tema"));
    this.#montarDados();
    this.#montarSenha();

    new PainelDoisFatores(this.conta, this.sessao.usuario.email || this.sessao.perfil.username).iniciar();
    new PainelExclusaoConta(this.conta, this.sessao.perfil).iniciar();

    this.el("btn-sair").addEventListener("click", () => this.controle.sair());
  }

  #montarDados() {
    const lista = new Lista(this.el("meus-dados"));
    this.conta.resumo(this.sessao.perfil).forEach(([rotulo, valor]) => {
      const item = new ItemLista();
      item.meta(rotulo);
      item.nome(valor);
      lista.adicionar(item);
    });
  }

  #montarSenha() {
    this.btnSenha = this.el("btn-trocar-senha");
    if (!this.conta.usaSenha) {
      this.btnSenha.disabled = true;
      Dom.texto("#aviso-senha", "Sua conta entra pelo Google, então a senha é gerenciada pela própria conta Google.");
    }
    this.btnSenha.addEventListener("click", () => this.#trocarSenha());
  }

  async #trocarSenha() {
    Dom.ocupado(this.btnSenha, true, "Enviando...");
    try {
      await this.conta.enviarTrocaSenha();
      notificador.sucesso("Link de troca de senha enviado para o seu e-mail.");
    } catch (e) {
      notificador.falha(e, "Não foi possível enviar o link.");
    }
    Dom.ocupado(this.btnSenha, false);
  }
}
