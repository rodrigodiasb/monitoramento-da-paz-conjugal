# Dias Sem Brigas

Aplicação web privada para um casal acompanhar, com humor e gamificação, os períodos de paz, ocorrências, reconciliações, recordes e conquistas.

## O que esta versão entrega

- Login por nome simples + senha.
- Firebase Authentication por trás do login; nenhuma senha fica no HTML ou JavaScript.
- Dois usuários autorizados: Rodrigo (administrador inicial) + segundo integrante configurável.
- Contador de dias sem brigas com pausa automática durante ocorrência ativa.
- Reconciliação bilateral: quem propõe não consegue confirmar a própria proposta.
- Histórico completo das ocorrências.
- Trilha de auditoria imutável para criação, edição, proposta, rejeição, cancelamento e resolução.
- Recorde histórico e Top 3 períodos de paz.
- Total de visitas, dias atuais, total de brigas, reconciliações, tempo monitorado, percentual de paz e demais indicadores.
- Títulos progressivos do casal.
- Marcos de 7, 15, 30, 50, 60, 90, 100, 180 e 365 dias.
- Conquistas visíveis e secretas.
- Banco dinâmico com centenas de frases humorísticas.
- Tela de comemoração com confetes em marcos, recordes e reconciliações.
- Interface responsiva para celular, tablet e computador.
- Publicação direta no GitHub Pages, sem build e sem servidor próprio.

## Firebase já configurado neste pacote

Projeto Firebase:

`monitoramento-da-paz-conjugal`

A configuração web fornecida anteriormente já está em `js/firebase.js`.

Usuário administrativo inicial:

- nome simples no app: `Rodrigo`
- e-mail do Firebase Authentication: `rodbcontato@gmail.com`
- UID autorizado: já incorporado às regras do Firestore

A senha de Rodrigo **não está no projeto**. O aplicativo usa a senha cadastrada no Firebase Authentication.

## Estrutura do projeto

```text
dias-sem-brigas-v2/
├── index.html
├── firestore.rules
├── manifest.webmanifest
├── .nojekyll
├── README.md
├── assets/
│   ├── heart-mark.svg
│   └── heart-maskable.svg
├── css/
│   └── styles.css
└── js/
    ├── app.js
    ├── auth.js
    ├── data.js
    ├── firebase.js
    ├── gamification.js
    ├── phrases.js
    ├── stats.js
    ├── ui.js
    └── utils.js
```

## Arquitetura do Firestore

```text
public/
└── authAliases
    └── aliases: mapa nome simples -> e-mail Firebase

authorizedUsers/
├── <UID Rodrigo>
└── <UID segundo usuário>

settings/
└── couple
    ├── coupleLabel
    ├── monitorStartAt
    ├── partnerName
    ├── partnerEmail
    └── partnerUid

system/
└── status
    ├── activeConflictId
    ├── currentPeaceStartAt
    ├── lastConflictAt
    └── lastResolvedAt

stats/
└── global
    └── totalVisits

conflicts/
└── <conflictId>
    ├── status
    ├── reason
    ├── startedAt
    ├── createdByUid
    ├── createdByName
    ├── daysBeforeConflict
    ├── resolutionProposal
    ├── resolvedAt
    ├── confirmedByUid
    ├── confirmedByName
    └── events/
        └── <eventId>
```

## Fluxo de uma briga

1. Um dos dois usuários registra data, hora e motivo.
2. O documento fica com status `active`.
3. O contador é pausado na quantidade de dias acumulada até o início da ocorrência.
4. Qualquer um dos dois pode clicar em **Considero resolvido**.
5. Essa ação cria uma proposta de reconciliação.
6. O próprio proponente não consegue confirmar a proposta.
7. O outro usuário recebe a pendência e escolhe:
   - `Concordo, paz restabelecida`; ou
   - `Ainda não considero resolvido`.
8. Se houver concordância, a ocorrência é encerrada e o contador reinicia a partir daquele momento.
9. Se houver rejeição, a ocorrência continua ativa e a proposta é retirada.
10. Todas essas movimentações ficam registradas na subcoleção `events`.

## Como as estatísticas são calculadas

Os indicadores são derivados do histórico para reduzir inconsistências.

