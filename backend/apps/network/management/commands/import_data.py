import os
from collections import defaultdict
from itertools import combinations

import networkx as nx
import pandas as pd
from community import community_louvain
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.network.models import (
    Authorship,
    Campus,
    CampusEdge,
    Collaboration,
    Community,
    ExternalCoauthor,
    Publication,
    Researcher,
    YearlyProduction,
)

CURRENT_YEAR = 2024
RECENT_YEARS = 3
ACTIVITY_YEARS = 5
ACTIVE_MIN_PUBS = 5
MAX_AUTORES_POR_ARTIGO = 20


def _pct(s: str) -> float:
    try:
        return float(str(s).replace("%", "").strip()) / 100
    except Exception:
        return 0.0


def _health_status(indicator: str, value) -> str:
    if value is None:
        return "cinza"
    thresholds = {
        "tendencia_producao": (5.0, 0.0),
        "taxa_colaboracao": (0.6, 0.3),
        "abertura_externa": (-0.1, -0.4),
        "diversidade_tematica": (5, 3),
        "taxa_ativos": (0.6, 0.4),
        "risco_concentracao": (0.4, 0.6),
    }
    hi, lo = thresholds.get(indicator, (None, None))
    if hi is None:
        return "cinza"
    # risco_concentracao: lower is better
    if indicator == "risco_concentracao":
        if value <= hi:
            return "verde"
        if value <= lo:
            return "amarelo"
        return "vermelho"
    if value >= hi:
        return "verde"
    if value >= lo:
        return "amarelo"
    return "vermelho"


def _classify_role(r: Researcher, median_betweenness: float, median_pagerank: float) -> str:
    recent_active = r.publicacoes_recentes > 0
    long_career = (r.ultima_publicacao or 0) - (r.primeira_publicacao or 0) >= 8
    is_high_betweenness = r.betweenness > median_betweenness
    is_high_pagerank = r.pagerank > median_pagerank
    is_isolated = r.grau == 0
    external_ratio = 1 - (r.campi_colaborados / max(r.grau, 1))

    if is_isolated and recent_active:
        return "solitario"
    if is_high_betweenness and r.campi_colaborados > 2:
        return "conector"
    if external_ratio > 0.6 and r.grau > 3:
        return "embaixador"
    if is_high_pagerank and r.areas_distintas <= 2:
        return "hub_tematico"
    if recent_active and r.publicacoes_recentes >= 3 and not long_career:
        return "emergente"
    if long_career and not recent_active:
        return "declinio"
    if long_career and recent_active:
        return "veterano"
    if r.grau > 5 and r.areas_distintas <= 2:
        return "especialista"
    return "indefinido"


