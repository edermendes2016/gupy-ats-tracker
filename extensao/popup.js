// Popup: pede a leitura à aba ativa e envia cada card ao tracker local (127.0.0.1).
const BFF = "http://127.0.0.1:3000";
const saida = document.getElementById("resultado");

document.getElementById("ler").addEventListener("click", async () => {
  saida.textContent = "Lendo…";
  try {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    const resposta = await chrome.tabs.sendMessage(aba.id, { tipo: "ler" });
    const cartoes = resposta?.cartoes ?? [];
    if (!cartoes.length) {
      saida.textContent = "Nenhum card com progresso encontrado. Abra Minhas candidaturas.";
      return;
    }
    let enviados = 0;
    const faltando = [];
    for (const c of cartoes) {
      const r = await fetch(`${BFF}/api/aventura/progresso`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(c),
      });
      if (r.ok) enviados++;
      else faltando.push(`${c.empresa} · ${c.cargo}`);
    }
    saida.textContent =
      `${enviados} de ${cartoes.length} etapas enviadas.` +
      (faltando.length ? `\nNão cadastradas (cadastre a vaga antes):\n- ${faltando.join("\n- ")}` : "");
  } catch (erro) {
    saida.textContent = `Não consegui ler. Confira se o tracker está rodando em ${BFF}. (${erro.message})`;
  }
});
