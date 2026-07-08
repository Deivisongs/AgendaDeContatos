let contagemAtual = {
  name: "",
  operador: "",
};

// Objeto para controle temporário da avaria iniciada
let avariaAtual = {
  loja: "",
  operador: "",
};

// Busca todos os balanços salvos do IndexedDB
async function obterTodasContagens() {
  // Se a função abrirBanco existir globalmente (vinda do db.js), ela será usada
  if (typeof abrirBanco !== "function") {
    console.error("A função abrirBanco() não foi encontrada no db.js!");
    return [];
  }

  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Busca especificamente da store de avarias para não misturar com balanços
async function obterTodasAvarias() {
  if (typeof abrirBanco !== "function") {
    console.error("A função abrirBanco() não foi encontrada!");
    return [];
  }

  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    // FORÇADO: Aponta para a store correta de avarias
    const transaction = db.transaction("avariasStore", "readonly");
    const store = transaction.objectStore("avariasStore");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Salva uma nova contagem inicializada no "localStorage temporário" e redireciona
function setIniciarContagem() {
  localStorage.setItem("contagemIniciada", JSON.stringify(contagemAtual));
  window.location.href = "coleta.html";
}

// Salva o registro da avaria e redireciona para a página correspondente
function setIniciarAvaria() {
  localStorage.setItem("avariaIniciada", JSON.stringify(avariaAtual));
  window.location.href = "avarias.html";
}

// =================== ELEMENTOS DO DOM ===================

// Elementos do Menu Lateral e Navegação Principal
const sidebarMenu = document.getElementById("sidebarMenu");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const asideBar = document.getElementById("asideBar");
const closeSidebar = document.getElementById("closeSidebar");
const avariasMenuBtn = document.getElementById("avariasMenuBtn");

// Elementos do Modal 1 (Seleção de Balanço)
const cameraBtn = document.getElementById("cameraBtn");
const balanceModal = document.getElementById("balanceModal");
const closeModal = document.getElementById("closeModal");
const btnNewBalance = document.getElementById("btnNewBalance");
const balanceListContainer = document.getElementById("balance-list");

// Elementos do Modal 2 (Formulário de Novo Balanço)
const newBalanceFormModal = document.getElementById("newBalanceFormModal");
const closeFormModal = document.getElementById("closeFormModal");
const btnConfirmNewBalance = document.getElementById("btnConfirmNewBalance");
const inputBalanceName = document.getElementById("inputBalanceName");
const inputOperatorName = document.getElementById("inputOperatorName");

// NEW: Elementos do Modal 3 (Seleção / Lista de Avarias)
const avariasModal = document.getElementById("avariasModal");
const closeAvariasModal = document.getElementById("closeAvariasModal");
const btnNewAvaria = document.getElementById("btnNewAvaria");
const avariasListContainer = document.getElementById("avarias-list");

// NEW: Elementos do Modal 4 (Formulário de Nova Avaria)
const newAvariaFormModal = document.getElementById("newAvariaFormModal");
const closeAvariaFormModal = document.getElementById("closeAvariaFormModal");
const btnConfirmNewAvaria = document.getElementById("btnConfirmNewAvaria");
const inputAvariaLoja = document.getElementById("inputAvariaLoja");
const inputAvariaOperator = document.getElementById("inputAvariaOperator");

// =================== LOGICA REAL DOS BALANÇOS ===================

async function renderizarBalancosAbertosNoModal() {
  if (!balanceListContainer) return;
  balanceListContainer.innerHTML = "";

  let listaTotal = [];
  try {
    listaTotal = await obterTodasContagens();
  } catch (error) {
    console.error(error);
  }

  const abertos = listaTotal
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .filter((item) => item.status === "aberto" || item.status === "open");

  if (abertos.length === 0) {
    balanceListContainer.innerHTML = `
      <p style="text-align:center; color:#888; margin: 20px 0; font-size: 0.9rem;">
        Nenhum balanço aberto encontrado.
      </p>`;
    return;
  }

  abertos.forEach((balanco) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "balance-item";
    itemDiv.innerHTML = `
      <div class="balance-info">
        <div class="balance-name">${balanco.name}</div>
        <div class="balance-date">Operador: ${balanco.operador || "Não informado"}</div>
      </div>
      <span class="balance-badge open">Aberto</span>
    `;

    itemDiv.addEventListener("click", () => {
      const identificador =
        balanco.id !== undefined ? balanco.id : balanco.originalIndex;
      selectBalance(balanco.name, identificador);
    });

    balanceListContainer.appendChild(itemDiv);
  });
}

function selectBalance(name, index) {
  balanceModal.classList.remove("active");
  window.location.href = `coleta.html?index=${index}`;
}

// =================== NEW: LOGICA DE AVARIAS ===================

// =================== LOGICA DE AVARIAS CORRIGIDA ===================

async function renderizarAvariasNoModal() {
  if (!avariasListContainer) return;
  avariasListContainer.innerHTML = "";

  let listaTotal = [];
  try {
    // CORREÇÃO 1: Usa a busca exclusiva da store de avarias
    listaTotal = await obterTodasAvarias();
  } catch (error) {
    console.error("Erro ao buscar avarias no IndexedDB:", error);
  }

  // Filtra mantendo apenas as avarias abertas/em andamento
  const avariasSalvas = listaTotal.filter(
    (item) =>
      item.status === "aberto" ||
      item.status === "open" ||
      item.status === "Em andamento",
  );

  if (avariasSalvas.length === 0) {
    avariasListContainer.innerHTML = `
      <p style="text-align:center; color:#888; margin: 20px 0; font-size: 0.9rem;">
        Nenhuma avaria em aberto encontrada.
      </p>`;
    return;
  }

  avariasSalvas.forEach((avaria) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "balance-item";
    itemDiv.innerHTML = `
      <div class="balance-info">
        <div class="balance-name">${avaria.name || avaria.loja || "Sem Nome"}</div>
        <div class="balance-date">Operador: ${avaria.operador || "Não informado"}</div>
      </div>
      <span class="balance-badge open">Em andamento</span>
    `;

    itemDiv.addEventListener("click", () => {
      avariasModal.classList.remove("active");

      // CORREÇÃO 2: Prioriza SEMPRE o id real do IndexedDB
      // Se por algum motivo não houver id, usa o da propriedade interna
      const identificador =
        avaria.id !== undefined ? avaria.id : avaria.originalIndex;

      window.location.href = `avarias.html?index=${identificador}`;
    });

    avariasListContainer.appendChild(itemDiv);
  });
}

