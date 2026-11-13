import io
import zipfile
import json
import tempfile
import unittest
from pathlib import Path

from gupy_tracker import armazenamento, relatorio, vazamento
from gupy_tracker.cli import main
from gupy_tracker.modelo import calcular_match_score, classificar, validar_vaga

CRIT = {"obrigatorios": 80, "desejaveis": 60, "experiencia": 100, "dominio": 50, "logistica": 100}


def vaga(id_, empresa, score_obrig, status="candidatada", data="2026-03-01"):
    return {"id": id_, "data": data, "empresa": empresa, "cargo": "Dev", "status": status,
            "criterios": {**CRIT, "obrigatorios": score_obrig}}


class MatchScore(unittest.TestCase):
    def test_media_ponderada(self):
        # 80*.5 + 60*.15 + 100*.15 + 50*.10 + 100*.10 = 79
        self.assertEqual(calcular_match_score(CRIT), 79)

    def test_extremos(self):
        self.assertEqual(calcular_match_score(dict.fromkeys(CRIT, 0)), 0)
        self.assertEqual(calcular_match_score(dict.fromkeys(CRIT, 100)), 100)

    def test_rejeita_criterio_ausente_ou_fora_da_faixa(self):
        with self.assertRaises(ValueError):
            calcular_match_score({"obrigatorios": 80})
        with self.assertRaises(ValueError):
            calcular_match_score({**CRIT, "dominio": 101})

    def test_corte_de_viabilidade(self):
        self.assertEqual(classificar(39), "não vale o esforço")
        self.assertEqual(classificar(40), "aposta")
        self.assertEqual(classificar(80), "alta aderência")

    def test_validacao(self):
        self.assertEqual(validar_vaga(vaga("a", "X", 50)), [])
        self.assertTrue(validar_vaga({**vaga("a", "X", 50), "status": "sumiu"}))


class Ranking(unittest.TestCase):
    def setUp(self):
        self.vagas = [
            vaga("a", "Alfa", 40, "recusada", "2026-03-01"),
            vaga("b", "Beta", 100, "entrevista", "2026-03-02"),
            vaga("c", "Alfa", 100, "candidatada", "2026-03-05"),
            vaga("d", "Gama", 0, "descartada", "2026-03-06"),
        ]

    def test_ordem_por_score_e_desempate_pela_mais_recente(self):
        self.assertEqual([v["id"] for v in relatorio.ranquear(self.vagas)], ["c", "b", "a", "d"])

    def test_metricas(self):
        m = relatorio.metricas(self.vagas)
        self.assertEqual((m["analisadas"], m["enviadas"], m["entrevistas"]), (4, 3, 1))
        self.assertEqual(m["conversao_entrevista"], 33)
        self.assertEqual(m["por_faixa"]["80-100"], {"enviadas": 2, "entrevistas": 1})

    def test_metricas_sem_vagas(self):
        self.assertEqual(relatorio.metricas([])["conversao_entrevista"], 0)

    def test_anonimizacao_nao_deixa_nome_nem_url(self):
        self.vagas[0]["url"] = "https://alfa.gupy.io/jobs/123"
        texto = relatorio.markdown(relatorio.anonimizar(self.vagas))
        for segredo in ("Alfa", "Beta", "Gama", "gupy.io/jobs", "2026-03-05"):
            self.assertNotIn(segredo, texto)
        self.assertIn("Empresa 01", texto)

    def test_apelido_estavel_por_empresa(self):
        anon = relatorio.anonimizar(self.vagas)
        self.assertEqual(sorted({v["empresa"] for v in anon}), ["Empresa 01", "Empresa 02", "Empresa 03"])
        alfa = [v["empresa"] for v, o in zip(anon, self.vagas) if o["empresa"] == "Alfa"]
        self.assertEqual(alfa, ["Empresa 01", "Empresa 01"])


class Vazamento(unittest.TestCase):
    def test_encontra_nome_de_empresa_sem_diferenciar_maiusculas(self):
        with tempfile.TemporaryDirectory() as d:
            limpo, sujo = Path(d, "limpo.md"), Path(d, "sujo.md")
            limpo.write_text("Empresa 01 respondeu\n", encoding="utf-8")
            sujo.write_text("ok\nentrevista na banco alfa amanhã\n", encoding="utf-8")
            termos = vazamento.termos_privados([vaga("a", "Banco Alfa", 50)])
            achados = vazamento.procurar(termos, [limpo, sujo])
            self.assertEqual([(a.name, n) for a, n, _ in achados], [("sujo.md", 2)])

    def test_ignora_nomes_curtos_e_palavras_que_so_contem_o_termo(self):
        with tempfile.TemporaryDirectory() as d:
            arq = Path(d, "a.md")
            arq.write_text("gamaglobulina e TI\n", encoding="utf-8")
            termos = vazamento.termos_privados([vaga("a", "Gama", 50), vaga("b", "TI", 50)])
            self.assertEqual(termos, {"Gama"})
            self.assertEqual(vazamento.procurar(termos, [arq]), [])


