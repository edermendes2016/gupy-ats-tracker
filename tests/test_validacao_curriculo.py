import unittest
from datetime import date

from gupy_tracker import analise
from gupy_tracker.validacao_curriculo import CurriculoNaoReconhecido, _sinais, verificar

HOJE = date(2026, 11, 12)

VAGA_3CON = """Desenvolvedor Backend .Net Core
Publicada em 11 de novembro de 2026
Inscrições abertas até 10 de janeiro de 2027
Descrição da vaga
Estamos em busca de um(a) Desenvolvedor Backend .Net Core para atuar em uma das maiores indústrias do Brasil!
Requisitos e qualificações
Desenvolvimento de APIs RESTful com .NET Core 8+.
Background Services e Worker Services.
Swagger/OpenAPI e contratos de APIs bem definidos.
C# avançado, orientação a objetos, SOLID e injeção de dependência.
Etapas do processo
Etapa 1: Cadastro
Etapa 2: Entrevista R&S
Candidate-se hoje mesmo às nossas vagas e faça parte do time 3CON!
"""

ROTEIRO = """Modelo de Roteiro para atividade experimental – PIBID
Um mapa de acidez e basicidade com materiais do cotidiano
Autor(a): ____________________
1. INFORMAÇÕES CURRICULARES
Disciplina Química, com articulação interdisciplinar com Biologia e Matemática
Etapa de ensino 2º ano do Ensino Médio
Competência Específica 3 da área de Ciências da Natureza e suas Tecnologias (BNCC)
Habilidades EM13CNT301 Construir questões, elaborar hipóteses e previsões
Materiais: repolho roxo, água, sucos cítricos, vinagre, bicarbonato de sódio, copos descartáveis
Procedimento: fatie o repolho, ferva em água por dez minutos e coe o líquido em um copo
Discussão: registre as cores observadas em cada mistura e compare com a escala de pH
"""

CV_COM_CONTATO = """Ana Exemplo
ana.exemplo@email.com | (11) 91234-5678
Experiência
Empresa Fictícia | Desenvolvedora
Jun/2022 – atual
Formação
Universidade Fictícia | 2014–2018
"""

CV_SEM_CONTATO = """Ana Exemplo
Experiência
Empresa Fictícia | Desenvolvedora
Jun/2022 – atual
Formação
Universidade Fictícia | 2014–2018
"""


class Recusa(unittest.TestCase):
    def test_roteiro_de_aula_nao_e_curriculo(self):
        with self.assertRaises(CurriculoNaoReconhecido) as ctx:
            verificar(ROTEIRO)
        self.assertIsInstance(ctx.exception, ValueError)
        self.assertIn("não parece um currículo", str(ctx.exception))

    def test_vaga_colada_no_lugar_do_curriculo_e_recusada(self):
        with self.assertRaises(CurriculoNaoReconhecido):
            verificar(VAGA_3CON)

    def test_analisar_recusa_antes_de_calcular_score(self):
        with self.assertRaises(ValueError):
            analise.analisar(curriculo=ROTEIRO, requisitos="Requisitos\n- C#", hoje=HOJE)

    def test_so_um_sinal_recusa(self):
        # Só títulos de seção: não basta para ser um currículo.
        with self.assertRaises(CurriculoNaoReconhecido):
            verificar("Experiência\nFormação\nHabilidades\nIdiomas\n")

    def test_titulo_no_meio_de_frase_nao_conta_como_secao(self):
        texto = "Tenho experiência e formação em C#. " * 3
        with self.assertRaises(CurriculoNaoReconhecido):
            verificar(texto)


class Aceite(unittest.TestCase):
    def test_curriculo_com_contato_secoes_e_periodos_passa_sem_aviso(self):
        cv = CV_COM_CONTATO + "\n".join(["Desenvolvimento de sistemas em C# e ASP.NET Core."] * 20)
        self.assertEqual(verificar(cv), [])

    def test_curriculo_curto_com_tres_sinais_passa(self):
        # Contato, duas seções e dois períodos: 3 sinais, mesmo abaixo de 80 palavras.
        self.assertEqual(verificar(CV_COM_CONTATO), [])

    def test_dois_sinais_passa_com_aviso(self):
        avisos = verificar(CV_SEM_CONTATO)
        self.assertEqual(len(avisos), 1)
        self.assertIn("poucos sinais de currículo", avisos[0])
        self.assertIn("e-mail ou telefone", avisos[0])

    def test_aviso_chega_ao_resultado_da_analise(self):
        r = analise.analisar(curriculo=CV_SEM_CONTATO, requisitos="Requisitos\n- C#", hoje=HOJE)
        self.assertTrue(any("poucos sinais de currículo" in a for a in r.avisos))


class Limites(unittest.TestCase):
    def test_texto_vazio_continua_com_a_mensagem_de_vazio(self):
        with self.assertRaisesRegex(ValueError, "está vazio"):
            analise.analisar(curriculo="   ", requisitos="C#", hoje=HOJE)

    def test_periodo_com_ano_so_nao_basta(self):
        # Um único intervalo de anos não conta como dois períodos.
        texto = "Ana\nExperiência\nEmpresa | 2019 – 2022\nFormação\n" + "palavra " * 90
        self.assertFalse(_sinais(texto)["periodos"])


if __name__ == "__main__":
    unittest.main()
