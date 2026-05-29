# MetaDesk — Deploy no GitHub Pages + Supabase

## Estrutura de arquivos
```
metadesk/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── config.js      ← você vai preencher
│   └── app.js
└── supabase-schema.sql
```

---

## Passo 1 — Configurar o Supabase

1. Acesse [supabase.com](https://supabase.com) e abra seu projeto
2. Vá em **SQL Editor** e cole o conteúdo de `supabase-schema.sql`, clique em **Run**
3. Vá em **Settings → API** e copie:
   - **Project URL** → `https://xxxx.supabase.co`
   - **anon public key** → começa com `eyJ...`

4. Abra o arquivo `js/config.js` e preencha:
```js
const CONFIG = {
  SUPABASE_URL: 'https://SEU_PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'sua_anon_key_aqui',
};
```

---

## Passo 2 — Criar repositório no GitHub

```bash
# Na pasta do projeto (metadesk/)
git init
git add .
git commit -m "primeiro commit"

# Crie um repositório em github.com (botão New repository)
# Depois conecte:
git remote add origin https://github.com/SEU_USUARIO/metadesk.git
git branch -M main
git push -u origin main
```

---

## Passo 3 — Ativar GitHub Pages

1. No seu repositório do GitHub, clique em **Settings**
2. No menu lateral, clique em **Pages**
3. Em **Source**, selecione:
   - Branch: `main`
   - Folder: `/ (root)`
4. Clique em **Save**
5. Aguarde ~1 minuto. Seu site estará em:
   ```
   https://SEU_USUARIO.github.io/metadesk/
   ```

---

## Passo 4 — Configurar domínio no Supabase (importante!)

Para o login funcionar pelo GitHub Pages:

1. No Supabase, vá em **Authentication → URL Configuration**
2. Em **Site URL**, coloque:
   ```
   https://SEU_USUARIO.github.io/metadesk
   ```
3. Em **Redirect URLs**, adicione:
   ```
   https://SEU_USUARIO.github.io/metadesk
   ```

---

## Uso

1. Acesse seu link do GitHub Pages
2. **Crie uma conta** com seu e-mail
3. Confirme o e-mail (Supabase envia automaticamente)
4. **Adicione um cliente** com nome, setor e token do Meta
5. Os dados são buscados em tempo real da Meta Graph API

---

## Como obter o Token do Meta (por cliente)

1. Acesse [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)
2. Selecione o app ou crie um
3. Clique em **Gerar token de acesso**
4. Selecione as permissões:
   - `ads_read`
   - `ads_management`
   - `pages_read_engagement`
   - `pages_show_list`
   - `instagram_basic`
5. Copie o token e cole ao adicionar o cliente

> **Tokens de curta duração expiram em 1-2 horas.**
> Para produção, gere um **token de longa duração** (60 dias) ou use um **System User Token** no Meta Business Manager (não expira).

---

## Atualizações futuras

Para atualizar o site após mudanças:
```bash
git add .
git commit -m "atualização"
git push
```
O GitHub Pages atualiza automaticamente em ~1 minuto.
