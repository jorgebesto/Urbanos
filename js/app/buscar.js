/* Vista 1: buscar folios. Solicitud con IA arriba, filtros activos, cuadrícula de filtros, resultados con barra fija. */
(function () {
  const IP = window.IP, PF = window.PF;
  const U = IP.util, F = IP.filtros, P = IP.PORTAFOLIO;
  const { $, esc, E } = PF;
  const CLAVES = P.panel.map((p) => p[0]);
  const TITULO = Object.fromEntries(P.panel);
  let ultimoConteo = {};

  /* ---------------- Controles ⇄ estado ---------------- */
  function leerControles() {
    const est = E.estado;
    document.querySelectorAll("[data-regla]").forEach((c) => { est.reglas[c.dataset.regla] = c.checked; });
    est.texto = $("texto").value;
    const n = (id, uni) => ($(id).value === "" ? null : Number($(id).value) * Number($(uni).value));
    est.rangos = { area_terreno: { min: n("atMin", "atUni"), max: n("atMax", "atUni") }, area_construida: { min: n("acMin", "acUni"), max: n("acMax", "acUni") } };
  }
  function ponerControles() {
    const est = E.estado;
    document.querySelectorAll("[data-regla]").forEach((c) => { c.checked = est.reglas[c.dataset.regla] !== false; });
    $("texto").value = est.texto || "";
    const poner = (min, max, idMin, idMax, idUni, r) => {
      const ha = [r.min, r.max].some((x) => x != null && x >= 10000 && x % 10000 === 0);
      $(idUni).value = ha ? "10000" : "1";
      const f = ha ? 10000 : 1;
      $(idMin).value = r.min == null ? "" : r.min / f;
      $(idMax).value = r.max == null ? "" : r.max / f;
    };
    poner(0, 0, "atMin", "atMax", "atUni", est.rangos.area_terreno || {});
    poner(0, 0, "acMin", "acMax", "acUni", est.rangos.area_construida || {});
  }
  PF.ponerEstado = function (est) { E.estado = est; ponerControles(); recalcular(); };

  /* ---------------- Cuadrícula de filtros ---------------- */
  function construirFacetas() {
    const cont = $("facetas");
    cont.innerHTML = "";
    for (const clave of CLAVES) {
      if (E.base.c[clave] < 0) continue;
      const d = document.createElement("div");
      d.className = "faceta";
      d.dataset.clave = clave;
      d.innerHTML = `<div class="faceta-cab"><span class="faceta-tit">${esc(TITULO[clave])}</span><button type="button" class="enlace limpiar-op" hidden>quitar</button></div>
        <input type="search" class="buscar-op" placeholder="Buscar…">
        <div class="opciones"></div>`;
      d.querySelector(".buscar-op").addEventListener("input", () => pintarFaceta(d));
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
  }
  function pintarFaceta(d) {
    const clave = d.dataset.clave;
    const elegidos = new Set(E.estado.cat[clave] || []);
    let cont = (ultimoConteo[clave] || []).slice();
    for (const v of elegidos) if (!cont.some((x) => x[0] === v)) cont.push([v, 0]);
    if (["departamento", "municipio"].includes(clave)) cont.sort((a, b) => a[0].localeCompare(b[0], "es"));
    else cont.sort((a, b) => b[1] - a[1]);
    // Los elegidos primero
    cont.sort((a, b) => (elegidos.has(b[0]) ? 1 : 0) - (elegidos.has(a[0]) ? 1 : 0));
    const q = U.normalizar(d.querySelector(".buscar-op").value);
    if (q) cont = cont.filter((x) => U.normalizar(x[0]).includes(q));
    const max = 300;
    d.querySelector(".opciones").innerHTML = cont.slice(0, max).map(([v, n]) =>
      `<label class="op${elegidos.has(v) ? " sel" : ""}${n ? "" : " cero"}"><input type="checkbox" value="${esc(v)}"${elegidos.has(v) ? " checked" : ""}><span class="op-t">${esc(v || "(vacío)")}</span><span class="n">${U.formatoNumero(n, 0)}</span></label>`).join("") +
      (cont.length > max ? `<p class="nota">… ${cont.length - max} más; use el buscador.</p>` : "") +
      (!cont.length ? `<p class="nota">Sin opciones.</p>` : "");
    d.classList.toggle("con-filtro", elegidos.size > 0);
    d.querySelector(".limpiar-op").hidden = !elegidos.size;
    d.querySelector(".faceta-tit").textContent = TITULO[clave] + (elegidos.size ? ` (${elegidos.size})` : "");
  }

  /* ---------------- Filtros activos ---------------- */
  function pintarActivos() {
    const est = E.estado, chips = [];
    for (const clave of CLAVES) for (const v of est.cat[clave] || [])
      chips.push(`<span class="chip">${esc(TITULO[clave])}: <b>${esc(v || "(vacío)")}</b><button type="button" data-quitar="cat" data-k="${clave}" data-v="${esc(v)}" aria-label="Quitar">✕</button></span>`);
    const rango = (k, t) => {
      const r = est.rangos[k] || {};
      const f = (x) => (x >= 10000 ? `${U.formatoNumero(x / 10000, 2)} ha` : `${U.formatoNumero(x, 0)} m²`);
      if (r.min != null || r.max != null)
        chips.push(`<span class="chip">${t}: <b>${r.min != null ? "desde " + f(r.min) : ""}${r.min != null && r.max != null ? " " : ""}${r.max != null ? "hasta " + f(r.max) : ""}</b><button type="button" data-quitar="rango" data-k="${k}">✕</button></span>`);
    };
    rango("area_terreno", "Área terreno"); rango("area_construida", "Área construida");
    if (U.limpiar(est.texto)) chips.push(`<span class="chip">Texto: <b>${esc(est.texto)}</b><button type="button" data-quitar="texto">✕</button></span>`);
    est.condiciones.forEach((c, i) => {
      const k = E.base.pos.get(c.columna);
      chips.push(`<span class="chip chip-cond">${esc(k !== undefined ? E.base.etiquetas[k] : c.columna)} ${esc(F.OPERADORES[c.operador] || c.operador)} ${["vacio", "no_vacio"].includes(c.operador) ? "" : "<b>" + esc(c.valor) + "</b>"}<button type="button" data-quitar="cond" data-i="${i}">✕</button></span>`);
    });
    const nombresRegla = { no_aplica: "trámites/contratos en no aplica", comercial: "estado comercial", viable: "viable comercial" };
    for (const [k, t] of Object.entries(nombresRegla)) if (est.reglas[k] === false)
      chips.push(`<span class="chip chip-regla">Regla base desactivada: ${t}<button type="button" data-quitar="regla" data-k="${k}" title="Volver a activarla">↺</button></span>`);
    $("chipsActivos").innerHTML = chips.join("") || `<span class="nota">Solo las reglas base. Elija filtros abajo o escriba la solicitud para la IA.</span>`;
  }
  $("chipsActivos").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-quitar]");
    if (!b) return;
    const est = E.estado, k = b.dataset.k;
    if (b.dataset.quitar === "cat") { est.cat[k] = (est.cat[k] || []).filter((x) => x !== b.dataset.v); if (!est.cat[k].length) delete est.cat[k]; }
    if (b.dataset.quitar === "rango") est.rangos[k] = { min: null, max: null };
    if (b.dataset.quitar === "texto") est.texto = "";
    if (b.dataset.quitar === "cond") est.condiciones.splice(Number(b.dataset.i), 1);
    if (b.dataset.quitar === "regla") est.reglas[k] = true;
    ponerControles();
    recalcular();
  });

  /* ---------------- Condiciones adicionales ---------------- */
  function construirCondiciones() {
    $("condCol").innerHTML = E.base.nombres.map((n, i) => `<option value="${esc(n)}">${esc(E.base.etiquetas[i])}</option>`).join("");
    $("condOp").innerHTML = Object.entries(F.OPERADORES).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("");
  }
  function pintarCondiciones() {
    $("condiciones").innerHTML = E.estado.condiciones.map((c, i) => {
      const k = E.base.pos.get(c.columna);
      return `<li><span><b>${esc(k !== undefined ? E.base.etiquetas[k] : c.columna)}</b> ${esc(F.OPERADORES[c.operador] || c.operador)} ${["vacio", "no_vacio"].includes(c.operador) ? "" : "<code>" + esc(c.valor) + "</code>"}</span><button type="button" class="mini" data-quitar-cond="${i}">✕</button></li>`;
    }).join("") || `<li class="nota">Ninguna. La IA las agrega cuando la solicitud pide algo que no está en la cuadrícula.</li>`;
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
    E.estado.reglas = { ...reglas, no_aplica: true, comercial: true, viable: true };
    ponerControles();
    $("respuestaIA").hidden = true;
    recalcular();
  });
  ["texto", "atMin", "atMax", "acMin", "acMax"].forEach((id) => $(id).addEventListener("input", () => recalcularRebote()));
  ["atUni", "acUni"].forEach((id) => $(id).addEventListener("change", () => recalcular()));
  document.querySelectorAll("[data-regla]").forEach((c) => c.addEventListener("change", () => recalcular()));

  /* ---------------- Recalcular ---------------- */
  let avaluoNum = null;
  function ordenar(filas) {
    const o = $("orden").value, b = E.base;
    if (!o) return filas;
    const a = filas.slice();
    const txt = (r, k) => b.valor(r, k);
    if (o === "departamento") a.sort((x, y) => txt(x, "departamento").localeCompare(txt(y, "departamento"), "es") || txt(x, "municipio").localeCompare(txt(y, "municipio"), "es"));
    else if (o === "fmi") a.sort((x, y) => txt(x, "fmi").localeCompare(txt(y, "fmi"), "es", { numeric: true }));
    else {
      let val;
      if (o.startsWith("areaT")) val = (r) => b.areaT[r];
      else if (o.startsWith("areaC")) val = (r) => b.areaC[r];
      else {
        if (!avaluoNum || avaluoNum.base !== b) {
          const i = b.c.avaluo_catastral;
          avaluoNum = { base: b, d: i >= 0 ? b.dict[i].map((v) => U.numeroColombiano(String(v).replace(/[$\s]/g, "")) ?? NaN) : null };
        }
        val = (r) => (avaluoNum.d ? avaluoNum.d[b.idx[b.c.avaluo_catastral][r]] : NaN);
      }
      const s = o.endsWith("-") ? -1 : 1;
      a.sort((x, y) => { const vx = val(x), vy = val(y); if (!Number.isFinite(vx)) return 1; if (!Number.isFinite(vy)) return -1; return s * (vx - vy); });
    }
    return a;
  }
  $("orden").addEventListener("change", () => { E.filas = ordenar(E.filasSinOrden || []); E.pagina = 0; pintarTabla(); });

  function recalcular() {
    if (!E.base) return;
    leerControles();
    const r = F.aplicarConFacetas(E.base, E.estado, E.reglas, CLAVES);
    ultimoConteo = r.conteos;
    E.filasSinOrden = r.filas;
    E.filas = ordenar(r.filas);
    E.pagina = 0;
    const enFilas = new Set(r.filas);
    for (const x of [...E.sel]) if (!enFilas.has(x)) E.sel.delete(x);
    document.querySelectorAll(".faceta").forEach(pintarFaceta);
    pintarActivos();
    pintarCondiciones();
    pintarResumenDep();
    pintarTabla();
  }
  const recalcularRebote = PF.rebote(recalcular, 180);
  PF.recalcular = recalcular;

  function pintarResumenDep() {
    const dep = (ultimoConteo.departamento || []).slice();
    // conteo de departamentos dentro de los resultados (si hay filtro de departamento, el conteo de la faceta lo ignora)
    const elegidos = new Set(E.estado.cat.departamento || []);
    const lista = elegidos.size ? dep.filter((x) => elegidos.has(x[0])) : dep;
    lista.sort((a, b) => b[1] - a[1]);
    $("resumenDep").innerHTML = lista.slice(0, 6).map(([d, n]) =>
      `<button type="button" class="dep${elegidos.has(d) ? " sel" : ""}" data-dep="${esc(d)}" title="Filtrar por ${esc(d)}">${esc(d || "(vacío)")} <b>${U.formatoNumero(n, 0)}</b></button>`).join("") +
      (lista.length > 6 ? `<span class="nota">+${lista.length - 6} más</span>` : "");
  }
  $("resumenDep").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-dep]");
    if (!b) return;
    const d = b.dataset.dep;
    const sel = E.estado.cat.departamento || [];
    E.estado.cat.departamento = sel.length === 1 && sel[0] === d ? [] : [d];
    if (!E.estado.cat.departamento.length) delete E.estado.cat.departamento;
    recalcular();
  });

  /* ---------------- Tabla ---------------- */
  const COLS = [
    ["fmi", "Folio (FMI)"], ["departamento", "Departamento"], ["municipio", "Municipio"], ["clasificacion", "Clasificación"], ["subtipo", "Subtipo"],
    ["@t", "Área terreno"], ["@c", "Área construida"], ["estado_legal", "Estado legal"], ["ocupacion", "Ocupación"], ["estado_comercial", "Estado comercial"],
  ];
  const enPort = () => new Set(E.port.items.map((i) => i.fmi));
  function pintarBotones() {
    $("agregarSel").disabled = !E.sel.size;
    $("agregarSel").textContent = E.sel.size ? `Agregar ${E.sel.size} al portafolio` : "Agregar al portafolio";
  }
  function pintarTabla() {
    const b = E.base, filas = E.filas;
    $("tituloRes").textContent = `${U.formatoNumero(filas.length, 0)} folios cumplen`;
    $("descargarRes").disabled = !filas.length;
    pintarBotones();
    if (!filas.length) {
      $("tablaRes").innerHTML = `<div class="vacio"><p><b>Ningún folio cumple todos los filtros.</b></p><p class="nota">Quite algún filtro activo o revise las reglas base.</p></div>`;
      $("paginas").innerHTML = "";
      return;
    }
    const ya = enPort();
    const ini = E.pagina * E.porPagina, pag = filas.slice(ini, ini + E.porPagina);
    const celda = (r, k) => (k === "@t" ? PF.fmtArea(b.areaT[r], b.valor(r, "area_terreno")) : k === "@c" ? PF.fmtArea(b.areaC[r], b.valor(r, "area_construida")) : b.valor(r, k));
    let h = `<table class="res"><thead><tr><th class="c-sel"><input type="checkbox" id="selPagina" title="Seleccionar esta página"></th>${COLS.map((c) => `<th>${c[1]}</th>`).join("")}<th></th></tr></thead><tbody>`;
    for (const r of pag) {
      const fmi = U.normalizarMatricula(b.valor(r, "fmi"));
      const esta = ya.has(fmi);
      h += `<tr class="${esta ? "en-port" : ""}${E.sel.has(r) ? " marcada" : ""}"><td class="c-sel"><input type="checkbox" data-sel="${r}"${E.sel.has(r) ? " checked" : ""}${esta ? " disabled" : ""}></td>` +
        COLS.map(([k]) => `<td class="${k === "fmi" ? "mono" : k[0] === "@" ? "num" : ""}">${esc(celda(r, k))}</td>`).join("") +
        `<td class="c-acc">${esta ? '<span class="sello ok">En portafolio</span>' : ""}<button type="button" class="mini" data-ver="${r}">${E.abiertas.has(r) ? "Cerrar" : "Ver todo"}</button></td></tr>`;
      if (E.abiertas.has(r)) {
        const fila = b.fila(r);
        h += `<tr class="detalle"><td colspan="${COLS.length + 2}"><dl>${Object.entries(fila).filter(([, v]) => U.limpiar(v) !== "").map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></td></tr>`;
      }
    }
    $("tablaRes").innerHTML = h + "</tbody></table>";
    const nPag = Math.ceil(filas.length / E.porPagina);
    $("paginas").innerHTML = nPag > 1 ? `<button type="button" class="mini" data-pag="-1"${E.pagina ? "" : " disabled"}>← Anterior</button>
      <span>Página ${E.pagina + 1} de ${U.formatoNumero(nPag, 0)}</span>
      <button type="button" class="mini" data-pag="1"${E.pagina < nPag - 1 ? "" : " disabled"}>Siguiente →</button>` : "";
    const libres = pag.filter((r) => !ya.has(U.normalizarMatricula(b.valor(r, "fmi"))));
    $("selPagina").checked = libres.length > 0 && libres.every((r) => E.sel.has(r));
  }
  PF.pintarTabla = () => E.base && pintarTabla();
  $("tablaRes").addEventListener("change", (ev) => {
    if (ev.target.id === "selPagina") {
      const ya = enPort();
      E.filas.slice(E.pagina * E.porPagina, (E.pagina + 1) * E.porPagina)
        .filter((r) => !ya.has(U.normalizarMatricula(E.base.valor(r, "fmi"))))
        .forEach((r) => (ev.target.checked ? E.sel.add(r) : E.sel.delete(r)));
      pintarTabla();
      return;
    }
    const r = ev.target.dataset.sel;
    if (r == null) return;
    ev.target.checked ? E.sel.add(Number(r)) : E.sel.delete(Number(r));
    ev.target.closest("tr").classList.toggle("marcada", ev.target.checked);
    pintarBotones();
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
    $("tablaRes").scrollIntoView({ block: "start", behavior: "smooth" });
  });

  $("descargarRes").addEventListener("click", () => {
    const b = E.base;
    const blob = IP.xlsx.escribir([
      { nombre: "Folios", columnas: b.etiquetas, filas: E.filas.map((r) => b.nombres.map((_, i) => b.dict[i][b.idx[i][r]])) },
      { nombre: "Filtros", columnas: ["Filtro"], filas: [...(U.limpiar($("solicitud").value) ? ["Solicitud: " + $("solicitud").value.trim()] : []), ...F.describir(b, E.estado)].map((x) => [x]) },
    ]);
    PF.descargar(blob, `Folios_filtrados_${U.ahora().slice(0, 10)}.xlsx`);
  });

  $("agregarSel").addEventListener("click", () => {
    const ya = enPort();
    let n = 0;
    const orden = new Map(E.filas.map((r, i) => [r, i]));
    for (const r of [...E.sel].sort((a, b) => orden.get(a) - orden.get(b))) {
      const it = PF.itemDesdeFila(r);
      if (ya.has(it.fmi)) continue;
      E.port.items.push(it); ya.add(it.fmi); n++;
    }
    E.port.filtros = F.describir(E.base, E.estado);
    if (!U.limpiar(E.port.solicitud) && U.limpiar($("solicitud").value)) E.port.solicitud = $("solicitud").value.trim();
    E.port.total_filtrados = E.filas.length;
    E.port.base_info = { archivo: E.base.archivo, generado: E.base.generado, n: E.base.n, reglas: E.reglas.conteo, todas_reglas: F.aplicar(E.base, { ...F.estadoVacio(), reglas: E.estado.reglas }, E.reglas).length };
    E.sel.clear();
    PF.guardar();
    pintarTabla();
    PF.aviso(n ? `${n} folio(s) agregados al portafolio. Siga en “2. Portafolio”.` : "Esos folios ya estaban en el portafolio.", "ok", 5000);
  });

  /* ---------------- IA ---------------- */
  $("preguntarIA").addEventListener("click", async () => {
    const texto = $("solicitud").value.trim();
    const box = $("respuestaIA");
    if (!E.base) { $("dlgBase").showModal(); return; }
    if (!texto) { box.hidden = false; box.innerHTML = "<p>Escriba primero la solicitud.</p>"; return; }
    if (!PF.asegurarGroq()) return;
    $("preguntarIA").disabled = true;
    box.hidden = false; box.className = "respuesta-ia cargando"; box.innerHTML = "<p>Consultando a Groq…</p>";
    try {
      const resp = await IP.agente.preguntar(E.base, texto);
      const r = IP.agente.aEstado(E.base, resp, E.estado);
      PF.ponerEstado(r.estado);
      box.className = "respuesta-ia";
      box.innerHTML = `<p><b>✦</b> ${esc(r.explicacion || "Filtros aplicados.")} <span class="nota">— ${U.formatoNumero(E.filas.length, 0)} folios. Ajuste los filtros abajo si hace falta.</span></p>` +
        (r.avisos.length ? `<ul class="avisos">${r.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : "");
      agregarHistorial(texto, r.estado, E.filas.length);
      if (!U.limpiar(E.port.solicitud)) { E.port.solicitud = texto; PF.guardar(); }
    } catch (e) {
      box.className = "respuesta-ia error";
      box.innerHTML = `<p>${esc(e.message)}</p>`;
    } finally { $("preguntarIA").disabled = false; }
  });
  $("solicitud").addEventListener("keydown", (ev) => { if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) $("preguntarIA").click(); });

  /* ---------------- Búsquedas guardadas e historial ---------------- */
  const CL_GUARD = "portafolio_busquedas", CL_HIST = "portafolio_historial";
  const copia = (x) => JSON.parse(JSON.stringify(x));
  function agregarHistorial(solicitud, estado, n) {
    const h = PF.local.json(CL_HIST, []).filter((x) => x.solicitud !== solicitud);
    h.unshift({ solicitud, estado: copia(estado), n, fecha: U.ahora() });
    PF.local.escribir(CL_HIST, JSON.stringify(h.slice(0, 15)));
  }
  function pintarMenu(id, lista, borrable) {
    $(id).innerHTML = lista.length ? lista.map((x, i) => `<div class="menu-op"><button type="button" data-usar="${i}"><b>${esc(x.nombre || x.solicitud || "(sin solicitud)")}</b><span class="nota">${esc(x.nombre ? x.solicitud || "" : "")} ${esc(x.fecha)}${x.n != null ? " · " + U.formatoNumero(x.n, 0) + " folios" : ""}</span></button>${borrable ? `<button type="button" class="mini" data-borrar="${i}" aria-label="Borrar">✕</button>` : ""}</div>`).join("")
      : `<p class="nota">${borrable ? "Todavía no hay búsquedas guardadas." : "Todavía no hay solicitudes."}</p>`;
  }
  document.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const m = $(b.dataset.menu);
    const abrir = m.hidden;
    document.querySelectorAll(".menu-lista").forEach((x) => (x.hidden = true));
    if (!abrir) return;
    if (m.id === "menuGuardadas") pintarMenu("menuGuardadas", PF.local.json(CL_GUARD, []), true);
    else pintarMenu("menuHistorial", PF.local.json(CL_HIST, []), false);
    m.hidden = false;
  }));
  document.addEventListener("click", (ev) => { if (!ev.target.closest(".menu")) document.querySelectorAll(".menu-lista").forEach((x) => (x.hidden = true)); });
  function usar(x) {
    if (!E.base) { $("dlgBase").showModal(); return; }
    $("solicitud").value = x.solicitud || "";
    const est = { ...F.estadoVacio(), ...copia(x.estado) };
    PF.ponerEstado(est);
    document.querySelectorAll(".menu-lista").forEach((m) => (m.hidden = true));
    $("respuestaIA").hidden = false;
    $("respuestaIA").className = "respuesta-ia";
    $("respuestaIA").innerHTML = `<p>Se aplicó ${x.nombre ? "la búsqueda guardada <b>" + esc(x.nombre) + "</b>" : "una solicitud del historial"} — ${U.formatoNumero(E.filas.length, 0)} folios hoy.</p>`;
  }
  $("menuGuardadas").addEventListener("click", (ev) => {
    const g = PF.local.json(CL_GUARD, []);
    const u = ev.target.closest("[data-usar]"), d = ev.target.closest("[data-borrar]");
    if (d) { g.splice(Number(d.dataset.borrar), 1); PF.local.escribir(CL_GUARD, JSON.stringify(g)); pintarMenu("menuGuardadas", g, true); ev.stopPropagation(); }
    else if (u) usar(g[Number(u.dataset.usar)]);
  });
  $("menuHistorial").addEventListener("click", (ev) => {
    const u = ev.target.closest("[data-usar]");
    if (u) usar(PF.local.json(CL_HIST, [])[Number(u.dataset.usar)]);
  });
  $("guardarBusqueda").addEventListener("click", () => {
    if (!E.base) return;
    $("nombreBusqueda").value = $("solicitud").value.trim().slice(0, 60);
    $("dlgGuardar").showModal();
    $("nombreBusqueda").select();
  });
  $("confirmarGuardar").addEventListener("click", () => {
    const nombre = $("nombreBusqueda").value.trim() || "Búsqueda " + U.ahora();
    const g = PF.local.json(CL_GUARD, []).filter((x) => x.nombre !== nombre);
    g.unshift({ nombre, solicitud: $("solicitud").value.trim(), estado: copia(E.estado), n: E.filas.length, fecha: U.ahora() });
    PF.local.escribir(CL_GUARD, JSON.stringify(g.slice(0, 40)));
    $("dlgGuardar").close();
    PF.aviso(`Búsqueda “${nombre}” guardada.`, "ok", 3000);
  });

  /* ---------------- Al abrir una base ---------------- */
  PF.alCambiarBase.push(() => {
    document.querySelectorAll("[data-cuenta]").forEach((s) => { s.textContent = U.formatoNumero(E.reglas.conteo[s.dataset.cuenta], 0); });
    construirFacetas();
    construirCondiciones();
    E.sel.clear();
    recalcular();
  });
  PF.alCambiarPort.push(() => { $("cuentaPort").textContent = E.port.items.length; });
})();
