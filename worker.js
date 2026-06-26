// Importa o script oficial do SQLite WASM a partir de um CDN público
importScripts(
  "https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.45.1-build1/sqlite-wasm/jswasm/sqlite3.js",
);

let db;

// Inicializa o ambiente SQLite
self
  .sqlite3InitModule({
    print: console.log,
    printErr: console.error,
  })
  .then((sqlite3) => {
    try {
      // Verifica se o OPFS está disponível no navegador
      if ("opfs" in sqlite3) {
        // Abre (ou cria) o banco de dados direto no OPFS
        db = new sqlite3.oo1.OpfsDb("/meu_banco.db", "c");
        console.log("SQLite conectado ao OPFS com sucesso!", db.filename);

        // Cria uma tabela simples de contatos se ela não existir
        db.exec(
          "CREATE TABLE IF NOT EXISTS contatos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, telefone TEXT);",
        );

        // Avisa a página principal que o banco de dados está pronto
        postMessage({ tipo: "STATUS", mensagem: "Banco de dados pronto!" });
      } else {
        postMessage({
          tipo: "ERRO",
          mensagem: "OPFS não suportado neste navegador.",
        });
      }
    } catch (err) {
      postMessage({ tipo: "ERRO", mensagem: err.message });
    }
  });

// Escuta comandos enviados pela página principal (index.html)
onmessage = function (evento) {
  if (!db) return;

  const { tipo, dados } = evento.data;

  if (tipo === "INSERIR") {
    try {
      db.exec({
        sql: "INSERT INTO contatos (nome, telefone) VALUES (?, ?);",
        bind: [dados.nome, dados.telefone],
      });
      postMessage({ tipo: "SUCESSO_INSERIR" });
    } catch (err) {
      postMessage({ tipo: "ERRO", mensagem: err.message });
    }
  }

  if (tipo === "BUSCAR") {
    try {
      const listaContatos = [];
      // Executa a query e lê linha por linha
      db.exec({
        sql: "SELECT * FROM contatos;",
        rowMode: "object",
        callback: (row) => {
          listaContatos.push(row);
        },
      });
      // Devolve a lista de contatos para a interface gráfica
      postMessage({ tipo: "LISTA_CONTATOS", dados: listaContatos });
    } catch (err) {
      postMessage({ tipo: "ERRO", mensagem: err.message });
    }
  }
};
