#!/usr/bin/env python3
"""Runs the PYTHON reference Q&A (workspace/opsigne, read-only) on a JSON list of questions.
usage: python3 -I -B tools/py_ask.py <opsigne-project-dir> <questions.json>   -> JSON list on stdout.
Builds a throwaway store in a temp dir, approves every step (like opsigne/redteam.py), never writes to the reference project."""
import json, os, sys, tempfile
ref, qfile = sys.argv[1], sys.argv[2]
sys.dont_write_bytecode = True
sys.path.insert(0, ref)
from opsigne.procedure import Store
from opsigne.qa import QA
doc = json.load(open(os.path.join(ref, "data", "mop-ups-017.json"), encoding="utf-8"))
qs = json.load(open(qfile, encoding="utf-8"))
out = []
with tempfile.TemporaryDirectory() as d:
    store = Store(d); store.import_procedure(doc)
    for s in doc["steps"]:
        store.approve(doc["id"], doc["version"], s["n"], "Parity Reviewer")
    qa = QA(store)
    for q in qs:
        r = qa.ask(q)
        out.append({"status": r["status"], "reason": r["reason"], "steps": [c["step"] for c in r["citations"]],
                    "score": r["confidence"]["score"], "coverage": r["confidence"]["coverage"], "answer": r["answer"],
                    "flagged": r["flagged_injection"]})
json.dump(out, sys.stdout, ensure_ascii=False)
