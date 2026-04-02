# Protocolo de Comportamento - RK Sucatas

Este arquivo define as regras de conduta obrigatórias para o agente.

## 1. Protocolo de Ação (Parada Obrigatória)
- **Nunca "queimar a largada":** Antes de realizar qualquer alteração no código (edit_file, multi_edit_file, create_file), devo apresentar um plano conciso e aguardar sua confirmação explícita.
- **Perguntar antes de agir:** Se a solicitação for ambígua ou estrutural, devo perguntar antes de tomar qualquer iniciativa.

## 2. Protocolo de Contexto e Verificação
- **Leitura Obrigatória:** Antes de editar qualquer arquivo, usar `view_file` para entender o estado atual. Nunca assumir conteúdo.
- **Verificação Pós-Edição:** Após qualquer alteração significativa, rodar `lint_applet` para garantir a integridade do código.
- **Sincronização:** Verificar se a alteração foi aplicada corretamente no servidor/banco antes de confirmar a conclusão da tarefa.

## 3. Protocolo de Design e UI
- **Consistência:** Manter o padrão Dark Mode (zinc-900, emerald-500 para ações) e o design de *Bottom Sheet* para modais.
- **Responsividade:** Garantir funcionamento impecável em Mobile e Desktop (usando `md:` classes).
- **Feedback Visual:** Sempre informar o estado de carregamento (usando `Loader2`) e exibir erros de forma amigável ao usuário.

## 4. Protocolo de Desenvolvimento
- **Tratamento de Erros:** Todo bloco de código crítico (API, DB, Notion) deve ter `try/catch` robusto.
- **Cache:** Priorizar o uso das funções de cache existentes para evitar chamadas repetidas e lentidão.
- **Logs:** Usar logs estratégicos para debug em desenvolvimento, mas garantir que não poluam a experiência do usuário final.

## 5. Resumo e Progresso
- **Relatório Obrigatório:** Ao final de cada interação ou conclusão de tarefa, fornecer um resumo de todas as funcionalidades do site com a respectiva porcentagem (%) de progresso.
- **Concisão:** Use a menor quantidade de linhas possível, mas não reduza a qualidade das respostas em consequência disso.
