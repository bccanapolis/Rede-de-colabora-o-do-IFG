import json as _json
import re as _re
import unicodedata as _unicodedata
import urllib.request
import urllib.parse

from django.db.models import Q
from rest_framework import generics

INVALID_AREAS = frozenset({"", "Indefinido", "NaN", "nan"})

_SKIP_NATURES = {"Formação Acadêmica", "Grande Área do Conhecimento"}

_ORIENTACAO_TIPO = {
    "Trabalho De Conclusao De Curso Graduacao": "TCC Graduação",
    "Monografia De Conclusao De Curso Aperfeicoamento E Especializacao": "Especialização",
    "Iniciacao Cientifica": "Iniciação Científica",
    "Dissertacao De Mestrado": "Dissertação de Mestrado",
    "Tese De Doutorado": "Tese de Doutorado",
    "Exame De Qualificacao De Mestrado": "Qualificação Mestrado",
    "Exame De Qualificacao De Doutorado": "Qualificação Doutorado",
}


def _norm_title(s: str) -> str:
    s = _unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = _re.sub(r"[^a-z0-9]", "", s.lower())
    return s[:100]


def _fetch_lattes(lattes_id: str) -> dict | None:
    params = urllib.parse.urlencode({
        "infor_docentes": "informacoes_docentesProducao",
        "lattes_id": lattes_id,
    })
    url = f"https://api.lattes.bcc.ifg.edu.br/api/informacoes_docentes?{params}"
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = _json.loads(resp.read())
        dpdf = data.get("dados_pdf", {})
        total = data.get("total", {})
        def qty(key): return dpdf.get(key, {}).get("quantidade", 0) if isinstance(dpdf.get(key), dict) else 0

        producoes = []
        for item in data.get("Sobre", []):
            nat = item.get("natureza_da_producao", "")
            if nat in _SKIP_NATURES:
                continue

            titulo = item.get("producao") or item.get("titulo", "")

            ano_raw = (
                item.get("ano_producao")
                or item.get("ano")
                or item.get("ano_orientacao")
                or item.get("ano_producao_tecnica")
                or (str(item.get("data_inicio", ""))[:4] if item.get("data_inicio") else "")
                or (str(item.get("data_registro", ""))[:4] if item.get("data_registro") else "")
            )

            qualis = item.get("qualificacao") or item.get("qualis_conferencia")
            if qualis in ("Não Informado", "vazio", None, ""):
                qualis = None

            conf = item.get("titulo_conferencia")
            venue = (
                item.get("revista_publicado")
                or (conf if conf and conf != "vazio" else None)
                or _ORIENTACAO_TIPO.get(item.get("tipo_orientacao", ""), item.get("tipo_orientacao"))
                or item.get("natureza")
                or item.get("orgao_do_projeto")
            )

            producoes.append({
                "titulo": titulo,
                "ano": str(ano_raw) if ano_raw else "",
                "natureza": nat,
                "qualis": qualis,
                "venue": venue,
                "doi": None,
            })

        producoes.sort(key=lambda x: x.get("ano") or "", reverse=True)

        return {
            "link_curriculo": lattes_id,
            "resumo": data.get("resumo_curriculo", ""),
            "nota_total": total.get("total"),
            "nota_titulacao": total.get("subtotalA"),
            "nota_producao": total.get("subtotalB"),
            "nota_orientacao": total.get("subtotalC"),
            "nota_bancas": total.get("subtotalD"),
            "artigos_a1": qty("b7_artigo_a1"),
            "artigos_a2": qty("b8_artigo_a2"),
            "artigos_a3": qty("b9_artigo_a3"),
            "artigos_a4": qty("b10_artigo_a4"),
            "artigos_b": qty("b11_artigo_b1") + qty("b12_artigo_b2") + qty("b13_artigo_b3") + qty("b14_artigo_b4"),
            "artigos_c": qty("b15_artigo_c"),
            "artigos_sem_qualis": qty("b16_artigo_sem_qualis"),
            "producoes": producoes,
        }
    except Exception:
        return None
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Authorship, Campus, CampusEdge, Collaboration, Community, ExternalCoauthor, Publication, Researcher, YearlyProduction
from .serializers import (
    CampusDetailSerializer,
    CampusListSerializer,
    CommunitySerializer,
    ResearcherDetailSerializer,
    ResearcherListSerializer,
)


