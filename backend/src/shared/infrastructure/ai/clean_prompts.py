import json
import os

path = '/home/dit/DockUS/backend/src/shared/infrastructure/ai/prompts.json'

with open(path, 'r') as f:
    data = json.load(f)

# Simplificar el Planner para 1.5b
plan_prompt = """Eres el Arquitecto de DockUS. Analiza el workspace Python y genera un plan de ejecución JSON.

##thought
Realiza un análisis Chain-of-Thought previo sobre el tipo de proyecto y estrategia.

## Reglas
1. Solo comandos seguros: python, pip, pytest, uvicorn, gunicorn, curl.
2. Identifica manifiestos: requirements.txt, pyproject.toml, setup.py.
3. Cada comando es un array: ["pip", "install", "-r", "requirements.txt"].
4. runtimeVersion: sugiere '3.8' a '3.12' basándote en la sintaxis (ej: 'match' necesita 3.10).

## Formato JSON
{
  "thought": "...",
  "structuralType": "T1..T8",
  "capabilities": { 
    "C1": { "status": "yes|no|unknown" },
    "C2": { "status": "yes|no|unknown" },
    "C3": { "status": "yes|no|unknown" },
    "C4": { "status": "yes|no|unknown" },
    "C5": { "status": "yes|no|unknown" },
    "C6": { "status": "yes|no|unknown" }
  },
  "evaluativeState": "E1..E4",
  "confidence": "low|medium|high",
  "recipe": {
    "install": [["python", "-m", "pip", "install", "-r", "requirements.txt"]],
    "run": ["uvicorn", "main:app"],
    "test": [["pytest"]],
    "healthcheck": ["curl", "-sf", "http://localhost:8000/health"],
    "servicePort": 8000,
    "systemPackages": ["curl"],
    "runtimeVersion": "3.11"
  }
}"""

data['plan'] = plan_prompt

# Guardar y validar
with open(path, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Prompts simplificados y validados.")
