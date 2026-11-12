// Roda só em portal.gupy.io/my/applications. Não faz rede e não lê nada até o popup pedir.
// Lê o texto visível dos cards e devolve para o popup. Nada é guardado aqui.
import { lerCartao } from "./leitor.js";

function cartaoDe(elemento) {
  let atual = elemento;
  for (let i = 0; i < 6 && atual; i++) {
    const texto = atual.innerText ?? "";
    if (texto.length < 800 && /Ver andamento/i.test(texto)) return atual;
    atual = atual.parentElement;
  }
  return null;
}

chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
  if (mensagem?.tipo !== "ler") return false;
  const vistos = new Set();
  const cartoes = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!/Seu\s+Progresso/i.test(el.childElementCount ? "" : el.textContent ?? "")) continue;
    const cartao = cartaoDe(el);
    if (!cartao || vistos.has(cartao)) continue;
    vistos.add(cartao);
    const lido = lerCartao(cartao.innerText);
    if (lido) cartoes.push(lido);
  }
  responder({ cartoes });
  return false;
});
