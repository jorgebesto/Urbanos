/* Página del portafolio: base cifrada → filtros (reglas base + panel + agente IA) → folios elegidos →
   VUR, polígono y fotos de cada folio → presentación (PowerPoint) e informe (Word). */
(function () {
  const IP = window.IP;
  const U = IP.util, B = IP.base, F = IP.filtros, P = IP.PORTAFOLIO;
  const $ = (id) => document.getElementById(id);
  const esc = U.esc;

  const E = {
    base: null, reglas: null, bytesCifrados: null, datosSinCifrar: null,
    estado: F.estadoVacio(), filas: [], pagina: 0, porPagina: 50, sel: new Set(), abiertas: new Set(),
    port: { solicitante: "", tipo: "", logo: "", solicitud: "", filtros: [], items: [] },
  };

  /* ---------------- Utilidades de pantalla ---------------- */
  function aviso(texto, tipo) {
    const a = $("aviso");
    a.hidden = !texto;
    a.textContent = texto || "";
    a.className = "aviso" + (tipo ? " " + tipo : "");
  }
  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  const nombreArchivo = (s) => U.sinTildes(s || "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 60);
  const guardarLocal = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { /* nada */ } };
  const leerLocal = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  function rebote(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  function pestana(nombre) {
    document.querySelectorAll(".pestanas button").forEach((b) => b.classList.toggle("activa", b.dataset.pestana === nombre));
    $("vistaFiltros").hidden = nombre !== "filtros";
    $("vistaPortafolio").hidden = nombre !== "portafolio";
    window.scrollTo(0, 0);
  }
  document.querySelectorAll(".pestanas button").forEach((b) => b.addEventListener("click", () => pestana(b.dataset.pestana)));

  /* ---------------- Formatos ---------------- */
  function fmtArea(r, cual) {
    const n = cual === "t" ? E.base.areaT[r] : E.base.areaC[r];
    if (!Number.isFinite(n)) return U.limpiar(E.base.valor(r, cual === "t" ? "area_terreno" : "area_construida"));
    return `${U.formatoNumero(n, Number.isInteger(n) ? 0 : 2)} m²`;
  }
  function fmtPesos(v) {
    const n = U.numeroColombiano(String(v ?? "").replace(/[$\s]/g, ""));
    if (n == null) return U.limpiar(v);
    return "$ " + Math.round(n).toLocaleString("es-CO");
  }

  /* ================= BASE ================= */
  function pintarEstadoBase(texto, clase) {
    const e = $("estadoBase");
    e.className = "estado" + (clase ? " " + clase : "");
    e.innerHTML = texto;
  }

  async function buscarBasePublicada() {
    try {
      const r = await fetch(P.base_url, { cache: "no-cache" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (!B.esCifrado(bytes)) throw new Error("formato");
      E.bytesCifrados = bytes;
      pintarEstadoBase(`Base cifrada encontrada en el repositorio (${(bytes.length / 1048576).toFixed(1)} MB). Escriba la contraseña.`);
      $("formClave").hidden = false;
      const recordada = leerLocal("portafolio_clave");
      if (recordada) { $("clave").value = recordada; $("recordarClave").checked = true; abrirCifrada(); }
      else $("clave").focus();
    } catch (e) {
      pintarEstadoBase("No hay base publicada en el repositorio (<code>" + esc(P.base_url) + "</code>). Abra un archivo en <b>Actualizar la base</b>.", "mal");
      $("detActualizar").open = true;
    }
  }

  async function abrirCifrada() {
    const clave = $("clave").value;
    if (!clave) return;
    pintarEstadoBase("Descifrando la base…");
    await new Promise((r) => setTimeout(r, 20));
    try {
      const datos = await B.descifrar(E.bytesCifrados, clave);
      guardarLocal("portafolio_clave", $("recordarClave").checked ? clave : "");
      $("formClave").hidden = true;
      usarBase(datos, "cifrada");
    } catch (e) {
      pintarEstadoBase(esc(e.message), "mal");
      guardarLocal("portafolio_clave", "");
    }
  }
  $("formClave").addEventListener("submit", (ev) => { ev.preventDefault(); abrirCifrada(); });

  $("archivoBase").addEventListener("change", async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const est = $("estadoArchivo");
    est.textContent = "Leyendo " + f.name + "…";
    $("cifrarCaja").hidden = true;
    await new Promise((r) => setTimeout(r, 20));
    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      if (B.esCifrado(bytes) || /\.enc$/i.test(f.name)) {
        E.bytesCifrados = bytes;
        $("formClave").hidden = false;
        pintarEstadoBase("Archivo cifrado " + esc(f.name) + ". Escriba la contraseña.");
        est.textContent = "";
        $("clave").focus();
        return;
      }
      const t0 = performance.now();
      const datos = /\.xlsx$/i.test(f.name) ? await B.desdeXlsx(buf, f.name) : B.desdeCsv(bytes, f.name);
      est.textContent = `${U.formatoNumero(datos.n, 0)} registros leídos en ${((performance.now() - t0) / 1000).toFixed(1)} s. Ya puede filtrar; para publicarla, cífrela abajo.`;
      E.datosSinCifrar = datos;
      $("cifrarCaja").hidden = false;
      usarBase(datos, "archivo");
    } catch (e) {
      est.textContent = "No se pudo leer: " + e.message;
    }
  });

  $("cifrarBase").addEventListener("click", async () => {
    const a = $("claveNueva").value, b = $("claveNueva2").value;
    const est = $("estadoArchivo");
    if (!E.datosSinCifrar) { est.textContent = "Primero elija el archivo de la base."; return; }
    if (a.length < 8) { est.textContent = "Use una contraseña de al menos 8 caracteres."; return; }
    if (a !== b) { est.textContent = "Las contraseñas no coinciden."; return; }
    est.textContent = "Cifrando…";
    await new Promise((r) => setTimeout(r, 20));
    const blob = await B.cifrar(E.datosSinCifrar, a);
    descargar(blob, "base.enc");
    est.innerHTML = `Listo: <b>base.enc</b> (${(blob.size / 1048576).toFixed(1)} MB). Súbalo a la carpeta <code>base/</code> del repositorio, reemplazando el anterior.`;
  });

  function usarBase(datos, origen) {
    E.base = new B.Base(datos);
    E.reglas = F.reglasBase(E.base);
    const b = E.base;
    const avisos = [];
    if (b.c.fmi < 0) avisos.push("no encontré la columna FOLIO DE MATRÍCULA");
    if (b.faltan.length) avisos.push("faltan columnas de la regla “no aplica”: " + b.faltan.join(", "));
    if (b.c.estado_comercial < 0) avisos.push("falta ESTADO COMERCIAL (esa regla no filtra)");
    if (b.c.viable < 0) avisos.push("falta VIABLE SI/NO (COMERCIAL) (esa regla no filtra)");
    if (b.cedulasDanadas) avisos.push(`${U.formatoNumero(b.cedulasDanadas, 0)} cédulas catastrales vienen dañadas por Excel (ej. 5.00E+28); para esos folios el polígono se busca con el VUR`);
    pintarEstadoBase(`<b>${esc(b.archivo || "Base")}</b> · ${U.formatoNumero(b.n, 0)} registros · generada ${esc(b.generado || "")}` +
      (origen === "archivo" ? " · <i>solo en esta sesión</i>" : "") +
      (avisos.length ? `<div class="avisos-base">⚠ ${avisos.map(esc).join("<br>⚠ ")}</div>` : ""), avisos.length ? "rev" : "ok");
    document.querySelectorAll("[data-cuenta]").forEach((s) => { s.textContent = `(${U.formatoNumero(E.reglas.conteo[s.dataset.cuenta], 0)})`; });
    construirPanel();
    construirCondiciones();
    E.sel.clear();
    recalcular();
  }

  /* ================= FILTROS ================= */
  function leerControles() {
    const est = E.estado;
    document.querySelectorAll("[data-regla]").forEach((c) => { est.reglas[c.dataset.regla] = c.checked; });
    est.texto = $("texto").value;
    const n = (id) => ($(id).value === "" ? null : Number($(id).value));
    est.rangos = { area_terreno: { min: n("atMin"), max: n("atMax") }, area_construida: { min: n("acMin"), max: n("acMax") } };
  }
  function ponerControles() {
    const est = E.estado;
    document.querySelectorAll("[data-regla]").forEach((c) => { c.checked = est.reglas[c.dataset.regla] !== false; });
    $("texto").value = est.texto || "";
    const v = (x) => (x == null ? "" : x);
    $("atMin").value = v(est.rangos.area_terreno.min); $("atMax").value = v(est.rangos.area_terreno.max);
    $("acMin").value = v(est.rangos.area_construida.min); $("acMax").value = v(est.rangos.area_construida.max);
  }

  function construirPanel() {
    const cont = $("filtrosPanel");
    cont.innerHTML = "";
    for (const [clave, titulo] of P.panel) {
      if (E.base.c[clave] < 0) continue;
      const d = document.createElement("details");
      d.className = "multi";
      d.dataset.clave = clave;
      d.innerHTML = `<summary><span>${esc(titulo)}</span><span class="elegidos"></span></summary>
        <input type="search" class="buscar-op" placeholder="Buscar…">
        <div class="opciones"></div>
        <button type="button" class="enlace limpiar-op">Quitar selección</button>`;
      d.addEventListener("toggle", () => { if (d.open) pintarOpciones(d); });
      d.querySelector(".buscar-op").addEventListener("input", () => pintarOpciones(d));
      d.querySelector(".limpiar-op").addEventListener("click", () => { delete E.estado.cat[clave]; recalcular(); });
      d.querySelector(".opciones").addEventListener("change", (ev) => {
        const v = ev.target.value;
        const lista = new Set(E.estado.cat[clave] || []);
        ev.target.checked ? lista.add(v) : lista.delete(v);
        if (lista.size) E.estado.cat[clave] = [...lista]; else delete E.estado.cat[clave];
        recalcularRebote();
      });
      cont.appendChild(d);
    }
    pintarElegidos();
  }

  function pintarOpciones(d) {
    const clave = d.dataset.clave;
    const filas = F.aplicar(E.base, E.estado, E.reglas, { omitirPanel: clave });
    const elegidos = new Set(E.estado.cat[clave] || []);
    let cont = E.base.conteos(E.base.c[clave], filas);
    for (const v of elegidos) if (!cont.some((x) => x[0] === v)) cont.push([v, 0]);
    if (clave === "departamento" || clave === "municipio") cont.sort((a, b) => a[0].localeCompare(b[0], "es"));
    const q = U.normalizar(d.querySelector(".buscar-op").value);
    if (q) cont = cont.filter((x) => U.normalizar(x[0]).includes(q));
    const max = 400;
    d.querySelector(".opciones").innerHTML = cont.slice(0, max).map(([v, n]) =>
      `<label class="op"><input type="checkbox" value="${esc(v)}"${elegidos.has(v) ? " checked" : ""}> <span>${esc(v || "(vacío)")}</span> <span class="n">${U.formatoNumero(n, 0)}</span></label>`).join("") +
      (cont.length > max ? `<p class="nota">… ${cont.length - max} más; use el buscador.</p>` : "") +
      (!cont.length ? `<p class="nota">Sin opciones con los filtros actuales.</p>` : "");
  }
  function pintarElegidos() {
    document.querySelectorAll("details.multi").forEach((d) => {
      const v = E.estado.cat[d.dataset.clave] || [];
      d.querySelector(".elegidos").textContent = v.length ? (v.length <= 2 ? v.map((x) => x || "(vacío)").join(", ") : `${v.length} elegidos`) : "";
      d.classList.toggle("con-filtro", v.length > 0);
      if (d.open) pintarOpciones(d);
    });
  }

  function construirCondiciones() {
    $("condCol").innerHTML = E.base.nombres.map((n, i) => `<option value="${esc(n)}">${esc(E.base.etiquetas[i])}</option>`).join("");
    $("condOp").innerHTML = Object.entries(F.OPERADORES).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("");
  }
  function pintarCondiciones() {
    $("condiciones").innerHTML = E.estado.condiciones.map((c, i) => {
      const k = E.base ? E.base.pos.get(c.columna) : undefined;
      const nombre = k !== undefined ? E.base.etiquetas[k] : c.columna;
      return `<li><span><b>${esc(nombre)}</b> ${esc(F.OPERADORES[c.operador] || c.operador)} ${["vacio", "no_vacio"].includes(c.operador) ? "" : "<code>" + esc(c.valor) + "</code>"}</span>
        <button type="button" class="mini" data-quitar-cond="${i}">✕</button></li>`;
    }).join("") || `<li class="nota">Ninguna. El agente de IA las agrega cuando la solicitud pide algo que no está en el panel.</li>`;
  }
  $("condiciones").addEventListener("click", (ev) => {
    const i = ev.target.dataset.quitarCond;
    if (i == null) return;
    E.estado.condiciones.splice(Number(i), 1);
    recalcular();
  });
  $("condAgregar").addEventListener("click", () => {
    if (!E.base) return;
    E.estado.condiciones.push({ columna: $("condCol").value, operador: $("condOp").value, valor: $("condVal").value });
    $("condVal").value = "";
    recalcular();
  });
  $("limpiarFiltros").addEventListener("click", () => {
    const reglas = E.estado.reglas;
    E.estado = F.estadoVacio();
    E.estado.reglas = reglas;
    ponerControles();
    $("respuestaIA").hidden = true;
    recalcular();
  });
  ["texto", "atMin", "atMax", "acMin", "acMax"].forEach((id) => $(id).addEventListener("input", () => recalcularRebote()));
  document.querySelectorAll("[data-regla]").forEach((c) => c.addEventListener("change", () => recalcular()));

  function recalcular() {
    if (!E.base) return;
    leerControles();
    E.filas = F.aplicar(E.base, E.estado, E.reglas);
    E.pagina = 0;
    for (const r of [...E.sel]) if (!E.filas.includes(r)) E.sel.delete(r);
    pintarElegidos();
    pintarCondiciones();
    const desc = F.describir(E.base, E.estado);
    $("resumenFiltros").innerHTML = desc.map((d) => `<span class="chip">${esc(d)}</span>`).join(" ");
    pintarTabla();
  }
  const recalcularRebote = rebote(recalcular, 200);

  /* ---------------- Tabla de resultados ---------------- */
  const COLS = [
    ["fmi", "FMI"], ["departamento", "Departamento"], ["municipio", "Municipio"], ["clasificacion", "Clasificación"], ["subtipo", "Subtipo"],
    ["@t", "Á. terreno"], ["@c", "Á. construida"], ["estado_legal", "Estado legal"], ["ocupacion", "Ocupación"], ["estado_comercial", "Estado comercial"],
  ];
  const enPort = () => new Set(E.port.items.map((i) => i.fmi));

  function pintarTabla() {
    const b = E.base, filas = E.filas;
    $("tituloRes").textContent = `${U.formatoNumero(filas.length, 0)} folios cumplen`;
    $("descargarRes").disabled = !filas.length;
    $("agregarSel").disabled = !E.sel.size;
    $("agregarSel").textContent = E.sel.size ? `Agregar ${E.sel.size} al portafolio` : "Agregar seleccionados al portafolio";
    if (!filas.length) {
      $("tablaRes").innerHTML = `<div class="vacio"><p>Ningún folio cumple todos los filtros.</p><p class="nota">Revise los filtros o desmarque alguna regla base.</p></div>`;
      $("paginas").innerHTML = "";
      return;
    }
    const ya = enPort();
    const ini = E.pagina * E.porPagina, pag = filas.slice(ini, ini + E.porPagina);
    const celda = (r, k) => k === "@t" ? fmtArea(r, "t") : k === "@c" ? fmtArea(r, "c") : b.valor(r, k);
    let h = `<table class="res"><thead><tr><th><input type="checkbox" id="selPagina" title="Seleccionar la página"></th>${COLS.map((c) => `<th>${c[1]}</th>`).join("")}<th></th></tr></thead><tbody>`;
    for (const r of pag) {
      const fmi = U.normalizarMatricula(b.valor(r, "fmi"));
      h += `<tr class="${ya.has(fmi) ? "en-port" : ""}"><td><input type="checkbox" data-sel="${r}"${E.sel.has(r) ? " checked" : ""}></td>` +
        COLS.map(([k]) => `<td${k === "fmi" ? ' class="mono"' : k[0] === "@" ? ' class="num"' : ""}>${esc(celda(r, k))}</td>`).join("") +
        `<td>${ya.has(fmi) ? '<span class="sello ok">En portafolio</span>' : ""}<button type="button" class="mini" data-ver="${r}">${E.abiertas.has(r) ? "Cerrar" : "Ver"}</button></td></tr>`;
      if (E.abiertas.has(r)) {
        const fila = b.fila(r);
        h += `<tr class="detalle"><td colspan="${COLS.length + 2}"><dl>${Object.entries(fila).filter(([, v]) => U.limpiar(v) !== "").map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></td></tr>`;
      }
    }
    h += "</tbody></table>";
    $("tablaRes").innerHTML = h;
    const nPag = Math.ceil(filas.length / E.porPagina);
    $("paginas").innerHTML = nPag > 1 ? `<button type="button" class="mini" data-pag="-1"${E.pagina ? "" : " disabled"}>← Anterior</button>
      <span>Página ${E.pagina + 1} de ${nPag}</span>
      <button type="button" class="mini" data-pag="1"${E.pagina < nPag - 1 ? "" : " disabled"}>Siguiente →</button>` : "";
    $("selPagina").checked = pag.every((r) => E.sel.has(r));
  }
  $("tablaRes").addEventListener("change", (ev) => {
    if (ev.target.id === "selPagina") {
      const pag = E.filas.slice(E.pagina * E.porPagina, (E.pagina + 1) * E.porPagina);
      pag.forEach((r) => (ev.target.checked ? E.sel.add(r) : E.sel.delete(r)));
      pintarTabla();
      return;
    }
    const r = ev.target.dataset.sel;
    if (r == null) return;
    ev.target.checked ? E.sel.add(Number(r)) : E.sel.delete(Number(r));
    $("agregarSel").disabled = !E.sel.size;
    $("agregarSel").textContent = E.sel.size ? `Agregar ${E.sel.size} al portafolio` : "Agregar seleccionados al portafolio";
  });
  $("tablaRes").addEventListener("click", (ev) => {
    const r = ev.target.dataset.ver;
    if (r == null) return;
    const n = Number(r);
    E.abiertas.has(n) ? E.abiertas.delete(n) : E.abiertas.add(n);
    pintarTabla();
  });
  $("paginas").addEventListener("click", (ev) => {
    const d = ev.target.dataset.pag;
    if (!d) return;
    E.pagina += Number(d);
    pintarTabla();
    $("tablaRes").scrollIntoView({ block: "start" });
  });

  $("descargarRes").addEventListener("click", () => {
    const b = E.base;
    const blob = IP.xlsx.escribir([
      { nombre: "Folios", columnas: b.etiquetas, filas: E.filas.map((r) => b.nombres.map((_, i) => b.dict[i][b.idx[i][r]])) },
      { nombre: "Filtros", columnas: ["Filtro"], filas: F.describir(b, E.estado).map((x) => [x]) },
    ]);
    descargar(blob, `Folios_filtrados_${U.ahora().slice(0, 10)}.xlsx`);
  });

  $("agregarSel").addEventListener("click", () => {
    const ya = enPort();
    let n = 0;
    for (const r of [...E.sel].sort((a, b) => E.filas.indexOf(a) - E.filas.indexOf(b))) {
      const it = itemDesdeFila(r);
      if (ya.has(it.fmi)) continue;
      E.port.items.push(it); ya.add(it.fmi); n++;
    }
    E.port.filtros = F.describir(E.base, E.estado);
    if (!U.limpiar(E.port.solicitud) && U.limpiar($("solicitud").value)) E.port.solicitud = $("solicitud").value.trim();
    E.port.total_filtrados = E.filas.length;
    E.sel.clear();
    guardarPort();
    pintarTabla();
    pintarPortafolio();
    aviso(n ? `${n} folio(s) agregados al portafolio.` : "Esos folios ya estaban en el portafolio.", "ok");
    setTimeout(() => aviso(""), 4000);
  });

  function itemDesdeFila(r) {
    const b = E.base, v = (k) => U.limpiar(b.valor(r, k));
    const fmiTxt = v("fmi");
    return {
      id: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      fmi: U.normalizarMatricula(fmiTxt, v("circulo")), fmi_texto: fmiTxt,
      fila_base: b.fila(r), registro: b.registro(r),
      campos: {
        direccion: v("direccion"), clase: v("subtipo"), tipo_activo: v("tipo_activo"), clasificacion: v("clasificacion"),
        estado_legal: v("estado_legal"), ocupacion: v("ocupacion"), area_terreno: fmtArea(r, "t"), area_construida: fmtArea(r, "c"),
        activo_social: v("activo_social"), avaluo_catastral: fmtPesos(b.valor(r, "avaluo_catastral")), avaluo_comercial: fmtPesos(b.valor(r, "avaluo_comercial")),
        departamento: v("departamento"), municipio: v("municipio"), barrio: v("vereda") || "-", enlace: "",
      },
      observaciones: "", vur_texto: "", vur: null, catastro: null, contraste: null, confirmacion: null, mapa: "", mapa_origen: "", fotos: [], fachada: "",
    };
  }

  /* ---------------- Agente de IA ---------------- */
  function pintarGroq() {
    $("groqKey").value = IP.agente.apiKey();
    const m = IP.agente.modelo();
    const lista = [...new Set([m, ...P.groq.modelos])];
    $("groqModelo").innerHTML = lista.map((x) => `<option${x === m ? " selected" : ""}>${esc(x)}</option>`).join("");
    if (!IP.agente.apiKey()) $("detGroq").open = true;
  }
  $("guardarGroq").addEventListener("click", () => {
    IP.agente.guardarApiKey($("groqKey").value);
    IP.agente.guardarModelo($("groqModelo").value);
    $("estadoGroq").textContent = IP.agente.apiKey() ? "Guardado en este navegador." : "Key borrada.";
  });

  $("preguntarIA").addEventListener("click", async () => {
    const texto = $("solicitud").value.trim();
    if (!E.base) { $("estadoIA").textContent = "Primero abra la base."; return; }
    if (!texto) { $("estadoIA").textContent = "Escriba la solicitud."; return; }
    if ($("groqKey").value.trim() && $("groqKey").value.trim() !== IP.agente.apiKey()) IP.agente.guardarApiKey($("groqKey").value);
    $("preguntarIA").disabled = true;
    $("estadoIA").textContent = "Consultando a Groq…";
    try {
      const resp = await IP.agente.preguntar(E.base, texto);
      const r = IP.agente.aEstado(E.base, resp, E.estado);
      E.estado = r.estado;
      ponerControles();
      recalcular();
      const box = $("respuestaIA");
      box.hidden = false;
      box.innerHTML = `<p>${esc(r.explicacion || "Filtros aplicados.")}</p>` +
        (r.avisos.length ? `<ul class="avisos">${r.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : "") +
        `<p class="nota">Revise y ajuste los filtros abajo si hace falta.</p>`;
      $("estadoIA").textContent = "";
      if (!U.limpiar(E.port.solicitud)) { E.port.solicitud = texto; $("textoSolicitud").value = texto; guardarPort(); }
    } catch (e) {
      $("estadoIA").textContent = e.message;
    } finally { $("preguntarIA").disabled = false; }
  });

  /* ================= PORTAFOLIO ================= */
  const DB = { db: null };
  function abrirDb() {
    if (DB.db !== null) return Promise.resolve(DB.db);
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open("portafolio_sae", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("datos");
        req.onsuccess = () => { DB.db = req.result; resolve(DB.db); };
        req.onerror = () => { DB.db = false; resolve(false); };
      } catch (e) { DB.db = false; resolve(false); }
    });
  }
  async function guardarPortAhora() {
    const db = await abrirDb();
    if (!db) return;
    try {
      await new Promise((res, rej) => {
        const t = db.transaction("datos", "readwrite");
        t.objectStore("datos").put(JSON.parse(JSON.stringify(E.port)), "port");
        t.oncomplete = res; t.onerror = () => rej(t.error);
      });
    } catch (e) { aviso("No se pudo guardar el portafolio en el navegador: " + e.message, "mal"); }
  }
  const guardarPort = rebote(guardarPortAhora, 500);
  async function cargarPort() {
    const db = await abrirDb();
    if (!db) return;
    const v = await new Promise((res) => {
      const t = db.transaction("datos", "readonly");
      const r = t.objectStore("datos").get("port");
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    });
    if (v && Array.isArray(v.items)) E.port = { ...E.port, ...v };
  }

  // Solicitante
  function pintarSolicitante() {
    $("solicitante").value = E.port.solicitante || "";
    $("tipoSolicitante").value = E.port.tipo || "";
    $("tipoSolicitante").placeholder = P.presentacion.tipo_por_defecto;
    $("textoSolicitud").value = E.port.solicitud || "";
    $("logoPrevia").innerHTML = E.port.logo ? `<img src="${E.port.logo}" alt="Logo del solicitante"><button type="button" class="mini" id="quitarLogo">Quitar logo</button>` : "";
  }
  $("solicitante").addEventListener("input", (e) => { E.port.solicitante = e.target.value; guardarPort(); });
  $("tipoSolicitante").addEventListener("input", (e) => { E.port.tipo = e.target.value; guardarPort(); });
  $("textoSolicitud").addEventListener("input", (e) => { E.port.solicitud = e.target.value; guardarPort(); });
  $("logoSolicitante").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    E.port.logo = (await IP.imagenes.reducir(f, 800)).url;
    e.target.value = "";
    guardarPort(); pintarSolicitante();
  });
  $("logoPrevia").addEventListener("click", (e) => { if (e.target.id === "quitarLogo") { E.port.logo = ""; guardarPort(); pintarSolicitante(); } });

  function selloConfirmacion(it) {
    if (!it.confirmacion) return "";
    const v = it.confirmacion.veredicto;
    const cl = { confirmado: "ok", no_coincide: "mal", revisar: "rev", sin_confirmar: "gris" }[v] || "gris";
    return `<span class="sello ${cl}" title="${esc(it.confirmacion.titulo)}">FMI ${esc(IP.TEXTO_CONFIRMACION[v] || v)}</span>`;
  }

  function pintarPortafolio() {
    $("cuentaPort").textContent = E.port.items.length;
    const cont = $("items");
    if (!E.port.items.length) {
      cont.innerHTML = `<div class="vacio"><p>Todavía no hay folios. Agréguelos desde <b>1. Base y filtros</b>.</p></div>`;
      return;
    }
    cont.innerHTML = "";
    E.port.items.forEach((it, i) => cont.appendChild(tarjeta(it, i)));
  }

  function tarjeta(it, i) {
    const nodo = $("tplItem").content.firstElementChild.cloneNode(true);
    nodo.dataset.id = it.id;
    nodo.querySelector(".item-num").textContent = i + 1 + ".";
    nodo.querySelector(".item-fmi").textContent = it.fmi_texto || it.fmi;
    nodo.querySelector(".item-lugar").textContent = [it.campos.municipio, it.campos.departamento].filter(Boolean).join(", ") + (it.campos.clasificacion ? " · " + it.campos.clasificacion : "");
    nodo.querySelector(".sello").outerHTML = selloConfirmacion(it) || "<span></span>";
    // Campos editables
    const filas = [...IP.CAMPOS_FICHA, ["departamento", "DEPARTAMENTO"], ["municipio", "CIUDAD/MUNICIPIO"], ["barrio", "BARRIO / VEREDA"], ["enlace", "ENLACE (Google Maps)"]];
    nodo.querySelector(".campos-ficha").innerHTML = filas.map(([k, et]) =>
      `<label class="campo-linea"><span>${esc(et)}</span><input data-campo-ficha="${k}" value="${esc(it.campos[k] || "")}"></label>`).join("");
    nodo.querySelector('[data-campo="observaciones"]').value = it.observaciones || "";
    nodo.querySelector(".vur").value = it.vur_texto || "";
    pintarVur(nodo, it);
    pintarCatastro(nodo, it);
    pintarMapa(nodo, it);
    pintarFotos(nodo, it);
    return nodo;
  }

  const itemDe = (el) => { const art = el.closest(".item"); return art ? [art, E.port.items.find((x) => x.id === art.dataset.id)] : [null, null]; };

  function pintarVur(nodo, it) {
    const box = nodo.querySelector(".vur-res");
    const v = it.vur;
    if (!v) { box.innerHTML = `<span class="nota">Sin consulta del VUR.</span>`; return; }
    const al = IP.vur.alertas(v);
    box.innerHTML = `<dl class="mini-dl">
      <div><dt>Referencia catastral</dt><dd class="mono">${esc(v.referencia_catastral || "-")}</dd></div>
      <div><dt>Ref. anterior</dt><dd class="mono">${esc(v.referencia_catastral_anterior || "-")}</dd></div>
      <div><dt>NUPRE</dt><dd class="mono">${esc(v.nupre || "-")}</dd></div>
      <div><dt>Estado folio</dt><dd>${esc(v.estado_folio || "-")}</dd></div>
      <div><dt>Propietarios</dt><dd>${esc(v.propietarios_texto || "-")}</dd></div>
      <div><dt>Cabida</dt><dd>${esc(v.area_cabida_texto || "-")}</dd></div></dl>` +
      (al.length ? `<ul class="avisos">${al.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : "");
  }
  function pintarCatastro(nodo, it) {
    const box = nodo.querySelector(".cat-res");
    const c = it.catastro;
    if (it._buscando) { box.innerHTML = `<span class="nota">Buscando en el catastro…</span>`; return; }
    if (!c) { box.innerHTML = `<span class="nota">Busque el polígono (usa la cédula de la base y, si ya pegó el VUR, su referencia catastral).</span>`; return; }
    const fuentes = (c.fuentes || []).map((f) => `<li class="f-${esc(f.estado)}"><b>${esc(f.fuente)}</b>: ${esc(f.estado === "ok" ? "encontrado" : f.mensaje || f.estado)}${(f.enlaces || []).slice(0, 1).map((e) => ` · <a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.texto)}</a>`).join("")}</li>`).join("");
    box.innerHTML = (c.mapa_fuente ? `<p>Polígono de <b>${esc(c.mapa_fuente)}</b>.</p>` : `<p class="mal-t">No se encontró el polígono. Puede subir la imagen del mapa a mano.</p>`) +
      (it.confirmacion ? `<p>${esc(it.confirmacion.titulo)}</p>` : "") + (fuentes ? `<ul class="fuentes">${fuentes}</ul>` : "") +
      (it._errorMapa ? `<p class="mal-t">${esc(it._errorMapa)}</p>` : "");
  }
  function pintarMapa(nodo, it) {
    nodo.querySelector(".mapa-previa").innerHTML = it.mapa
      ? `<img src="${it.mapa}" alt="Imagen satelital del predio"><div class="fila"><span class="nota">${it.mapa_origen === "manual" ? "Imagen subida a mano" : "Generada con el polígono"}</span><button type="button" class="mini" data-acc="quitarMapa">Quitar</button></div>`
      : "";
  }
  function pintarFotos(nodo, it) {
    const fach = it.fachada || (it.fotos[0] || {}).id;
    nodo.querySelector(".fotos").innerHTML = it.fotos.map((f, k) => `
      <figure class="foto">
        <img src="${f.url}" alt="Foto ${k + 1}">
        <figcaption>
          <label class="chk"><input type="radio" name="fach-${it.id}" value="${f.id}" data-acc="fachada"${f.id === fach ? " checked" : ""}> Fachada</label>
          <span>
            <button type="button" class="mini" data-acc="fotoIzq" data-foto="${f.id}" title="Mover antes">←</button>
            <button type="button" class="mini" data-acc="fotoDer" data-foto="${f.id}" title="Mover después">→</button>
            <button type="button" class="mini" data-acc="fotoQuitar" data-foto="${f.id}" title="Quitar">✕</button>
          </span>
        </figcaption>
      </figure>`).join("") || `<p class="nota">Sin fotos.</p>`;
  }

  async function leerVur(art, it) {
    const texto = art.querySelector(".vur").value;
    const box = art.querySelector(".vur-res");
    const consultas = IP.vur.leerTexto(texto);
    if (!consultas.length) { box.innerHTML = `<span class="mal-t">No reconocí una consulta "Datos Básicos" del VUR en el texto.</span>`; return false; }
    const v = consultas.find((c) => c.matricula_normalizada === it.fmi) || consultas[0];
    if (v.matricula_normalizada !== it.fmi) {
      box.innerHTML = `<span class="mal-t">La consulta pegada es del folio ${esc(v.matricula)}, no del ${esc(it.fmi_texto || it.fmi)}. No se guardó.</span>`;
      return false;
    }
    it.vur = v; it.vur_texto = texto;
    try { await IP.almacen.guardarVur(v); } catch (e) { /* también la ve el investigador de predios; si falla no importa */ }
    if (/RURAL/i.test(it.campos.clase) && U.limpiar(v.vereda) && (!U.limpiar(it.campos.barrio) || it.campos.barrio === "-")) it.campos.barrio = v.vereda;
    guardarPort();
    return true;
  }

  async function buscarPoligono(it) {
    it._buscando = true; it._errorMapa = "";
    refrescarItem(it);
    try {
      await IP.gestores.asegurar();
      const cat = await IP.consultarCatastro(it.vur || null, it.registro, it.fmi);
      const d = cat.datos || {};
      it.catastro = {
        estado: cat.estado, gestor: cat.gestor, mapa_fuente: cat.mapa_fuente, lat: cat.lat, lon: cat.lon, anillos: cat.anillos || [],
        datos: { numero_predial: d.numero_predial || "", area_terreno_m2: d.area_terreno_m2 || "", barrio: d.barrio || "", direccion: d.direccion || "" },
        fuentes: (cat.fuentes || []).map((f) => ({ fuente: f.fuente, estado: f.estado, mensaje: f.mensaje, enlaces: (f.enlaces || []).slice(0, 2) })),
      };
      it.contraste = IP.contrastar(it.vur, it.registro, cat).filas;
      const conf = IP.confirmarFMI({ matricula: it.fmi, registro: it.registro, vur: it.vur, catastro: cat });
      it.confirmacion = { veredicto: conf.veredicto, titulo: conf.titulo };
      if (cat.lat != null) {
        if (!U.limpiar(it.campos.enlace) || it.enlace_auto) { it.campos.enlace = IP.mapaImagen.enlaceMaps(cat.lat, cat.lon); it.enlace_auto = true; }
        if (U.limpiar(d.barrio) && (!U.limpiar(it.campos.barrio) || it.campos.barrio === "-")) it.campos.barrio = d.barrio;
        if (it.mapa_origen !== "manual") {
          try { it.mapa = await IP.mapaImagen.generar(cat); it.mapa_origen = "auto"; }
          catch (e) { it._errorMapa = e.message; }
        }
      }
    } catch (e) {
      it._errorMapa = "Error al consultar el catastro: " + e.message;
    } finally {
      it._buscando = false;
      guardarPort();
      refrescarItem(it);
    }
  }

  function refrescarItem(it) {
    const art = document.querySelector(`.item[data-id="${it.id}"]`);
    if (!art) return;
    const i = E.port.items.indexOf(it);
    art.replaceWith(tarjeta(it, i));
  }

  $("items").addEventListener("input", (ev) => {
    const [, it] = itemDe(ev.target);
    if (!it) return;
    const k = ev.target.dataset.campoFicha;
    if (k) { it.campos[k] = ev.target.value; if (k === "enlace") it.enlace_auto = false; guardarPort(); }
    if (ev.target.dataset.campo === "observaciones") { it.observaciones = ev.target.value; guardarPort(); }
  });
  $("items").addEventListener("change", async (ev) => {
    const [art, it] = itemDe(ev.target);
    if (!it) return;
    const acc = ev.target.dataset.acc;
    if (acc === "fachada") { it.fachada = ev.target.value; guardarPort(); }
    if (acc === "fotos") {
      for (const f of ev.target.files) {
        try {
          const r = await IP.imagenes.reducir(f, 1600);
          it.fotos.push({ id: "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), url: r.url, w: r.w, h: r.h });
        } catch (e) { aviso("No se pudo leer " + f.name, "mal"); }
      }
      if (!it.fachada && it.fotos[0]) it.fachada = it.fotos[0].id;
      guardarPort(); pintarFotos(art, it);
    }
    if (acc === "mapaManual" && ev.target.files[0]) {
      it.mapa = (await IP.imagenes.reducir(ev.target.files[0], 1600)).url;
      it.mapa_origen = "manual";
      guardarPort(); pintarMapa(art, it);
    }
  });
  $("items").addEventListener("click", async (ev) => {
    const [art, it] = itemDe(ev.target);
    if (!it) return;
    const acc = ev.target.dataset.acc;
    const idx = E.port.items.indexOf(it);
    if (acc === "quitar") { if (confirm(`¿Quitar el folio ${it.fmi_texto || it.fmi} del portafolio?`)) { E.port.items.splice(idx, 1); guardarPort(); pintarPortafolio(); if (E.base) pintarTabla(); } }
    if (acc === "subir" && idx > 0) { E.port.items.splice(idx - 1, 0, E.port.items.splice(idx, 1)[0]); guardarPort(); pintarPortafolio(); }
    if (acc === "bajar" && idx < E.port.items.length - 1) { E.port.items.splice(idx + 1, 0, E.port.items.splice(idx, 1)[0]); guardarPort(); pintarPortafolio(); }
    if (acc === "leerVur") { ev.target.disabled = true; if (await leerVur(art, it)) await buscarPoligono(it); else ev.target.disabled = false; }
    if (acc === "poligono") { ev.target.disabled = true; await buscarPoligono(it); }
    if (acc === "quitarMapa") { it.mapa = ""; it.mapa_origen = ""; guardarPort(); pintarMapa(art, it); }
    const fid = ev.target.dataset.foto;
    if (fid) {
      const k = it.fotos.findIndex((f) => f.id === fid);
      if (acc === "fotoQuitar") { it.fotos.splice(k, 1); if (it.fachada === fid) it.fachada = (it.fotos[0] || {}).id || ""; }
      if (acc === "fotoIzq" && k > 0) it.fotos.splice(k - 1, 0, it.fotos.splice(k, 1)[0]);
      if (acc === "fotoDer" && k < it.fotos.length - 1) it.fotos.splice(k + 1, 0, it.fotos.splice(k, 1)[0]);
      guardarPort(); pintarFotos(art, it);
    }
  });

  $("buscarTodos").addEventListener("click", async () => {
    const b = $("buscarTodos");
    b.disabled = true;
    const pend = E.port.items.filter((it) => !it.mapa);
    for (let k = 0; k < pend.length; k++) {
      b.textContent = `Buscando ${k + 1} de ${pend.length}…`;
      await buscarPoligono(pend[k]);
    }
    b.textContent = "Buscar polígonos de todos";
    b.disabled = false;
  });

  $("vaciarPort").addEventListener("click", () => {
    if (!confirm("¿Vaciar el portafolio? Se borran los folios, el VUR pegado, los mapas y las fotos guardados en este navegador.")) return;
    E.port = { solicitante: "", tipo: "", logo: "", solicitud: "", filtros: [], items: [] };
    guardarPortAhora(); pintarSolicitante(); pintarPortafolio(); if (E.base) pintarTabla();
  });

  function datosParaDocumentos() {
    const port = { ...E.port };
    if (E.base) { port.filtros = E.port.filtros && E.port.filtros.length ? E.port.filtros : F.describir(E.base, E.estado); }
    return port;
  }
  function revisarAntes() {
    if (!E.port.items.length) { $("estadoGen").textContent = "Agregue folios al portafolio primero."; return false; }
    const sinMapa = E.port.items.filter((i) => !i.mapa).length, sinFotos = E.port.items.filter((i) => !i.fotos.length).length;
    const faltas = [];
    if (!U.limpiar(E.port.solicitante)) faltas.push("falta el nombre del solicitante");
    if (sinMapa) faltas.push(`${sinMapa} folio(s) sin imagen del mapa`);
    if (sinFotos) faltas.push(`${sinFotos} folio(s) sin fotos`);
    $("estadoGen").textContent = faltas.length ? "Ojo: " + faltas.join("; ") + ". Se genera igual." : "";
    return true;
  }
  $("genPptx").addEventListener("click", async () => {
    if (!revisarAntes()) return;
    const b = $("genPptx"); b.disabled = true;
    const previo = $("estadoGen").textContent;
    $("estadoGen").textContent = (previo ? previo + " " : "") + "Generando la presentación…";
    try {
      const blob = await IP.generarPresentacion(datosParaDocumentos());
      descargar(blob, `Portafolio_${nombreArchivo(E.port.solicitante) || "SAE"}_${U.ahora().slice(0, 10)}.pptx`);
      $("estadoGen").textContent = (previo ? previo + " " : "") + "Presentación descargada.";
    } catch (e) { $("estadoGen").textContent = "Error: " + e.message; console.error(e); }
    b.disabled = false;
  });
  $("genDocx").addEventListener("click", async () => {
    if (!revisarAntes()) return;
    const b = $("genDocx"); b.disabled = true;
    const previo = $("estadoGen").textContent;
    $("estadoGen").textContent = (previo ? previo + " " : "") + "Generando el informe…";
    try {
      const extra = { base: E.base ? { archivo: E.base.archivo, generado: E.base.generado, n: E.base.n } : null, totalFiltrados: E.port.total_filtrados };
      const blob = await IP.generarInforme(datosParaDocumentos(), extra);
      descargar(blob, `Informe_folios_${nombreArchivo(E.port.solicitante) || "SAE"}_${U.ahora().slice(0, 10)}.docx`);
      $("estadoGen").textContent = (previo ? previo + " " : "") + "Informe descargado.";
    } catch (e) { $("estadoGen").textContent = "Error: " + e.message; console.error(e); }
    b.disabled = false;
  });

  /* ---------------- Inicio ---------------- */
  (async function iniciar() {
    if (!window.CompressionStream || !window.crypto || !crypto.subtle) aviso("Este navegador es muy antiguo para abrir la base cifrada. Use Chrome, Edge o Firefox actualizados.", "mal");
    pintarGroq();
    try { IP.gestores.cargar(); } catch (e) { /* sin directorio guardado */ }
    await cargarPort();
    pintarSolicitante();
    pintarPortafolio();
    if (location.protocol === "file:") {
      pintarEstadoBase("Abierta como archivo local: abra la base en <b>Actualizar la base</b> (o publique la página para leer <code>base/base.enc</code>).", "rev");
      $("detActualizar").open = true;
    } else await buscarBasePublicada();
  })();

  window.__portafolio = E; // para revisar desde la consola
})();