class NetworkStatsView(APIView):
    def get(self, request):
        total_r = Researcher.objects.count()
        total_p = Publication.objects.count()
        total_e = Collaboration.objects.count()
        EXCLUIR_CAMPI = {"Reitoria", "Externo"}
        total_c = Campus.objects.exclude(nome__in=EXCLUIR_CAMPI).count()
        total_com = Community.objects.count()
        top_campus = Campus.objects.order_by("-total_publicacoes").first()

        return Response({
            "total_pesquisadores": total_r,
            "total_publicacoes": total_p,
            "total_colaboracoes": total_e,
            "total_campi": total_c,
            "total_comunidades": total_com,
            "campus_mais_central": _mini_campus(top_campus),
            "area_mais_produtiva": _most_productive_area(),
            "area_extincao": _area_extincao(),
            "par_areas_conectadas": _par_areas_conectadas(),
            "par_campi_colaborativos": _par_campi_colaborativos(),
            "area_mais_crescimento": _area_mais_crescimento(),
        })


def _most_productive_area():
    from collections import defaultdict
    from .models import Authorship
    area_counts: dict[str, int] = defaultdict(int)
    for a in Authorship.objects.exclude(area__in=INVALID_AREAS).values_list("area", flat=True):
        area_counts[a] += 1
    if not area_counts:
        return {"area": "", "count": 0, "pct": 0}
    total = sum(area_counts.values())
    best = max(area_counts, key=area_counts.get)
    return {"area": best, "count": area_counts[best], "pct": round(area_counts[best] / total * 100, 1)}


def _mini_campus(c):
    if not c:
        return None
    return {"id": c.id, "nome": c.nome, "slug": c.slug, "total_publicacoes": c.total_publicacoes}


def _area_extincao():
    from collections import defaultdict
    CURRENT_YEAR = 2024
    PERIOD = 5
    MIN_OLDER = 5  # mínimo de pub. no período anterior para considerar

    area_recent: dict[str, int] = defaultdict(int)
    area_older: dict[str, int] = defaultdict(int)
    for row in (
        Authorship.objects
        .exclude(area__in=INVALID_AREAS)
        .exclude(publication__ano__isnull=True)
        .values("area", "publication__ano")
    ):
        year = row["publication__ano"]
        if year >= CURRENT_YEAR - PERIOD:
            area_recent[row["area"]] += 1
        elif year >= CURRENT_YEAR - PERIOD * 2:
            area_older[row["area"]] += 1

    best = None
    best_score = -1.0
    for area, older_cnt in area_older.items():
        if older_cnt < MIN_OLDER:
            continue
        recent_cnt = area_recent.get(area, 0)
        queda_pct = (older_cnt - recent_cnt) / older_cnt
        if queda_pct > best_score:
            best_score = queda_pct
            best = {
                "area": area,
                "publicacoes_recentes": recent_cnt,
                "publicacoes_anteriores": older_cnt,
                "queda_pct": round(queda_pct * 100, 1),
            }
    return best


def _par_areas_conectadas():
    from collections import defaultdict
    from itertools import combinations

    pub_areas: dict[int, set] = defaultdict(set)
    for row in (
        Authorship.objects
        .exclude(area__in=INVALID_AREAS)
        .values("publication_id", "area")
        .distinct()
    ):
        pub_areas[row["publication_id"]].add(row["area"])

    pair_counts: dict[tuple, int] = defaultdict(int)
    for areas in pub_areas.values():
        for a, b in combinations(sorted(areas), 2):
            pair_counts[(a, b)] += 1

    if not pair_counts:
        return None
    (area1, area2), count = max(pair_counts.items(), key=lambda x: x[1])
    return {"area1": area1, "area2": area2, "coocorrencias": count}


