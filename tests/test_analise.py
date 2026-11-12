import unittest
from datetime import date

from gupy_tracker import analise

HOJE = date(2026, 11, 12)

CURRICULO = """
Desenvolvedor Full-Stack .NET | Angular
Resumo: experiência com C#, ASP.NET Core, Entity Framework, SQL Server e Angular.
Backend: C#, .NET Core 8, ASP.NET Core, Entity Framework, FluentValidation.
Arquitetura: DDD, Clean Architecture, CQRS, microsserviços, API-First.
Containers: Docker, otimização de imagens .NET Core, ambientes multi-container e Kubernetes (conhecimento conceitual).
Cloud: Azure App Service, SQL Database, Azure DevOps, CI/CD, Git.
Design System GOV.BR e acessibilidade WCAG. Scrum.
Inglês: básico / intermediário inicial.
Certificações
Linux Foundation — LFS158: Introduction to Kubernetes — Credencial: LF7pt65q0zket

EXPERIÊNCIA
Empresa A | Desenvolvedor Pleno
Jun/2022 – atual
Empresa B | Analista de Sistemas
Jan/2019 – Mai/2022
Formação
UNIDERP — Campo Grande, MS | 2013–2019
Bacharelado em Engenharia de Computação — concluído em 2019
"""

VAGA_REQUISITOS = """
Requisitos e qualificações
- Experiência comprovada com C# e .NET
- ASP.NET Core e Entity Framework
- SQL Server
- 5+ anos de experiência em desenvolvimento
- Angular
- RabbitMQ em produção
Diferenciais
- Kubernetes
- Terraform
"""

VAGA_DESCRICAO = "Sistemas críticos do setor público. Migração de legado, Design System GOV.BR."


class Tecnologias(unittest.TestCase):
    def test_nao_casa_dentro_de_outra_palavra(self):
        self.assertEqual(analise.tecnologias_em("Usamos JavaScript"), {"JavaScript"})

    def test_reconhece_termos_com_simbolos(self):
        self.assertTrue({"C#", ".NET"} <= analise.tecnologias_em("C# e .NET 8"))

    def test_sem_acento_e_caixa(self):
        self.assertIn("Microsserviços", analise.tecnologias_em("MICROSSERVIÇOS"))


class Cobertura(unittest.TestCase):
    def test_experiencia_vale_inteiro_estudo_vale_metade(self):
        cob = analise.cobertura_curriculo(CURRICULO)
        self.assertEqual(cob["C#"], 1.0)
        self.assertEqual(cob["Docker"], 1.0)
        self.assertEqual(cob["Kubernetes"], 0.5)

    def test_tecnologia_ausente_nao_aparece(self):
        self.assertNotIn("RabbitMQ", analise.cobertura_curriculo(CURRICULO))


class LinhasIndependentes(unittest.TestCase):
    def test_janela_de_estudo_nao_cruza_linhas(self):
        cv = "Kubernetes (conhecimento conceitual)\nDocker em produção"
        cob = analise.cobertura_curriculo(cv)
        self.assertEqual(cob["Kubernetes"], 0.5)
        self.assertEqual(cob["Docker"], 1.0)


class Requisitos(unittest.TestCase):
    def test_separa_obrigatorios_de_diferenciais(self):
        obrig, desej = analise.separar_requisitos(VAGA_REQUISITOS)
        self.assertIn("C#", obrig)
        self.assertIn("RabbitMQ", obrig)
        self.assertEqual(desej, {"Kubernetes", "Terraform"})


class Experiencia(unittest.TestCase):
    def test_anos_pedidos(self):
        self.assertEqual(analise.anos_pedidos(VAGA_REQUISITOS), 5.0)
        self.assertIsNone(analise.anos_pedidos("Vaga sem tempo definido"))

    def test_periodos_sem_formacao_e_sem_repetir_meses(self):
        # 2022-06 a 2026-11 (54 meses) + 2019-01 a 2022-05 (41 meses) = 95 meses = 7,9 anos.
        self.assertEqual(analise.anos_curriculo(CURRICULO, HOJE), 7.9)

    def test_experiencia_explicita_prevalece_quando_maior(self):
        self.assertEqual(analise.anos_curriculo("Tenho 10 anos de experiência em software.", HOJE), 10.0)


class Analisar(unittest.TestCase):
    def test_fluxo_completo_gera_criterios_palavras_e_lacunas(self):
        r = analise.analisar(curriculo=CURRICULO, requisitos=VAGA_REQUISITOS, descricao=VAGA_DESCRICAO, hoje=HOJE)
        self.assertEqual(set(r.criterios), {"obrigatorios", "desejaveis", "experiencia", "dominio", "logistica"})
        for nota in r.criterios.values():
            self.assertTrue(0 <= nota <= 100)
        self.assertIn("C#", r.palavras_chave)
        self.assertIn("RabbitMQ", r.lacunas)
        self.assertTrue(any(x.startswith("Kubernetes") for x in r.lacunas))
        self.assertIn("setor público", analise.dominios_em(VAGA_DESCRICAO))
        # Vaga: setor público, alta criticidade, legado (3 temas). Currículo de teste cita só GOV.BR: 1/3.
        self.assertEqual(r.criterios["dominio"], 33)

    def test_obrigatorios_refletem_a_cobertura(self):
        # 6 tecnologias obrigatórias: C#, .NET, ASP.NET Core, Entity Framework, SQL Server, Angular, RabbitMQ.
        r = analise.analisar(curriculo=CURRICULO, requisitos=VAGA_REQUISITOS, hoje=HOJE)
        self.assertEqual(r.criterios["obrigatorios"], round(100 * 6 / 7))

    def test_score_e_classificacao_seguem_o_modelo(self):
        r = analise.analisar(curriculo=CURRICULO, requisitos=VAGA_REQUISITOS, hoje=HOJE)
        from gupy_tracker.modelo import calcular_match_score, classificar
        self.assertEqual(r.match_score, calcular_match_score(r.criterios))
        self.assertEqual(r.classificacao, classificar(r.match_score))

    def test_avisa_quando_nao_ha_requisitos_reconhecidos(self):
        r = analise.analisar(curriculo=CURRICULO, requisitos="Procuramos alguém comunicativo.", hoje=HOJE)
        self.assertEqual(r.criterios["obrigatorios"], analise.NEUTRO)
        self.assertTrue(any("obrigatórios" in a for a in r.avisos))

    def test_ingles_fluente_com_curriculo_basico_reduz_logistica(self):
        vaga = "Requisitos\n- Inglês fluente\n- C#"
        r = analise.analisar(curriculo=CURRICULO, requisitos=vaga, hoje=HOJE)
        self.assertEqual(r.criterios["logistica"], 40)

    def test_exige_vaga_e_curriculo(self):
        with self.assertRaises(ValueError):
            analise.analisar(curriculo=CURRICULO, hoje=HOJE)
        with self.assertRaises(ValueError):
            analise.analisar(curriculo="   ", requisitos="C#", hoje=HOJE)


if __name__ == "__main__":
    unittest.main()
