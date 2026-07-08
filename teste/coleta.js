// ========================================================
// ESTADO GLOBAL DA APLICAÇÃO
// ========================================================
let contagem = {};
let contagensRealizadas = [];
let indexEdicaoBalanco = null;

let produtosDatabase = {}; // <-- CORRIGIDO: O "F" que estava aqui foi removido!
let isEditingMode = false;
let editingIndex = null;

let streamVideo = null;
let barcodeDetectorInstance = null;
let barcodeScanningActive = false;
let currentScannedCode = "";

// Variáveis de controle para dupla confirmação (unificadas para ambos os leitores)
let codeReaderZXing = null;
let ultimoCodigoDetectado = null;
let leiturasIdenticasContador = 0;

async function obterTodasContagens() {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ========================================================
// RECURSOS UTILITÁRIOS E DE DATA
// ========================================================
function dataHora() {
  const agora = new Date();
  const formatador = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return formatador.format(agora).replace(",", "");
}

const nowStr = () => {
  const d = new Date();
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR")}`;
};

async function getObjeto(objeto) {
  return JSON.parse(localStorage.getItem(objeto));
}

// Helper para detectar iPhone / iOS
function isIphone() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// ========================================================
// INICIALIZAÇÃO DA PÁGINA E CICLO DE VIDA
// ========================================================
window.addEventListener("DOMContentLoaded", () => {
  // Injeta dinamicamente a biblioteca do ZXing caso seja iPhone
  if (isIphone()) {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@zxing/library@latest";
    script.onload = () => {
      initBarcodeDetector();
    };
    document.head.appendChild(script);
  } else {
    initBarcodeDetector();
  }

  iniciarPaginaColeta();
  autoLoadCSV();
  initManualInputControl();
  initActionTriggers();
});

// Modificado para ASYNC para buscar a lista do IndexedDB
async function iniciarPaginaColeta() {
  const lblBalanceName = document.getElementById("lblBalanceName");
  const lblBalanceDate = document.getElementById("lblBalanceDate");

  const urlParams = new URLSearchParams(window.location.search);
  const indexParam = urlParams.get("index");

  // Busca dados do IndexedDB em vez do localStorage
  let listaDeContagens = [];
  try {
    listaDeContagens = await obterTodasContagens();
  } catch (error) {
    console.error(error);
  }

  // Verifica por ID numérico ou pelo índice passado por parâmetro
  if (indexParam !== null) {
    indexEdicaoBalanco = parseInt(indexParam);

    // Procura pelo id correspondente ou usa a posição do array como fallback
    let encontrado = listaDeContagens.find(
      (item) => item.id === indexEdicaoBalanco,
    );
    if (!encontrado) encontrado = listaDeContagens[indexEdicaoBalanco];

    if (encontrado) {
      contagem = encontrado;
      contagensRealizadas = contagem.itens || [];

      lblBalanceName.textContent = contagem.name;
      lblBalanceDate.textContent = `Status: ${contagem.status.toUpperCase()}`;

      if (contagem.status !== "aberto" && contagem.status !== "open") {
        mostrarModalAviso(
          "Aviso",
          "Este balanço está ENCERRADO. Para alterar os itens, reabra-o na tela inicial.",
        );
        bloquearAcoesColeta();
      }
    }
  } else {
    // Modo Nova Contagem
    const contagemIniciada = await getObjeto("contagemIniciada");
    const dataeHora = dataHora();
    lblBalanceDate.textContent = `Data de abertura: ${dataeHora}`;

    if (contagemIniciada && contagemIniciada.name) {
      lblBalanceName.textContent = contagemIniciada.name;
      contagem = {
        name: contagemIniciada.name,
        operador: contagemIniciada.operador,
        itens: [],
        status: "aberto",
      };
      contagensRealizadas = [];
    } else {
      lblBalanceName.textContent = "Erro de Inicialização";
    }
  }
  renderList();
}

function bloquearAcoesColeta() {
  const btnScan = document.getElementById("btnScan");
  const btnManualInput = document.getElementById("btnManualInput");
  if (btnScan) btnScan.style.display = "none";
  if (btnManualInput) btnManualInput.style.display = "none";
}

// ========================================================
// CARREGAMENTO DE PRODUTOS (CSV)
// ========================================================
function autoLoadCSV() {
  fetch("produtos.csv")
    .then((response) => {
      if (!response.ok) throw new Error();
      return response.text();
    })
    .then((text) => processCSVData(text))
    .catch(() => console.warn("produtos.csv ausente na pasta de execução."));
}

function processCSVData(csvText) {
  produtosDatabase = {};
  const lines = csvText.split(/\r?\n/);
  lines.forEach((line) => {
    if (!line.trim()) return;
    const parts = line.split(";");
    if (parts.length >= 2) {
      const codigo = parts[0].trim();
      produtosDatabase[codigo] = {
        descricao: parts[1] ? parts[1].trim() : "Sem Descrição",
        preco: parts[2] ? parts[2].trim() : "0,00",
        quantidade: parts[3] ? parts[3].trim() : "0",
      };
    }
  });
}

// ========================================================
// PERSISTÊNCIA E SINCRONIZAÇÃO (INDEXEDDB)
// ========================================================
async function salvaContagem(dadosContagem) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(dadosContagem);

    request.onsuccess = () => {
      // CRUCIAL: Se o banco gerou um ID novo (autoIncrement), 
      // salvamos ele no nosso objeto para os próximos bips atualizarem o mesmo registro.
      if (request.result && !dadosContagem.id) {
        dadosContagem.id = request.result;
      }
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

function obterDadosParaAPI() {
  return contagensRealizadas.map((item) => ({
    codigo: item.codigo,
    quantidade: item.quantidade,
    hora: item.hora || nowStr(),
    localizacao: item.localizacao || "",
    descricaoManual: item.descricaoManual || "",
    referencia: item.referencia || "",
  }));
}

function initActionTriggers() {
  document.getElementById("btnFinish").addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      if (contagem.status === "aberto" || contagem.status === "open") {
        contagem.itens = obterDadosParaAPI();
        await salvaContagem(contagem);
      }
    } catch (err) {
      console.error("Erro ao salvar ao encerrar:", err);
    } finally {
      window.location.href = "index.html";
    }
  });

  document.getElementById("btnHeaderBack").addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      if (contagem.status === "aberto" || contagem.status === "open") {
        contagem.itens = obterDadosParaAPI();
        await salvaContagem(contagem);
      }
    } catch (err) {
      console.error("Erro ao salvar ao voltar:", err);
    } finally {
      window.location.href = "index.html";
    }
  });
}

