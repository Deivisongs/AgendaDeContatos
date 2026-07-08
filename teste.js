let listaAvarias = [];
let indexSelecionadoContexto = null;
const INVENTORY_STORE = "avariasStore";
let mapaProdutosCache = null; // Cache para evitar ler o CSV múltiplas vezes

window.addEventListener("DOMContentLoaded", () => {
  carregarDadosIndexedDB();
  carregarProdutosCSV(); // Pré-carrega o CSV ao iniciar a página

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

// Função para ler o arquivo produtos.csv e transformá-lo em um mapa rápido de busca
async function carregarProdutosCSV() {
  try {
    const response = await fetch("produtos.csv");
    if (!response.ok)
      throw new Error("Não foi possível carregar o arquivo produtos.csv");
    const textoCsv = await response.text();

    mapaProdutosCache = new Map();
    const linhas = textoCsv.split(/\r?\n/);

    linhas.forEach((linha) => {
      if (!linha.trim()) return;
      // Trata delimitador comum de CSV (ponto e vírgula ou vírgula)
      const colunas = linha.includes(";") ? linha.split(";") : linha.split(",");
      if (colunas.length >= 2) {
        const codigo = colunas[0].trim();
        const descricao = colunas[1].trim();
        mapaProdutosCache.set(codigo, descricao);
      }
    });
  } catch (error) {
    console.error("Erro ao processar produtos.csv:", error);
  }
}

// Retorna a descrição correta baseada no código do produto
function obterDescricaoDoProduto(item) {
  if (mapaProdutosCache && mapaProdutosCache.has(item.codigo)) {
    return mapaProdutosCache.get(item.codigo);
  }
  return item.descricaoManual || item.descricao || "Produto Coletado";
}

async function carregarDadosIndexedDB() {
  try {
    const db = await abrirBanco();
    listaAvarias = await new Promise((resolve, reject) => {
      const transaction = db.transaction(INVENTORY_STORE, "readonly");
      const store = transaction.objectStore(INVENTORY_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
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
  btnToggleStatus.textContent =
    item.status === "encerrado" || item.status === "success"
      ? "Reabrir"
      : "Encerrar";

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
    item.status =
      item.status === "encerrado" || item.status === "success"
        ? "aberto"
        : "encerrado";
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
// NOVOS MÉTODOS DE COMPARTILHAMENTO ATUALIZADOS
// ========================================================

async function compartilharItem(formato) {
  const item = listaAvarias[indexSelecionadoContexto];
  const nomeLoja = item.loja || item.name || "avaria";
  const nomeArquivoSanitizado = nomeLoja.toLowerCase().replace(/[^a-z0-9]/g, "_");

  if (formato === "json") {
    // Transforma o objeto JSON em texto formatado para envio
    const stringJson = JSON.stringify(item, null, 2);
    
    // Texto legível que acompanhará o envio (ótimo para WhatsApp / E-mail)
    let textoEnvio = `*Relatório de Avaria - ${nomeLoja}*\n`;
    textoEnvio += `Operador: ${item.operador || "Não informado"}\n`;
    textoEnvio += `Status: ${item.status || "aberto"}\n\n`;
    textoEnvio += `Dados Técnicos (JSON):\n\`\`\`json\n${stringJson}\n\`\`\``;

    // Se o navegador der suporte ao compartilhamento de texto simples
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Dados JSON - ${nomeLoja}`,
          text: textoEnvio // Enviando o conteúdo diretamente como texto estruturado
        });
      } catch (err) {
        console.log("Compartilhamento cancelado ou falhou:", err);
      }
    } else {
      // Fallback robusto para desktops ou navegadores antigos
      try {
        await navigator.clipboard.writeText(stringJson);
        alert("O conteúdo JSON foi copiado para a sua Área de Transferência! Você já pode colá-lo no WhatsApp ou e-mail.");
      } catch (clipErr) {
        alert("Não foi possível compartilhar ou copiar os dados automaticamente.");
      }
    }
  } 
  else if (formato === "pdf") {
    fecharModalShare();

    // Monta as linhas buscando a descrição correta no produtos.csv
    let linhasTabela = (item.itens || [])
      .map((i) => {
        const descricaoReal = obterDescricaoDoProduto(i);
        return `
          <tr>
              <td style="padding:10px; border-bottom:1px solid #ddd;">${i.codigo}</td>
              <td style="padding:10px; border-bottom:1px solid #ddd;">${descricaoReal}</td>
              <td style="padding:10px; border-bottom:1px solid #ddd; text-align:center;">${i.quantidade}</td>
              <td style="padding:10px; border-bottom:1px solid #ddd;">${i.localizacao || "-"}</td>
          </tr>
        `;
      })
      .join("");

    let templateHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <title>Relatório de Avarias - ${nomeLoja}</title>
          <style>
              body { font-family: sans-serif; color: #333; padding: 20px; background: #fff; }
              .container { max-width: 800px; margin: 0 auto; }
              h2 { color: #2d3748; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 8px; }
              p { margin: 4px 0; color: #4a5568; font-size: 0.95rem; }
              table { width: 100%; margin-top: 25px; border-collapse: collapse; text-align: left; }
              th { background: #333; color: #fff; padding: 10px; font-size: 0.9rem; }
              @media print {
                  body { padding: 0; }
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h2>Relatório de Produtos Avariados</h2>
              <p><strong>Origem/Loja:</strong> ${nomeLoja}</p>
              <p><strong>Operador:</strong> ${item.operador || "Não informado"}</p>
              <p><strong>Status:</strong> ${item.status ? item.status.toUpperCase() : "ABERTO"}</p>
              
              <table>
                  <thead>
                      <tr>
                          <th style="width: 20%;">Código</th>
                          <th style="width: 50%;">Descrição do Item</th>
                          <th style="width: 10%; text-align:center;">Qtd</th>
                          <th style="width: 20%;">Localização</th>
                      </tr>
                  </thead>
                  <tbody>${linhasTabela}</tbody>
              </table>
          </div>
          <script>
              window.onload = function() {
                  window.print();
                  setTimeout(() => { window.close(); }, 500);
              }
          </script>
      </body>
      </html>
    `;

    const janelaImpressao = window.open("", "_blank");
    janelaImpressao.document.write(templateHtml);
    janelaImpressao.document.close();
  }
}
