"""Guardas da imagem Docker: dados pessoais ficam fora do contexto de build e do Git."""
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


class DockerTest(unittest.TestCase):
    def test_dockerignore_e_lista_de_permissao(self):
        linhas = [l.strip() for l in (RAIZ / ".dockerignore").read_text(encoding="utf-8").splitlines()
                  if l.strip() and not l.strip().startswith("#")]
        self.assertEqual(linhas[0], "*", "o .dockerignore deve negar tudo por padrão")

    def test_dados_pessoais_nao_entram_na_imagem(self):
        # Os padrões de permissão não podem liberar private/, data/ ou capturas de tela.
        permitidos = [l.strip() for l in (RAIZ / ".dockerignore").read_text(encoding="utf-8").splitlines()
                      if l.strip().startswith("!")]
        for pasta in ("private", "data", "planilhas", "linkedin", "interface", "vagas"):
            self.assertFalse(any(p.lstrip("!").startswith(pasta) for p in permitidos), pasta)

    def test_dados_entram_por_volume_no_compose(self):
        compose = (RAIZ / "docker-compose.yml").read_text(encoding="utf-8")
        self.assertIn("./private:/app/private", compose)
        self.assertIn("/app/planilhas", compose)
        self.assertIn("127.0.0.1:3000:3000", compose)

    def test_proto_e_gerado_no_build(self):
        dockerfile = (RAIZ / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn("python scripts/gerar_proto.py", dockerfile)


if __name__ == "__main__":
    unittest.main()