- **Dias atuais sem brigas:** diferença entre o início da sequência atual e agora; durante conflito ativo, permanece pausado no valor atingido antes da ocorrência.
- **Recorde:** maior intervalo de paz identificado no histórico, incluindo a sequência atual.
- **Top 3:** três maiores intervalos de paz.
- **Média entre brigas:** média dos intervalos concluídos de paz antes das ocorrências.
- **Tempo médio de resolução:** média entre início e encerramento das ocorrências resolvidas.
- **Briga mais longa:** maior duração de ocorrência resolvida.
- **Reconciliação mais rápida:** menor duração de ocorrência resolvida.
- **Tempo total monitorado:** período entre `monitorStartAt` e agora.
- **Percentual de paz:** tempo monitorado menos duração dos conflitos, dividido pelo tempo monitorado.
- **Total de visitas:** incrementado após login, no máximo uma vez a cada 30 minutos por navegador/usuário, evitando aumento a cada simples recarregamento da página.

## Títulos progressivos

| Dias | Título |
|---|---|
| 0–6 | 🥉 Casal em Treinamento |
| 7–29 | 🥈 Casal Estável |
| 30–89 | 🥇 Mestres da Diplomacia |
| 90–179 | 👑 Lendas da Paz Conjugal |
| 180+ | 🛡️ Patrimônio Nacional da Resolução de Conflitos |

## Passo 1 — Atualizar as regras do Firestore

Esta nova versão usa regras diferentes da versão anterior porque agora haverá dois usuários autorizados de forma dinâmica.

No Firebase Console:

1. Abra **Firestore Database**.
2. Entre em **Regras**.
3. Apague as regras antigas.
4. Copie todo o conteúdo de `firestore.rules` deste pacote.
5. Clique em **Publicar**.

Não altere o UID do administrador já presente no arquivo.

## Passo 2 — Confirmar o login de Rodrigo

No Firebase Console:

1. Abra **Authentication**.
2. Confirme que o método **E-mail/senha** está ativado.
3. Confirme que existe o usuário `rodbcontato@gmail.com`.
4. Não coloque a senha dessa conta em nenhum arquivo do projeto.

A senha digitada no site será enviada diretamente ao Firebase Authentication.

## Passo 3 — Criar a segunda conta

Ainda em **Authentication > Users**:

1. Clique em **Adicionar usuário**.
2. Informe o e-mail real da segunda pessoa.
3. Defina uma senha segura.
4. Salve.
5. Copie o **UID** gerado pelo Firebase.

O nome simples, por exemplo `Digníssima`, não precisa ser o e-mail.

## Passo 4 — Publicar no GitHub Pages

### Repositório novo

1. Crie um repositório público, por exemplo `dias-sem-brigas`.
2. Descompacte este ZIP.
3. Envie **o conteúdo da pasta**, não o ZIP fechado.
4. `index.html` deve ficar diretamente na raiz do repositório.

Estrutura correta:

```text
seu-repositorio/
├── index.html
├── css/
├── js/
├── assets/
└── ...
```

### Ativar Pages

1. No repositório, abra **Settings**.
2. Entre em **Pages**.
3. Em **Build and deployment**, escolha `Deploy from a branch`.
4. Branch: `main`.
5. Pasta: `/(root)`.
6. Clique em **Save**.

O endereço será semelhante a:

`https://SEU-USUARIO.github.io/dias-sem-brigas/`

## Passo 5 — Autorizar o domínio no Firebase Authentication

Depois que o GitHub Pages gerar o endereço:

1. Firebase Console > **Authentication**.
2. Abra **Settings**.
3. Procure **Authorized domains**.
4. Adicione somente o host, por exemplo:
   `SEU-USUARIO.github.io`

Não coloque `/dias-sem-brigas/` nesse campo.

## Passo 6 — Primeiro acesso e configuração do casal

1. Abra o site publicado.
2. Digite `Rodrigo` no campo de nome.
3. Digite a senha real da conta `rodbcontato@gmail.com` cadastrada no Firebase.
4. No primeiro acesso, o aplicativo cria automaticamente os documentos iniciais do monitoramento.
5. Clique no perfil no canto superior direito.
6. Entre em **Configurações**.
7. Preencha:
   - nome do casal;
   - data de início do monitoramento;
   - nome simples do segundo usuário, por exemplo `Digníssima`;
   - e-mail da conta criada no Firebase;
   - UID copiado do Firebase.
8. Salve.

Depois disso, a segunda pessoa poderá acessar usando apenas:

- o nome simples configurado;
- a senha da conta dela no Firebase.

O usuário não precisa digitar e-mail na tela do aplicativo.

## Por que o nome simples funciona sem guardar senha no código?

O documento `public/authAliases` associa o apelido de login ao e-mail usado pelo Firebase Authentication. O navegador converte, por exemplo, `Rodrigo` no e-mail da conta e envia a senha diretamente ao Firebase.

