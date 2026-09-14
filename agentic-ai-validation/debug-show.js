(async () => {
  const host = "http://127.0.0.1:11434";
  const tags = await fetch(`${host}/api/tags`).then((r) => r.json());
  console.log("tags", tags.models && tags.models.map((m) => m.name));
  for (const body of [
    { name: "llama3.2:3b" },
    { model: "llama3.2:3b" },
    { name: "llama3.2:3b", model: "llama3.2:3b" },
  ]) {
    const res = await fetch(`${host}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log("show", JSON.stringify(body), res.status, text.slice(0, 180));
  }
})();
