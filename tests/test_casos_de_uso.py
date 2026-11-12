import unittest

from gupy_tracker import casos_de_uso as cdu

CRITERIOS = {"obrigatorios": 80, "desejaveis": 50, "experiencia": 70, "dominio": 60, "logistica": 90}


class CasosDeUsoTest(unittest.TestCase):
    def test_registrar_gera_id_e_historico(self):
        vagas = []
        vaga = cdu.registrar_vaga(vagas, data="2026-01-10", empresa="Acme Ação", cargo="Dev Pleno", criterios=CRITERIOS)
        self.assertEqual(vaga["id"], "2026-01-10-acme-acao-dev-pleno")
        self.assertEqual(vaga["historico"], [{"data": "2026-01-10", "status": "analisada"}])
        self.assertIs(vagas[0], vaga)

    def test_registrar_rejeita_duplicada_sem_alterar_lista(self):
        vagas = []
        cdu.registrar_vaga(vagas, data="2026-01-10", empresa="A", cargo="B", criterios=CRITERIOS)
        with self.assertRaises(cdu.VagaDuplicada):
            cdu.registrar_vaga(vagas, data="2026-01-10", empresa="A", cargo="B", criterios=CRITERIOS)
        self.assertEqual(len(vagas), 1)

    def test_curriculo_outro_exige_nome(self):
        with self.assertRaises(cdu.CurriculoSemNome):
            cdu.registrar_vaga([], data="2026-01-10", empresa="A", cargo="B", criterios=CRITERIOS, curriculo="outro")

    def test_criterio_fora_da_faixa_vira_vaga_invalida(self):
        with self.assertRaises(cdu.VagaInvalida):
            cdu.registrar_vaga([], data="2026-01-10", empresa="A", cargo="B", criterios={**CRITERIOS, "dominio": 101})

    def test_achar_vaga_exige_resultado_unico(self):
        vagas = [{"id": "2026-01-10-acme-dev"}, {"id": "2026-01-11-acme-qa"}]
        self.assertEqual(cdu.achar_vaga(vagas, "2026-01-10-acme-dev")["id"], "2026-01-10-acme-dev")
        with self.assertRaisesRegex(cdu.VagaNaoEncontrada, "ambígua"):
            cdu.achar_vaga(vagas, "acme")
        with self.assertRaisesRegex(cdu.VagaNaoEncontrada, "não encontrada"):
            cdu.achar_vaga(vagas, "nada")

    def test_atualizar_status_acrescenta_historico(self):
        vagas = [{"id": "x", "status": "analisada", "historico": [{"data": "d1", "status": "analisada"}]}]
        cdu.atualizar_status(vagas, "x", "entrevista", "d2")
        self.assertEqual(vagas[0]["status"], "entrevista")
        self.assertEqual(len(vagas[0]["historico"]), 2)

    def test_resumo_score_marca_abaixo_do_corte(self):
        score, classe, abaixo = cdu.resumo_score({k: 10 for k in CRITERIOS})
        self.assertEqual((score, classe, abaixo), (10, "não vale o esforço", True))


if __name__ == "__main__":
    unittest.main()
