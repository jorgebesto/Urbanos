/* Agente de IA (Groq): convierte la solicitud escrita en filtros.
   Al agente solo se le envían los NOMBRES de las columnas y los valores posibles de las columnas de categorías.
   Ninguna fila de la base sale del navegador. */
(function (g) {
  const IP = (g.IP = g.IP || {});
  const U = IP.util;
  const A = (IP.agente = {});
  const CLAVE_KEY = "portafolio_groq_key", CLAVE_MODELO = "portafolio_groq_modelo";

  const leer = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const escribir = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } };
  A.apiKey = () => leer(CLAVE_KEY);
  A.guardarApiKey = (v) => escribir(CLAVE_KEY, String(v || "").trim());
  A.modelo = () => leer(CLAVE_MODELO) || IP.PORTAFOLIO.groq.modelo;
  A.guardarModelo = (v) => escribir(CLAVE_MODELO, v);

  /* Catálogo de columnas para el agente (se calcula una vez por base) */
  let cache = null;
  A.catalogo = function (base) {
    if (cache && cache.base === base) return cache.texto;
    const P = IP.PORTAFOLIO;
    const panel = new Map(P.panel.map(([k, t]) => [base.c[k], [k, t]]));
    const lineas = [];
    base.nombres.forEach((nombre, i) => {
      if (/^COLUMNA/.test(nombre)) return;
      const vals = base.conteos(i).map((x) => x[0]).filter((v) => v !== "");
      const enPanel = panel.get(i);
      let desc;
      if (enPanel && enPanel[0] === "municipio") desc = `(${vals.length} municipios; escriba el nombre del municipio)`;
      else if (vals.length <= 40) desc = "valores: " + vals.map((v) => JSON.stringify(v)).join(", ");
      else {
        const nums = vals.slice(0, 200).filter((v) => U.numeroColombiano(v) != null).length;
        desc = nums > 150 ? "(numérica)" : `(texto libre, ${vals.length} valores distintos)`;
      }
      lineas.push(`- ${JSON.stringify(nombre)}${enPanel ? ` [filtro del panel "${enPanel[0]}"]` : ""}: ${desc}`);
    });
    cache = { base, texto: lineas.join("\n") };
    return cache.texto;
  };

  function sistema(base) {
    const P = IP.PORTAFOLIO;
    return `Eres un asistente que traduce solicitudes de inmuebles de la Sociedad de Activos Especiales (SAE, Colombia) a filtros sobre una base de datos.
La base ya aplica estas reglas base (no las repitas): trámites/contratos/comodatos en "no aplica"; ESTADO COMERCIAL en ${P.reglas.estado_comercial.join(", ")}; VIABLE SI/NO (COMERCIAL) en NO o 0.

Columnas de la base (nombre exacto → valores posibles):
${A.catalogo(base)}

Filtros del panel disponibles (clave → columna): ${P.panel.map(([k, t]) => `${k} (${t})`).join("; ")}.

Responde SOLO con un objeto JSON con esta forma:
{
  "panel": { "<clave del panel>": ["valor exacto de la lista", ...] },
  "rangos": { "area_terreno": {"min": número o null, "max": número o null}, "area_construida": {"min": número o null, "max": número o null} },
  "condiciones": [ { "columna": "<nombre exacto de la columna>", "operador": "igual|distinto|contiene|no_contiene|mayor|menor|vacio|no_vacio", "valor": "texto o número" } ],
  "texto": "palabras para buscar en dirección/descripción/vereda, o vacío",
  "explicacion": "frase corta en español de lo que filtraste",
  "no_entendido": "lo que no pudiste convertir en filtro, o vacío"
}
Reglas:
- Las áreas van SIEMPRE en metros cuadrados (1 hectárea = 10000 m²).
- Usa "panel" para las columnas que tienen clave de panel; usa "condiciones" para cualquier otra columna.
- En "panel" usa los valores tal como aparecen en la lista. Para municipio escribe el nombre del municipio en mayúsculas sin tildes.
- "rural" o "urbano" se filtran con el panel "subtipo". Un lote, casa, finca, apartamento, etc. se filtra con "clasificacion" (puedes poner varios valores parecidos).
- Si se piden varios valores de la misma columna con "o", pon todos en la lista. Usa "|" para separar varios valores en "valor" de una condición igual/distinto/contiene.
- No inventes columnas ni valores. Si algo no corresponde a ninguna columna, explícalo en "no_entendido".
- Deja fuera los filtros que la solicitud no menciona.`;
  }

  /* Llamada a Groq que devuelve un objeto JSON */
  A.chat = async function (sistemaTxt, usuarioTxt, opciones = {}) {
    const key = A.apiKey();
    if (!key) throw new Error("Falta la API key de Groq. Escríbala en el botón de IA de arriba.");
    const cuerpo = {
      model: A.modelo(),
      temperature: opciones.temperatura ?? 0,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: sistemaTxt }, { role: "user", content: usuarioTxt }],
    };
    let r;
    try {
      r = await fetch(IP.PORTAFOLIO.groq.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify(cuerpo),
      });
    } catch (e) { throw new Error("No se pudo conectar con Groq (" + e.message + ")."); }
    const js = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = (js.error && js.error.message) || "HTTP " + r.status;
      if (r.status === 401) throw new Error("Groq rechazó la API key (401). Revísela en el botón de IA de arriba.");
      if (r.status === 429) throw new Error("Groq dice que se alcanzó el límite de uso (429). Espere un minuto y vuelva a intentar. " + m);
      if (/model/i.test(m) && /(decommission|not exist|not found)/i.test(m)) throw new Error("Groq ya no ofrece el modelo elegido. Elija otro en el botón de IA de arriba. (" + m + ")");
      throw new Error("Groq respondió con error: " + m);
    }
    const txt = (((js.choices || [])[0] || {}).message || {}).content || "";
    try { return JSON.parse(txt); }
    catch (e) {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error("La respuesta de Groq no es JSON válido.");
    }
  };

  A.preguntar = (base, solicitud) => A.chat(sistema(base), solicitud);

  /* Busca en el diccionario de una columna el valor que corresponde a lo que escribió el agente */
  function emparejar(dict, valor, restringir) {
    const nv = U.normalizar(valor);
    if (!nv) return [];
    const cand = restringir ? dict.filter((v) => restringir.has(v)) : dict;
    const exactos = cand.filter((v) => U.normalizar(v) === nv);
    if (exactos.length) return exactos;
    const contiene = cand.filter((v) => { const n = U.normalizar(v); return n && (n.includes(nv) || (nv.length > 3 && nv.includes(n))); });
    if (contiene.length && contiene.length <= 15) return contiene;
    let mejor = null, sim = 0;
    for (const v of cand) { const s = U.similitud(v, valor); if (s > sim) { sim = s; mejor = v; } }
    return sim >= 0.84 ? [mejor] : [];
  }

  /* Convierte la respuesta del agente en un estado de filtros (conserva las reglas base del estado actual) */
  A.aEstado = function (base, resp, estadoActual) {
    const P = IP.PORTAFOLIO;
    const est = IP.filtros.estadoVacio();
    est.reglas = { ...(estadoActual || {}).reglas || est.reglas };
    const avisos = [];
    const panel = resp.panel || resp.filtros || {};
    const claves = new Map(P.panel.map(([k, t]) => [k, k]));
    // también aceptar el nombre de la columna como clave
    for (const [k] of P.panel) if (base.c[k] >= 0) claves.set(U.normalizar(base.nombres[base.c[k]]).toLowerCase(), k);
    const orden = Object.keys(panel).sort((a, b) => (a === "departamento" ? -1 : b === "departamento" ? 1 : 0));
    for (const k0 of orden) {
      const k = claves.get(k0) || claves.get(U.normalizar(k0).toLowerCase()) || claves.get(String(k0).toLowerCase());
      const lista = [].concat(panel[k0] || []).filter((x) => U.limpiar(x));
      if (!lista.length) continue;
      if (!k || base.c[k] < 0) { avisos.push(`No reconocí el filtro "${k0}"`); continue; }
      const dict = base.dict[base.c[k]];
      let restringir = null;
      if (k === "municipio" && (est.cat.departamento || []).length && base.c.departamento >= 0) {
        // solo municipios de los departamentos elegidos
        const dep = new Set(est.cat.departamento), id = base.idx[base.c.departamento], im = base.idx[base.c.municipio];
        restringir = new Set();
        for (let r = 0; r < base.n; r++) if (dep.has(base.dict[base.c.departamento][id[r]])) restringir.add(dict[im[r]]);
      }
      const elegidos = new Set();
      for (const v of lista) {
        const m = emparejar(dict, v, restringir);
        if (!m.length) avisos.push(`"${v}" no aparece en ${P.panel.find((p) => p[0] === k)[1]}`);
        m.forEach((x) => elegidos.add(x));
      }
      if (elegidos.size) est.cat[k] = [...elegidos];
    }
    const rg = resp.rangos || {};
    for (const k of ["area_terreno", "area_construida"]) {
      const r = rg[k] || {};
      const n = (x) => (x == null || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));
      est.rangos[k] = { min: n(r.min), max: n(r.max) };
    }
    for (const c of resp.condiciones || []) {
      if (!c || !c.columna) continue;
      const nc = U.normalizar(c.columna);
      let col = base.pos.has(nc) ? nc : null;
      if (!col) {
        let mejor = null, sim = 0;
        for (const n of base.nombres) { const s = U.similitud(n, nc); if (s > sim) { sim = s; mejor = n; } }
        if (sim >= 0.85) col = mejor;
      }
      const op = IP.filtros.OPERADORES[c.operador] ? c.operador : "igual";
      if (!col) { avisos.push(`No existe la columna "${c.columna}"`); continue; }
      est.condiciones.push({ columna: col, operador: op, valor: c.valor == null ? "" : String(c.valor) });
    }
    est.texto = U.limpiar(resp.texto);
    if (U.limpiar(resp.no_entendido)) avisos.push("El agente no pudo convertir: " + resp.no_entendido);
    return { estado: est, explicacion: U.limpiar(resp.explicacion), avisos };
  };
})(typeof window !== "undefined" ? window : globalThis);
