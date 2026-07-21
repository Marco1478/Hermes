# Hermes Custom UI — istruzioni di progetto

Interfaccia React/Vite custom per Hermes (l'agente AI di Marco), pubblicata su
GitHub: `github.com/Marco1478/Hermes`. Il codice reale gira su un box Linux
(Proxmox → VM `docker-smarthome`, 192.168.2.11) dentro un unico container
Docker chiamato `hermes` (gateway :8642 + dashboard :9119 + webui, stesso
binario `nousresearch/hermes-agent`, processi diversi supervisionati da s6).

## Regola operativa: pull prima di iniziare

**Hermes stesso ha accesso a questo repo** (lavora su una copia in
`/opt/data/repos/Hermes` dentro il suo container) e può committare/pushare
autonomamente — incluso un **cron job ricorrente** ("Hermes Custom UI —
Morning/Evening Brief", 2 volte al giorno) che analizza i commit recenti e
prepara file di istruzioni in:

```
docs/claude/YYYY-MM-DD_HHMM_CLAUDE_INSTRUCTIONS_###.md
```

**Prima di qualsiasi lavoro su questo repo**: fare `git fetch --all` e
controllare branch/commit nuovi (`git log --oneline -10`, `git branch -ra`)
prima di assumere che lo stato locale sia aggiornato. Se esiste un file
istruzioni nuovo in `docs/claude/`, leggerlo e seguirlo. Hermes a volte lavora
su branch dedicati (es. `docs/hermes-ui-bridge-plan`) invece che direttamente
su `main` — controllare anche quelli.

## Accesso SSH al box (bridge)

C'è un bridge SSH configurato per operazioni sul box quando serve (es.
`docker exec hermes hermes config ...`, verificare/riavviare processi):
chiave in `C:\Users\Marco\.hermes-bridge\id_hermes_bridge`, connessione
`root@192.168.2.11`. Usare con cautela — è l'host reale di Hermes, non un
ambiente di test.

## Cose imparate nel modo difficile (per non ripeterle)

- **Il vero codice sorgente della dashboard** è dentro il container, sotto
  `/opt/hermes/hermes_cli/` e `/opt/hermes/plugins/dashboard_auth/` — NON il
  clone locale di `hermes-webui` (quello è un fork di terze parti,
  `nesquena/hermes-webui`, non correlato al software reale che gira sul box).
  Se serve capire un comportamento della dashboard, leggere il codice vero via
  `docker exec hermes cat /opt/hermes/...`, non indovinare dal fork.
- **Endpoint corretto per cambiare modello**: `POST /api/model/set` con body
  `{scope:"main", model, provider}` — NON `/api/default-model` (404 su questa
  build). Il catalogo modelli (`GET /api/model/options`) è organizzato per
  provider (nous/moa/anthropic/openai-codex/copilot); passare `model` senza
  `provider` esplicito atterra silenziosamente sul provider sbagliato.
  Provider reale di Marco: **openai-codex** (non "nous").
- **Password dashboard**: chiave env corretta `HERMES_DASHBOARD_BASIC_AUTH_PASSWORD`
  (non `HERMES_WEBUI_PASSWORD`, quella è del fork sbagliato). Un vecchio
  `dashboard.basic_auth.password_hash` in config.yaml ha SEMPRE priorità su un
  nuovo `password` in chiaro — va rimosso con
  `hermes config unset dashboard.basic_auth.password_hash`. Il processo
  dashboard legge la config solo all'avvio: dopo ogni modifica serve
  `hermes dashboard --stop` poi `hermes dashboard --host 0.0.0.0` (mantenere
  `--host 0.0.0.0` o si rilega solo su loopback e diventa irraggiungibile).
- **Il gateway (:8642) non ha capacità di scrittura config**: ignora
  silenziosamente un campo `model` extra su `/v1/runs`, e ogni endpoint di
  config testato direttamente lì risponde 404. Il cambio modello passa
  SOLO dalla dashboard (:9119).
