/* Filtros sobre la base: reglas base fijas + filtros del panel + condiciones adicionales (las agrega el agente o el usuario). */
(function (g) {
  const IP = (g.IP = g.IP || {});
  const U = IP.util;
  const F = (IP.filtros = {});

  F.OPERADORES = {
    igual: "es igual a", distinto: "es distinto de", contiene: "contiene", no_contiene: "no contiene",
    mayor: "mayor o igual que", menor: "menor o igual que", vacio: "está vacío", no_vacio: "no está vacío",
  };

  F.estadoVacio = () => ({
    reglas: { no_aplica: true, comercial: true, viable: true },
    cat: {},            // clave de columna del panel → [valores]
    rangos: { area_terreno: { min: null, max: null }, area_construida: { min: null, max: null } },
    condiciones: [],    // [{ columna: nombre normalizado, operador, valor }]
    texto: "",
  });

  const conjunto = (lista) => new Set(lista.map((x) => U.normalizar(x)));

  // Arreglo booleano por valor del diccionario de una columna
  function porValor(base, i, fn) {
    return base.dict[i].map((v) => fn(v));
  }

  /* Cuántas filas pasa cada regla base (para mostrarlo al lado de cada casilla) */
  F.reglasBase = function (base) {
    const R = IP.PORTAFOLIO.reglas;
    const na = conjunto(R.no_aplica), ignorar = conjunto(R.sigma_ignorar_estados);
    const com = conjunto(R.estado_comercial), via = conjunto(R.viable);
    const n = base.n;
    const ok = { no_aplica: new Uint8Array(n).fill(1), comercial: new Uint8Array(n).fill(1), viable: new Uint8Array(n).fill(1) };

    // No aplica (con la excepción de SIGMA en estado terminado)
    const iNum = base.c.contrato_sigma, iEst = base.c.estado_sigma;
    const sigmaIgnorada = iEst >= 0 ? porValor(base, iEst, (v) => ignorar.has(U.normalizar(v))) : null;
    for (const i of base.noAplica) {
      const vale = porValor(base, i, (v) => na.has(U.normalizar(v)));
      const ix = base.idx[i];
      const esSigma = i === iNum || i === iEst;
      for (let r = 0; r < n; r++) {
        if (!ok.no_aplica[r] || vale[ix[r]]) continue;
        if (esSigma && sigmaIgnorada && sigmaIgnorada[base.idx[iEst][r]]) continue;
        ok.no_aplica[r] = 0;
      }
    }
    for (const [regla, col, permitidos] of [["comercial", "estado_comercial", com], ["viable", "viable", via]]) {
      const i = base.c[col];
      if (i < 0) continue; // si la columna no existe, la regla no filtra
      const vale = porValor(base, i, (v) => permitidos.has(U.normalizar(v)));
      const ix = base.idx[i];
      for (let r = 0; r < n; r++) ok[regla][r] = vale[ix[r]] ? 1 : 0;
    }
    const cuenta = (a) => a.reduce((s, x) => s + x, 0);
    return { ok, conteo: { no_aplica: cuenta(ok.no_aplica), comercial: cuenta(ok.comercial), viable: cuenta(ok.viable) } };
  };

  function numero(v) {
    const n = U.numeroColombiano(String(v ?? "").replace(/[$\s]/g, ""));
    return n == null ? NaN : n;
  }

  // Prueba de una condición sobre un valor de texto
  F.probar = function (op, v, valor) {
    const nv = U.normalizar(v);
    const opciones = String(valor ?? "").split("|").map((x) => U.normalizar(x)).filter((x) => x !== "");
    switch (op) {
      case "igual": return opciones.includes(nv);
      case "distinto": return !opciones.includes(nv);
      case "contiene": return opciones.some((o) => nv.includes(o));
      case "no_contiene": return !opciones.some((o) => nv.includes(o));
      case "mayor": { const a = numero(v), b = numero(valor); return Number.isFinite(a) && a >= b; }
      case "menor": { const a = numero(v), b = numero(valor); return Number.isFinite(a) && a <= b; }
      case "vacio": return U.vacio(v) || /^#N\/?[AD]$/i.test(String(v).trim());
      case "no_vacio": return !(U.vacio(v) || /^#N\/?[AD]$/i.test(String(v).trim()));
      default: return true;
    }
  };

  /* Filas que cumplen todo. 'reglas' es el resultado de F.reglasBase (se calcula una vez por base). */
  F.aplicar = function (base, estado, reglas, opciones = {}) {
    const n = base.n;
    const pruebas = []; // [ix, arreglo booleano por valor]
    const omitir = opciones.omitirPanel; // para contar opciones de un filtro sin aplicarse a sí mismo
    for (const [clave, valores] of Object.entries(estado.cat || {})) {
      if (clave === omitir || !valores || !valores.length) continue;
      const i = base.c[clave];
      if (i < 0) continue;
      const s = new Set(valores);
      pruebas.push([base.idx[i], base.dict[i].map((v) => s.has(v))]);
    }
    for (const c of estado.condiciones || []) {
      const i = base.pos.get(c.columna);
      if (i === undefined) continue;
      pruebas.push([base.idx[i], base.dict[i].map((v) => F.probar(c.operador, v, c.valor))]);
    }
    const texto = U.normalizar(estado.texto).split(" ").filter(Boolean);
    let buscar = null;
    if (texto.length) {
      const cols = ["fmi", "direccion", "descripcion", "vereda", "municipio", "nombre_bien", "cedula", "idactivo"].map((k) => base.c[k]).filter((i) => i >= 0);
      const norm = cols.map((i) => base.dict[i].map((v) => U.normalizar(v)));
      buscar = (r) => {
        const todo = cols.map((i, k) => norm[k][base.idx[i][r]]).join(" ");
        return texto.every((t) => todo.includes(t));
      };
    }
    const rg = estado.rangos || {};
    const rT = rg.area_terreno || {}, rC = rg.area_construida || {};
    const usar = (x) => x != null && x !== "" && Number.isFinite(Number(x));
    const R = estado.reglas || {};
    const out = [];
    for (let r = 0; r < n; r++) {
      if (R.no_aplica && !reglas.ok.no_aplica[r]) continue;
      if (R.comercial && !reglas.ok.comercial[r]) continue;
      if (R.viable && !reglas.ok.viable[r]) continue;
      let pasa = true;
      for (const [ix, vale] of pruebas) if (!vale[ix[r]]) { pasa = false; break; }
      if (!pasa) continue;
      if (usar(rT.min) && !(base.areaT[r] >= Number(rT.min))) continue;
      if (usar(rT.max) && !(base.areaT[r] <= Number(rT.max))) continue;
      if (usar(rC.min) && !(base.areaC[r] >= Number(rC.min))) continue;
      if (usar(rC.max) && !(base.areaC[r] <= Number(rC.max))) continue;
      if (buscar && !buscar(r)) continue;
      out.push(r);
    }
    return out;
  };

  /* Texto corto de los filtros activos (para el informe y la pantalla) */
  F.describir = function (base, estado) {
    const P = IP.PORTAFOLIO;
    const partes = [];
    const R = estado.reglas || {};
    if (R.no_aplica) partes.push("Trámites, contratos y comodatos en \"no aplica\"");
    if (R.comercial) partes.push("Estado comercial: " + P.reglas.estado_comercial.join(", "));
    if (R.viable) partes.push("Viable (comercial): " + P.reglas.viable.join(" o "));
    for (const [clave, titulo] of P.panel) {
      const v = (estado.cat || {})[clave];
      if (v && v.length) partes.push(`${titulo}: ${v.map((x) => x || "(vacío)").join(", ")}`);
    }
    const rg = estado.rangos || {};
    const rango = (t, r) => {
      if (!r) return;
      const a = r.min != null && r.min !== "", b = r.max != null && r.max !== "";
      if (a && b) partes.push(`${t} entre ${U.formatoNumero(r.min, 0)} y ${U.formatoNumero(r.max, 0)} m²`);
      else if (a) partes.push(`${t} desde ${U.formatoNumero(r.min, 0)} m²`);
      else if (b) partes.push(`${t} hasta ${U.formatoNumero(r.max, 0)} m²`);
    };
    rango("Área de terreno", rg.area_terreno);
    rango("Área construida", rg.area_construida);
    for (const c of estado.condiciones || []) {
      const i = base ? base.pos.get(c.columna) : undefined;
      const nombre = i !== undefined ? base.etiquetas[i] : c.columna;
      partes.push(`${nombre} ${F.OPERADORES[c.operador] || c.operador}${["vacio", "no_vacio"].includes(c.operador) ? "" : " " + c.valor}`);
    }
    if (U.limpiar(estado.texto)) partes.push(`Texto: "${estado.texto}"`);
    return partes;
  };
})(typeof window !== "undefined" ? window : globalThis);
