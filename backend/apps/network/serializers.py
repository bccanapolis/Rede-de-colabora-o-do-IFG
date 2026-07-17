from rest_framework import serializers
from .models import Campus, Community, Researcher, YearlyProduction, Collaboration, CampusEdge

INVALID_AREAS = frozenset({"", "Indefinido", "NaN", "nan"})
_AREA_FIELDS = ("area_dominante", "area_principal")


def _clean_area_fields(data: dict) -> dict:
    for f in _AREA_FIELDS:
        if f in data and data[f] in INVALID_AREAS:
            data[f] = ""
    return data


def health_status(indicator: str, value) -> str:
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


class CampusListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campus
        fields = [
            "id", "nome", "slug", "total_pesquisadores", "pesquisadores_ativos",
            "total_publicacoes", "publicacoes_recentes", "area_dominante",
        ]

    def to_representation(self, instance):
        return _clean_area_fields(super().to_representation(instance))


class ResearcherListSerializer(serializers.ModelSerializer):
    campus_nome = serializers.CharField(source="campus.nome")
    campus_slug = serializers.CharField(source="campus.slug")
    papel_display = serializers.CharField(source="get_papel_display")
    community_codigo = serializers.CharField(source="community.codigo", allow_null=True)

    class Meta:
        model = Researcher
        fields = [
            "id", "nome", "campus_nome", "campus_slug", "papel", "papel_display",
            "pagerank", "betweenness", "degree_cent", "total_publicacoes",
            "publicacoes_recentes", "is_ativo", "atividade", "area_principal", "community_codigo",
        ]

    def to_representation(self, instance):
        return _clean_area_fields(super().to_representation(instance))


class CommunitySerializer(serializers.ModelSerializer):
    campus_dominante_nome = serializers.CharField(source="campus_dominante.nome", allow_null=True)
    campus_dominante_slug = serializers.CharField(source="campus_dominante.slug", allow_null=True)

    class Meta:
        model = Community
        fields = [
            "id", "codigo", "membros", "campus_dominante_nome", "campus_dominante_slug",
            "pct_campus", "area_dominante", "pct_area", "n_campus_unicos", "n_areas_unicas",
        ]

    def to_representation(self, instance):
        return _clean_area_fields(super().to_representation(instance))


class YearlyProductionSerializer(serializers.ModelSerializer):
    class Meta:
        model = YearlyProduction
        fields = ["year", "count"]


