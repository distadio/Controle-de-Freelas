# Como Atualizar o App no GitHub (Processo Simplificado)

Este guia mostra o método correto e definitivo para enviar as últimas alterações do seu código para o GitHub. Este processo aciona o deploy automático para o seu site (`app.pulodogatoead.com.br`).

**O processo correto é SEMPRE clonar o repositório. Nunca baixe o arquivo `.zip` para fazer alterações.**

---

### **Passo 1: Fazer Backup das Suas Alterações (Se Você Usou o .zip antes)**

Se você já tem uma pasta com alterações de um download `.zip` anterior, siga este passo. Caso contrário, pule para o Passo 2.

1.  Encontre a pasta do projeto que você descompactou (ex: `Controle-de-Freelas`).
2.  Renomeie-a para **`controle-de-freelas-backup`**.
3.  Isto garante que seu trabalho não será perdido.

---

### **Passo 2: Clonar o Repositório Corretamente**

Agora, vamos obter uma cópia do projeto que inclui as informações do Git.

1.  Abra seu **Terminal** (seja o do Mac/Windows ou o integrado no Cursor/VS Code).
2.  Navegue para a pasta onde você quer que seu projeto fique (ex: `cd ~/Downloads`).
3.  Clone o repositório. **Isso criará uma nova pasta `Controle-de-Freelas` com tudo o que precisamos.**
    ```bash
    git clone https://github.com/distadio/Controle-de-Freelas.git
    ```
    *Se você receber um erro de "destination path already exists", veja a seção "Solucionando Problemas" abaixo.*

---

### **Passo 3: Restaurar Suas Alterações (Se Fez Backup)**

1.  Abra a pasta `controle-de-freelas-backup` e a nova pasta `Controle-de-Freelas`.
2.  **Copie todo o conteúdo** de `controle-de-freelas-backup`.
3.  **Cole** dentro da nova pasta `Controle-de-Freelas`.
4.  Confirme para **substituir** todos os arquivos quando o sistema perguntar.

---

### **Passo 4: Enviar as Alterações para o GitHub (O Novo Jeito Fácil)**

Para facilitar o processo, criei um script que faz todo o trabalho pesado para você.

#### **A. Configuração Única (só precisa fazer uma vez):**
Primeiro, precisamos dar permissão para o script ser executado.
1.  Abra o Terminal e navegue até a pasta do projeto:
    ```bash
    cd Controle-de-Freelas
    ```
2.  Execute o seguinte comando para tornar o script executável:
    ```bash
    chmod +x deploy.sh
    ```

#### **B. Processo de Atualização (faça sempre que quiser atualizar o site):**
Agora, para enviar suas atualizações, basta executar um único comando.
1.  No Terminal, dentro da pasta `Controle-de-Freelas`, execute:
    ```bash
    ./deploy.sh
    ```
2.  O script vai pedir que você **descreva suas alterações**. Digite uma mensagem curta (ex: "ajusta cores do layout") e pressione `Enter`.
3.  Pronto! O script fará todo o resto e iniciará o deploy automático.

---

### **🚀 Resumo Rápido dos Comandos (Para Copiar e Colar)**

Use esta seção para agilizar o processo no dia a dia.

#### **Configuração Inicial (só precisa fazer uma vez):**
Clone o repositório e dê permissão ao script.
```bash
# 1. Clone o projeto para o seu computador
git clone https://github.com/distadio/Controle-de-Freelas.git

# 2. Entre na pasta do projeto
cd Controle-de-Freelas

# 3. Dê permissão de execução para o script de deploy
chmod +x deploy.sh
```

#### **Processo de Atualização (use sempre este comando):**
Execute este comando de dentro da pasta do projeto para enviar suas atualizações.
```bash
./deploy.sh
```

---

### **Solucionando Problemas Comuns**

*   **Erro: `fatal: destination path 'Controle-de-Freelas' already exists...`**
    *   **Causa:** Você já tem uma pasta com esse nome no local.
    *   **Solução:** Delete a pasta antiga antes de clonar. No terminal, use o comando:
        ```bash
        rm -rf Controle-de-Freelas
        ```
        *Isso apaga a pasta permanentemente. Tenha certeza que você fez backup das suas alterações antes.*
*   **Erro: `./deploy.sh: Permission denied`**
    *   **Causa:** O script não tem permissão para ser executado.
    *   **Solução:** Execute o comando de permissão novamente:
        ```bash
        chmod +x deploy.sh
        ```

---

### **Verificação Final**

Após executar `./deploy.sh`, vá para a aba **"Actions"** no seu repositório do GitHub para verificar o andamento do deploy. Se o processo iniciar (com um ícone amarelo 🟡) e depois ficar verde (✅), a atualização foi um sucesso!