def _par_campi_colaborativos():
    EXCLUIR_CAMPI = {"Reitoria", "Externo"}
    edge = (
        CampusEdge.objects
        .select_related("source", "target")
        .exclude(source__nome__in=EXCLUIR_CAMPI)
        .exclude(target__nome__in=EXCLUIR_CAMPI)
        .order_by("-weight")
        .first()
    )
    if not edge:
        return None
    return {
        "campus1": edge.source.nome,
        "slug1": edge.source.slug,
        "campus2": edge.target.nome,
        "slug2": edge.target.slug,
        "colaboracoes": edge.weight,
    }


def _area_mais_crescimento():
    from collections import defaultdict
    CURRENT_YEAR = 2024
    PERIOD = 5

    area_recent: dict[str, int] = defaultdict(int)
    area_older: dict[str, int] = defaultdict(int)
    for row in (
        Authorship.objects
        .exclude(area__in=INVALID_AREAS)
        .exclude(publication__ano__isnull=True)
        .values("area", "publication__ano")
    ):
        year = row["publication__ano"]
        if year >= CURRENT_YEAR - PERIOD:
            area_recent[row["area"]] += 1
        elif year >= CURRENT_YEAR - PERIOD * 2:
            area_older[row["area"]] += 1

    best = None
    best_growth = -1
    for area, recent_cnt in area_recent.items():
        if recent_cnt < 5:
            continue
        older_cnt = area_older.get(area, 0)
        growth = recent_cnt - older_cnt
        if growth > best_growth:
            best_growth = growth
            best = {
                "area": area,
                "publicacoes_recentes": recent_cnt,
                "publicacoes_anteriores": older_cnt,
                "crescimento": growth,
                "crescimento_pct": round(growth / max(older_cnt, 1) * 100, 1),
            }
    return best


class RedeEvolucaoView(APIView):
    """Evolução temporal da rede cumulativa de coautoria interna do IFG.

    Para cada ano, considera todos os pesquisadores e coautorias registrados
    até aquele ano (rede cumulativa) e devolve nós, arestas, componentes
    conectados, tamanho/fração do maior componente (LCC) e densidade.
    """

    def get(self, request):
        from collections import defaultdict
        from itertools import combinations

        MAX_AUTORES_POR_ARTIGO = 20  # mesmo critério usado na construção de G_IFG
        pub_year: dict[int, int] = {}
        pub_authors: dict[int, set] = defaultdict(set)
        for row in (
            Authorship.objects
            .exclude(publication__ano__isnull=True)
            .filter(publication__ano__gt=1900)
            .values("publication_id", "researcher_id", "publication__ano")
        ):
            pid, rid, year = row["publication_id"], row["researcher_id"], row["publication__ano"]
            pub_year[pid] = year
            pub_authors[pid].add(rid)

        edge_first: dict[tuple, int] = {}
        for pid, authors in pub_authors.items():
            # Mesmo critério de exclusão de mega-publicações usado na
            # construção de G_IFG (Collaboration já aplica esse filtro
            # contando também autores externos; aqui usamos a contagem de
            # autores IFG como aproximação, já que Authorship só registra
            # servidores).
            if len(authors) < 2 or len(authors) > MAX_AUTORES_POR_ARTIGO:
                continue
            year = pub_year[pid]
            for pair in combinations(sorted(authors), 2):
                if pair not in edge_first or year < edge_first[pair]:
                    edge_first[pair] = year

        # Um pesquisador só se torna vértice de G_IFG quando tem a primeira
        # coautoria interna (mesma definição usada no restante do sistema e
        # no TCC: servidores sem nenhuma coautoria interna não são vértices).
        node_first: dict[int, int] = {}
        for (a, b), year in edge_first.items():
            for rid in (a, b):
                if rid not in node_first or year < node_first[rid]:
                    node_first[rid] = year

        nodes_by_year: dict[int, list] = defaultdict(list)
        for rid, year in node_first.items():
            nodes_by_year[year].append(rid)
        edges_by_year: dict[int, list] = defaultdict(list)
        for pair, year in edge_first.items():
            edges_by_year[year].append(pair)

        parent: dict[int, int] = {}
        comp_size: dict[int, int] = {}

        def find(x):
            root = x
            while parent[root] != root:
                root = parent[root]
            while parent[x] != root:
                parent[x], x = root, parent[x]
            return root

        n_components = 0
        n_edges = 0
        lcc = 0
        result = []
        for year in sorted(nodes_by_year.keys() | edges_by_year.keys()):
            for rid in nodes_by_year.get(year, ()):
                parent[rid] = rid
                comp_size[rid] = 1
                n_components += 1
                lcc = max(lcc, 1)
            for a, b in edges_by_year.get(year, ()):
                n_edges += 1
                ra, rb = find(a), find(b)
                if ra != rb:
                    if comp_size[ra] < comp_size[rb]:
                        ra, rb = rb, ra
                    parent[rb] = ra
                    comp_size[ra] += comp_size[rb]
                    n_components -= 1
                    lcc = max(lcc, comp_size[ra])

            n = len(parent)
            result.append({
                "ano": year,
                "n_nos": n,
                "n_arestas": n_edges,
                "n_componentes": n_components,
                "tamanho_lcc": lcc,
                "fracao_lcc": round(lcc / n * 100, 2) if n else 0,
                "densidade": round((2 * n_edges) / (n * (n - 1)), 8) if n > 1 else 0,
            })

        return Response(result)


