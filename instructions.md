# Como Atualizar o App no GitHub (Processo Correto) entao


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

### **Passo 4: Enviar as Alterações para o GitHub**

Este é o processo que você usará sempre que quiser atualizar o site.

1.  No Terminal, **entre na nova pasta do projeto**:
    ```bash
    cd Controle-de-Freelas
    ```
2.  Execute os seguintes comandos, um por vez, pressionando `Enter` após cada um.

    **A. Verifique as alterações (opcional, mas recomendado):**
    ```bash
    git status
    ```
    *Isso deve mostrar uma lista de arquivos. Se você vir seus arquivos listados com `modified` ou `untracked`, é um ótimo sinal! Prossiga para o próximo passo.*

    **B. Adicione todos os arquivos para o "pacote" de envio:**
    ```bash
    git add .
    ```

    **C. Crie um "ponto de salvamento" com uma mensagem:**
    *Substitua `"Sua mensagem aqui"` por uma breve descrição do que você fez.*
    ```bash
    git commit -m "Sua mensagem aqui"
    ```
    *Exemplo: `git commit -m "Adiciona funcionalidade de busca"`*

    **D. Envie para o GitHub (isso inicia o deploy):**
    ```bash
    git push origin main
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

---

### **Verificação Final**

Após o comando `git push`, vá para a aba **"Actions"** no seu repositório do GitHub para verificar o andamento do deploy. Se o processo iniciar (com um ícone amarelo 🟡) e depois ficar verde (✅), a atualização foi um sucesso!
