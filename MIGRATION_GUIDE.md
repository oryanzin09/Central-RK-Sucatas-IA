# GUIA DE MIGRAÇÃO: RK SUCATAS

Este guia explica passo a passo como transferir o projeto RK Sucatas do AI Studio atual para uma nova conta do Google/AI Studio, sem perder dados ou configurações.

## Passo 1: Exportar o Código do AI Studio Atual
1. No AI Studio atual, clique no ícone de engrenagem (Configurações) no canto superior direito.
2. Selecione a opção **"Export as ZIP"** (Exportar como ZIP) ou conecte ao seu GitHub e faça o push do código.
3. Baixe o arquivo ZIP para o seu computador e extraia-o em uma pasta.

## Passo 2: Salvar as Variáveis de Ambiente (MUITO IMPORTANTE)
O projeto depende de várias chaves secretas que não vão no ZIP. Você precisa copiá-las:
1. No AI Studio atual, vá em **Settings > Environment Variables** (ou Secrets).
2. Copie TODOS os valores listados lá para um bloco de notas seguro. Você precisará deles na nova conta.
   - *Exemplos: `NOTION_API_KEY`, `NOTION_DATABASE_ID`, `ML_APP_ID`, `ML_SECRET_KEY`, etc.*

## Passo 3: Configurar o Novo Firebase (Na nova conta Google)
Como você está mudando de conta, o ideal é criar um novo projeto Firebase ou dar permissão para a nova conta no Firebase antigo. Se for criar um novo:
1. Acesse [console.firebase.google.com](https://console.firebase.google.com/) com a **nova conta**.
2. Clique em **"Adicionar projeto"** e siga os passos.
3. No menu lateral, vá em **Build > Firestore Database** e clique em "Criar banco de dados". Inicie em modo de produção.
4. Vá em **Build > Authentication**, clique em "Vamos começar" e ative o provedor **Google**.
5. Vá na engrenagem (Configurações do Projeto) > **Geral**. Role para baixo, clique no ícone web `</>` para adicionar um app web.
6. Copie o objeto `firebaseConfig` gerado.
7. No código extraído (Passo 1), abra o arquivo `firebase-applet-config.json` e substitua os valores pelos do seu novo projeto Firebase.

## Passo 4: Importar para o Novo AI Studio
1. Acesse o AI Studio com sua **nova conta**.
2. Crie um novo projeto em branco.
3. Faça o upload dos arquivos extraídos (você pode arrastar a pasta para o editor ou usar a integração com GitHub se tiver feito o push no Passo 1).
4. Vá em **Settings > Environment Variables** no novo AI Studio e cole todas as chaves que você salvou no Passo 2.

## Passo 5: Restaurar Regras do Firebase
1. No novo AI Studio, peça para a IA: *"Faça o deploy das regras do Firebase usando o arquivo firestore.rules"*.
2. Isso garantirá que o banco de dados tenha as permissões corretas.

## Passo 6: Entregar o Contexto para a Nova IA
1. No chat do novo AI Studio, envie a seguinte mensagem:
   *"Olá, acabei de migrar este projeto. Por favor, leia o arquivo `HANDOVER_FOR_AI.txt` na raiz do projeto para entender a arquitetura, as regras de negócio e o status atual antes de fazermos qualquer alteração."*

Pronto! Seguindo esses passos, o projeto RK Sucatas estará rodando perfeitamente na sua nova conta, com a nova IA totalmente ciente de como o sistema funciona.