class CampusListView(generics.ListAPIView):
    queryset = Campus.objects.all()
    serializer_class = CampusListSerializer
    pagination_class = None


class CampusDetailView(generics.RetrieveAPIView):
    queryset = Campus.objects.all()
    serializer_class = CampusDetailSerializer
    lookup_field = "slug"


class CampusRedeView(APIView):
    def get(self, request, slug):
        try:
            campus = Campus.objects.get(slug=slug)
        except Campus.DoesNotExist:
            return Response({"error": "Not found"}, status=404)

        EXCLUIR_CAMPI = {"Reitoria", "Externo"}
        all_campuses = list(Campus.objects.exclude(nome__in=EXCLUIR_CAMPI))
        included_ids = {c.id for c in all_campuses}
        nodes = [
            {
                "id": c.id,
                "label": c.nome.replace("CÂMPUS ", "").replace("CAMPUS ", "").title(),
                "title": c.nome,
                "slug": c.slug,
                "selected": c.id == campus.id,
                "value": max(c.total_publicacoes, 1),
            }
            for c in all_campuses
        ]
        edges = [
            {"from": e.source_id, "to": e.target_id, "value": e.weight, "title": f"{e.weight} colaborações"}
            for e in CampusEdge.objects.all()
            if e.source_id in included_ids and e.target_id in included_ids
        ]
        return Response({"nodes": nodes, "edges": edges})


class ResearcherSmallPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class ResearcherListView(generics.ListAPIView):
    serializer_class = ResearcherListSerializer
    pagination_class = ResearcherSmallPagination

    def get_queryset(self):
        qs = Researcher.objects.select_related("campus", "community").all()
        search = self.request.query_params.get("search", "").strip()
        campus_slug = self.request.query_params.get("campus", "").strip()
        papel = self.request.query_params.get("papel", "").strip()
        if search:
            qs = qs.filter(nome__icontains=search)
        if campus_slug:
            qs = qs.filter(campus__slug=campus_slug)
        if papel:
            qs = qs.filter(papel=papel)
        return qs.order_by("-pagerank")


class ResearcherDetailView(generics.RetrieveAPIView):
    queryset = Researcher.objects.select_related("campus", "community").all()
    serializer_class = ResearcherDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = dict(serializer.data)
        if instance.lattes_id:
            lattes = _fetch_lattes(instance.lattes_id)
            if lattes:
                doi_map = {}
                for pub in (
                    Publication.objects
                    .filter(authorships__researcher=instance)
                    .exclude(doi="")
                    .distinct()
                    .values("titulo", "doi")
                ):
                    key = _norm_title(pub["titulo"])
                    if key:
                        doi_raw = pub["doi"].strip()
                        doi_map[key] = doi_raw if doi_raw.startswith("http") else f"https://doi.org/{doi_raw}"

                for prod in lattes.get("producoes", []):
                    key = _norm_title(prod.get("titulo", ""))
                    if key in doi_map:
                        prod["doi"] = doi_map[key]

                data["lattes"] = lattes
        return Response(data)


