importScripts('sqlite3.js');

let db;
let sqlite3Instance;

function carregarBancoDoLocalStorage(sqlite3) {
  try {
    db = new sqlite3.oo1.DB();
    // Garante que a tabela existe antes de qualquer coisa
    db.exec("CREATE TABLE IF NOT EXISTS contatos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, telefone TEXT);");
  } catch (e) {
    db = new sqlite3.oo1.DB();
  }
}

function dispararBackup() {
  try {
    if (!db || !sqlite3Instance) return;
    const byteArray = sqlite3Instance.capi.sqlite3_serialize(db.pointer, 'main', null, 0);
    if (byteArray) {
      postMessage({ tipo: 'SALVAR_BACKUP', dados: Array.from(byteArray) });
    }
  } catch (e) {
    console.error('Erro ao gerar cópia de segurança:', e);
  }
}

self.sqlite3InitModule({
  print: console.log,
  printErr: console.error,
}).then((sqlite3) => {
  try {
    sqlite3Instance = sqlite3;

    if (sqlite3.oo1.OpfsDb) {
      db = new sqlite3.oo1.OpfsDb('/meu_banco.db', 'c');
    } else {
      carregarBancoDoLocalStorage(sqlite3);
    }
    
    // Criação garantida na inicialização
    db.exec("CREATE TABLE IF NOT EXISTS contatos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, telefone TEXT);");
    
    postMessage({ tipo: 'PEDIR_RESTAURACAO' });

  } catch (err) {
    postMessage({ tipo: 'ERRO', mensagem: String(err) });
  }
});

onmessage = function (evento) {
  if (!db) return;

  const { tipo, dados } = evento.data;

  if (tipo === 'RESTAURAR_DADOS' && dados && dados.length > 0) {
    try {
      const u8array = new Uint8Array(dados);
      sqlite3Instance.capi.sqlite3_deserialize(db.pointer, 'main', u8array, u8array.length, u8array.length, 0);
      console.log('Dados restaurados com sucesso no SQLite!');
    } catch (e) {
      console.error('Erro ao restaurar banco:', e);
    }
    
    // SEGREDO: Força a criação da tabela de novo se o arquivo restaurado estivesse corrompido ou vazio
    db.exec("CREATE TABLE IF NOT EXISTS contatos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, telefone TEXT);");
    postMessage({ tipo: 'STATUS', mensagem: 'Banco de dados pronto!' });
    return;
  }
  
  if (tipo === 'RESTAURAR_VAZIO') {
    db.exec("CREATE TABLE IF NOT EXISTS contatos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, telefone TEXT);");
    postMessage({ tipo: 'STATUS', mensagem: 'Banco de dados pronto!' });
    return;
  }

  if (tipo === 'INSERIR') {
    try {
      db.exec({
        sql: "INSERT INTO contatos (nome, telefone) VALUES (?, ?);",
        bind: [dados.nome, dados.telefone]
      });
      dispararBackup();
      postMessage({ tipo: 'SUCESSO_INSERIR' });
    } catch (err) {
      postMessage({ tipo: 'ERRO', mensagem: String(err) });
    }
  }

  if (tipo === 'BUSCAR') {
    try {
      const listaContatos = [];
      db.exec({
        sql: "SELECT * FROM contatos;",
        rowMode: 'object',
        callback: (row) => { listaContatos.push(row); }
      });
      postMessage({ tipo: 'LISTA_CONTATOS', dados: listaContatos });
    } catch (err) {
      postMessage({ tipo: 'ERRO', mensagem: String(err) });
    }
  }
};
