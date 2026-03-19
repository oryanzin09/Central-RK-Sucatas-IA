async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/inventory');
    const json = await res.json();
    const inventory = json.data;
    console.log("Total rows:", inventory.length);
    console.log("Rows with estoque > 0:", inventory.filter(i => Number(i.estoque) > 0).length);
    console.log("Sum of estoque:", inventory.reduce((sum, i) => sum + (Number(i.estoque) || 0), 0));
  } catch (e) {
    console.error(e);
  }
}
test();
