// 1. Importa a biblioteca do SQLite WASM que está no seu repositório
importScripts('sqlite3.js');

let db;

// 2. Inicializa o módulo do SQLite
self.sqlite3InitModule({
  print: console.log,
  printErr: console.error,
}).then((sqlite3) => {
  try {
    console.log('SQLite inicializado com sucesso. Versão:', sqlite3.version.libVersion);

    // 3. Verifica se a API de armazenamento (Storage) nativa do navegador está acessível
    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      
      // Tentativa A: Se o sub-worker do OPFS carregou com sucesso, usa o OpfsDb (Modo ideal)
      if (sqlite3.oo1.OpfsDb) {
        db = new sqlite3.oo1.OpfsDb('/meu_banco.db', 'c');
        console.log('SQLite conectado ao OPFS via OpfsDb nativo!', db.filename);
      } 
      // Tentativa B: Fallback de segurança se o sub-worker assíncrono falhou por causa da Vercel
      else if (sqlite3.oo1.DB) {
        db = new sqlite3.oo1.DB('/meu_banco.db', 'c');
        console.log('SQLite conectado em modo de compatibilidade direta (DB).');
      } 
      else {
        throw new Error('Nenhum construtor de banco de dados válido foi encontrado no módulo SQLite.');
      }
      
      // 4. Cria a tabela padrão se ela não existir no celular do usuário
      db.exec("CREATE TABLE IF NOT EXISTS contatos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, telephone TEXT);");
      
      // Notifica o index.html que o banco de dados está pronto para operar
      postMessage({ tipo: 'STATUS', mensagem: 'Banco de dados pronto!' });

    } else {
      postMessage({ tipo: 'ERRO', mensagem: 'Este navegador de celular não oferece suporte à Storage API em Workers.' });
    }
  } catch (err) {
    // Captura erros internos e envia o texto exato para a interface gráfica
    const mensagemErro = err instanceof Error ? err.message : String(err);
    postMessage({ tipo: 'ERRO', mensagem: mensagemErro });
  }
});

// 5. Gerenciamento de Mensagens (Comunicação com o index.html)
onmessage = function (evento) {
  // Se o banco de dados ainda não foi instanciado, ignora as requisições temporariamente
  if (!db) {
    console.warn('Banco de dados ainda não está pronto.');
    return;
  }

  const { tipo, dados } = evento.data;

  // Operação de INSERT
  if (tipo === 'INSERIR') {
    try {
      db.exec({
        sql: "INSERT INTO contatos (nome, telephone) VALUES (?, ?);",
        bind: [dados.nome, dados.telefone]
      });
      postMessage({ tipo: 'SUCESSO_INSERIR' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      postMessage({ tipo: 'ERRO', mensagem: 'Erro ao inserir: ' + msg });
    }
  }

  // Operação de SELECT
  if (tipo === 'BUSCAR') {
    try {
      const listaContatos = [];
      
      db.exec({
        sql: "SELECT * FROM contatos;",
        rowMode: 'object',
        callback: (row) => {
          listaContatos.push(row);
        }
      });
      
      // Devolve a lista preenchida de volta para a interface gráfica
      postMessage({ tipo: 'LISTA_CONTATOS', dados: listaContatos });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      postMessage({ tipo: 'ERRO', mensagem: 'Erro ao buscar: ' + msg });
    }
  }
};
