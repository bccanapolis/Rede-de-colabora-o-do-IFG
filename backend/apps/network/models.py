from django.db import models


class Campus(models.Model):
    nome = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=200, unique=True)

    total_pesquisadores = models.IntegerField(default=0)
    pesquisadores_ativos = models.IntegerField(default=0)
    total_publicacoes = models.IntegerField(default=0)
    publicacoes_recentes = models.IntegerField(default=0)
    n_comunidades = models.IntegerField(default=0)

    # Health indicators (stored as raw values; status computed in serializer)
    tendencia_producao = models.FloatField(null=True, blank=True)
    taxa_colaboracao = models.FloatField(null=True, blank=True)
    abertura_externa = models.FloatField(null=True, blank=True)
    diversidade_tematica = models.IntegerField(null=True, blank=True)
    taxa_ativos = models.FloatField(null=True, blank=True)
    risco_concentracao = models.FloatField(null=True, blank=True)

    perfil_tematico = models.CharField(max_length=100, default="")
    perfil_conectividade = models.CharField(max_length=100, default="")

    area_dominante = models.CharField(max_length=200, default="")
    pct_area_dominante = models.FloatField(default=0)

    def __str__(self):
        return self.nome

    class Meta:
        ordering = ["nome"]
        verbose_name_plural = "campuses"


class Community(models.Model):
    codigo = models.CharField(max_length=20, unique=True)
    membros = models.IntegerField(default=0)
    campus_dominante = models.ForeignKey(
        Campus, null=True, blank=True, on_delete=models.SET_NULL, related_name="communities"
    )
    pct_campus = models.FloatField(default=0)
    area_dominante = models.CharField(max_length=200, default="")
    pct_area = models.FloatField(default=0)
    n_campus_unicos = models.IntegerField(default=0)
    n_areas_unicas = models.IntegerField(default=0)

    def __str__(self):
        return self.codigo

    class Meta:
        ordering = ["-membros"]


class Researcher(models.Model):
    ATIVIDADE_CHOICES = [
        ("ativo", "Ativo"),
        ("parcialmente_ativo", "Parcialmente ativo"),
        ("inativo", "Inativo"),
    ]

    PAPEL_CHOICES = [
        ("conector", "Conector"),
        ("especialista", "Especialista"),
        ("embaixador", "Embaixador"),
        ("hub_tematico", "Hub temático"),
        ("emergente", "Emergente"),
        ("solitario", "Solitário ativo"),
        ("veterano", "Veterano estável"),
        ("declinio", "Em declínio"),
        ("indefinido", "Indefinido"),
    ]

    nome = models.CharField(max_length=300, db_index=True)
    campus = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name="researchers")
    community = models.ForeignKey(
        Community, null=True, blank=True, on_delete=models.SET_NULL, related_name="members"
    )

    grau = models.IntegerField(default=0)
    degree_cent = models.FloatField(default=0)
    betweenness = models.FloatField(default=0)
    closeness = models.FloatField(default=0)
    eigenvector = models.FloatField(default=0)
    pagerank = models.FloatField(default=0)

    total_publicacoes = models.IntegerField(default=0)
    publicacoes_recentes = models.IntegerField(default=0)
    coautores_unicos = models.IntegerField(default=0)
    campi_colaborados = models.IntegerField(default=0)
    areas_distintas = models.IntegerField(default=0)
    area_principal = models.CharField(max_length=200, default="")
    primeira_publicacao = models.IntegerField(null=True, blank=True)
    ultima_publicacao = models.IntegerField(null=True, blank=True)
    is_ativo = models.BooleanField(default=False)
    atividade = models.CharField(max_length=30, choices=ATIVIDADE_CHOICES, default="inativo")
    papel = models.CharField(max_length=50, choices=PAPEL_CHOICES, default="indefinido")
    lattes_id = models.CharField(max_length=200, blank=True, default="")
    nota_lattes = models.FloatField(null=True, blank=True)

    def __str__(self):
        return self.nome

    class Meta:
        ordering = ["-pagerank"]


class Publication(models.Model):
    id_artigo = models.IntegerField(unique=True, db_index=True)
    titulo = models.TextField()
    ano = models.IntegerField(null=True, blank=True, db_index=True)
    tipo = models.CharField(max_length=100, default="")
    doi = models.CharField(max_length=500, default="")
    abstract = models.TextField(default="")
    terms = models.CharField(max_length=2000, default="")

    def __str__(self):
        return self.titulo[:80]

    class Meta:
        ordering = ["-ano"]


class Authorship(models.Model):
    researcher = models.ForeignKey(Researcher, on_delete=models.CASCADE, related_name="authorships")
    publication = models.ForeignKey(Publication, on_delete=models.CASCADE, related_name="authorships")
    area = models.CharField(max_length=200, default="")

    class Meta:
        unique_together = [["researcher", "publication"]]


class Collaboration(models.Model):
    source = models.ForeignKey(Researcher, on_delete=models.CASCADE, related_name="collaborations_out")
    target = models.ForeignKey(Researcher, on_delete=models.CASCADE, related_name="collaborations_in")
    weight = models.IntegerField(default=1)

    class Meta:
        unique_together = [["source", "target"]]
        ordering = ["-weight"]


class CampusEdge(models.Model):
    source = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name="edges_out")
    target = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name="edges_in")
    weight = models.IntegerField(default=0)

    class Meta:
        unique_together = [["source", "target"]]
        ordering = ["-weight"]


class ExternalCoauthor(models.Model):
    researcher = models.ForeignKey(Researcher, on_delete=models.CASCADE, related_name="external_coauthors")
    nome = models.CharField(max_length=300)
    coautorias = models.IntegerField(default=1)

    class Meta:
        unique_together = [["researcher", "nome"]]
        ordering = ["-coautorias"]


class YearlyProduction(models.Model):
    campus = models.ForeignKey(Campus, null=True, blank=True, on_delete=models.CASCADE, related_name="yearly")
    researcher = models.ForeignKey(
        Researcher, null=True, blank=True, on_delete=models.CASCADE, related_name="yearly"
    )
    year = models.IntegerField(db_index=True)
    count = models.IntegerField(default=0)

    class Meta:
        unique_together = [["campus", "researcher", "year"]]
        ordering = ["year"]
