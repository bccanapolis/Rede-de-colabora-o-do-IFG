from django.contrib import admin
from .models import Campus, Community, Researcher, Publication, Authorship, Collaboration


@admin.register(Campus)
class CampusAdmin(admin.ModelAdmin):
    list_display = ["nome", "total_pesquisadores", "total_publicacoes", "area_dominante"]
    search_fields = ["nome"]


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = ["codigo", "membros", "campus_dominante", "area_dominante"]


@admin.register(Researcher)
class ResearcherAdmin(admin.ModelAdmin):
    list_display = ["nome", "campus", "papel", "total_publicacoes", "pagerank", "is_ativo"]
    list_filter = ["campus", "papel", "is_ativo"]
    search_fields = ["nome"]


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = ["titulo", "ano", "tipo"]
    list_filter = ["ano", "tipo"]
    search_fields = ["titulo"]


@admin.register(Collaboration)
class CollaborationAdmin(admin.ModelAdmin):
    list_display = ["source", "target", "weight"]
    list_filter = ["source__campus"]