class ResearcherEgoGraphView(APIView):
    def get(self, request, pk):
        try:
            researcher = Researcher.objects.select_related("campus").get(pk=pk)
        except Researcher.DoesNotExist:
            return Response({"error": "Not found"}, status=404)

        collabs = list(
            Collaboration.objects.filter(Q(source=researcher) | Q(target=researcher))
            .select_related("source__campus", "target__campus")
        )
        neighbor_ids = set()
        for c in collabs:
            neighbor_ids.add(c.source_id)
            neighbor_ids.add(c.target_id)
        neighbor_ids.discard(researcher.id)

        neighbors = {r.id: r for r in Researcher.objects.filter(id__in=neighbor_ids).select_related("campus")}

        nodes = [
            {
                "id": researcher.id,
                "label": _short_name(researcher.nome),
                "title": researcher.nome,
                "group": "ego",
                "campus": researcher.campus.nome,
                "campus_slug": researcher.campus.slug,
                "value": 20,
            }
        ]
        for r in neighbors.values():
            same_campus = r.campus_id == researcher.campus_id
            nodes.append({
                "id": r.id,
                "label": _short_name(r.nome),
                "title": r.nome,
                "group": "internal" if same_campus else "external",
                "campus": r.campus.nome,
                "campus_slug": r.campus.slug,
                "value": 8,
            })

        edges = []
        for c in collabs:
            edges.append({"from": c.source_id, "to": c.target_id, "value": c.weight, "title": f"{c.weight} coautorias"})

        # External co-authors (eh_servidor=False in the CSV)
        ext_coauthors = list(
            ExternalCoauthor.objects.filter(researcher=researcher).order_by("-coautorias")[:20]
        )
        for i, ec in enumerate(ext_coauthors):
            ext_id = -(i + 1)
            nodes.append({
                "id": ext_id,
                "label": _short_name(ec.nome),
                "title": f"{ec.nome} (Externo)",
                "group": "externo",
                "value": max(4, min(14, ec.coautorias * 2)),
            })
            edges.append({"from": researcher.id, "to": ext_id, "value": ec.coautorias, "title": f"{ec.coautorias} coautorias"})

        mesmo_campus = sum(1 for r in neighbors.values() if r.campus_id == researcher.campus_id)
        outros_campi = sum(1 for r in neighbors.values() if r.campus_id != researcher.campus_id)
        stats = {
            "total_vizinhos": len(neighbors) + len(ext_coauthors),
            "internos": mesmo_campus,
            "externos": outros_campi,
            "externos_ifg": len(ext_coauthors),
            "campi": len(set(r.campus_id for r in neighbors.values())),
        }
        return Response({"nodes": nodes, "edges": edges, "stats": stats})


def _short_name(nome: str) -> str:
    parts = nome.strip().split()
    if len(parts) <= 2:
        return nome.title()
    return f"{parts[0].title()} {parts[-1].title()}"


class CommunityListView(generics.ListAPIView):
    queryset = Community.objects.select_related("campus_dominante").all()
    serializer_class = CommunitySerializer
    pagination_class = None


class AreaListView(APIView):
    def get(self, request):
        from collections import defaultdict

        area_pub: dict[str, set] = defaultdict(set)
        area_res: dict[str, set] = defaultdict(set)

        for row in Authorship.objects.exclude(area__in=INVALID_AREAS).values("area", "publication_id", "researcher_id"):
            area_pub[row["area"]].add(row["publication_id"])
            area_res[row["area"]].add(row["researcher_id"])

        result = sorted(
            [
                {
                    "nome": area,
                    "total_publicacoes": len(pubs),
                    "total_pesquisadores": len(area_res[area]),
                }
                for area, pubs in area_pub.items()
            ],
            key=lambda x: -x["total_publicacoes"],
        )
        return Response(result)


