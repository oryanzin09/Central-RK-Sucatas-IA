import dotenv from 'dotenv';
dotenv.config();

const NOTION_TOKEN = process.env.NOTION_TOKEN || "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";
const DATABASE_ID = process.env.NOTION_DATABASE_ID || process.env.NOTION_DB_ESTOQUE || "2f4dfa25a52880c1b315f7e8953f5889";
const NOTION_VERSION = '2022-06-28';

async function fetchAllFromNotion(databaseId: string) {
  let allResults: any[] = [];
  let cursor = undefined;
  let hasMore = true;
  
  while (hasMore) {
    const payload: any = { page_size: 100 };
    if (cursor) payload.start_cursor = cursor;
    
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    allResults = [...allResults, ...data.results];
    hasMore = data.has_more;
    cursor = data.next_cursor;
  }
  return allResults;
}

async function countCategories() {
  const items = await fetchAllFromNotion(DATABASE_ID);
  console.log(`Total items fetched: ${items.length}`);
  
  if (items.length > 0) {
    console.log("Sample item properties:", Object.keys(items[0].properties));
    console.log("Sample Categoria value:", JSON.stringify(items[0].properties.Categoria, null, 2));
  }

  const counts: Record<string, number> = {};
  
  items.forEach((item: any) => {
    const props = item.properties;
    // Inspect the structure of Categoria
    const catProp = props?.Categoria;
    let cat = 'Sem Categoria';
    if (catProp) {
        if (catProp.type === 'select') cat = catProp.select?.name || 'Sem Categoria';
        else if (catProp.type === 'multi_select') cat = catProp.multi_select?.map((s: any) => s.name).join(', ') || 'Sem Categoria';
        else if (catProp.type === 'rich_text') cat = catProp.rich_text?.map((r: any) => r.plain_text).join('') || 'Sem Categoria';
        else if (catProp.type === 'title') cat = catProp.title?.map((t: any) => t.plain_text).join('') || 'Sem Categoria';
    }
    counts[cat] = (counts[cat] || 0) + 1;
  });
  
  const ranking = Object.entries(counts)
    .filter(([cat]) => cat !== 'Sem Categoria')
    .sort((a, b) => b[1] - a[1]);
    
  console.log("Ranking de Categorias:");
  ranking.forEach(([cat, total], index) => {
    console.log(`${index + 1}º: ${cat} - ${total} itens`);
  });
}

countCategories().catch(console.error);
