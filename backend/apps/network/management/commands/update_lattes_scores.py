import json
import time
import urllib.parse
import urllib.request

from django.core.management.base import BaseCommand

from apps.network.models import Researcher


class Command(BaseCommand):
    help = "Busca nota_lattes de cada pesquisador via API Lattes e salva no banco."

    def add_arguments(self, parser):
        parser.add_argument("--delay", type=float, default=0.15,
                            help="Segundos entre requisições (padrão 0.15)")
        parser.add_argument("--force", action="store_true",
                            help="Atualiza mesmo pesquisadores que já têm nota_lattes")

    def handle(self, *args, **options):
        delay = options["delay"]
        force = options["force"]

        qs = Researcher.objects.exclude(lattes_id="")
        if not force:
            qs = qs.filter(nota_lattes__isnull=True)

        total = qs.count()
        self.stdout.write(f"Atualizando {total} pesquisadores…")

        ok = 0
        falhou = 0
        for i, researcher in enumerate(qs.iterator(), 1):
            try:
                params = urllib.parse.urlencode({
                    "infor_docentes": "informacoes_docentesProducao",
                    "lattes_id": researcher.lattes_id,
                })
                url = f"https://api.lattes.bcc.ifg.edu.br/api/informacoes_docentes?{params}"
                with urllib.request.urlopen(url, timeout=10) as resp:
                    data = json.loads(resp.read())

                nota = data.get("total", {}).get("total")
                if nota is not None:
                    researcher.nota_lattes = float(nota)
                    researcher.save(update_fields=["nota_lattes"])
                    ok += 1
                else:
                    falhou += 1
            except Exception:
                falhou += 1

            if i % 50 == 0:
                self.stdout.write(f"  {i}/{total} — ok: {ok}, falhou: {falhou}")

            time.sleep(delay)

        self.stdout.write(self.style.SUCCESS(
            f"Concluído: {ok} atualizados, {falhou} falhou, {total - ok - falhou} sem nota."
        ))