class Cli(unittest.TestCase):
    def test_adicionar_status_e_relatorio(self):
        with tempfile.TemporaryDirectory() as d:
            dados, saida = str(Path(d, "p", "vagas.json")), str(Path(d, "r.md"))
            base = ["--dados", dados]
            self.assertEqual(main(base + [
                "adicionar", "--empresa", "Órgão Público S.A.", "--cargo", "Dev .NET Pleno", "--data", "2026-04-01",
                "--obrigatorios", "80", "--desejaveis", "60", "--experiencia", "100", "--dominio", "50",
                "--logistica", "100", "--lacuna", "AWS"]), 0)
            salvo = json.loads(Path(dados).read_text(encoding="utf-8"))
            self.assertEqual(salvo[0]["id"], "2026-04-01-orgao-publico-s-a-dev-net-pleno")
            self.assertEqual(main(base + ["status", "orgao-publico", "entrevista", "--data", "2026-04-09"]), 0)
            self.assertEqual(armazenamento.carregar(Path(dados))[0]["historico"][-1],
                             {"data": "2026-04-09", "status": "entrevista"})
            self.assertEqual(main(base + ["relatorio", "--saida", saida]), 0)
            texto = Path(saida).read_text(encoding="utf-8")
            self.assertIn("79%", texto)
            self.assertNotIn("Órgão", texto)

    def test_recusa_duplicata(self):
        with tempfile.TemporaryDirectory() as d:
            args = ["--dados", str(Path(d, "v.json")), "adicionar", "--empresa", "X Corp", "--cargo", "Dev",
                    "--data", "2026-04-01", "--obrigatorios", "1", "--desejaveis", "1", "--experiencia", "1",
                    "--dominio", "1", "--logistica", "1"]
            main(args)
            with self.assertRaises(SystemExit):
                main(args)

    def test_gravacao_nunca_cai_nos_dados_de_exemplo(self):
        import os
        from unittest import mock
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("GUPY_TRACKER_DADOS", None)
            with mock.patch.object(armazenamento, "PADRAO_PRIVADO", Path("/nao/existe/vagas.json")):
                self.assertEqual(armazenamento.resolver_caminho(None), armazenamento.EXEMPLO)
                self.assertEqual(armazenamento.resolver_caminho(None, escrita=True), Path("/nao/existe/vagas.json"))

    def test_dados_de_exemplo_sao_validos(self):
        self.assertEqual(len(armazenamento.carregar(armazenamento.EXEMPLO)), 4)


if __name__ == "__main__":
    unittest.main()