function processAvariaFormSubmission() {
  const loja = inputAvariaLoja.value.trim();
  const operador = inputAvariaOperator.value.trim();

  if (!loja || !operador) {
    alert("Por favor, preencha todos os campos antes de continuar!");
    return;
  }

  newAvariaFormModal.classList.remove("active");

  avariaAtual.loja = loja;
  avariaAtual.operador = operador;

  setIniciarAvaria();
}

// =================== CONTROLADORES DE EVENTOS ===================

// Controladores do Balanço (Existentes)
cameraBtn.addEventListener("click", () => {
  renderizarBalancosAbertosNoModal();
  balanceModal.classList.add("active");
});

closeModal.addEventListener("click", () =>
  balanceModal.classList.remove("active"),
);
balanceModal.addEventListener("click", (e) => {
  if (e.target === balanceModal) balanceModal.classList.remove("active");
});

btnNewBalance.addEventListener("click", () => {
  balanceModal.classList.remove("active");
  inputBalanceName.value = "";
  inputOperatorName.value = "";
  setTimeout(() => {
    newBalanceFormModal.classList.add("active");
    inputBalanceName.focus();
  }, 250);
});

closeFormModal.addEventListener("click", () =>
  newBalanceFormModal.classList.remove("active"),
);

// NEW: Controladores do Modal de Avarias
avariasMenuBtn.addEventListener("click", () => {
  toggleCloseSidebar(); // Fecha a barra lateral antes de abrir o modal
  renderizarAvariasNoModal();
  avariasModal.classList.add("active");
});

closeAvariasModal.addEventListener("click", () =>
  avariasModal.classList.remove("active"),
);
avariasModal.addEventListener("click", (e) => {
  if (e.target === avariasModal) avariasModal.classList.remove("active");
});

btnNewAvaria.addEventListener("click", () => {
  avariasModal.classList.remove("active");
  inputAvariaLoja.value = "";
  inputAvariaOperator.value = "";
  setTimeout(() => {
    newAvariaFormModal.classList.add("active");
    inputAvariaLoja.focus();
  }, 250);
});

closeAvariaFormModal.addEventListener("click", () =>
  newAvariaFormModal.classList.remove("active"),
);
newAvariaFormModal.addEventListener("click", (e) => {
  if (e.target === newAvariaFormModal)
    newAvariaFormModal.classList.remove("active");
});

// =================== SUBMISSÃO DOS FORMULÁRIOS ===================

// Confirmação de Balanço
btnConfirmNewBalance.addEventListener("click", processFormSubmission);

function processFormSubmission() {
  const balanco = inputBalanceName.value.trim();
  const usuario = inputOperatorName.value.trim();

  if (!balanco || !usuario) {
    alert("Por favor, preencha todos os campos antes de continuar!");
    return;
  }

  newBalanceFormModal.classList.remove("active");
  contagemAtual.name = balanco;
  contagemAtual.operador = usuario;
  setIniciarContagem();
}

[inputBalanceName, inputOperatorName].forEach((input) => {
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (input === inputBalanceName) {
        inputOperatorName.focus();
      } else {
        processFormSubmission();
      }
    }
  });
});

// NEW: Confirmação de Avaria
btnConfirmNewAvaria.addEventListener("click", processAvariaFormSubmission);

[inputAvariaLoja, inputAvariaOperator].forEach((input) => {
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (input === inputAvariaLoja) {
        inputAvariaOperator.focus();
      } else {
        processAvariaFormSubmission();
      }
    }
  });
});

// =================== NAVEGAÇÃO SECUNDÁRIA & SIDEBAR ===================

document.getElementById("logoutBtn").addEventListener("click", () => {
  if (confirm("Deseja sair?")) alert("Sessão encerrada.");
});

function openSidebar() {
  sidebarMenu.classList.add("active");
  sidebarOverlay.classList.add("active");
}

function toggleCloseSidebar() {
  sidebarMenu.classList.remove("active");
  sidebarOverlay.classList.remove("active");
}

asideBar.addEventListener("click", openSidebar);
closeSidebar.addEventListener("click", toggleCloseSidebar);
sidebarOverlay.addEventListener("click", toggleCloseSidebar);
