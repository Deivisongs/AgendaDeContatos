@echo off
:: Navega até o diretório onde o arquivo .bat está salvo (sua pasta do GitHub)
cd /d "%~dp0"

:: Adiciona o arquivo específico (substitua "seu-arquivo.txt" pelo nome do seu arquivo)
:: Se quiser subir TODOS os arquivos modificados da pasta, use: git add .
git add "produtos.csv"

:: Cria o commit com uma mensagem automática (inclui data e hora)
git commit -m "Upload automatico: %date% %time%"

:: Envia os arquivos para o GitHub (mude 'main' para 'master' se seu branch principal for antigo)
git push origin main

:: Mensagem de sucesso e pausa para você ver se deu tudo certo
echo Upload concluido com sucesso!
pause