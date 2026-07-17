from django.urls import path
from . import views

urlpatterns = [
    path("stats/", views.NetworkStatsView.as_view()),
    path("rede/evolucao/", views.RedeEvolucaoView.as_view()),
    path("campuses/", views.CampusListView.as_view()),
    path("campuses/<slug:slug>/", views.CampusDetailView.as_view()),
    path("campuses/<slug:slug>/rede/", views.CampusRedeView.as_view()),
    path("pesquisadores/", views.ResearcherListView.as_view()),
    path("pesquisadores/<int:pk>/", views.ResearcherDetailView.as_view()),
    path("pesquisadores/<int:pk>/ego-graph/", views.ResearcherEgoGraphView.as_view()),
    path("comunidades/", views.CommunityListView.as_view()),
    path("areas/", views.AreaListView.as_view()),
    path("areas/detail/", views.AreaDetailView.as_view()),
    path("areas/coocorrencia/", views.AreaCoocorrenciaView.as_view()),
    path("search/", views.SearchView.as_view()),
]
