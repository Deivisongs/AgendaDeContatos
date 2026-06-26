// Carrega o arquivo que está na raiz da sua pasta pública da Vercel
importScripts("sqlite3.js");

let db;

self
  .sqlite3InitModule({
    print: console.log,
    printErr: console.error,
  })
  .then((sqlite3) => {
    if ("opfs" in sqlite3) {
      // Cria ou abre o banco de dados que vai residir permanentemente no celular do usuário
      db = new sqlite3.oo1.OpfsDb("/meu_banco_local.db", "c");

      // Cria suas tabelas normalmente
      db.exec(
        "CREATE TABLE IF NOT EXISTS vendas (id INTEGER PRIMARY KEY, produto TEXT, valor REAL);",
      );

      postMessage({ tipo: "PRONTO" });
    } else {
      postMessage({
        tipo: "ERRO",
        msg: "Navegador do celular não suporta OPFS.",
      });
    }
  });

// Responde aos comandos do seu index.html (Inserir, Buscar, Deletar...)
onmessage = function (e) {
  // Sua lógica de INSERT / SELECT aqui...
};
