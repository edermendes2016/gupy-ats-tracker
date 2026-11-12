"""Servidor gRPC local do tracker (extra opcional).

Instalação e execução (a partir da raiz do repositório):
    python -m pip install ".[grpc]" grpcio-tools
    python scripts/gerar_proto.py
    python -m gupy_tracker.servidor_grpc

Só aceita conexões de loopback (127.0.0.1 ou localhost). A CLI não depende deste módulo.
"""
from __future__ import annotations

import argparse
import threading
from concurrent import futures
from datetime import date
from pathlib import Path

from . import analise, armazenamento, casos_de_uso, leitor_texto, planilha, relatorio

LOOPBACK = ("127.0.0.1", "localhost")
ENDERECO_PADRAO = "127.0.0.1:50051"
MENSAGEM_DEPENDENCIA = (
    "servidor gRPC indisponível: instale com 'pip install .[grpc]' "
    "e gere o código com 'python scripts/gerar_proto.py'"
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
    from .conversao_proto import requisicao_para_vaga, status_do_proto, vaga_para_proto
except ImportError:  # sem o código gerado: _grpc() avisa antes de qualquer chamada
    def requisicao_para_vaga(*_a, **_k):
        _grpc()

    def vaga_para_proto(*_a, **_k):
        _grpc()

    def status_do_proto(*_a, **_k):
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
            nome = status_do_proto(req.status)
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
        grpc = _grpc()
        novo = status_do_proto(req.novo_status)
        with self._trava:
            vagas = armazenamento.carregar(self._caminho)
            try:
                vaga = casos_de_uso.atualizar_status(vagas, req.id, novo, req.data or date.today().isoformat())
            except casos_de_uso.VagaNaoEncontrada as e:
                context.abort(grpc.StatusCode.NOT_FOUND, str(e))
            armazenamento.salvar(self._caminho, vagas)
        return vaga_para_proto(vaga, detalhe=True)


    def ExcluirVaga(self, req, context):
        from .v1 import vagas_pb2 as pb

        grpc = _grpc()
        with self._trava:
            vagas = armazenamento.carregar(self._caminho)
            try:
                casos_de_uso.excluir_vaga(vagas, req.id, anonimo=req.anonimo)
            except casos_de_uso.VagaNaoEncontrada as e:
                context.abort(grpc.StatusCode.NOT_FOUND, str(e))
            armazenamento.salvar(self._caminho, vagas)
        return pb.ExcluirVagaResponse()


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
            ofertas=m["ofertas"],
            score_medio=m["score_medio"],
            por_status=[rpb.ContagemStatus(status=s, vagas=n) for s, n in sorted(m["por_status"].items())],
            faixas=[rpb.FaixaScore(faixa=f, enviadas=d["enviadas"], entrevistas=d["entrevistas"])
                    for f, d in m["por_faixa"].items()],
            evolucao=[rpb.PontoEvolucao(mes=e["mes"], analisadas=e["analisadas"], enviadas=e["enviadas"],
                                        entrevistas=e["entrevistas"]) for e in m["evolucao"]],
            pontos_fortes=[rpb.Termo(nome=t["nome"], vagas=t["vagas"]) for t in m["pontos_fortes"]],
            lacunas=[rpb.Termo(nome=t["nome"], vagas=t["vagas"]) for t in m["lacunas"]],
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

    def GerarModelo(self, req, context):
        from .v1 import planilha_pb2 as ppb

        grpc = _grpc()
        try:
            planilha.gerar_modelo(Path(req.caminho))
        except FileExistsError as e:
            context.abort(grpc.StatusCode.ALREADY_EXISTS, str(e))
        except (OSError, ValueError) as e:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, f"não foi possível criar a planilha: {e}")
        return ppb.GerarModeloResponse()


class AnaliseServicer(_Base):
    """Implementa gupy_tracker.v1.AnaliseService. Não grava nada: só calcula."""

    def Analisar(self, req, context):
        from .v1 import analise_pb2 as apb

        grpc = _grpc()
        try:
            texto = leitor_texto.ler_conteudo(req.nome_arquivo, req.curriculo)
            r = analise.analisar(
                curriculo=texto,
                descricao=req.descricao,
                responsabilidades=req.responsabilidades,
                requisitos=req.requisitos,
                modelo=req.modelo or None,
            )
        except ValueError as e:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(e))
        c = r.criterios
        return apb.AnalisarResponse(
            criterios=apb.CriteriosAnalise(
                obrigatorios=c["obrigatorios"], desejaveis=c["desejaveis"], experiencia=c["experiencia"],
                dominio=c["dominio"], logistica=c["logistica"],
            ),
            match_score=r.match_score,
            classificacao=r.classificacao,
            palavras_chave=r.palavras_chave,
            lacunas=r.lacunas,
            avisos=r.avisos,
            sugestoes=r.sugestoes,
            anos_curriculo=r.anos_curriculo,
            anos_pedidos=r.anos_pedidos or 0.0,
        )


def criar_servidor(caminho: Path, endereco: str = ENDERECO_PADRAO, max_workers: int = 4):
    """Monta o servidor sem iniciá-lo. Devolve (servidor, porta efetiva)."""
    grpc = _grpc()
    from .v1 import analise_pb2_grpc, planilha_pb2_grpc, ranking_pb2_grpc, vagas_pb2_grpc

    host = endereco.rsplit(":", 1)[0]
    if host not in LOOPBACK:
        raise SystemExit(f"endereço recusado: '{host}'. O servidor aceita só loopback ({', '.join(LOOPBACK)}).")

    trava = threading.Lock()
    servidor = grpc.server(futures.ThreadPoolExecutor(max_workers=max_workers))
    vagas_pb2_grpc.add_VagasServiceServicer_to_server(VagasServicer(caminho, trava), servidor)
    ranking_pb2_grpc.add_RankingServiceServicer_to_server(RankingServicer(caminho, trava), servidor)
    planilha_pb2_grpc.add_PlanilhaServiceServicer_to_server(PlanilhaServicer(caminho, trava), servidor)
    analise_pb2_grpc.add_AnaliseServiceServicer_to_server(AnaliseServicer(caminho, trava), servidor)
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