class CampusDetailSerializer(serializers.ModelSerializer):
    health = serializers.SerializerMethodField()
    producao_anual = serializers.SerializerMethodField()
    top_grau = serializers.SerializerMethodField()
    top_intermediacao = serializers.SerializerMethodField()
    top_proximidade = serializers.SerializerMethodField()
    top_nota_lattes = serializers.SerializerMethodField()
    top_pagerank = serializers.SerializerMethodField()
    top_campi_parceiros = serializers.SerializerMethodField()
    colaboracoes_intercampi = serializers.SerializerMethodField()
    pesquisadores_ponte = serializers.SerializerMethodField()
    pico_producao = serializers.SerializerMethodField()
    tendencia_classificacao = serializers.SerializerMethodField()
    areas_emergentes = serializers.SerializerMethodField()
    distribuicao_areas = serializers.SerializerMethodField()
    novos_pesquisadores_recentes = serializers.SerializerMethodField()
    ranking_centralidade = serializers.SerializerMethodField()
    ei_por_area = serializers.SerializerMethodField()
    pontuacao_lattes_por_area = serializers.SerializerMethodField()

    class Meta:
        model = Campus
        fields = [
            "id", "nome", "slug",
            "total_pesquisadores", "pesquisadores_ativos", "total_publicacoes",
            "publicacoes_recentes", "n_comunidades",
            "perfil_tematico", "perfil_conectividade",
            "area_dominante", "pct_area_dominante",
            "tendencia_producao", "taxa_colaboracao", "abertura_externa",
            "diversidade_tematica", "taxa_ativos", "risco_concentracao",
            "health", "producao_anual",
            "top_grau", "top_intermediacao", "top_proximidade", "top_nota_lattes", "top_pagerank",
            "top_campi_parceiros", "colaboracoes_intercampi", "pesquisadores_ponte",
            "pico_producao", "tendencia_classificacao", "areas_emergentes",
            "distribuicao_areas", "novos_pesquisadores_recentes", "ranking_centralidade",
            "ei_por_area", "pontuacao_lattes_por_area",
        ]

    def get_health(self, obj):
        return {
            "tendencia_producao": {
                "label": "Tendência de produção",
                "descricao": "Variação % média (3 anos)",
                "valor": obj.tendencia_producao,
                "status": health_status("tendencia_producao", obj.tendencia_producao),
            },
            "taxa_colaboracao": {
                "label": "Taxa de colaboração",
                "descricao": "Artigos colaborativos ÷ total",
                "valor": obj.taxa_colaboracao,
                "status": health_status("taxa_colaboracao", obj.taxa_colaboracao),
            },
            "abertura_externa": {
                "label": "Abertura externa",
                "descricao": "Índice E-I do campus",
                "valor": obj.abertura_externa,
                "status": health_status("abertura_externa", obj.abertura_externa),
            },
            "diversidade_tematica": {
                "label": "Diversidade temática",
                "descricao": "Nº áreas com ≥ 5 artigos",
                "valor": obj.diversidade_tematica,
                "status": health_status("diversidade_tematica", obj.diversidade_tematica),
            },
            "taxa_ativos": {
                "label": "Taxa de pesquisadores ativos",
                "descricao": "Ativos (3 anos) ÷ total",
                "valor": obj.taxa_ativos,
                "status": health_status("taxa_ativos", obj.taxa_ativos),
            },
            "risco_concentracao": {
                "label": "Risco de concentração",
                "descricao": "% produção nos 3 mais produtivos",
                "valor": obj.risco_concentracao,
                "status": health_status("risco_concentracao", obj.risco_concentracao),
            },
        }

    def get_producao_anual(self, obj):
        return list(
            YearlyProduction.objects.filter(campus=obj, researcher=None)
            .values("year", "count")
            .order_by("year")
        )

    def _mini_researcher(self, r, metric=None):
        data = {
            "id": r.id, "nome": r.nome, "campus_slug": r.campus.slug,
            "total_publicacoes": r.total_publicacoes,
            "papel": r.papel, "papel_display": r.get_papel_display(),
            "grau": r.grau, "degree_cent": round(r.degree_cent, 4),
            "betweenness": round(r.betweenness, 4), "closeness": round(r.closeness, 4),
            "eigenvector": round(r.eigenvector, 4), "pagerank": round(r.pagerank, 4),
            "nota_lattes": r.nota_lattes,
        }
        if metric:
            data["metric_value"] = data[metric]
        return data

    def _top_by(self, obj, field, metric=None):
        return [self._mini_researcher(r, metric=metric or field) for r in
                Researcher.objects.filter(campus=obj).order_by(f"-{field}")[:5]]

    def get_top_grau(self, obj):
        return self._top_by(obj, "grau")

    def get_top_intermediacao(self, obj):
        return self._top_by(obj, "betweenness")

    def get_top_proximidade(self, obj):
        return self._top_by(obj, "closeness")

    def get_top_nota_lattes(self, obj):
        return [self._mini_researcher(r, metric="nota_lattes") for r in
                Researcher.objects.filter(campus=obj, nota_lattes__isnull=False).order_by("-nota_lattes")[:5]]

    def get_top_pagerank(self, obj):
        return self._top_by(obj, "pagerank")

    def get_top_campi_parceiros(self, obj):
        result = []
        for edge in CampusEdge.objects.filter(source=obj).select_related("target").order_by("-weight")[:5]:
            result.append({"campus": edge.target.nome, "slug": edge.target.slug, "colaboracoes": edge.weight})
        for edge in CampusEdge.objects.filter(target=obj).select_related("source").order_by("-weight")[:5]:
            result.append({"campus": edge.source.nome, "slug": edge.source.slug, "colaboracoes": edge.weight})
        result.sort(key=lambda x: -x["colaboracoes"])
        seen = set()
        deduped = []
        for item in result:
            if item["slug"] not in seen:
                seen.add(item["slug"])
                deduped.append(item)
        return deduped[:5]

    def get_colaboracoes_intercampi(self, obj):
        from django.db.models import Sum
        a = CampusEdge.objects.filter(source=obj).aggregate(s=Sum("weight"))["s"] or 0
        b = CampusEdge.objects.filter(target=obj).aggregate(s=Sum("weight"))["s"] or 0
        return a + b

    def get_pesquisadores_ponte(self, obj):
        return Researcher.objects.filter(campus=obj, campi_colaborados__gte=2).count()

    def get_pico_producao(self, obj):
        yp = YearlyProduction.objects.filter(campus=obj, researcher=None).order_by("-count").first()
        return yp.year if yp else None

    def get_tendencia_classificacao(self, obj):
        if obj.tendencia_producao is None:
            return "Estável"
        if obj.tendencia_producao > 5:
            return "Crescimento"
        if obj.tendencia_producao < -5:
            return "Declínio"
        return "Estável"

    def to_representation(self, instance):
        return _clean_area_fields(super().to_representation(instance))

    def get_distribuicao_areas(self, obj):
        from collections import defaultdict
        from apps.network.models import Authorship
        area_counts: dict[str, int] = defaultdict(int)
        for a in (
            Authorship.objects
            .filter(researcher__campus=obj)
            .exclude(area__in=INVALID_AREAS)
            .values_list("area", flat=True)
        ):
            area_counts[a] += 1
        total = sum(area_counts.values())
        if not total:
            return []
        return sorted(
            [{"area": a, "count": cnt, "pct": round(cnt / total * 100, 1)}
             for a, cnt in area_counts.items() if cnt >= 2],
            key=lambda x: -x["count"],
        )[:10]

    def get_ei_por_area(self, obj):
        """Índice E-I (Krackhardt & Stern) por grande área, considerando toda
        coautoria que envolva ao menos um pesquisador deste campus (o outro
        extremo pode ser de outro campus). Para cada área, uma aresta é
        interna (I) se os dois pesquisadores pertencem à mesma área, e
        externa (E) caso contrário; E-I = (E - I) / (E + I)."""
        from django.db.models import Q
        from collections import defaultdict

        colaboracoes = (
            Collaboration.objects
            .filter(Q(source__campus=obj) | Q(target__campus=obj))
            .select_related("source", "target")
        )

        e_count: dict[str, int] = defaultdict(int)
        i_count: dict[str, int] = defaultdict(int)
        pesquisadores_por_area: dict[str, set] = defaultdict(set)

        for c in colaboracoes:
            area_s = c.source.area_principal
            area_t = c.target.area_principal
            if area_s in INVALID_AREAS or area_t in INVALID_AREAS:
                continue
            if c.source.campus_id == obj.id:
                pesquisadores_por_area[area_s].add(c.source_id)
            if c.target.campus_id == obj.id:
                pesquisadores_por_area[area_t].add(c.target_id)
            for area in {area_s, area_t}:
                if area_s == area_t:
                    i_count[area] += 1
                else:
                    e_count[area] += 1

        result = []
        for area, n_pesquisadores in pesquisadores_por_area.items():
            e, i = e_count[area], i_count[area]
            total = e + i
            if total == 0:
                continue
            result.append({
                "area": area,
                "ei": round((e - i) / total, 3),
                "n_pesquisadores": len(n_pesquisadores),
                "n_colaboracoes": total,
            })
        return sorted(result, key=lambda x: x["ei"])

    def get_pontuacao_lattes_por_area(self, obj):
        """Pontuação Lattes média (nota_lattes) dos pesquisadores deste campus,
        agrupados pela área principal de cada um. Áreas com menos de 3
        pesquisadores com nota registrada são descartadas para evitar que um
        único pesquisador domine a média."""
        from collections import defaultdict

        pesquisadores = (
            Researcher.objects
            .filter(campus=obj)
            .exclude(area_principal__in=INVALID_AREAS)
            .values("area_principal", "nota_lattes")
        )

        notas_por_area: dict[str, list] = defaultdict(list)
        total_por_area: dict[str, int] = defaultdict(int)
        for p in pesquisadores:
            area = p["area_principal"]
            total_por_area[area] += 1
            if p["nota_lattes"] is not None:
                notas_por_area[area].append(p["nota_lattes"])

        result = []
        for area, notas in notas_por_area.items():
            if len(notas) < 3:
                continue
            result.append({
                "area": area,
                "media_nota": round(sum(notas) / len(notas), 1),
                "n_com_nota": len(notas),
                "n_total": total_por_area[area],
            })
        return sorted(result, key=lambda x: -x["media_nota"])[:10]

    def get_novos_pesquisadores_recentes(self, obj):
        CURRENT_YEAR = 2024
        return Researcher.objects.filter(
            campus=obj,
            primeira_publicacao__gte=CURRENT_YEAR - 2,
        ).count()

    def get_ranking_centralidade(self, obj):
        EXCLUIR_CAMPI = {"Reitoria", "Externo"}
        qs = Campus.objects.exclude(nome__in=EXCLUIR_CAMPI)
        rank = qs.filter(total_publicacoes__gt=obj.total_publicacoes).count() + 1
        total = qs.count()
        if rank <= total / 3:
            nivel = "Alta"
        elif rank <= 2 * total / 3:
            nivel = "Média"
        else:
            nivel = "Baixa"
        return {"rank": rank, "total": total, "nivel": nivel}

    def get_areas_emergentes(self, obj):
        from collections import defaultdict
        from apps.network.models import Authorship
        CURRENT_YEAR = 2024
        recent = (
            Authorship.objects.filter(
                researcher__campus=obj,
                publication__ano__gte=CURRENT_YEAR - 3,
            )
            .exclude(area__in=INVALID_AREAS)
            .values_list("area", flat=True)
        )
        older = (
            Authorship.objects.filter(
                researcher__campus=obj,
                publication__ano__lt=CURRENT_YEAR - 3,
            )
            .exclude(area__in=INVALID_AREAS)
            .values_list("area", flat=True)
        )
        recent_counts: dict[str, int] = defaultdict(int)
        for a in recent:
            recent_counts[a] += 1
        older_counts: dict[str, int] = defaultdict(int)
        for a in older:
            older_counts[a] += 1
        growth = {
            area: cnt / max(older_counts.get(area, 1), 1)
            for area, cnt in recent_counts.items()
            if cnt >= 3
        }
        return [k for k, _ in sorted(growth.items(), key=lambda x: -x[1])[:3]]


