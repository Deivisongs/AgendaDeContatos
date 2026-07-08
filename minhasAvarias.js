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
      iconHtml = `<i class="fa-solid fa-file-circle-exclamation open status-icon"></i>`;
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

  // --- MODO JSON (COMO ARQUIVO ANEXO) ---
  if (formato === "json") {
    fecharModalShare();

    const stringJson = JSON.stringify(item, null, 2);
    
    // 1. Cria o Blob com o conteúdo do JSON
    const blobJson = new Blob([stringJson], { type: "application/json;charset=utf-8" });
    
    // 2. Converte o Blob em um Arquivo físico virtual aceito pelo sistema operacional
    const nomeArquivo = `avaria_${nomeArquivoSanitizado}.json`;
    const arquivoJson = new File([blobJson], nomeArquivo, { type: "application/json" });

    // 3. Verifica se o navegador/celular suporta o compartilhamento deste arquivo
    if (navigator.canShare && navigator.canShare({ files: [arquivoJson] })) {
      try {
        await navigator.share({
          files: [arquivoJson],
          title: `JSON - Avaria ${nomeLoja}`,
          text: `Segue em anexo o arquivo de dados da avaria de ${nomeLoja}.`
        });
      } catch (err) {
        console.log("Compartilhamento de JSON cancelado:", err);
      }
    } else {
      // Fallback automático caso esteja testando em um computador ou navegador antigo
      await navigator.clipboard.writeText(stringJson);
      alert("Seu navegador não suporta envio de arquivos de texto via menu. O JSON foi copiado para a Área de Transferência!");
    }
  } 
  
  // --- MODO PDF DIRETO (SEM IMPRESSORA) ---
  else if (formato === "pdf") {
    fecharModalShare();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Configuração de fontes e cabeçalho do PDF
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Relatório de Produtos Avariados", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Origem/Loja: ${nomeLoja}`, 14, 30);
    doc.text(`Operador: ${item.operador || "Não informado"}`, 14, 36);
    doc.text(`Status: ${item.status ? item.status.toUpperCase() : "ABERTO"}`, 14, 42);

    doc.setDrawColor(150);
    doc.line(14, 48, 196, 48);

    doc.setFont("helvetica", "bold");
    doc.text("Código", 14, 55);
    doc.text("Descrição do Item", 50, 55);
    doc.text("Qtd", 155, 55);
    doc.text("Localização", 175, 55);

    doc.line(14, 58, 196, 58);
    doc.setFont("helvetica", "normal");

    let y = 66;
    const itens = item.itens || [];

    itens.forEach((i) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }

      const descricaoReal = obterDescricaoDoProduto(i);
      const descTruncada = descricaoReal.length > 40 ? descricaoReal.substring(0, 38) + "..." : descricaoReal;

      doc.text(String(i.codigo), 14, y);
      doc.text(descTruncada, 50, y);
      doc.text(String(i.quantidade), 155, y, { align: "center" });
      doc.text(String(i.localizacao || "-"), 175, y);

      y += 8;
    });

    const pdfOutput = doc.output("blob");
    const nomeArquivoPdf = `relatorio_${nomeArquivoSanitizado}.pdf`;
    const arquivoPdf = new File([pdfOutput], nomeArquivoPdf, { type: "application/pdf" });

    if (navigator.canShare && navigator.canShare({ files: [arquivoPdf] })) {
      try {
        await navigator.share({
          files: [arquivoPdf],
          title: `Relatório PDF - ${nomeLoja}`,
          text: `Segue em anexo o relatório de avarias da loja ${nomeLoja}.`
        });
      } catch (err) {
        console.log("Compartilhamento de PDF cancelado:", err);
      }
    } else {
      doc.save(nomeArquivoPdf);
    }
  }
}
