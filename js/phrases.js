import { deterministicIndex } from "./utils.js";

const institutionalOpeners = [
  "Boletim oficial:", "Comunicado extraordinário:", "Relatório de situação:", "Nota técnica:",
  "Despacho do dia:", "Parecer conjunto:", "Auditoria da convivência:", "Registro institucional:",
  "Ata resumida:", "Informe diplomático:"
];

const institutionalSubjects = [
  "a convivência doméstica", "a diplomacia do casal", "o pacto de boa vizinhança", "a operação harmonia",
  "o sistema de carinho", "a cooperação bilateral", "o acordo de paz", "o relacionamento em produção",
  "a central de afetos", "o protocolo de conversa"
];

const institutionalStates = [
  "segue dentro dos parâmetros esperados", "permanece estável e sem intercorrências", "opera sem necessidade de contingência",
  "mantém indicadores positivos", "apresenta excelente aderência ao diálogo", "segue sem abertura de sindicância",
  "continua em conformidade com o bom senso", "mantém nível satisfatório de paciência", "registra desempenho acima da média",
  "avança com risco reduzido de reunião extraordinária"
];

const militaryOpeners = ["Situação do perímetro:", "Comando informa:", "Ordem do dia:", "Operação casal:", "Central de comando:", "Briefing afetivo:"];
const militarySubjects = ["as forças do carinho", "a tropa da paciência", "a unidade diplomática", "o batalhão do bom senso", "a missão harmonia", "o efetivo conjugal"];
const militaryStates = ["mantém posição sem hostilidades", "avança com moral elevada", "segue sem necessidade de reforços", "opera em total coordenação", "preserva a zona de paz", "cumpre a missão sem baixas emocionais"];

const romantic = [
  "Mais um dia lembrando que escolher conversar também é escolher um ao outro.",
  "A paz não é ausência de diferença; é saber continuar do mesmo lado mesmo quando a opinião muda.",
  "Carinho bem distribuído continua sendo uma excelente política de prevenção de crises.",
  "Hoje o placar é simples: vocês dois, do mesmo lado.",
  "Cada dia tranquilo é menos sobre sorte e mais sobre parceria.",
  "Relacionamento bom não é o que nunca diverge, é o que sabe voltar para perto.",
  "Pequenos gestos seguem fazendo um trabalho enorme pela paz doméstica.",
  "O afeto continua sendo a única burocracia que vale preencher todos os dias.",
  "Ouvir com atenção ainda é uma das tecnologias mais avançadas do relacionamento.",
  "Se der para escolher entre ter razão e preservar o carinho, talvez exista uma terceira opção: conversar.",
  "Mais um dia para lembrar que vocês são uma dupla, não duas bancadas de oposição.",
  "A melhor estatística continua sendo a vontade de ficar bem um com o outro.",
  "Paz também se constrói no café, na mensagem curta e naquele 'tá tudo bem?' dito de verdade.",
  "O relacionamento segue ganhando pontos por cooperação espontânea.",
  "Hoje a missão é simples: manter leve o que merece ser leve."
];

const reconciliation = [
  "A paz foi oficialmente restabelecida. Fica autorizado voltar ao carinho sem necessidade de recurso.",
  "Reconciliação confirmada pelas duas partes. Processo encerrado com possibilidade de abraço imediato.",
  "Conflito encerrado. O sistema recomenda café, conversa e nenhuma reconstituição desnecessária dos fatos.",
  "Termo de paz homologado. O contador volta a trabalhar a partir de agora.",
  "As duas partes concordaram: assunto resolvido. A diplomacia agradece a colaboração.",
  "Paz restabelecida com sucesso. Nenhum vencedor, dois beneficiados.",
  "Conciliação concluída. O Centro de Monitoramento declara encerrada a fase de nuvens carregadas.",
  "Acordo bilateral confirmado. O bom senso retomou suas atividades normais."
];

const conflict = [
  "O contador está pausado. Antes da estatística, vem a conversa.",
  "Há uma ocorrência ativa. O sistema recomenda reduzir o volume e aumentar a escuta.",
  "Alerta diplomático: ainda existe assunto pendente entre as duas partes.",
  "A paz está em manutenção. O retorno depende de concordância bilateral.",
  "Situação em aberto. Nenhum algoritmo substitui uma conversa bem feita.",
  "O sistema identificou turbulência doméstica. A prioridade agora é resolver, não pontuar.",
  "Contador em pausa técnica. A retomada exige um acordo dos dois lados.",
  "Há nuvens no radar, mas o protocolo continua sendo diálogo, respeito e tempo."
];

function buildInstitutionalBank() {
  const bank = [];
  for (const opener of institutionalOpeners) {
    for (const subject of institutionalSubjects) {
      for (const state of institutionalStates) {
        bank.push(`${opener} ${subject} ${state}.`);
      }
    }
  }
  return bank;
}

function buildMilitaryBank() {
  const bank = [];
  for (const opener of militaryOpeners) {
    for (const subject of militarySubjects) {
      for (const state of militaryStates) {
        bank.push(`${opener} ${subject} ${state}.`);
      }
    }
  }
  return bank;
}

export const PHRASE_BANK = [
  ...buildInstitutionalBank(),
  ...buildMilitaryBank(),
  ...romantic
];

export const TOTAL_GENERATED_PHRASES = PHRASE_BANK.length;

export function getDailyPhrase({ days = 0, userKey = "casal", conflictActive = false, now = new Date() }) {
  if (conflictActive) {
    return conflict[deterministicIndex(`${now.toDateString()}-${userKey}`, conflict.length)];
  }
  const seed = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${days}-${userKey}`;
  return PHRASE_BANK[deterministicIndex(seed, PHRASE_BANK.length)];
}

export function getReconciliationPhrase(seed = Date.now()) {
  return reconciliation[deterministicIndex(seed, reconciliation.length)];
}
