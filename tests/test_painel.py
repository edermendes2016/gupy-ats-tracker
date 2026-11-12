"""Painel de métricas: funil, evolução, score médio e agregação de pontos fortes e lacunas."""
import unittest

from gupy_tracker import relatorio

CRITERIOS = dict(obrigatorios=80, desejaveis=50, experiencia=70, dominio=60, logistica=90)


def vaga(id, data, status, palavras=(), lacunas=(), historico=None):
    return {
        "id": id, "data": data, "empresa": "Empresa Teste", "cargo": "Dev", "status": status,
        "criterios": CRITERIOS, "palavras_chave": list(palavras), "lacunas": list(lacunas),
        "historico": historico or [{"data": data, "status": status}],
    }


class PainelTest(unittest.TestCase):
    def setUp(self):
        self.vagas = [
            vaga("a", "2026-01-10", "entrevista", ["Python", "Docker"], ["Kubernetes (só estudo ou certificação)"],
                 historico=[{"data": "2026-01-10", "status": "analisada"},
                            {"data": "2026-02-03", "status": "candidatada"},
                            {"data": "2026-02-20", "status": "entrevista"}]),
            vaga("b", "2026-02-05", "candidatada", ["Python"], ["Kubernetes"]),
            vaga("c", "2026-02-07", "analisada", ["Python", "SQL Server"], ["Kubernetes", "AWS"]),
        ]

    def test_pontos_fortes_ordenados_por_frequencia(self):
        m = relatorio.metricas(self.vagas)
        self.assertEqual(m["pontos_fortes"][0], {"nome": "Python", "vagas": 3})
        self.assertEqual({t["nome"] for t in m["pontos_fortes"]}, {"Python", "Docker", "SQL Server"})

    def test_lacunas_sem_o_sufixo_e_contadas_uma_vez_por_vaga(self):
        m = relatorio.metricas(self.vagas)
        self.assertEqual(m["lacunas"][0], {"nome": "Kubernetes", "vagas": 3})
        self.assertIn({"nome": "AWS", "vagas": 1}, m["lacunas"])

    def test_evolucao_usa_datas_do_historico(self):
        ev = relatorio.metricas(self.vagas)["evolucao"]
        self.assertEqual(ev, [
            {"mes": "2026-01", "analisadas": 1, "enviadas": 0, "entrevistas": 0},
            {"mes": "2026-02", "analisadas": 2, "enviadas": 2, "entrevistas": 1},
        ])

    def test_funil_score_medio_e_ofertas(self):
        m = relatorio.metricas(self.vagas)
        self.assertEqual(m["por_status"], {"entrevista": 1, "candidatada": 1, "analisada": 1})
        self.assertEqual(m["ofertas"], 0)
        self.assertGreater(m["score_medio"], 0)

    def test_sem_vagas(self):
        m = relatorio.metricas([])
        self.assertEqual((m["pontos_fortes"], m["lacunas"], m["evolucao"]), ([], [], []))


if __name__ == "__main__":
    unittest.main()
