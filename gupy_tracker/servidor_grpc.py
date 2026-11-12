"""Servidor gRPC local do tracker (extra opcional).

Instalação e execução:
    pip install .[grpc]
    sh scripts/gerar_proto.sh
    python -m gupy_tracker.servidor_grpc --dados private/vagas.json

Só aceita conexões de loopback (127.0.0.1 ou localhost). A CLI não depende deste módulo.
"""
from __future__ import annotations

import argparse
import threading
from concurrent import futures
from datetime import date
from pathlib import Path

from . import armazenamento, casos_de_uso, planilha, relatorio

LOOPBACK = ("127.0.0.1", "localhost")
ENDERECO_PADRAO = "127.0.0.1:50051"
MENSAGEM_DEPENDENCIA = (
    "servidor gRPC indisponível: instale com 'pip install .[grpc]' "
    "e gere o código com 'sh scripts/gerar_proto.sh'"
)


def _grpc():
    """Importa grpc e o código gerado; sai com mensagem clara se faltar algo."""
    try:
        import grpc  # noqa: F401
        from .v1 import planilha_pb2_grpc, ranking_pb2_grpc, vagas_pb2_grpc  # noqa: F401
    except ImportError as e:
        raise SystemExit(f"{MENSAGEM_DEPENDENCIA} ({e})")
    return grpc


try:
    from .conversao_proto import requisicao_para_vaga, vaga_para_proto
except ImportError:  # sem o código gerado: _grpc() avisa antes de qualquer chamada
    def requisicao_para_vaga(*_a, **_k):
        _grpc()

    def vaga_para_proto(*_a, **_k):
        _grpc()


class _Base:
    def __init__(self, caminho: Path, trava: threading.Lock):
        self._caminho = caminho
        self._trava = trava


class VagasServicer(_Base):
    """Implementa gupy_tracker.v1.VagasService."""

    def ListarVagas(self, req, context):
        from .v1 import vagas_pb2 as pb

        vagas = armazenamento.carregar(self._caminho)
        if req.HasField("status"):
            nome = pb.Status.Name(req.status)[len("STATUS_"):].lower()
            vagas = [v for v in vagas if v["status"] == nome]
        if req.anonimo:
            vagas = relatorio.anonimizar(vagas)
        return pb.ListarVagasResponse(vagas=[vaga_para_proto(v, detalhe=False) for v in vagas])

    def ObterVaga(self, req, context):
        grpc = _grpc()
        vagas = armazenamento.carregar(self._caminho)
        try:
            vaga = casos_de_uso.achar_vaga(vagas, req.id)
        except casos_de_uso.VagaNaoEncontrada as e:
            context.abort(grpc.StatusCode.NOT_FOUND, str(e))
        if req.anonimo:
            return vaga_para_proto(relatorio.anonimizar([vaga])[0], detalhe=False)
        return vaga_para_proto(vaga, detalhe=True)

    def RegistrarVaga(self, req, context):
        grpc = _grpc()
        with self._trava:
            vagas = armazenamento.carregar(self._caminho)
            try:
                vaga = casos_de_uso.registrar_vaga(vagas, **requisicao_para_vaga(req.vaga))
            except casos_de_uso.VagaDuplicada as e:
                context.abort(grpc.StatusCode.ALREADY_EXISTS, str(e))
            except casos_de_uso.VagaInvalida as e:
                context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(e))
            armazenamento.salvar(self._caminho, vagas)
        return vaga_para_proto(vaga, detalhe=True)

    def AtualizarStatus(self, req, context):
        from .v1 import vagas_pb2 as pb

        grpc = _grpc()
        novo = pb.Status.Name(req.novo_status)[len("STATUS_"):].lower()
        with self._trava:
            vagas = armazenamento.carregar(self._caminho)
            try:
                vaga = casos_de_uso.atualizar_status(vagas, req.id, novo, req.data or date.today().isoformat())
            except casos_de_uso.VagaNaoEncontrada as e:
                context.abort(grpc.StatusCode.NOT_FOUND, str(e))
            armazenamento.salvar(self._caminho, vagas)
        return vaga_para_proto(vaga, detalhe=True)


class RankingServicer(_Base):
    """Implementa gupy_tracker.v1.RankingService."""

    def Ranking(self, req, context):
        from .v1 import ranking_pb2 as rpb

        vagas = armazenamento.carregar(self._caminho)
        if req.anonimo:
            vagas = relatorio.anonimizar(vagas)
        ordenadas = relatorio.ranquear(vagas)
        return rpb.RankingResponse(vagas_ordenadas=[vaga_para_proto(v, detalhe=False) for v in ordenadas])

    def Metricas(self, req, context):
        from .v1 import ranking_pb2 as rpb

        m = relatorio.metricas(armazenamento.carregar(self._caminho))
        return rpb.MetricasResponse(
            total=m["analisadas"],
            enviadas=m["enviadas"],
            chegaram_entrevista=m["entrevistas"],
            taxa_conversao=m["conversao_entrevista"] / 100.0,
        )


class PlanilhaServicer(_Base):
    """Implementa gupy_tracker.v1.PlanilhaService."""

    def Exportar(self, req, context):
        from .v1 import planilha_pb2 as ppb

        grpc = _grpc()
        vagas = armazenamento.carregar(self._caminho)
        try:
            novas, existentes = planilha.exportar(Path(req.caminho), vagas)
        except (OSError, ValueError) as e:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, f"não foi possível atualizar a planilha: {e}")
        return ppb.ExportarPlanilhaResponse(novas=novas, existentes=existentes)


def criar_servidor(caminho: Path, endereco: str = ENDERECO_PADRAO, max_workers: int = 4):
    """Monta o servidor sem iniciá-lo. Devolve (servidor, porta efetiva)."""
    grpc = _grpc()
    from .v1 import planilha_pb2_grpc, ranking_pb2_grpc, vagas_pb2_grpc

    host = endereco.rsplit(":", 1)[0]
    if host not in LOOPBACK:
        raise SystemExit(f"endereço recusado: '{host}'. O servidor aceita só loopback ({', '.join(LOOPBACK)}).")

    trava = threading.Lock()
    servidor = grpc.server(futures.ThreadPoolExecutor(max_workers=max_workers))
    vagas_pb2_grpc.add_VagasServiceServicer_to_server(VagasServicer(caminho, trava), servidor)
    ranking_pb2_grpc.add_RankingServiceServicer_to_server(RankingServicer(caminho, trava), servidor)
    planilha_pb2_grpc.add_PlanilhaServiceServicer_to_server(PlanilhaServicer(caminho, trava), servidor)
    porta = servidor.add_insecure_port(endereco)
    return servidor, porta


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="gupy_tracker.servidor_grpc", description="Servidor gRPC local do tracker.")
    p.add_argument("--dados", help="arquivo vagas.json (padrão: o mesmo da CLI)")
    p.add_argument("--endereco", default=ENDERECO_PADRAO, help="host:porta em loopback (padrão: %(default)s)")
    args = p.parse_args(argv)
    caminho = armazenamento.resolver_caminho(args.dados, escrita=True)
    servidor, porta = criar_servidor(caminho, args.endereco)
    servidor.start()
    print(f"servidor gRPC em {args.endereco.rsplit(':', 1)[0]}:{porta} (dados: {caminho})")
    try:
        servidor.wait_for_termination()
    except KeyboardInterrupt:
        servidor.stop(0)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
