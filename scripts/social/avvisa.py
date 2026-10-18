"""Scrive una nota sul post in dashboard (es. generazione non riuscita): la vede Federico nella scheda del contenuto.
Uso: python3 avvisa.py <id post> "testo" """
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dashboard import chiama  # noqa: E402

print(chiama(f"/api/generatore/post/{sys.argv[1]}", "POST", {"nota_routine": sys.argv[2][:500]}))