class Command(BaseCommand):
    help = "Importa dados dos CSVs para o banco de dados"

    def add_arguments(self, parser):
        parser.add_argument("--data-dir", default=getattr(settings, "DATA_DIR", "/data"))

    def handle(self, *args, **options):
        data_dir = options["data_dir"]
        self.stdout.write("Limpando dados existentes…")
        for Model in [YearlyProduction, CampusEdge, Collaboration, ExternalCoauthor, Authorship, Researcher, Community, Publication, Campus]:
            Model.objects.all().delete()

        # ── 1. Carregar CSVs ──────────────────────────────────────────────
        self.stdout.write("Lendo CSVs…")
        df_cent = pd.read_csv(os.path.join(data_dir, "centralidades_IFG.csv"))
        df_rede = pd.read_csv(os.path.join(data_dir, "rede_ifg_normalizado.csv"), low_memory=False)
        df_com = pd.read_csv(os.path.join(data_dir, "comunidade.csv"))

        df_cent["autor"] = df_cent["autor"].str.strip().str.upper()
        df_rede["autor_nome"] = df_rede["autor_nome"].str.strip().str.upper()
        df_cent["campus"] = df_cent["campus"].str.strip().str.title()
        df_rede["campus_autor"] = df_rede["campus_autor"].str.strip().str.title()

        # ── 1b. Mapa lattes_id e nota_lattes por pesquisador ───────────────
        lattes_map: dict[str, str] = {}
        nota_map: dict[str, float] = {}
        for _, row in df_rede.iterrows():
            nome = str(row["autor_nome"]).strip().upper()
            lattes = str(row.get("link_curriculo", "")).strip()
            if nome not in lattes_map and lattes and lattes.lower() != "nan":
                lattes_map[nome] = lattes
            if nome not in nota_map and pd.notna(row.get("nota_lattes")):
                nota_map[nome] = float(row["nota_lattes"])

        # ── 2. Campuses ───────────────────────────────────────────────────
        self.stdout.write("Criando campuses…")
        campus_names = sorted(set(df_cent["campus"].dropna().unique()) | set(df_rede["campus_autor"].dropna().unique()))
        campus_map: dict[str, Campus] = {}
        for nome in campus_names:
            if not nome or nome == "nan":
                continue
            slug = slugify(nome)
            c = Campus.objects.create(nome=nome, slug=slug)
            campus_map[nome] = c

        # ── 3. Pesquisadores ──────────────────────────────────────────────
        self.stdout.write("Criando pesquisadores…")
        researcher_map: dict[str, Researcher] = {}
        for _, row in df_cent.iterrows():
            campus = campus_map.get(row["campus"])
            if campus is None:
                continue
            r = Researcher.objects.create(
                nome=row["autor"],
                campus=campus,
                grau=int(row["grau"]),
                degree_cent=float(row["degree_cent"]),
                betweenness=float(row["betweenness"]),
                closeness=float(row["closeness"]),
                eigenvector=float(row["eigenvector"]),
                pagerank=float(row["pagerank"]),
                lattes_id=lattes_map.get(row["autor"], ""),
                nota_lattes=nota_map.get(row["autor"]),
            )
            researcher_map[row["autor"]] = r

        # ── 3b. Servidores IFG sem coautoria interna (não estão em centralidades_IFG.csv) ──
        self.stdout.write("Criando pesquisadores sem rede…")
        df_sem_rede = df_rede[df_rede["eh_servidor"] == True].drop_duplicates("autor_nome")
        for _, row in df_sem_rede.iterrows():
            nome = str(row["autor_nome"]).strip().upper()
            if nome in researcher_map:
                continue
            campus = campus_map.get(str(row["campus_autor"]).strip().title())
            if campus is None:
                continue
            r = Researcher.objects.create(nome=nome, campus=campus, lattes_id=lattes_map.get(nome, ""), nota_lattes=nota_map.get(nome))
            researcher_map[nome] = r

        # ── 4. Publicações + Autorias ─────────────────────────────────────
        self.stdout.write("Criando publicações e autorias…")
        pub_rows = {}
        for _, row in df_rede.iterrows():
            aid = int(row["id_artigo"])
            if aid not in pub_rows:
                pub_rows[aid] = row

        publications = []
        for aid, row in pub_rows.items():
            publications.append(
                Publication(
                    id_artigo=aid,
                    titulo=str(row.get("titulo", ""))[:2000],
                    ano=int(row["ano"]) if pd.notna(row.get("ano")) else None,
                    tipo=str(row.get("tipo", ""))[:100],
                    doi=str(row.get("doi", ""))[:500] if pd.notna(row.get("doi")) else "",
                    abstract=str(row.get("api_abstract", ""))[:5000] if pd.notna(row.get("api_abstract")) else "",
                    terms=str(row.get("terms", ""))[:2000] if pd.notna(row.get("terms")) else "",
                )
            )
        Publication.objects.bulk_create(publications, batch_size=500)
        pub_id_map = {p.id_artigo: p for p in Publication.objects.all()}

        # Group rows by publication id for authorship
        pub_authors: dict[int, list] = defaultdict(list)
        for _, row in df_rede.iterrows():
            pub_authors[int(row["id_artigo"])].append(row)

        authorships = []
        for aid, rows in pub_authors.items():
            pub = pub_id_map.get(aid)
            if pub is None:
                continue
            for row in rows:
                if not bool(row["eh_servidor"]):
                    continue
                r = researcher_map.get(str(row["autor_nome"]).strip().upper())
                if r is None:
                    continue
                authorships.append(
                    Authorship(
                        researcher=r,
                        publication=pub,
                        area=str(row.get("area_id", ""))[:200],
                    )
                )
        Authorship.objects.bulk_create(authorships, batch_size=500, ignore_conflicts=True)

        # ── 5. Colaborações (co-autoria entre servidores) ─────────────────
        # Mega-publicações (>20 autores) são excluídas da construção da rede
        # de coautoria (mesmo critério de Barabási et al. 2002 usado no TCC
        # para G_IFG), mas permanecem em Publication/Authorship como registro
        # de produção.
        self.stdout.write("Calculando colaborações…")
        pub_authors_rede = {
            aid: rows for aid, rows in pub_authors.items()
            if len(rows) <= MAX_AUTORES_POR_ARTIGO
        }
        collab_weight: dict[tuple[int, int], int] = defaultdict(int)
        for aid, rows in pub_authors_rede.items():
            # Só conta como coautoria interna se a própria linha estiver
            # marcada eh_servidor=True (algumas pessoas aparecem com o mesmo
            # nome como externo em outro artigo, e não como coautor aqui).
            # Também deduplica por pesquisador, pois há linhas repetidas do
            # mesmo autor no mesmo artigo (erro de pareamento na coleta).
            authors_in_pub = {
                researcher_map[str(r["autor_nome"]).strip().upper()].id: researcher_map[str(r["autor_nome"]).strip().upper()]
                for r in rows
                if bool(r["eh_servidor"]) and str(r["autor_nome"]).strip().upper() in researcher_map
            }.values()
            for a, b in combinations(authors_in_pub, 2):
                key = (min(a.id, b.id), max(a.id, b.id))
                collab_weight[key] += 1

        collabs = [
            Collaboration(source_id=src, target_id=tgt, weight=w)
            for (src, tgt), w in collab_weight.items()
        ]
        Collaboration.objects.bulk_create(collabs, batch_size=500)

        # ── 5b. Co-autorias com externos ──────────────────────────────────
        self.stdout.write("Calculando co-autorias com pesquisadores externos…")
        ext_collab_weight: dict[tuple[int, str], int] = defaultdict(int)
        for aid, rows in pub_authors_rede.items():
            ifg_in_pub = [
                researcher_map[str(r["autor_nome"]).strip().upper()]
                for r in rows
                if bool(r["eh_servidor"]) and str(r["autor_nome"]).strip().upper() in researcher_map
            ]
            ext_in_pub = [
                str(r["autor_nome"]).strip().upper()
                for r in rows
                if not bool(r["eh_servidor"])
            ]
            for researcher in ifg_in_pub:
                for ext_nome in ext_in_pub:
                    ext_collab_weight[(researcher.id, ext_nome)] += 1

        ExternalCoauthor.objects.bulk_create([
            ExternalCoauthor(researcher_id=rid, nome=nome, coautorias=cnt)
            for (rid, nome), cnt in ext_collab_weight.items()
        ], batch_size=500)

        # ── 6. Comunidades (Louvain) ──────────────────────────────────────
        self.stdout.write("Detectando comunidades (Louvain)…")
        G = nx.Graph()
        G.add_nodes_from(r.id for r in researcher_map.values())
        for c in Collaboration.objects.all():
            G.add_edge(c.source_id, c.target_id, weight=c.weight)

        partition = community_louvain.best_partition(G)  # {node_id: community_int}

        # Group by community integer → list of researcher ids
        comm_groups: dict[int, list[int]] = defaultdict(list)
        for node_id, comm_int in partition.items():
            comm_groups[comm_int].append(node_id)

        # Sort communities by size descending → C01, C02, ...
        sorted_comms = sorted(comm_groups.items(), key=lambda x: -len(x[1]))
        comm_obj_map: dict[int, Community] = {}

        for i, (comm_int, member_ids) in enumerate(sorted_comms):
            codigo = f"C{i+1:02d}"
            members_qs = Researcher.objects.filter(id__in=member_ids)
            campus_counts: dict[str, int] = defaultdict(int)
            area_counts: dict[str, int] = defaultdict(int)
            campus_set = set()
            area_set = set()
            for m in members_qs:
                campus_counts[m.campus.nome] += 1
                campus_set.add(m.campus_id)
            for auth in Authorship.objects.filter(researcher_id__in=member_ids).exclude(area=""):
                area_counts[auth.area] += 1
                area_set.add(auth.area)

            campus_dom = max(campus_counts, key=campus_counts.get) if campus_counts else ""
            campus_dom_obj = campus_map.get(campus_dom)
            area_dom = max(area_counts, key=area_counts.get) if area_counts else "Indefinido"
            total = len(member_ids)
            pct_c = campus_counts.get(campus_dom, 0) / total if total else 0
            pct_a = area_counts.get(area_dom, 0) / sum(area_counts.values()) if area_counts else 0

            comm = Community.objects.create(
                codigo=codigo,
                membros=total,
                campus_dominante=campus_dom_obj,
                pct_campus=round(pct_c * 100, 1),
                area_dominante=area_dom,
                pct_area=round(pct_a * 100, 1),
                n_campus_unicos=len(campus_set),
                n_areas_unicas=len(area_set),
            )
            comm_obj_map[comm_int] = comm

        # Assign community to researchers
        for r in Researcher.objects.all():
            comm_int = partition.get(r.id)
            if comm_int is not None and comm_int in comm_obj_map:
                r.community = comm_obj_map[comm_int]
                r.save(update_fields=["community"])

        # ── 7. Stats por pesquisador ──────────────────────────────────────
        self.stdout.write("Calculando stats por pesquisador…")
        for r in Researcher.objects.select_related("campus").all():
            pubs = list(
                r.authorships.select_related("publication").values_list(
                    "publication__ano", "publication__id", "area"
                )
            )
            anos = [p[0] for p in pubs if p[0]]
            r.total_publicacoes = len(pubs)
            r.publicacoes_recentes = sum(1 for a in anos if a and a >= CURRENT_YEAR - RECENT_YEARS)
            r.primeira_publicacao = min(anos) if anos else None
            r.ultima_publicacao = max(anos) if anos else None

            pubs_5y = sum(1 for a in anos if a and a >= CURRENT_YEAR - ACTIVITY_YEARS)
            if pubs_5y >= ACTIVE_MIN_PUBS:
                r.atividade = "ativo"
            elif pubs_5y >= 1:
                r.atividade = "parcialmente_ativo"
            else:
                r.atividade = "inativo"
            r.is_ativo = r.atividade != "inativo"

            areas = [p[2] for p in pubs if p[2] and p[2] not in ("", "Indefinido")]
            area_counts: dict[str, int] = defaultdict(int)
            for a in areas:
                area_counts[a] += 1
            r.area_principal = max(area_counts, key=area_counts.get) if area_counts else ""

            pub_ids = [p[1] for p in pubs]
            coauthor_areas = set(
                Authorship.objects.filter(publication_id__in=pub_ids)
                .exclude(researcher=r)
                .exclude(area="")
                .exclude(area="Indefinido")
                .values_list("area", flat=True)
            )
            r.areas_distintas = len(coauthor_areas)

            # Co-authors via collaboration edges
            collab_ids = set(
                Collaboration.objects.filter(source=r).values_list("target_id", flat=True)
            ) | set(
                Collaboration.objects.filter(target=r).values_list("source_id", flat=True)
            )
            r.coautores_unicos = len(collab_ids)

            collab_campuses = set(
                Researcher.objects.filter(id__in=collab_ids).values_list("campus_id", flat=True)
            )
            r.campi_colaborados = len(collab_campuses)

            r.save(
                update_fields=[
                    "total_publicacoes", "publicacoes_recentes", "primeira_publicacao",
                    "ultima_publicacao", "atividade", "is_ativo", "areas_distintas",
                    "area_principal", "coautores_unicos", "campi_colaborados",
                ]
            )

        # ── 8. Papel dos pesquisadores ────────────────────────────────────
        self.stdout.write("Classificando papéis…")
        researchers = list(Researcher.objects.all())
        btwn_vals = [r.betweenness for r in researchers]
        pgr_vals = [r.pagerank for r in researchers]
        median_btwn = sorted(btwn_vals)[len(btwn_vals) // 2]
        median_pgr = sorted(pgr_vals)[len(pgr_vals) // 2]
        for r in researchers:
            r.papel = _classify_role(r, median_btwn, median_pgr)
        Researcher.objects.bulk_update(researchers, ["papel"], batch_size=200)

        # ── 9. YearlyProduction ───────────────────────────────────────────
        self.stdout.write("Calculando produção anual…")
        yearly_rows = []
        # Per campus
        for campus in Campus.objects.all():
            campus_pubs = (
                Authorship.objects.filter(researcher__campus=campus)
                .values_list("publication__ano", flat=True)
            )
            year_counts: dict[int, int] = defaultdict(int)
            for y in campus_pubs:
                if y:
                    year_counts[y] += 1
            for y, cnt in year_counts.items():
                yearly_rows.append(YearlyProduction(campus=campus, year=y, count=cnt))
        # Per researcher
        for r in Researcher.objects.all():
            r_pubs = r.authorships.values_list("publication__ano", flat=True)
            year_counts2: dict[int, int] = defaultdict(int)
            for y in r_pubs:
                if y:
                    year_counts2[y] += 1
            for y, cnt in year_counts2.items():
                yearly_rows.append(YearlyProduction(researcher=r, year=y, count=cnt))
        YearlyProduction.objects.bulk_create(yearly_rows, batch_size=500)

        # ── 10. Campus edges ──────────────────────────────────────────────
        self.stdout.write("Calculando arestas entre campi…")
        campus_edge_weight: dict[tuple[int, int], int] = defaultdict(int)
        for c in Collaboration.objects.select_related("source__campus", "target__campus"):
            s_c = c.source.campus_id
            t_c = c.target.campus_id
            if s_c != t_c:
                key = (min(s_c, t_c), max(s_c, t_c))
                campus_edge_weight[key] += c.weight
        campus_edges = [
            CampusEdge(source_id=s, target_id=t, weight=w)
            for (s, t), w in campus_edge_weight.items()
        ]
        CampusEdge.objects.bulk_create(campus_edges, batch_size=500)

        # ── 11. Stats + health por campus ─────────────────────────────────
        self.stdout.write("Calculando saúde dos campi…")
        for campus in Campus.objects.all():
            researchers_qs = Researcher.objects.filter(campus=campus)
            total_r = researchers_qs.count()
            ativos = researchers_qs.filter(is_ativo=True).count()

            all_pubs = Authorship.objects.filter(researcher__campus=campus)
            total_pub = (
                Publication.objects.filter(authorships__researcher__campus=campus)
                .distinct()
                .count()
            )
            recent_pub = (
                Publication.objects.filter(
                    authorships__researcher__campus=campus,
                    ano__gte=CURRENT_YEAR - RECENT_YEARS,
                )
                .distinct()
                .count()
            )

            # Tendência: % change comparing last 3 years vs previous 3
            yearly = {
                yp.year: yp.count
                for yp in YearlyProduction.objects.filter(campus=campus)
            }
            recent_sum = sum(yearly.get(y, 0) for y in range(CURRENT_YEAR - RECENT_YEARS, CURRENT_YEAR))
            prev_sum = sum(yearly.get(y, 0) for y in range(CURRENT_YEAR - RECENT_YEARS * 2, CURRENT_YEAR - RECENT_YEARS))
            if prev_sum > 0:
                tendencia = (recent_sum - prev_sum) / prev_sum * 100
            else:
                tendencia = 0.0

            # Taxa colaboração: pubs com >= 2 autores / total
            pubs_campus = Publication.objects.filter(
                authorships__researcher__campus=campus
            ).distinct()
            collab_pub_count = sum(
                1 for p in pubs_campus if p.authorships.count() >= 2
            )
            total_p = pubs_campus.count()
            taxa_colab = collab_pub_count / total_p if total_p else 0

            # E-I index: (external - internal) / (external + internal) co-authorships
            internal = Collaboration.objects.filter(
                source__campus=campus, target__campus=campus
            ).count()
            external = Collaboration.objects.filter(
                source__campus=campus
            ).exclude(target__campus=campus).count() + Collaboration.objects.filter(
                target__campus=campus
            ).exclude(source__campus=campus).count()
            total_edges = internal + external
            abertura = (external - internal) / total_edges if total_edges else 0

            # Diversidade temática: nº de áreas com >= 5 pubs
            area_counts: dict[str, int] = defaultdict(int)
            for a in all_pubs.exclude(area="").values_list("area", flat=True):
                area_counts[a] += 1
            diversidade = sum(1 for cnt in area_counts.values() if cnt >= 5)

            # Risco concentração: % produção nos top 3 pesquisadores
            top3 = researchers_qs.order_by("-total_publicacoes")[:3]
            top3_pub = sum(r.total_publicacoes for r in top3)
            risco = top3_pub / total_pub if total_pub else 0

            # Área dominante
            area_dom = max(area_counts, key=area_counts.get) if area_counts else ""
            pct_area_dom = area_counts.get(area_dom, 0) / sum(area_counts.values()) if area_counts else 0

            # Perfil temático
            if pct_area_dom > 0.6:
                perfil_tematico = "Concentrado"
            elif pct_area_dom > 0.4:
                perfil_tematico = "Semi-especializado"
            else:
                perfil_tematico = "Diversificado"

            # Perfil conectividade
            if abertura > 0.1:
                perfil_con = "Aberto"
            elif abertura > -0.2:
                perfil_con = "Bem conectado"
            else:
                perfil_con = "Internamente focado"

            n_com = Community.objects.filter(campus_dominante=campus).count()

            campus.total_pesquisadores = total_r
            campus.pesquisadores_ativos = ativos
            campus.total_publicacoes = total_pub
            campus.publicacoes_recentes = recent_pub
            campus.n_comunidades = n_com
            campus.tendencia_producao = round(tendencia, 2)
            campus.taxa_colaboracao = round(taxa_colab, 3)
            campus.abertura_externa = round(abertura, 3)
            campus.diversidade_tematica = diversidade
            campus.taxa_ativos = round(ativos / total_r, 3) if total_r else 0
            campus.risco_concentracao = round(risco, 3)
            campus.perfil_tematico = perfil_tematico
            campus.perfil_conectividade = perfil_con
            campus.area_dominante = area_dom
            campus.pct_area_dominante = round(pct_area_dom, 3)
            campus.save()

        total_r = Researcher.objects.count()
        total_p = Publication.objects.count()
        total_e = Collaboration.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Importação concluída: {total_r} pesquisadores, {total_p} publicações, {total_e} colaborações."
            )
        )
