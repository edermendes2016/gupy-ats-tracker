"""Testes do servidor gRPC. Pulam sozinhos se o extra grpc ou o código gerado faltarem."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from gupy_tracker import armazenamento
from gupy_tracker.modelo import STATUS

RAIZ = Path(__file__).resolve().parent.parent

try:
    import grpc
    from gupy_tracker.v1 import ranking_pb2, vagas_pb2, vagas_pb2_grpc
    from gupy_tracker import servidor_grpc
    DISPONIVEL = True
except ImportError:
    DISPONIVEL = False

CRITERIOS = dict(obrigatorios=80, desejaveis=50, experiencia=70, dominio=60, logistica=90)
MOTIVO = "requer 'python -m pip install \".[grpc]\" grpcio-tools' e 'python scripts/gerar_proto.py'"


@unittest.skipUnless(DISPONIVEL, MOTIVO)
class ContratoTest(unittest.TestCase):
    def test_status_do_proto_espelha_o_dominio(self):
        nomes = {vagas_pb2.Status.Name(v)[len("STATUS_"):].lower() for v in vagas_pb2.Status.values()}
        nomes.discard("desconhecido")
        self.assertEqual(nomes, set(STATUS))


@unittest.skipUnless(DISPONIVEL, MOTIVO)
class ServidorTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dados = Path(self._tmp.name) / "vagas.json"
        armazenamento.salvar(self.dados, [])
        self.servidor, porta = servidor_grpc.criar_servidor(self.dados, "127.0.0.1:0")
        self.servidor.start()
        self.canal = grpc.insecure_channel(f"127.0.0.1:{porta}")
        self.vagas = vagas_pb2_grpc.VagasServiceStub(self.canal)

    def tearDown(self):
        self.canal.close()
        self.servidor.stop(0)
        self._tmp.cleanup()

    def registrar(self, empresa="Acme", cargo="Dev", data="2026-01-10", **extra):
        req = vagas_pb2.RegistrarVagaRequest(vaga=vagas_pb2.Vaga(
            data=data, empresa=empresa, cargo=cargo,
            criterios=vagas_pb2.Criterios(**CRITERIOS), modelo=vagas_pb2.MODELO_REMOTO,
            descricao="texto da vaga", **extra))
        return self.vagas.RegistrarVaga(req)

    def test_registrar_e_obter_com_score_calculado_no_servidor(self):
        criada = self.registrar()
        self.assertEqual(criada.id, "2026-01-10-acme-dev")
        self.assertEqual(criada.match_score, 73)
        self.assertEqual(criada.classificacao, "boa aderência")
        obtida = self.vagas.ObterVaga(vagas_pb2.ObterVagaRequest(id=criada.id))
        self.assertEqual(obtida.descricao, "texto da vaga")

    def test_duplicada_e_invalida_viram_codigos_de_erro(self):
        self.registrar()
        with self.assertRaises(grpc.RpcError) as dup:
            self.registrar()
        self.assertEqual(dup.exception.code(), grpc.StatusCode.ALREADY_EXISTS)
        with self.assertRaises(grpc.RpcError) as inv:
            self.vagas.RegistrarVaga(vagas_pb2.RegistrarVagaRequest(vaga=vagas_pb2.Vaga(
                data="2026-01-11", empresa="X", cargo="Y",
                criterios=vagas_pb2.Criterios(obrigatorios=200, desejaveis=1, experiencia=1, dominio=1, logistica=1))))
        self.assertEqual(inv.exception.code(), grpc.StatusCode.INVALID_ARGUMENT)

    def test_atualizar_status_e_filtrar_listagem(self):
        criada = self.registrar()
        atual = self.vagas.AtualizarStatus(vagas_pb2.AtualizarStatusRequest(
            id=criada.id, novo_status=vagas_pb2.STATUS_ENTREVISTA, data="2026-01-12"))
        self.assertEqual(atual.status, vagas_pb2.STATUS_ENTREVISTA)
        self.assertEqual(len(atual.historico), 2)
        filtrada = self.vagas.ListarVagas(vagas_pb2.ListarVagasRequest(status=vagas_pb2.STATUS_ENTREVISTA))
        self.assertEqual(len(filtrada.vagas), 1)
        vazia = self.vagas.ListarVagas(vagas_pb2.ListarVagasRequest(status=vagas_pb2.STATUS_ANALISADA))
        self.assertEqual(len(vazia.vagas), 0)

    def test_modo_anonimo_nao_expoe_empresa_nem_texto(self):
        criada = self.registrar(empresa="Empresa Secreta")
        listagem = self.vagas.ListarVagas(vagas_pb2.ListarVagasRequest(anonimo=True)).vagas
        self.assertNotIn("Empresa Secreta", str(listagem))
        self.assertFalse(listagem[0].HasField("descricao"))
        detalhe = self.vagas.ObterVaga(vagas_pb2.ObterVagaRequest(id=criada.id, anonimo=True))
        self.assertNotIn("Empresa Secreta", str(detalhe))
        self.assertEqual(detalhe.url, "")
        self.assertFalse(detalhe.HasField("descricao"))

    def test_ranking_e_metricas(self):
        self.registrar(empresa="A", cargo="1")
        self.registrar(empresa="B", cargo="2", data="2026-01-11")
        ranking = self.canal.unary_unary(
            "/gupy_tracker.v1.RankingService/Ranking",
            request_serializer=ranking_pb2.RankingRequest.SerializeToString,
            response_deserializer=ranking_pb2.RankingResponse.FromString)(ranking_pb2.RankingRequest())
        self.assertEqual(len(ranking.vagas_ordenadas), 2)
        metricas = self.canal.unary_unary(
            "/gupy_tracker.v1.RankingService/Metricas",
            request_serializer=ranking_pb2.MetricasRequest.SerializeToString,
            response_deserializer=ranking_pb2.MetricasResponse.FromString)(ranking_pb2.MetricasRequest())
        self.assertEqual(metricas.total, 2)

    def test_recusa_endereco_que_nao_e_loopback(self):
        with self.assertRaises(SystemExit):
            servidor_grpc.criar_servidor(self.dados, "0.0.0.0:0")


class CliSemGrpcTest(unittest.TestCase):
    def test_cli_nao_importa_grpc(self):
        codigo = "import sys, gupy_tracker.cli; assert 'grpc' not in sys.modules"
        subprocess.run([sys.executable, "-c", codigo], check=True, cwd=RAIZ)


if __name__ == "__main__":
    unittest.main()


@unittest.skipUnless(DISPONIVEL, MOTIVO)
class AnaliseGrpcTest(unittest.TestCase):
    def test_analisar_devolve_criterios_e_recusa_formato_sem_suporte(self):
        import tempfile
        from pathlib import Path as P

        from gupy_tracker import servidor_grpc
        from gupy_tracker.v1 import analise_pb2 as apb, analise_pb2_grpc as agrpc

        grpc = servidor_grpc._grpc()
        with tempfile.TemporaryDirectory() as tmp:
            servidor, porta = servidor_grpc.criar_servidor(P(tmp) / "vagas.json", "127.0.0.1:0")
            servidor.start()
            try:
                stub = agrpc.AnaliseServiceStub(grpc.insecure_channel(f"127.0.0.1:{porta}"))
                r = stub.Analisar(apb.AnalisarRequest(
                    curriculo=b"C#, ASP.NET Core e Entity Framework em producao.",
                    nome_arquivo="cv.txt",
                    requisitos="Requisitos\n- C#\n- RabbitMQ",
                ))
                self.assertEqual(r.criterios.obrigatorios, 50)
                self.assertIn("C#", list(r.palavras_chave))
                self.assertIn("RabbitMQ", list(r.lacunas))
                with self.assertRaises(grpc.RpcError) as erro:
                    stub.Analisar(apb.AnalisarRequest(curriculo=b"x", nome_arquivo="cv.xlsx", requisitos="C#"))
                self.assertEqual(erro.exception.code(), grpc.StatusCode.INVALID_ARGUMENT)
            finally:
                servidor.stop(0)
