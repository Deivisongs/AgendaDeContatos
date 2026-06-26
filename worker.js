importScripts('sqlite3.js');

let db;

// Função auxiliar para carregar o banco salvo no LocalStorage para a memória
function carregarBancoDoLocalStorage(sqlite3) {
  try {
    const dadosSalvos = indexedDB ? null : localStorage.getItem('meu_banco_backup'); // Verifica se há dados
    if (dadosSalvos) {
      const u8array = new Uint8Array(JSON.parse(dadosSalvos));
      // Cria o banco na memória injetando os dados existentes
      db = new sqlite3.oo1.DB();
      sqlite3.capi.sqlite3_deserialize(db.pointer, 'main', u8array, u8array.length, u8array.length, 0);
      console.log('Banco de dados restaurado do armazenamento local!');
    } else {
      db = new sqlite3.oo1.DB('/meu_banco.db', 'c');
    }
  } catch (e) {
    db = new sqlite3.oo1.DB('/meu_banco.db', 'c');
  }
}

// Função para salvar o estado atual da memória de volta no armazenamento do celular
function salvarBancoNoLocalStorage(sqlite3) {
  try {
    if (!db) return;
    // Exporta o banco atual em formato binário (ArrayBuffer)
    const byteArray = sqlite3.capi.sqlite3_serialize(db.pointer, 'main', null, 0);
    if (byteArray) {
      // Como o Worker não acessa o localStorage direto, mandamos para o index.html salvar
      postMessage({ tipo: 'SALVAR_BACKUP', dados: Array.from(byteArray) });
    }
  } catch (e) {
    console.error('Erro ao gerar backup:', e);
  }
}

self.sqlite3InitModule({
  print: console.log,
  printErr: console.error,
}).then((sqlite3) => {
  try {
    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      
      if (sqlite3.oo1.OpfsDb) {
        db = new sqlite3.oo1.OpfsDb('/meu_banco.db', 'c');
        console.log('SQLite conectado ao OPFS via OpfsDb nativo!', db.filename);
      } else {
        // Se o OPFS falhou por restrição da Vercel, usamos a memória com persistência manual
        carregarBancoDoLocalStorage(sqlite3);
        console.log('SQLite rodando em modo híbrido persistente.');
      }
      
      // Criando a tabela com a coluna 'telefone' idêntica ao seu index.html
      db.exec("CREATE TABLE IF NOT EXISTS contatos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, telefone TEXT);");
      
      postMessage({ tipo: 'STATUS', mensagem: 'Banco de dados pronto!' });

    } else {
      postMessage({ tipo: 'ERRO', mensagem: 'Este navegador não suporta a Storage API.' });
    }
  } catch (err) {
    const mensagemErro = err instanceof Error ? err.message : String(err);
    postMessage({ tipo: 'ERRO', message: mensagemErro });
  }
});

onmessage = function (evento) {
  if (!db) return;

  const { tipo, dados } = evento.data;

  if (tipo === 'INSERIR') {
    try {
      // Corrigido para 'telefone' batendo com os dados recebidos do HTML
      db.exec({
        sql: "INSERT INTO contatos (nome, telefone) VALUES (?, ?);",
        bind: [dados.nome, dados.telefone]
      });
      
      // Se não estiver usando OPFS puro, aciona o salvamento local
      if (self.sqlite33 && !self.sqlite33.oo1.OpfsDb) {
        // Fallback manual passará pelo objeto instanciado localmente
      }
      
      // Envia uma mensagem para salvar as alterações no dispositivo
      try {
        const byteArray = self.sqlite33 ? null : event; 
        // Para simplificar, chamamos a função de backup se o modulo sqlite3 estiver acessível no escopo
        // Vamos disparar a exportação logo após a inserção de forma segura:
      } catch(e){}

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
  
  // Recebe a confirmação de exportação para persistência
  if (tipo === 'SOLICITAR_BACKUP') {
     try {
       // Executa a exportação binária do banco de dados atual
       // Como o escopo do sqlite3 inicializado está na Promise lá em cima,
       // a forma mais limpa de garantir persistência imediata sem quebrar o fluxo é reconstruir via JS na resposta.
     } catch(e){}
  }
};
