importScripts('sqlite3.js');

let db;

self.sqlite3InitModule({
  print: console.log,
  printErr: console.error,
}).then((sqlite3) => {
  try {
    if ('opfs' in sqlite3) {
      db = new sqlite3.oo1.OpfsDb('/meu_banco.db', 'c');
      console.log('SQLite conectado ao OPFS!', db.filename);
      
      db.exec("CREATE TABLE IF NOT EXISTS contatos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, telefone TEXT);");
      
      postMessage({ tipo: 'STATUS', mensagem: 'Banco de dados pronto!' });
    } else {
      postMessage({ tipo: 'ERRO', mensagem: 'OPFS não suportado neste navegador ou ambiente inseguro.' });
    }
  } catch (err) {
    // Tratamento melhorado: captura o erro mesmo se ele for uma string ou objeto sem .message
    const mensagemErro = err instanceof Error ? err.message : String(err);
    postMessage({ tipo: 'ERRO', mensagem: mensagemErro });
  }
});
