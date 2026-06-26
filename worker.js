importScripts('sqlite3.js');

let db;
let sqlite3Instance; // Guarda a instância global para usar nas funções

// Função para converter e carregar o banco salvo de volta para a memória
function carregarBancoDoLocalStorage(sqlite3) {
  try {
    // O banco inicializará vazio e aguardará o index.html enviar o backup se existir
    db = new sqlite3.oo1.DB();
    console.log('Banco de dados inicializado na memória.');
  } catch (e) {
    db = new sqlite3.oo1.DB();
  }
}

// Função para exportar os dados e mandar para o index.html salvar no celular
function dispararBackup() {
  try {
    if (!db || !sqlite3Instance) return;
    
    // Serializa o banco de dados da memória RAM em um array binário
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
    sqlite3Instance = sqlite3; // Salva a referência

    if (sqlite3.oo1.OpfsDb) {
      db = new sqlite3.oo1.OpfsDb('/meu_banco.db', 'c');
      console.log('SQLite conectado ao OPFS via OpfsDb nativo!', db.filename);
    } else {
      carregarBancoDoLocalStorage(sqlite3);
      console.log('SQLite rodando em modo híbrido persistente.');
    }
    
    // Cria a tabela padrão
    db.exec("CREATE TABLE IF NOT EXISTS contatos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, telefone TEXT);");
    
    // Pede para o index.html enviar os dados antigos caso existam no localStorage
    postMessage({ tipo: 'PEDIR_RESTAURACAO' });

  } catch (err) {
    postMessage({ tipo: 'ERRO', mensagem: String(err) });
  }
});

onmessage = function (evento) {
  if (!db) return;

  const { tipo, dados } = evento.data;

  // Recebe o backup do localStorage e injeta de volta na memória RAM do SQLite
  if (tipo === 'RESTAURAR_DADOS' && dados) {
    try {
      const u8array = new Uint8Array(dados);
      sqlite3Instance.capi.sqlite3_deserialize(db.pointer, 'main', u8array, u8array.length, u8array.length, 0);
      console.log('Dados restaurados com sucesso no SQLite!');
    } catch (e) {
      console.error('Erro ao deserializar banco:', e);
    }
    // Após restaurar, avisa que o banco está pronto e busca a lista antiga
    postMessage({ tipo: 'STATUS', mensagem: 'Banco de dados pronto!' });
    return;
  }
  
  // Se o index responder que não tem backup antigo, apenas inicia o banco zerado
  if (tipo === 'RESTAURAR_VAZIO') {
    postMessage({ tipo: 'STATUS', mensagem: 'Banco de dados pronto!' });
    return;
  }

  if (tipo === 'INSERIR') {
    try {
      db.exec({
        sql: "INSERT INTO contatos (nome, telefone) VALUES (?, ?);",
        bind: [dados.nome, dados.telefone]
      });
      
      // O SEGREDO: Salva no localStorage imediatamente após inserir
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
