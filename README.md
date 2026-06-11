# Bolão Copa 2026 - HTML + JS + Supabase

Sistema completo de palpites para a Copa do Mundo 2026.

## O que tem

- Cadastro e login com Supabase Auth.
- Recuperação de senha por e-mail.
- Perfil jogador e perfil gestor.
- Cada jogador paga R$ 0,50 por jogo apurado, mesmo se não palpitar.
- Palpite único por jogador e por jogo.
- Palpite pode ser criado, editado ou excluído somente até 30 minutos antes do jogo.
- Gestor pode bloquear/liberar apostas por jogo.
- Gestor pode bloquear/liberar todos os jogos.
- Gestor informa resultado final.
- Apuração automática.
- Ranking geral.
- Financeiro individual após login.
- Apuração pública para usuários logados.

## Passo a passo Supabase

1. Crie um projeto no Supabase.
2. Vá em SQL Editor.
3. Cole e execute o arquivo `supabase.sql`.
4. Vá em Project Settings > API.
5. Copie:
   - Project URL
   - anon public key
6. Abra o arquivo `app.js` e substitua:

```js
const SUPABASE_URL = 'COLE_AQUI_SUA_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'COLE_AQUI_SUA_SUPABASE_ANON_KEY';
```

## Definir gestor

1. Cadastre seu usuário pela tela do sistema.
2. No SQL Editor, execute:

```sql
update public.profiles
set role = 'gestor'
where email = 'SEU_EMAIL_AQUI';
```

## Recuperação de senha

No Supabase, configure a URL do site em:
Authentication > URL Configuration.

Use a URL da Vercel depois do deploy.

## Deploy na Vercel

1. Envie estes arquivos para um repositório GitHub.
2. Importe na Vercel.
3. Framework: Other.
4. Build command: deixe vazio.
5. Output directory: deixe vazio ou `/`.

## Observação sobre a tabela da Copa

O arquivo SQL já contém os 104 jogos em horário de Brasília. Para o mata-mata, os nomes aparecem como classificações provisórias, exemplo: `1º Grupo A`, `Vencedor Oitavas 1`. Depois que os confrontos forem definidos, o gestor pode ajustar diretamente na tabela `matches` pelo Supabase.
