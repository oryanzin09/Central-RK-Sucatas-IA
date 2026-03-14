
const NOTION_TOKEN = "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";
const MOTOS_DATABASE_ID = "317dfa25a528805f9663ff0e6ebf0318";

async function checkNotion() {
  const response = await fetch(`https://api.notion.com/v1/databases/${MOTOS_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({ page_size: 10 })
  });
  const data = await response.json();
  console.log(JSON.stringify(data.results.map(r => r.properties.Fotos || r.properties.Imagem), null, 2));
}

checkNotion();