// ========================================================
// RENDERIZAÇÃO E INTERAÇÃO DA LISTA DE ITENS
// ========================================================
function renderList() {
  const container = document.getElementById("coletasContainer");
  container.innerHTML = "";

  contagensRealizadas.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "coleta-item";

    row.addEventListener("click", (e) => {
      if (!e.target.closest(".btn-delete-item")) {
        openEditModal(index, true);
      }
    });

    row.innerHTML = `
      <div class="coleta-info">
        <div class="coleta-code">${item.codigo}</div>
        <div class="coleta-time">${item.hora} ${item.localizacao ? `• Loc: ${item.localizacao}` : ""}</div>
      </div>
      <div class="coleta-qty-area">
        <div class="coleta-qty">x ${item.quantidade}</div>
        <button class="btn-delete-item" title="Remover"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;

    row.querySelector(".btn-delete-item").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteItem(index);
    });

    container.appendChild(row);
  });
}

function deleteItem(index) {
  mostrarModalConfirmacao(
    "Remover Item",
    "Tem certeza que deseja remover este item da contagem?",
    async () => {
      contagensRealizadas.splice(index, 1);
      
      // Sincroniza e atualiza o IndexedDB imediatamente após remoção
      try {
        if (contagem.status === "aberto" || contagem.status === "open") {
          contagem.itens = obterDadosParaAPI();
          await salvaContagem(contagem);
        }
      } catch (err) {
        console.error("Erro ao salvar após remoção:", err);
      }

      renderList();
    },
  );
}

// ========================================================
// PROCESSAMENTO E TRATAMENTO DE CÓDIGOS (LEITURA)
// ========================================================
function initManualInputControl() {
  document.getElementById("btnManualInput").addEventListener("click", () => {
    abrirModalDigitarCodigo();
  });
}

function handleCodeDetected(code) {
  currentScannedCode = code;

  const existingIndex = contagensRealizadas.findIndex(
    (item) => item.codigo === code,
  );

  if (existingIndex !== -1) {
    openEditModal(existingIndex, false);
    return;
  }

  isEditingMode = false;
  const headBar = document.getElementById("headModalFound");
  const badgeDup = document.getElementById("badgeDuplicate");

  headBar.className = "modal-header-bar default";
  badgeDup.style.display = "none";

  if (produtosDatabase[code]) {
    const prod = produtosDatabase[code];
    document.getElementById("titleModalFound").innerText = "Produto Encontrado";
    document.getElementById("fndCode").innerText = code;
    document.getElementById("fndDesc").innerText = prod.descricao;
    document.getElementById("fndPrice").innerText = prod.preco;
    document.getElementById("fndStock").innerText = prod.quantidade;
    document.getElementById("fndQtyApurada").value = 1;
    document.getElementById("fndLocalizacao").value = "";
    document.getElementById("modalProductFound").classList.add("active");
  } else {
    document.getElementById("titleModalNotFound").innerText =
      "Código Não Encontrado";
    document.getElementById("nfndCode").innerText = code;
    document.getElementById("nfndDesc").value = "";
    document.getElementById("nfndRef").value = "";
    document.getElementById("nfndQty").value = 1;
    document.getElementById("nfndLocalizacao").value = "";
    document.getElementById("modalProductNotFound").classList.add("active");
  }
}

// ========================================================
// MODAIS DE CONFIRMAÇÃO DO PRODUTO (SALVAMENTO)
// ========================================================
function openEditModal(index, isFromListClick = false) {
  isEditingMode = true;
  editingIndex = index;
  const item = contagensRealizadas[index];

  const headBar = document.getElementById("headModalFound");
  const badgeDup = document.getElementById("badgeDuplicate");

  if (!item.descricaoManual) {
    currentScannedCode = item.codigo;
    const prod = produtosDatabase[item.codigo] || {
      descricao: "Produto Coletado",
      preco: "-",
      quantidade: "-",
    };

    if (!isFromListClick) {
      headBar.className = "modal-header-bar warning";
      badgeDup.style.display = "block";
      document.getElementById("titleModalFound").innerText =
        "Produto Já Bipado";
    } else {
      headBar.className = "modal-header-bar default";
      badgeDup.style.display = "none";
      document.getElementById("titleModalFound").innerText =
        "Editar Quantidade";
    }

    document.getElementById("fndCode").innerText = item.codigo;
    document.getElementById("fndDesc").innerText = prod.descricao;
    document.getElementById("fndPrice").innerText = prod.preco;
    document.getElementById("fndStock").innerText = prod.quantidade;
    document.getElementById("fndQtyApurada").value = item.quantidade;
    document.getElementById("fndLocalizacao").value = item.localizacao || "";

    document.getElementById("modalProductFound").classList.add("active");
  } else {
    currentScannedCode = item.codigo;
    document.getElementById("titleModalNotFound").innerText =
      "Editar Produto Manual";
    document.getElementById("nfndCode").innerText = item.codigo;
    document.getElementById("nfndDesc").value = item.descricaoManual || "";
    document.getElementById("nfndRef").value = item.referencia || "";
    document.getElementById("nfndQty").value = item.quantidade;
    document.getElementById("nfndLocalizacao").value = item.localizacao || "";

    document.getElementById("modalProductNotFound").classList.add("active");
  }
}

document.getElementById("btnSaveFound").addEventListener("click", async () => {
  const qty = parseInt(document.getElementById("fndQtyApurada").value) || 1;
  const loc = document.getElementById("fndLocalizacao").value.trim();

  if (isEditingMode) {
    contagensRealizadas[editingIndex].quantidade = qty;
    contagensRealizadas[editingIndex].localizacao = loc;
  } else {
    contagensRealizadas.unshift({
      codigo: currentScannedCode,
      quantidade: qty,
      hora: nowStr(),
      localizacao: loc,
      descricaoManual: "",
      referencia: "",
    });
  }

  // Sincroniza e atualiza o IndexedDB imediatamente após inserção/edição
  try {
    if (contagem.status === "aberto" || contagem.status === "open") {
      contagem.itens = obterDadosParaAPI();
      await salvaContagem(contagem);
    }
  } catch (err) {
    console.error("Erro ao salvar produto encontrado:", err);
  }

  document.getElementById("modalProductFound").classList.remove("active");
  renderList();
});

document.getElementById("btnSaveNotFound").addEventListener("click", async () => {
  const desc = document.getElementById("nfndDesc").value.trim();
  const ref = document.getElementById("nfndRef").value.trim();
  const qty = parseInt(document.getElementById("nfndQty").value) || 0;
  const loc = document.getElementById("nfndLocalizacao").value.trim();

  if (!ref || qty <= 0) {
    mostrarModalAviso("Aviso", "Referência e Quantidade são obrigatórios!");
    return;
  }

  if (isEditingMode) {
    contagensRealizadas[editingIndex].codigo = currentScannedCode;
    contagensRealizadas[editingIndex].quantidade = qty;
    contagensRealizadas[editingIndex].descricaoManual = desc;
    contagensRealizadas[editingIndex].referencia = ref;
    contagensRealizadas[editingIndex].localizacao = loc;
  } else {
    contagensRealizadas.unshift({
      codigo: currentScannedCode,
      quantidade: qty,
      hora: nowStr(),
      descricaoManual: desc,
      referencia: ref,
      localizacao: loc,
    });
  }

  // Sincroniza e atualiza o IndexedDB imediatamente após inserção/edição manual
  try {
    if (contagem.status === "aberto" || contagem.status === "open") {
      contagem.itens = obterDadosParaAPI();
      await salvaContagem(contagem);
    }
  } catch (err) {
    console.error("Erro ao salvar produto manual:", err);
  }

  document.getElementById("modalProductNotFound").classList.remove("active");
  renderList();
});

document
  .getElementById("btnCancelFound")
  .addEventListener("click", () =>
    document.getElementById("modalProductFound").classList.remove("active"),
  );
document
  .getElementById("btnCancelNotFound")
  .addEventListener("click", () =>
    document.getElementById("modalProductNotFound").classList.remove("active"),
  );

// ========================================================
// CONTROLE DO SCANNER HARDWARE (CÂMERA)
// ========================================================
function initBarcodeDetector() {
  if (isIphone()) {
    if (typeof ZXing !== "undefined") {
      codeReaderZXing = new ZXing.BrowserMultiFormatReader();
    }
  } else if ("BarcodeDetector" in window) {
    barcodeDetectorInstance = new BarcodeDetector({
      formats: ["ean_13", "code_128", "qr_code", "upc_a"],
    });
  }
}

document.getElementById("btnScan").addEventListener("click", async () => {
  ultimoCodigoDetectado = null;
  leiturasIdenticasContador = 0;

  if (isIphone()) {
    if (!codeReaderZXing) {
      abrirModalDigitarCodigo();
      return;
    }
    
    const videoEl = document.getElementById("videoPreview");
    if (videoEl) {
      videoEl.style.filter = "contrast(150%) brightness(90%) saturate(0%)";
      videoEl.style.objectFit = "cover";
    }

    document.getElementById("videoContainer").style.display = "block";
    barcodeScanningActive = true;

    const constraints = {
      video: {
        width: { min: 640, ideal: 1280 },
        height: { min: 480, ideal: 720 },
        facingMode: "environment",
        advanced: [{ focusMode: "continuous" }]
      }
    };

    codeReaderZXing.decodeFromConstraints(constraints, 'videoPreview', (result, err) => {
      if (!barcodeScanningActive) return;

      if (result) {
        const codigoDetectado = result.text;

        if (codigoDetectado === ultimoCodigoDetectado) {
          leiturasIdenticasContador++;
        } else {
          ultimoCodigoDetectado = codigoDetectado;
          leiturasIdenticasContador = 0;
        }

        if (leiturasIdenticasContador >= 1) { 
          stopScanner();
          handleCodeDetected(codigoDetectado);
        }
      }

      if (err && !(err instanceof ZXing.NotFoundException)) {
        console.error(err);
      }
    }).catch((err) => {
      console.error("Erro ao abrir a câmera no ZXing:", err);
      mostrarModalAviso("Erro", "Câmera indisponível ou permissão negada.");
      stopScanner();
    });

    return;
  }

  if (!barcodeDetectorInstance) {
    abrirModalDigitarCodigo();
    return;
  }
  try {
    streamVideo = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    document.getElementById("videoPreview").srcObject = streamVideo;
    document.getElementById("videoContainer").style.display = "block";
    barcodeScanningActive = true;
    requestAnimationFrame(scanLoop);
  } catch (err) {
    mostrarModalAviso("Erro", "Câmera indisponível ou permissão negada.");
  }
});

async function scanLoop() {
  if (!barcodeScanningActive || isIphone()) return;
  const videoEl = document.getElementById("videoPreview");
  if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
    try {
      const barcodes = await barcodeDetectorInstance.detect(videoEl);
      if (barcodes.length > 0) {
        const codigoDetectado = barcodes[0].rawValue;

        if (codigoDetectado === ultimoCodigoDetectado) {
          leiturasIdenticasContador++;
        } else {
          ultimoCodigoDetectado = codigoDetectado;
          leiturasIdenticasContador = 0;
        }

        if (leiturasIdenticasContador >= 1) {
          stopScanner();
          handleCodeDetected(codigoDetectado);
          return;
        }
      }
    } catch (e) {}
  }
  requestAnimationFrame(scanLoop);
}

function stopScanner() {
  barcodeScanningActive = false;
  document.getElementById("videoContainer").style.display = "none";
  
  if (isIphone() && codeReaderZXing) {
    codeReaderZXing.reset();
  } else if (streamVideo) {
    streamVideo.getTracks().forEach((track) => track.stop());
  }
}

document
  .getElementById("btnCloseScanner")
  .addEventListener("click", stopScanner);

// ========================================================
// COMPONENTES DE INTERFACE DINÂMICOS (MODAIS CUSTOMIZADOS)
// ========================================================
function mostrarModalAviso(titulo, mensagem) {
  const modalId = "modalAvisoDinamico";
  let modal = document.getElementById(modalId);
  if (!modal) {
    modal = document.createElement("div");
    modal.id = modalId;
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header-bar warning">
          <div class="modal-title" id="avisoTitulo"></div>
        </div>
        <div class="modal-body">
          <p id="avisoMensagem" style="font-size:1rem; color:#333; margin-bottom:20px;"></p>
          <button class="btn-finish" id="btnFecharAviso">OK</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById("btnFecharAviso").addEventListener("click", () => {
      modal.classList.remove("active");
    });
  }
  document.getElementById("avisoTitulo").innerText = titulo;
  document.getElementById("avisoMensagem").innerText = mensagem;
  modal.classList.add("active");
}

function abrirModalDigitarCodigo() {
  const modalId = "modalDigitarCodigo";
  let modal = document.getElementById(modalId);
  if (!modal) {
    modal = document.createElement("div");
    modal.id = modalId;
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header-bar default" style="border-bottom:1px solid #e2e8f0;">
          <div class="modal-title">Entrada Manual de Código</div>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="inputCodigoManual">Digite ou bipe o código:</label>
            <input type="text" id="inputCodigoManual" placeholder="Código de barras ou referência">
          </div>
          <div class="modal-actions">
            <button class="btn-modal btn-modal-cancel" id="btnCancelarCodigoManual">Cancelar</button>
            <button class="btn-modal btn-modal-save" id="btnConfirmarCodigoManual">Confirmar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document
      .getElementById("btnCancelarCodigoManual")
      .addEventListener("click", () => {
        modal.classList.remove("active");
      });

    document
      .getElementById("btnConfirmarCodigoManual")
      .addEventListener("click", () => {
        const code = document.getElementById("inputCodigoManual").value.trim();
        if (code) {
          modal.classList.remove("active");
          handleCodeDetected(code);
        }
      });
  }
  document.getElementById("inputCodigoManual").value = "";
  modal.classList.add("active");
  setTimeout(() => document.getElementById("inputCodigoManual").focus(), 200);
}

function mostrarModalConfirmacao(titulo, messageText, callbackSucesso) {
  const modalId = "modalConfirmacaoDinamica";
  let modal = document.getElementById(modalId);
  if (!modal) {
    modal = document.createElement("div");
    modal.id = modalId;
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header-bar warning">
          <div class="modal-title" id="confirmTitulo"></div>
        </div>
        <div class="modal-body">
          <p id="confirmMensagem" style="font-size:1rem; color:#333; margin-bottom:20px;"></p>
          <div class="modal-actions">
            <button class="btn-modal btn-modal-cancel" id="btnCancelarConfirmacao">Não</button>
            <button class="btn-modal btn-modal-save" style="background-color:var(--danger-red);" id="btnConfirmarConfirmacao">Sim, Remover</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document
      .getElementById("btnCancelarConfirmacao")
      .addEventListener("click", () => {
        modal.classList.remove("active");
      });
  }

  const btnSim = document.getElementById("btnConfirmarConfirmacao");
  const novoBtnSim = btnSim.cloneNode(true);
  btnSim.parentNode.replaceChild(novoBtnSim, btnSim);

  novoBtnSim.addEventListener("click", () => {
    modal.classList.remove("active");
    callbackSucesso();
  });

  document.getElementById("confirmTitulo").innerText = titulo;
  document.getElementById("confirmMensagem").innerText = messageText;
  modal.classList.add("active");
}