class PlanilhaDeControle(unittest.TestCase):
    """Exportação para a planilha .xlsx, feita só com a biblioteca padrão."""

    def _planilha(self, d):
        from zipfile import ZipFile
        caminho = Path(d) / "planilha.xlsx"
        xml = ('<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
               '<dimension ref="A1:H4"/><sheetData>'
               '<row r="1"><c r="A1" t="inlineStr"><is><t>Copie</t></is></c></row>'
               '<row r="2"><c r="A2" t="inlineStr"><is><t>Data</t></is></c></row>'
               '<row r="3"><c r="A3"/><c r="B3"/></row>'
               '<row r="4" spans="1:8"><c r="A4"/></row></sheetData></worksheet>')
        with ZipFile(caminho, "w") as z:
            z.writestr("xl/worksheets/sheet1.xml", xml)
        return caminho

    def _xml(self, caminho):
        from zipfile import ZipFile
        return ZipFile(caminho).read("xl/worksheets/sheet1.xml").decode()

    def test_grava_uma_linha_por_vaga_sem_duplicar(self):
        from datetime import date
        from gupy_tracker import planilha
        with tempfile.TemporaryDirectory() as d:
            caminho = self._planilha(d)
            v = {**vaga("a", "Alfa", 80), "cargo": "Dev", "data": "2026-03-01",
                 "url": "https://alfa.gupy.io/job/1", "palavras_chave": ["Python", "SQL"], "lacunas": ["Power BI"]}
            self.assertEqual(planilha.exportar(caminho, [v]), (1, 0))
            self.assertEqual(planilha.exportar(caminho, [v]), (0, 1))
            xml = self._xml(caminho)
            serial = (date(2026, 3, 1) - date(1899, 12, 30)).days
            self.assertIn(f"<v>{serial}</v>", xml)
            for texto in ("Alfa", "Dev", "candidatada", "Python, SQL", "Power BI", "Gupy",
                          "https://alfa.gupy.io/job/1"):
                self.assertIn(f"<t xml:space=\"preserve\">{texto}</t>", xml)
            self.assertEqual(xml.count("<t xml:space=\"preserve\">Alfa</t>"), 1)

    def test_reexportar_completa_colunas_vazias_sem_duplicar(self):
        """Regressão: vaga exportada antes de ter palavras-chave e link não os recebia depois."""
        from gupy_tracker import planilha
        with tempfile.TemporaryDirectory() as d:
            caminho = self._planilha(d)
            antiga = {**vaga("a", "Alfa", 80), "cargo": "Dev", "data": "2026-03-01", "palavras_chave": [], "lacunas": []}
            self.assertEqual(planilha.exportar(caminho, [antiga]), (1, 0))
            nova = {**antiga, "palavras_chave": ["Python", "SQL"], "lacunas": ["Power BI"],
                    "url": "https://alfa.gupy.io/job/1"}
            self.assertEqual(planilha.exportar(caminho, [nova]), (0, 1))
            xml = self._xml(caminho)
            for texto in ("Python, SQL", "Power BI", "https://alfa.gupy.io/job/1"):
                self.assertIn(f"<t xml:space=\"preserve\">{texto}</t>", xml)
            self.assertEqual(xml.count("<t xml:space=\"preserve\">Alfa</t>"), 1)

    def test_gerar_modelo_cria_planilha_que_aceita_exportacao(self):
        from gupy_tracker import planilha
        with tempfile.TemporaryDirectory() as d:
            caminho = Path(d) / "novo" / "controle.xlsx"
            planilha.gerar_modelo(caminho)
            v = {**vaga("a", "Alfa", 80), "cargo": "Dev", "data": "2026-03-01", "palavras_chave": ["C#"]}
            self.assertEqual(planilha.exportar(caminho, [v]), (1, 0))
            xml = self._xml(caminho)
            for texto in ("Data de Inscrição", "Link da vaga", "Alfa", "C#"):
                self.assertIn(texto, xml)
            with self.assertRaises(FileExistsError):
                planilha.gerar_modelo(caminho)

    def test_escapa_caracteres_especiais(self):
        from gupy_tracker import planilha
        with tempfile.TemporaryDirectory() as d:
            caminho = self._planilha(d)
            v = {**vaga("a", "A&B <Ltda>", 80), "cargo": "Dev", "data": "2026-03-01"}
            planilha.exportar(caminho, [v])
            self.assertIn("A&amp;B &lt;Ltda&gt;", self._xml(caminho))


