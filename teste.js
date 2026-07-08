let listaAvarias = [];
let indexSelecionadoContexto = null;
// Altere para a constante correta de sua Store de Avarias se for diferente de STORE_NAME
const INVENTORY_STORE = "avariasStore";

window.addEventListener("DOMContentLoaded", () => {
  carregarDadosIndexedDB();

  document.addEventListener("click", (e) => {
    const popover = document.getElementById("globalPopover");
    if (
      !e.target.closest(".btn-action-trigger") &&
      !e.target.closest("#globalPopover")
    ) {
      popover.classList.remove("active");
    }
  });
});

async function carregarDadosIndexedDB() {
  try {
    const db = await abrirBanco();
    listaAvarias = await new Promise((resolve, reject) => {
      const transaction = db.transaction(INVENTORY_STORE, "readonly");
      const store = transaction.objectStore(INVENTORY_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const todos = request.result || [];
        // Filtra apenas registros que contenham dados de avaria (ou baseado na sua flag de tipo se houver)
        // Caso seu banco use chaves diferentes ou unificadas, deixamos adaptável:
        resolve(todos);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Erro ao ler dados do IndexedDB:", e);
    listaAvarias = [];
  }
  renderAvarias();
}

async function salvarAvariaNoIndexedDB(avaria) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INVENTORY_STORE, "readwrite");
    const store = transaction.objectStore(INVENTORY_STORE);
    const request = store.put(avaria);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deletarAvariaNoIndexedDB(id) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INVENTORY_STORE, "readwrite");
    const store = transaction.objectStore(INVENTORY_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function renderAvarias() {
  const container = document.getElementById("avariasContainer");
  container.innerHTML = "";

  if (listaAvarias.length === 0) {
    container.innerHTML =
      '<div class="empty-message">Nenhum registro de avaria encontrado.</div>';
    return;
  }

  listaAvarias.forEach((avaria, index) => {
    const card = document.createElement("div");
    card.className = "balanco-card";

    let iconHtml = "";
    if (avaria.status === "aberto" || avaria.status === "open") {
      iconHtml = `<i class="fa-solid fa-fire open status-icon"></i>`;
    } else if (avaria.status === "encerrado" || avaria.status === "success") {
      iconHtml = `<i class="fa-solid fa-circle-check status-icon success"></i>`;
    } else {
      iconHtml = `<i class="fa-solid fa-circle-xmark status-icon canceled"></i>`;
    }

    const exibicaoId = avaria.id !== undefined ? avaria.id : index + 1;
    // Valida se o registro veio de avarias (loja) ou balanço padrão (name)
    const nomeExibicao = avaria.loja || avaria.name || "Sem identificação";

    card.innerHTML = `
                            <div class="balanco-info">
                                <div class="balanco-id">Avaria #${exibicaoId}</div>
                                <div class="balanco-name">${nomeExibicao}</div>
                                <div class="balanco-date">Operador: ${avaria.operador || "Não informado"}</div>
                            </div>
                            <div class="balanco-actions-area">
                                ${iconHtml}
                                <button class="btn-action-trigger" data-index="${index}">
                                    <i class="fa-solid fa-ellipsis-vertical"></i>
                                </button>
                            </div>
                        `;

    card.querySelector(".btn-action-trigger").addEventListener("click", (e) => {
      e.stopPropagation();
      togglePopover(e.currentTarget, index);
    });

    container.appendChild(card);
  });
}

function togglePopover(button, index) {
  const popover = document.getElementById("globalPopover");
  const btnToggleStatus = document.getElementById("btnToggleStatus");
  indexSelecionadoContexto = index;

  const item = listaAvarias[index];

  if (item.status === "encerrado" || item.status === "success") {
    btnToggleStatus.textContent = "Reabrir";
  } else {
    btnToggleStatus.textContent = "Encerrar";
  }

  const rect = button.getBoundingClientRect();
  const containerRect = document
    .getElementById("appContainer")
    .getBoundingClientRect();

  popover.style.top = `${rect.top - containerRect.top - 10}px`;
  popover.style.left = `${rect.left - containerRect.left - 115}px`;

  popover.classList.toggle("active");
}

async function handleMenuAction(acao) {
  const popover = document.getElementById("globalPopover");
  popover.classList.remove("active");

  if (indexSelecionadoContexto === null) return;
  const item = listaAvarias[indexSelecionadoContexto];

  const identificadorLink =
    item.id !== undefined ? item.id : indexSelecionadoContexto;

  if (acao === "detalhes") {
    window.location.href = `avarias.html?index=${identificadorLink}`;
  } else if (acao === "exportar") {
    abrirModalShare();
  } else if (acao === "toggleStatus") {
    if (item.status === "encerrado" || item.status === "success") {
      item.status = "aberto";
    } else {
      item.status = "encerrado";
    }
    await salvarAvariaNoIndexedDB(item);
    await carregarDadosIndexedDB();
  } else if (acao === "cancelar") {
    const identificadorNome = item.loja || item.name || "";
    if (
      confirm(
        `Tem certeza que deseja apagar o registro de avaria de "${identificadorNome}"?`,
      )
    ) {
      if (item.id !== undefined) {
        await deletarAvariaNoIndexedDB(item.id);
      } else {
        listaAvarias.splice(indexSelecionadoContexto, 1);
      }
      await carregarDadosIndexedDB();
    }
  }
}

function abrirModalShare() {
  const item = listaAvarias[indexSelecionadoContexto];
  const itens = item.itens || [];

  if (itens.length === 0) {
    alert("Este registro de avaria não possui itens coletados para exportar.");
    return;
  }

  document.getElementById("modalShare").classList.add("active");
}

function fecharModalShare() {
  document.getElementById("modalShare").classList.remove("active");
}

// ========================================================
// GERAÇÃO DE ARQUIVOS (JSON & HTML)
// ========================================================

function gerarConteudo(tipo) {
  const item = listaAvarias[indexSelecionadoContexto];
  const nomeLoja = item.loja || item.name || "avaria";
  const nomeArquivoSanitizado = nomeLoja
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_");

  if (tipo === "json") {
    const stringJson = JSON.stringify(item, null, 2);
    return {
      blob: new Blob([stringJson], { type: "application/json;charset=utf-8" }),
      filename: `avaria_${nomeArquivoSanitizado}.json`,
      text: stringJson,
    };
  } else {
    // Renderiza um documento HTML limpo contendo uma tabela estilizada com os dados coletados
    let linhasTabela = (item.itens || [])
      .map(
        (i) => `
                            <tr>
                                <td style="padding:10px; border-bottom:1px solid #ddd;">${i.codigo}</td>
                                <td style="padding:10px; border-bottom:1px solid #ddd;">${i.descricaoManual || i.descricao || "Produto Cadastrado"}</td>
                                <td style="padding:10px; border-bottom:1px solid #ddd; text-align:center;">${i.quantidade}</td>
                                <td style="padding:10px; border-bottom:1px solid #ddd;">${i.localizacao || "-"}</td>
                            </tr>
                        `,
      )
      .join("");

    let templateHtml = `
                            <!DOCTYPE html>
                            <html lang="pt-BR">
                            <head>
                                <meta charset="UTF-8">
                                <title>Relatório de Avarias - ${nomeLoja}</title>
                            </head>
                            <body style="font-family:sans-serif; margin:30px; color:#333; background-color:#f4f7fc;">
                                <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                                    <h2 style="color:#333; margin-bottom:5px;">Relatório de Produtos Avariados</h2>
                                    <p style="margin:2px 0; color:#666;"><strong>Origem/Loja:</strong> ${nomeLoja}</p>
                                    <p style="margin:2px 0; color:#666;"><strong>Operador:</strong> ${item.operador || "Não informado"}</p>
                                    <p style="margin:2px 0; color:#666;"><strong>Status:</strong> ${item.status ? item.status.toUpperCase() : "ABERTO"}</p>
                                    <table style="width:100%; margin-top:20px; border-collapse:collapse; text-align:left;">
                                        <thead>
                                            <tr style="background:#333; color:#fff;">
                                                <th style="padding:10px;">Código</th>
                                                <th style="padding:10px;">Descrição do Item</th>
                                                <th style="padding:10px; text-align:center;">Qtd</th>
                                                <th style="padding:10px;">Localização</th>
                                            </tr>
                                        </thead>
                                        <tbody>${linhasTabela}</tbody>
                                    </table>
                                </div>
                            </body>
                            </html>
                        `;
    return {
      blob: new Blob([templateHtml], { type: "text/html;charset=utf-8" }),
      filename: `relatorio_${nomeArquivoSanitizado}.html`,
      text: templateHtml,
    };
  }
}

function baixarArquivo(tipo) {
  const arquivo = gerarConteudo(tipo);

  const linkTemporario = document.createElement("a");
  linkTemporario.href = URL.createObjectURL(arquivo.blob);
  linkTemporario.download = arquivo.filename;

  document.body.appendChild(linkTemporario);
  linkTemporario.click();
  document.body.removeChild(linkTemporario);
}

// Compartilhamento Web Nativo (Funciona perfeitamente em dispositivos Mobile/Android/iOS)

async function compartilharNativo() {
  const item = listaAvarias[indexSelecionadoContexto];
  const nomeLoja = item.loja || item.name || "Avaria";

  // Cria um resumo simples em texto legível para o WhatsApp/E-mail
  let resumoTexto = `*Relatório de Avarias - ${nomeLoja}*\n`;
  resumoTexto += `Operador: ${item.operador || "Não informado"}\n\n`;
  resumoTexto += `Itens Coletados:\n`;

  (item.itens || []).forEach((i) => {
    const desc = i.descricaoManual || i.descricao || "Item";
    resumoTexto += `- Cod: ${i.codigo} | Qtd: ${i.quantidade} | ${desc}\n`;
  });

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Avarias - ${nomeLoja}`,
        text: resumoTexto,
      });
    } catch (err) {
      console.log("Compartilhamento cancelado ou não executado: ", err);
    }
  } else {
    // Fallback para área de transferência caso o navegador de desktop seja antigo e não dê suporte
    try {
      await navigator.clipboard.writeText(resumoTexto);
      alert(
        "Texto do relatório copiado para a Área de Transferência com sucesso! Agora você pode colá-lo no WhatsApp.",
      );
    } catch (err) {
      alert("O seu navegador não possui suporte para compartilhamento nativo.");
    }
  }
}
