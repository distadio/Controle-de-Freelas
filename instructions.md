# Como Atualizar o App no GitHub (Processo Correto para o AI Studio)

Este guia mostra como enviar as últimas alterações do seu código para o GitHub. Este processo é o que aciona o deploy automático para o seu site `app.pulodogatoead.com.br`.

---

### **Ponto Crucial: O AI Studio NÃO Tem um Terminal**

Após uma análise correta, confirmo que o ambiente do AI Studio **NÃO possui um terminal de comando integrado**. As instruções abaixo mostram o processo correto, que envolve baixar o código para o seu computador.

---

### **Passo a Passo para Enviar as Alterações**

#### **Passo 1: Baixar e Descompactar o Projeto**

1.  No canto superior direito da tela do editor de código, encontre o **ícone de download** (uma seta apontando para baixo).
2.  Clique nele para baixar um arquivo `.zip` contendo todo o seu projeto.
3.  Salve este arquivo em um local de fácil acesso (ex: Área de Trabalho ou Downloads).
4.  **Descompacte** o arquivo.
    *   **No Mac:** Basta dar um duplo clique no arquivo `.zip`.
    *   **No Windows:** Clique com o botão direito e selecione "Extrair tudo...".

#### **Passo 2: Abrir um Terminal e Navegar até a Pasta**

Você precisa abrir um programa de linha de comando e navegar até a pasta que você acabou de descompactar.

**➡️ Para Mac:**

1.  Abra o **Terminal**.
    *   **Método Rápido:** Pressione `Command (⌘) + Barra de Espaço` para abrir o Spotlight, digite `Terminal` e pressione `Enter`.
    *   **Método Padrão:** Vá para `Aplicativos > Utilitários > Terminal`.
2.  Navegue até a pasta usando o comando `cd` (change directory).
    *   *Exemplo (se a pasta estiver em Downloads):*
    ```bash
    cd ~/Downloads/nome-da-pasta-do-projeto
    ```

**➡️ Para Windows:**

1.  Abra o **PowerShell** ou **Git Bash**.
    *   Procure por um desses programas no Menu Iniciar.
2.  Navegue até a pasta usando o comando `cd`.
    *   *Exemplo (ajuste o caminho conforme necessário):*
    ```bash
    cd C:\Users\SeuNome\Downloads\nome-da-pasta-do-projeto
    ```

#### **Passo 3: Rodar os Comandos Git (Idêntico para Mac e Windows)**

Agora que você está na pasta correta no terminal, digite os seguintes comandos, um por vez, e pressione `Enter` após cada um.

1.  **Verifique as alterações (opcional, mas recomendado):**
    ```bash
    git status
    ```

2.  **Adicione todos os arquivos modificados para o "pacote" de envio:**
    ```bash
    git add .
    ```

3.  **Crie um "ponto de salvamento" com uma mensagem descritiva:**
    *Substitua `"Sua mensagem aqui"` por uma breve descrição do que você fez.*
    ```bash
    git commit -m "Sua mensagem aqui"
    ```
    *Exemplo: `git commit -m "Adiciona funcionalidade de busca"`*

4.  **Envie o "pacote" para o GitHub:**
    *Este é o comando que inicia o deploy automático.*
    ```bash
    git push origin main
    ```

---

Após o último comando, vá para a aba **"Actions"** no seu repositório do GitHub para verificar o andamento do deploy. Se aparecer um ícone verde (✓), deu tudo certo!