class AreaDetailView(APIView):
    def get(self, request):
        from django.db.models import Count

        nome = request.query_params.get("nome", "").strip()
        if not nome or nome in INVALID_AREAS:
            return Response({"error": "Área não encontrada"}, status=404)

        if not Authorship.objects.filter(area=nome).exists():
            return Response({"error": "Área não encontrada"}, status=404)

        pub_ids = set(Authorship.objects.filter(area=nome).values_list("publication_id", flat=True))
        researcher_ids = set(Authorship.objects.filter(area=nome).values_list("researcher_id", flat=True))
        ativos = Researcher.objects.filter(id__in=researcher_ids, is_ativo=True).count()
        total_campi = (
            Authorship.objects.filter(area=nome).values("researcher__campus_id").distinct().count()
        )

        campus_raw = (
            Authorship.objects.filter(area=nome)
            .values("researcher__campus__slug", "researcher__campus__nome")
            .annotate(
                publicacoes=Count("publication_id", distinct=True),
                pesquisadores=Count("researcher_id", distinct=True),
            )
            .order_by("-publicacoes")[:10]
        )
        distribuicao_campi = [
            {
                "campus_nome": row["researcher__campus__nome"],
                "campus_slug": row["researcher__campus__slug"],
                "publicacoes": row["publicacoes"],
                "pesquisadores": row["pesquisadores"],
            }
            for row in campus_raw
        ]

        yearly_raw = (
            Authorship.objects.filter(area=nome)
            .exclude(publication__ano__isnull=True)
            .values("publication__ano")
            .annotate(count=Count("publication_id", distinct=True))
            .order_by("publication__ano")
        )
        producao_anual = [{"year": row["publication__ano"], "count": row["count"]} for row in yearly_raw]

        top_raw = (
            Authorship.objects.filter(area=nome)
            .values("researcher_id")
            .annotate(publicacoes_na_area=Count("publication_id", distinct=True))
            .order_by("-publicacoes_na_area")[:50]
        )
        top_count = {row["researcher_id"]: row["publicacoes_na_area"] for row in top_raw}
        top_researchers = {r.id: r for r in Researcher.objects.filter(id__in=top_count.keys()).select_related("campus")}
        top_pesquisadores = sorted(
            [
                {
                    "id": r.id,
                    "nome": r.nome,
                    "campus_nome": r.campus.nome,
                    "campus_slug": r.campus.slug,
                    "publicacoes_na_area": top_count[r.id],
                    "nota_lattes": r.nota_lattes,
                    "atividade": r.atividade,
                }
                for r in top_researchers.values()
            ],
            key=lambda x: (-(x["nota_lattes"] or 0), -x["publicacoes_na_area"]),
        )[:10]

        comunidades = Community.objects.filter(area_dominante=nome).select_related("campus_dominante")
        comunidades_data = [
            {
                "codigo": c.codigo,
                "membros": c.membros,
                "campus_dominante": c.campus_dominante.nome if c.campus_dominante else None,
                "pct_area": round(c.pct_area * 100, 1),
            }
            for c in comunidades
        ]

        # ── Análise por campus ───────────────────────────────────────────
        CURRENT_YEAR = 2024
        PERIOD = 5

        campus_pubs: dict = {}
        for row in (
            Authorship.objects.filter(area=nome)
            .exclude(publication__ano__isnull=True)
            .values("researcher__campus__slug", "publication_id", "publication__ano")
            .distinct()
        ):
            slug = row["researcher__campus__slug"]
            year = row["publication__ano"]
            if slug not in campus_pubs:
                campus_pubs[slug] = {"recent": 0, "older": 0}
            if year >= CURRENT_YEAR - PERIOD:
                campus_pubs[slug]["recent"] += 1
            elif year >= CURRENT_YEAR - PERIOD * 2:
                campus_pubs[slug]["older"] += 1

        from django.db.models import Count as _Count
        campus_ativos_map = {
            row["researcher__campus__slug"]: row["ativos"]
            for row in (
                Authorship.objects.filter(area=nome, researcher__is_ativo=True)
                .values("researcher__campus__slug")
                .annotate(ativos=_Count("researcher_id", distinct=True))
            )
        }

        TOP_PRODUTORES_POR_CAMPUS = 3
        top_per_campus: dict = {}
        for row in (
            Authorship.objects.filter(area=nome)
            .values("researcher__campus__slug", "researcher_id", "researcher__nome")
            .annotate(pubs=_Count("publication_id", distinct=True))
            .order_by("researcher__campus__slug", "-pubs")
        ):
            slug = row["researcher__campus__slug"]
            lista = top_per_campus.setdefault(slug, [])
            if len(lista) < TOP_PRODUTORES_POR_CAMPUS:
                lista.append({
                    "id": row["researcher_id"],
                    "nome": row["researcher__nome"],
                    "pubs": row["pubs"],
                })

        def _tend_status(v):
            if v is None: return "cinza"
            return "verde" if v >= 10 else ("vermelho" if v < -10 else "amarelo")

        for d in distribuicao_campi:
            slug = d["campus_slug"]
            cp = campus_pubs.get(slug, {"recent": 0, "older": 0})
            rec, old = cp["recent"], cp["older"]
            tend = round((rec - old) / old * 100, 1) if old > 0 else None
            d["publicacoes_recentes"] = rec
            d["publicacoes_anteriores"] = old
            d["tendencia"] = tend
            d["tendencia_status"] = _tend_status(tend)
            d["pesquisadores_ativos"] = campus_ativos_map.get(slug, 0)
            d["top_pesquisadores"] = top_per_campus.get(slug, [])

        # ── Análise geral ────────────────────────────────────────────────
        pubs_recent = sum(1 for r in producao_anual if r["year"] >= CURRENT_YEAR - PERIOD)
        pubs_older  = sum(1 for r in producao_anual if CURRENT_YEAR - PERIOD * 2 <= r["year"] < CURRENT_YEAR - PERIOD)
        # weighted by count, not just year presence
        pubs_recent_cnt = sum(r["count"] for r in producao_anual if r["year"] >= CURRENT_YEAR - PERIOD)
        pubs_older_cnt  = sum(r["count"] for r in producao_anual if CURRENT_YEAR - PERIOD * 2 <= r["year"] < CURRENT_YEAR - PERIOD)

        tendencia = None
        if pubs_older_cnt > 0:
            tendencia = round((pubs_recent_cnt - pubs_older_cnt) / pubs_older_cnt * 100, 1)

        total_r = len(researcher_ids)
        taxa_ativos = round(ativos / total_r, 3) if total_r else None

        produtividade = round(len(pub_ids) / total_r, 1) if total_r else None

        concentracao = None
        if distribuicao_campi and len(pub_ids) > 0:
            concentracao = round(distribuicao_campi[0]["publicacoes"] / len(pub_ids), 3)

        def _status(key, value):
            if value is None:
                return "cinza"
            if key == "tendencia":
                return "verde" if value >= 10 else ("amarelo" if value >= -10 else "vermelho")
            if key == "taxa_ativos":
                return "verde" if value >= 0.5 else ("amarelo" if value >= 0.3 else "vermelho")
            if key == "produtividade":
                return "verde" if value >= 10 else ("amarelo" if value >= 5 else "vermelho")
            if key == "concentracao":
                return "verde" if value <= 0.4 else ("amarelo" if value <= 0.6 else "vermelho")
            return "cinza"

        def _fmt_tendencia(v):
            if v is None: return "—"
            return f"+{v}%" if v >= 0 else f"{v}%"

        saude = {
            "tendencia_producao": {
                "label": "Tendência de produção",
                "descricao": f"Variação entre os últimos 5 anos ({pubs_recent_cnt} pub.) e os 5 anteriores ({pubs_older_cnt} pub.)",
                "valor": tendencia,
                "valor_fmt": _fmt_tendencia(tendencia),
                "status": _status("tendencia", tendencia),
            },
            "taxa_ativos": {
                "label": "Pesquisadores ativos",
                "descricao": f"{ativos} de {total_r} pesquisadores publicaram nos últimos 5 anos",
                "valor": taxa_ativos,
                "valor_fmt": f"{round(taxa_ativos * 100)}%" if taxa_ativos is not None else "—",
                "status": _status("taxa_ativos", taxa_ativos),
            },
            "produtividade_media": {
                "label": "Produtividade média",
                "descricao": "Publicações históricas por pesquisador na área",
                "valor": produtividade,
                "valor_fmt": f"{produtividade} pub/pesq." if produtividade is not None else "—",
                "status": _status("produtividade", produtividade),
            },
            "concentracao": {
                "label": "Concentração",
                "descricao": f"% da produção no campus com mais publicações ({distribuicao_campi[0]['campus_nome'].split()[-1] if distribuicao_campi else '—'})",
                "valor": concentracao,
                "valor_fmt": f"{round(concentracao * 100)}%" if concentracao is not None else "—",
                "status": _status("concentracao", concentracao),
            },
        }

        return Response(
            {
                "nome": nome,
                "total_publicacoes": len(pub_ids),
                "total_pesquisadores": len(researcher_ids),
                "pesquisadores_ativos": ativos,
                "total_campi": total_campi,
                "distribuicao_campi": distribuicao_campi,
                "top_pesquisadores": top_pesquisadores,
                "producao_anual": producao_anual,
                "comunidades": comunidades_data,
                "saude": saude,
            }
        )