class ResearcherDetailSerializer(serializers.ModelSerializer):
    campus_nome = serializers.CharField(source="campus.nome")
    campus_slug = serializers.CharField(source="campus.slug")
    papel_display = serializers.CharField(source="get_papel_display")
    community_codigo = serializers.CharField(source="community.codigo", allow_null=True)
    producao_anual = serializers.SerializerMethodField()
    coautores_frequentes = serializers.SerializerMethodField()
    areas = serializers.SerializerMethodField()

    class Meta:
        model = Researcher
        fields = [
            "id", "nome", "campus_nome", "campus_slug", "papel", "papel_display",
            "community_codigo",
            "grau", "degree_cent", "betweenness", "closeness", "eigenvector", "pagerank",
            "total_publicacoes", "publicacoes_recentes", "coautores_unicos",
            "campi_colaborados", "areas_distintas", "area_principal",
            "primeira_publicacao", "ultima_publicacao", "is_ativo", "atividade",
            "producao_anual", "coautores_frequentes", "areas",
        ]

    def to_representation(self, instance):
        return _clean_area_fields(super().to_representation(instance))

    def get_producao_anual(self, obj):
        return list(
            YearlyProduction.objects.filter(researcher=obj)
            .values("year", "count")
            .order_by("year")
        )

    def get_coautores_frequentes(self, obj):
        from apps.network.models import Collaboration, ExternalCoauthor
        collabs = list(
            Collaboration.objects.filter(source=obj).select_related("target__campus")
        ) + list(
            Collaboration.objects.filter(target=obj).select_related("source__campus")
        )
        collabs.sort(key=lambda c: -c.weight)
        seen = set()
        result = []
        for c in collabs:
            partner = c.target if c.source_id == obj.id else c.source
            if partner.id not in seen:
                seen.add(partner.id)
                result.append({
                    "id": partner.id,
                    "nome": partner.nome,
                    "campus": partner.campus.nome,
                    "campus_slug": partner.campus.slug,
                    "coautorias": c.weight,
                    "externo": False,
                })
        for ec in ExternalCoauthor.objects.filter(researcher=obj).order_by("-coautorias"):
            result.append({
                "id": None,
                "nome": ec.nome,
                "campus": "Externo",
                "campus_slug": None,
                "coautorias": ec.coautorias,
                "externo": True,
            })
        result.sort(key=lambda x: -x["coautorias"])
        return result

    def get_areas(self, obj):
        from collections import defaultdict
        area_counts: dict[str, int] = defaultdict(int)
        for a in obj.authorships.exclude(area__in=INVALID_AREAS).values_list("area", flat=True):
            area_counts[a] += 1
        return [
            {"area": area, "count": cnt}
            for area, cnt in sorted(area_counts.items(), key=lambda x: -x[1])
        ]
