# Sistema Web — Rede de Pesquisa IFG

Aplicação web para exploração dos resultados do TCC sobre a rede de coautoria do IFG.

## Stack

- **Backend**: Django 5 + Django REST Framework
- **Banco de dados**: PostgreSQL 16
- **Frontend**: React 18 + Vite + recharts + vis-network
- **Containers**: Docker Compose

---

## Como rodar (primeira vez)

Certifique-se de que o Docker Desktop está rodando.

```bash
# 1. Entrar na pasta do sistema
cd sistema/

# 2. Subir os containers
docker-compose up -d

# 3. Aguardar o banco ficar pronto, depois aplicar as migrations
docker-compose exec backend python manage.py migrate

# 4. Criar superusuário para o admin Django (opcional)
docker-compose exec backend python manage.py createsuperuser

# 5. Importar os dados dos CSVs (demora ~3-5 min na primeira vez)
docker-compose exec backend python manage.py import_data

# 6. Abrir o sistema no navegador
# Frontend: http://localhost:5173
# API:      http://localhost:8000/api/stats/
# Admin:    http://localhost:8000/admin/
```

## Reiniciar após fechar

```bash
docker-compose up -d
# Não precisa re-importar os dados (ficam no banco PostgreSQL)
```

## Parar os containers

```bash
docker-compose down
```

## Reimportar dados (se os CSVs mudarem)

```bash
docker-compose exec backend python manage.py import_data
```

---

## Arquitetura

```
sistema/
├── docker-compose.yml
├── backend/           ← Django REST API
│   ├── apps/network/
│   │   ├── models.py           (Campus, Researcher, Publication, ...)
│   │   ├── views.py            (endpoints da API)
│   │   ├── serializers.py      (formato JSON)
│   │   └── management/commands/import_data.py
│   └── config/settings.py
└── frontend/          ← React + Vite
    └── src/
        ├── pages/Home.jsx
        ├── pages/CampusProfile.jsx
        └── pages/ResearcherProfile.jsx
```

---

## Produção

O `docker-compose.yml` é só para desenvolvimento local (hot-reload, servidor de dev). Para produção, existe um `docker-compose.prod.yml` separado, que builda o frontend como estático servido por nginx e o backend com gunicorn.

```bash
# 1. Copiar o template de variáveis de ambiente e preencher os valores reais
cp .env.example .env

# Preencher no .env pelo menos:
#   DB_PASSWORD          (senha forte, diferente da de dev)
#   DJANGO_SECRET_KEY    (gerar com: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")
#   DEBUG=False
#   ALLOWED_HOSTS        (domínio real, ex: rede.ifg.edu.br)
#   CORS_ALLOWED_ORIGINS (origem do frontend, ex: https://rede.ifg.edu.br)
#   CSRF_TRUSTED_ORIGINS (mesma origem acima)

# 2. Subir os containers de produção
docker-compose -f docker-compose.prod.yml up -d --build

# 3. Aplicar migrations e importar dados acontece automaticamente no boot do backend
#    (entrypoint.sh cuida disso)
```

O container `frontend` expõe a porta 80 (nginx), que serve os arquivos estáticos do React e faz proxy de `/api/`, `/admin/` e `/static/` para o backend. Falta apenas colocar um proxy reverso com TLS (nginx, Caddy, Traefik, etc.) na frente apontando para essa porta 80 — isso depende do servidor onde o projeto for hospedado e não está incluído aqui.

**Atenção:** com `DEBUG=False`, o Django redireciona automaticamente HTTP → HTTPS (`SECURE_SSL_REDIRECT=True` por padrão). Esse proxy reverso com TLS **precisa** repassar o header `X-Forwarded-Proto: https` nas requisições encaminhadas — sem isso, o Django nunca reconhece a requisição como segura e entra em loop de redirecionamento (site fora do ar). Se for testar a stack de produção antes do TLS estar pronto, defina `SECURE_SSL_REDIRECT=False` no `.env` temporariamente.

---

## Endpoints da API

| Rota | Descrição |
|------|-----------|
| `GET /api/stats/` | Métricas globais da rede |
| `GET /api/campuses/` | Lista de campi |
| `GET /api/campuses/{slug}/` | Perfil completo do campus |
| `GET /api/campuses/{slug}/rede/` | Grafo de campus (nodes + edges) |
| `GET /api/pesquisadores/?search=&campus=` | Lista/busca de pesquisadores |
| `GET /api/pesquisadores/{id}/` | Perfil completo do pesquisador |
| `GET /api/pesquisadores/{id}/ego-graph/` | Rede egocêntrica |
| `GET /api/comunidades/` | Lista de comunidades Louvain |
| `GET /api/search/?q=` | Busca integrada (campus + pesquisador) |