class AreaCoocorrenciaView(APIView):
    def get(self, request):
        from collections import defaultdict

        nome = request.query_params.get("nome", "").strip()
        if not nome or nome in INVALID_AREAS:
            return Response({"error": "Área não encontrada"}, status=404)

        pub_ids = set(
            Authorship.objects.filter(area=nome).values_list("publication_id", flat=True)
        )
        if not pub_ids:
            return Response({"error": "Área não encontrada"}, status=404)

        co_rows = (
            Authorship.objects
            .filter(publication_id__in=pub_ids)
            .exclude(area__in=INVALID_AREAS | {nome})
            .values("area", "publication_id")
            .distinct()
        )

        area_pubs: dict[str, set] = defaultdict(set)
        for row in co_rows:
            area_pubs[row["area"]].add(row["publication_id"])

        cooc = sorted(
            [(area, len(pubs)) for area, pubs in area_pubs.items()],
            key=lambda x: -x[1],
        )[:25]

        nodes = [
            {
                "id": 0,
                "label": nome,
                "title": f"{nome} ({len(pub_ids)} pub.)",
                "value": len(pub_ids),
                "group": "ego",
            }
        ] + [
            {
                "id": i + 1,
                "label": area,
                "title": f"{area} · {weight} pub. em comum",
                "value": weight,
                "group": "campus",
            }
            for i, (area, weight) in enumerate(cooc)
        ]

        edges = [
            {
                "from": 0,
                "to": i + 1,
                "value": weight,
                "title": f"{weight} publicações em comum",
            }
            for i, (area, weight) in enumerate(cooc)
        ]

        return Response({
            "nodes": nodes,
            "edges": edges,
            "total_areas_relacionadas": len(area_pubs),
        })


class SearchView(APIView):
    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q or len(q) < 2:
            return Response({"campuses": [], "pesquisadores": [], "areas": []})

        campuses = Campus.objects.filter(nome__icontains=q)[:5]
        researchers = Researcher.objects.filter(nome__icontains=q).select_related("campus")[:8]
        areas = (
            Authorship.objects
            .exclude(area__in=INVALID_AREAS)
            .filter(area__icontains=q)
            .values_list("area", flat=True)
            .distinct()
            .order_by("area")[:8]
        )

        return Response({
            "campuses": [{"id": c.id, "nome": c.nome, "slug": c.slug} for c in campuses],
            "pesquisadores": [
                {"id": r.id, "nome": r.nome, "campus": r.campus.nome, "campus_slug": r.campus.slug}
                for r in researchers
            ],
            "areas": [{"nome": a} for a in areas],
        })