class PlanilhaJaPreenchida(unittest.TestCase):
    """Regressão: planilha salva pelo Excel (textos em sharedStrings, datas com estilo) não duplica linhas."""

    SST = ["Empresa Exemplo", "Desenvolvedor Backend .Net Core", "desistencia", "Órgão Público"]

    def _xlsx_preenchido(self, d):
        from zipfile import ZipFile
        from gupy_tracker import planilha
        caminho = Path(d) / "controle.xlsx"
        linha3 = ('<row r="3"><c r="A3" s="10"><v>46331</v></c><c r="B3" s="1" t="s"><v>0</v></c>'
                  '<c r="C3" s="1" t="s"><v>1</v></c><c r="D3" s="15" t="s"><v>2</v></c>'
                  '<c r="E3" s="14"/><c r="F3" s="1"/><c r="G3" s="1"/><c r="H3" s="7"/></row>')
        linha4 = '<row r="4"><c r="A4" s="11"/><c r="B4" s="1"/><c r="C4" s="1"/><c r="D4" s="1"/></row>'
        aba = ('<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
               '<dimension ref="A1:H4"/><sheetData>'
               '<row r="1"><c r="A1" t="inlineStr"><is><t>Controle</t></is></c></row>'
               '<row r="2"><c r="A2" t="inlineStr"><is><t>Data</t></is></c></row>'
               f'{linha3}{linha4}</sheetData></worksheet>')
        sst = ('<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
               + "".join(f"<si><t>{t}</t></si>" for t in self.SST) + "</sst>")
        with ZipFile(caminho, "w") as z:
            z.writestr("xl/worksheets/sheet1.xml", aba)
            z.writestr("xl/sharedStrings.xml", sst)
        return caminho

    def _xml(self, caminho):
        from zipfile import ZipFile
        return ZipFile(caminho).read("xl/worksheets/sheet1.xml").decode()

    def test_nao_duplica_vaga_digitada_a_mao_e_mantem_data(self):
        from datetime import date
        from gupy_tracker import planilha
        with tempfile.TemporaryDirectory() as d:
            caminho = self._xlsx_preenchido(d)
            igual = {**vaga("a", "Empresa Exemplo", 80), "cargo": "Desenvolvedor Backend .NET Core",
                     "data": "2026-11-12", "status": "analisada", "palavras_chave": ["C#"],
                     "url": "https://exemplo.gupy.io/job/1"}
            self.assertEqual(planilha.exportar(caminho, [igual]), (0, 1))
            xml = self._xml(caminho)
            self.assertNotIn('<row r="5"', xml)  # nenhuma linha nova para a vaga já digitada
            self.assertIn("<t xml:space=\"preserve\">C#</t>", xml)
            self.assertIn("https://exemplo.gupy.io/job/1", xml)

            nova = {**vaga("b", "Empresa Teste", 90), "cargo": "Dev Full Stack", "data": "2026-11-12",
                    "palavras_chave": ["C#"]}
            self.assertEqual(planilha.exportar(caminho, [nova]), (1, 0))
            self.assertEqual(planilha.exportar(caminho, [nova]), (0, 1))
            xml = self._xml(caminho)
            self.assertEqual(xml.count("Empresa Teste"), 1)
            serial = (date(2026, 11, 12) - date(1899, 12, 30)).days
            self.assertIn(f'<c r="A4" s="10"><v>{serial}</v></c>', xml)

    def test_compara_sem_acento_e_caixa(self):
        from gupy_tracker import planilha
        with tempfile.TemporaryDirectory() as d:
            caminho = self._xlsx_preenchido(d)
            v = {**vaga("c", "ORGAO PUBLICO", 80), "cargo": "dev", "data": "2026-11-12"}
            self.assertEqual(planilha.exportar(caminho, [{**v, "empresa": "Orgao Publico"}]), (1, 0))
            self.assertEqual(planilha.exportar(caminho, [{**v, "empresa": "Órgão Público"}]), (0, 1))


class ModeloDeControle(unittest.TestCase):
    """Modelo baixável: fontes padronizadas, envio validado e preenchimento de planilha enviada."""

    VAGA = {"data": "2026-01-10", "empresa": "Acme", "cargo": "Dev", "status": "analisada",
            "palavras_chave": ["Python"], "lacunas": ["Kubernetes"], "fonte": "Gupy", "url": "https://x"}

    def test_todas_as_fontes_do_modelo_sao_calibri_11(self):
        import re
        from gupy_tracker import planilha
        estilos = (planilha.PASTA_MODELO / "styles.xml").read_text(encoding="utf-8")
        fontes = re.findall(r"<font>(.*?)</font>", re.search(r"<fonts[^>]*>(.*?)</fonts>", estilos, re.S).group(1), re.S)
        self.assertTrue(fontes)
        for f in fontes:
            self.assertIn('<name val="Calibri"/>', f)
            self.assertIn('<sz val="11"/>', f)

    def test_modelo_gerado_passa_na_verificacao(self):
        from gupy_tracker import planilha
        with tempfile.TemporaryDirectory() as d:
            caminho = Path(d) / "modelo.xlsx"
            planilha.gerar_modelo(caminho)
            planilha.ler_modelo(caminho.read_bytes())

    def test_recusa_arquivo_que_nao_e_xlsx(self):
        from gupy_tracker import planilha
        with self.assertRaises(ValueError):
            planilha.ler_modelo(b"isto nao e um zip")

    def test_recusa_planilha_com_outras_colunas(self):
        from gupy_tracker import planilha
        with tempfile.TemporaryDirectory() as d:
            caminho = Path(d) / "outra.xlsx"
            planilha.gerar_modelo(caminho)
            with zipfile.ZipFile(caminho) as z:
                dados = {n: z.read(n) for n in z.namelist()}
            dados[planilha.ABA] = dados[planilha.ABA].replace(b"Empresa", b"Empresa X", 1)
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w") as z:
                for n, c in dados.items():
                    z.writestr(n, c)
            with self.assertRaises(ValueError):
                planilha.ler_modelo(buf.getvalue())

    def test_preenche_a_planilha_enviada_sem_duplicar(self):
        from gupy_tracker import planilha
        with tempfile.TemporaryDirectory() as d:
            caminho = Path(d) / "controle.xlsx"
            planilha.gerar_modelo(caminho)
            self.assertEqual(planilha.exportar(caminho, [self.VAGA]), (1, 0))
            self.assertEqual(planilha.exportar(caminho, [self.VAGA]), (0, 1))
