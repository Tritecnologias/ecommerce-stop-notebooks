# Configuração do Supabase

## 1. Criar projeto
- Acesse https://supabase.com e crie um novo projeto
- Copie `Project URL` e `anon key` em Settings > API

## 2. Executar o schema
No SQL Editor do Supabase, execute em ordem:
1. `supabase/schema.sql` — cria as tabelas, RLS e triggers
2. `supabase/seed.sql` — insere os 6 produtos iniciais

## 3. Criar usuário admin
Após criar sua conta via `/cadastro`, execute no SQL Editor:
```sql
update profiles set role = 'admin' where id = 'SEU_USER_ID';
```

## 4. Configurar variáveis de ambiente
Copie `.env.example` para `.env` e preencha com as chaves do seu projeto.

## Tabelas
| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfis de usuário (extend auth.users) |
| `addresses` | Endereços salvos dos clientes |
| `products` | Catálogo de produtos |
| `orders` | Pedidos realizados |
| `order_items` | Itens de cada pedido |
