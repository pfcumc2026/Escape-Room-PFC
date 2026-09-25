// Regras de negócio compartilhadas (espelhadas nas Security Rules)

export class Limites {
  static maxIntegrantes = 4;
  static usernameMin = 3;
  static usernameMax = 20;
  static senhaMin = 8;
  static mensagemMax = 300;
  static mensagensPorJanela = 15;
  static janelaSegundos = 60;
  static intervaloMinimoSegundos = 2;
  static intervaloCriarGrupoSegundos = 30;
  static horasValidadeMensagem = 24;
}