Esse documento **não contém senha**.

Como o site é 100% cliente e não possui servidor próprio, o e-mail associado ao nome de login pode ser inspecionado por alguém que examine as requisições do aplicativo. Isso não concede acesso: a autenticação continua exigindo a senha e o Firestore ainda verifica se o UID pertence a um dos dois usuários autorizados.

## Segurança

As regras incluídas aplicam estas restrições:

- somente usuários autenticados e autorizados leem os dados privados do casal;
- Rodrigo, pelo UID inicial, funciona como administrador de configuração;
- o segundo usuário só passa a acessar depois de ter seu UID cadastrado em `authorizedUsers`;
- apenas Rodrigo altera a lista de usuários e as configurações estruturais;
- ambos podem registrar e movimentar ocorrências;
- eventos da trilha de auditoria podem ser criados, mas não editados ou excluídos;
- qualquer coleção não prevista pelas regras permanece bloqueada.

Observação: como os dois integrantes são usuários confiáveis do mesmo casal, as regras autorizam ambos a movimentar os documentos operacionais. A trilha de eventos permite identificar quem executou cada ação pelo aplicativo.

## Sobre senha simples como “123”

Tecnicamente o Firebase pode aceitar uma senha que cumpra a política configurada na conta, mas não é recomendado usar uma senha previsível como `123` em um site publicado na internet. Use uma senha que os dois consigam memorizar, mas que não seja trivial.

## Banco de frases

`js/phrases.js` gera mais de mil combinações possíveis de mensagens institucionais e diplomáticas, além de frases românticas e mensagens específicas para conflito e reconciliação. A escolha muda de acordo com o dia, a sequência atual e o usuário.

## Migração da versão antiga

Esta versão foi construída do zero e não depende das coleções da aplicação anterior.

Coleções antigas como `occurrences` ou documentos antigos como `system/main` podem permanecer no Firestore sem interferir no novo aplicativo. Esta versão usa `conflicts`, `system/status`, `settings/couple`, `stats/global`, `public/authAliases` e `authorizedUsers`.

Não apague dados antigos antes de confirmar que não precisa mais deles.

## Teste recomendado após a publicação

1. Login de Rodrigo.
2. Configuração da segunda conta.
3. Logout.
4. Login da segunda pessoa pelo nome simples.
5. Registrar uma ocorrência com um usuário.
6. Clicar em **Considero resolvido**.
7. Confirmar que o próprio usuário não consegue homologar a própria proposta.
8. Entrar com o outro login.
9. Confirmar a reconciliação.
10. Verificar se o contador reiniciou.
11. Conferir o Histórico Diplomático e a trilha de movimentações.
12. Conferir as estatísticas.

## Firebase SDK

O projeto usa módulos ES do Firebase JavaScript SDK 12.19.0 diretamente do CDN oficial do Google. Não existe etapa de `npm install` ou build.

## Limitação conhecida antes da configuração final

O segundo usuário ainda não está preenchido neste pacote porque nenhum e-mail/UID da segunda conta foi fornecido. Isso não exige alteração de código: basta criar a conta no Firebase Authentication e cadastrá-la pela tela **Configurações**, após o primeiro login de Rodrigo.


## Histórico de acesso

A versão 2.1 adiciona uma trilha de login para o casal. Cada autenticação concluída com sucesso gera um documento na coleção `accessLogs` com o UID, nome exibido e horário do acesso. Atualizações da página e restaurações automáticas da sessão não são registradas como novos logins.

No painel, a área **Memória Oficial** passa a mostrar também **Histórico de acesso**, com os 50 logins mais recentes em ordem decrescente de data/hora. Os dois usuários autorizados podem consultar o histórico. Pelo aplicativo, os registros são imutáveis: não podem ser editados ou excluídos.

### Regra necessária no Firestore

Publique o arquivo `firestore.rules` desta versão antes de testar o recurso. A coleção `accessLogs` só aceita criação quando o `userUid` gravado corresponde ao usuário autenticado.


### Diagnóstico do Histórico de acesso — v2.1.1

O bloco de acessos agora é independente do carregamento do restante do painel. Se a leitura da coleção `accessLogs` falhar, a interface deixa de ficar presa em “Carregando…” e mostra um aviso específico. As causas mais comuns são: regras antigas ainda publicadas no Firestore, arquivos JavaScript da versão anterior no GitHub Pages ou cache do navegador. Após atualizar os arquivos e as Rules, faça logout/login novamente para gerar um novo registro de acesso.
