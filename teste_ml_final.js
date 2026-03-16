import mlClient from './services/mlClient.js';

async function testar() {
  console.log('\n🔍 TESTANDO CONEXÃO COM MERCADO LIVRE\n');
  
  const result = await mlClient.testConnection();
  console.log(result);
  
  if (result.success) {
    console.log('\n📊 Buscando perguntas...');
    const questions = await mlClient.getQuestions('UNANSWERED', 5);
    console.log(`Perguntas pendentes: ${questions.total}`);
  }
}

testar();
