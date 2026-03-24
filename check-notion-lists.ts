import fs from 'fs';

const NOTION_TOKEN = "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";
const MOTOS_DATABASE_ID = "317dfa25a528805f9663ff0e6ebf0318";
const INVENTORY_DATABASE_ID = "2f4dfa25a52880c1b315f7e8953f5889";

async function fetchAllMotos() {
  let allResults: any[] = [];
  let hasMore = true;
  let nextCursor = undefined;

  while (hasMore) {
    const response = await fetch(`https://api.notion.com/v1/databases/${MOTOS_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        start_cursor: nextCursor,
        page_size: 100
      })
    });
    const data = await response.json();
    if (data.results) {
      allResults = [...allResults, ...data.results];
    }
    hasMore = data.has_more;
    nextCursor = data.next_cursor;
  }
  
  const motos = allResults.map(r => {
    const titleProp = Object.values(r.properties).find((p: any) => p.type === 'title') as any;
    return titleProp?.title?.[0]?.plain_text;
  }).filter(Boolean);
  
  return Array.from(new Set(motos)).sort();
}

async function fetchCategories() {
  const response = await fetch(`https://api.notion.com/v1/databases/${INVENTORY_DATABASE_ID}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28'
    }
  });
  const data = await response.json();
  const catProp = Object.entries(data.properties).find(([key, prop]: [string, any]) => 
    key.toLowerCase().includes('categoria') || key.toLowerCase().includes('cat')
  );
  
  if (catProp && (catProp[1] as any).type === 'multi_select') {
    return (catProp[1] as any).multi_select.options.map((opt: any) => opt.name).sort();
  } else if (catProp && (catProp[1] as any).type === 'select') {
    return (catProp[1] as any).select.options.map((opt: any) => opt.name).sort();
  }
  return [];
}

async function main() {
  const motos = await fetchAllMotos();
  const categories = await fetchCategories();
  
  console.log("MOTOS FROM NOTION:");
  console.log(JSON.stringify(motos, null, 2));
  
  console.log("\nCATEGORIES FROM NOTION:");
  console.log(JSON.stringify(categories, null, 2));
}

main();
