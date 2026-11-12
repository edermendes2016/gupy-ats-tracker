import unittest
from datetime import date

from gupy_tracker import analise
from gupy_tracker.analise import TECNOLOGIAS, tecnologias_em
from gupy_tracker.respostas_gupy import LIMITE_APRESENTACAO, MAX_HABILIDADES, montar

HOJE = date(2026, 11, 12)

CV = """Ana Exemplo
ana.exemplo@email.com | (11) 91234-5678
Resumo
Desenvolvedora backend com foco em APIs.
Experiência
Empresa Fictícia | Desenvolvedora Pleno
Jun/2022 – atual
Desenvolvimento de APIs em C# e ASP.NET Core, com Entity Framework e SQL Server, deploy em Azure App Service.
Empresa Exemplo | Analista de Sistemas
Jan/2019 – Mai/2022
Manutenção de sistemas internos e automação com Docker e Git.
Formação
Universidade Fictícia | 2014–2018
Habilidades
C#, ASP.NET Core, Entity Framework, SQL Server, Docker, Git, Angular (estudo)
Certificações
Kubernetes (conhecimento conceitual)
"""

VAGA = """Requisitos e qualificações
- Experiência comprovada com C# e .NET
- ASP.NET Core e Entity Framework
- SQL Server
- React em produção
- RabbitMQ
Diferenciais
- Kubernetes
"""


class Montagem(unittest.TestCase):
    def test_respostas_saem_da_analise_completa(self):
        r = analise.analisar(curriculo=CV, requisitos=VAGA, hoje=HOJE)
        self.assertTrue(r.apresentacao.startswith("Sou desenvolvedora pleno com 7 anos de experiência."))
        self.assertIn("C#", r.habilidades_valiosas)
        self.assertLessEqual(len(r.habilidades_valiosas), MAX_HABILIDADES)

    def test_texto_nunca_passa_de_1500_caracteres(self):
        muitas = {t: 1.0 for t in TECNOLOGIAS}
        pesos = {t: 3 for t in TECNOLOGIAS}
        r = montar(tecnologias_cv=muitas, pesos_vaga=pesos, cargo="Desenvolvedor Pleno", anos=10)
        self.assertLessEqual(len(r.apresentacao), LIMITE_APRESENTACAO)
        self.assertTrue(r.apresentacao.endswith("."))

    def test_nao_cita_tecnologia_que_o_curriculo_nao_tem(self):
        r = analise.analisar(curriculo=CV, requisitos=VAGA, hoje=HOJE)
        do_curriculo = tecnologias_em(CV)
        for texto in [r.apresentacao, *r.habilidades_valiosas]:
            citadas = tecnologias_em(texto)
            self.assertLessEqual(citadas, do_curriculo, f"citou sem ter: {citadas - do_curriculo}")
        self.assertNotIn("React", r.apresentacao)
        self.assertNotIn("RabbitMQ", r.apresentacao)

    def test_habilidades_existem_no_curriculo_e_casam_com_a_vaga(self):
        r = analise.analisar(curriculo=CV, requisitos=VAGA, hoje=HOJE)
        do_curriculo = tecnologias_em(CV)
        for h in r.habilidades_valiosas:
            self.assertIn(h, do_curriculo)
        self.assertNotIn("React", r.habilidades_valiosas)
        self.assertNotIn("RabbitMQ", r.habilidades_valiosas)

    def test_telefone_nao_conta_como_periodo(self):
        # "(11) 91234-5678" tem a forma de um intervalo de anos; não pode somar anos de experiência.
        self.assertEqual(analise.anos_curriculo(CV, HOJE), 7.9)

    def test_estudo_nao_vira_experiencia(self):
        r = analise.analisar(curriculo=CV, requisitos="Requisitos\n- Angular", hoje=HOJE)
        self.assertNotIn("Angular", r.apresentacao.split("Tenho estudado")[0])
        self.assertIn("Tenho estudado Angular", r.apresentacao)


class Casos(unittest.TestCase):
    def test_sem_cargo_nao_inventa_frase_de_cargo(self):
        cv = "Ana\nExperiência\nEmpresa | Jun/2022 – atual\nC# e SQL Server em produção por dois anos.\nFormação\n"
        r = montar(tecnologias_cv={"C#": 1.0}, pesos_vaga={"C#": 3}, cargo=None, anos=0)
        self.assertNotIn("Sou ", r.apresentacao)
        self.assertIn("C#", r.apresentacao)

    def test_curriculo_sem_tecnologia_reconhecida_nao_quebra(self):
        r = montar(tecnologias_cv={}, pesos_vaga={"C#": 3}, cargo="Analista", anos=3)
        self.assertEqual(r.habilidades, [])
        self.assertIn("Sou analista com 3 anos de experiência.", r.apresentacao)

    def test_habilidades_priorizam_o_que_a_vaga_pede(self):
        r = montar(
            tecnologias_cv={"Docker": 1.0, "C#": 1.0, "Git": 1.0, "SQL Server": 1.0},
            pesos_vaga={"C#": 3, "SQL Server": 2},
            cargo=None,
            anos=0,
        )
        self.assertEqual(r.habilidades[:2], ["C#", "SQL Server"])
        self.assertLessEqual(len(r.habilidades), MAX_HABILIDADES)


if __name__ == "__main__":
    unittest.main()
