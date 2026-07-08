const DB_NAME = "ContagensDB";
const DB_VERSION = 4;
const STORE_NAME = "contagensStore";
const PEDIDO_NAME = "pedidosStore";
const AVARIAS_NAME = "avariasStore";

// Função utilitária para abrir o banco de dados
function abrirBanco() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
      if (!db.objectStoreNames.contains(PEDIDO_NAME)) {
        db.createObjectStore(PEDIDO_NAME, { keyPath: "numero" });
      }
      if (!db.objectStoreNames.contains(AVARIAS_NAME)) {
        db.createObjectStore(AVARIAS_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) =>
      reject("Erro ao abrir IndexedDB: " + e.target.error);
  });
}