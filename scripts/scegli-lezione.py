#!/usr/bin/env python3
"""Stampa l'id della prossima lezione da renderizzare (stato "dati_pronti", ordine più basso), oppure niente.
Con --resto stampa quante lezioni sono ancora in lavorazione (da_montare, in_preparazione, da_verificare,
dati_pronti, in_render): se è 0 la catena di render si ferma.
Uso: scegli-lezione.py <cartella_video-guide-media> [--resto]"""
import json, os, sys

M = sys.argv[1]
cat = sorted(json.load(open(f"{M}/catalogo.json"))["lezioni"], key=lambda l: l["ordine"])


def stato(i):
    p = f"{M}/lezioni/{i}/stato"
    return open(p).read().strip() if os.path.exists(p) else ""


if "--resto" in sys.argv:
    attivi = {"da_montare", "in_preparazione", "da_verificare", "dati_pronti", "in_render"}
    print(sum(1 for l in cat if stato(l["id"]) in attivi))
else:
    pronte = [l["id"] for l in cat if stato(l["id"]) == "dati_pronti"]
    print(pronte[0] if pronte else "")
