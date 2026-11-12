/* Núcleo de la página del portafolio: estado, utilidades, base de inmuebles, Groq, guardado en el navegador
   y exportar / importar el avance. Las vistas (buscar.js, folios.js, documentos.js) se apoyan en PF. */
(function () {
  const IP = window.IP;
  const U = IP.util, B = IP.base, F = IP.filtros, P = IP.PORTAFOLIO;
  const $ = (id) => document.getElementById(id);

  const PF = (window.PF = {
    $, esc: U.esc,
    E: {
      base: null, reglas: null, bytesCifrados: null, datosSinCifrar: null,
      estado: F.estadoVacio(), filas: [], pagina: 0, porPagina: 50, sel: new Set(), abiertas: new Set(), orden: "",
      port: null,
    },
    vacioPort: () => ({ version: 2, solicitante: "", tipo: "", radicado: "", logo: "", solicitud: "", conclusiones: "", filtros: [], total_filtrados: null, base_info: null, items: [] }),
    alCambiarBase: [], alCambiarPort: [],
  });
  PF.E.port = PF.vacioPort();
  const E = PF.E;

  /* ---------------- Utilidades ---------------- */
  PF.aviso = function (texto, tipo, ms) {
    const a = $("aviso");
    a.hidden = !texto;
    a.textContent = texto || "";
    a.className = "aviso" + (tipo ? " " + tipo : "");
    clearTimeout(PF._tAviso);
    if (texto && ms) PF._tAviso = setTimeout(() => (a.hidden = true), ms);
  };
  PF.descargar = function (blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  };
  PF.nombreArchivo = (s) => U.sinTildes(s || "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 60);
  PF.local = {
    leer(k, def = "") { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } },
    escribir(k, v) { try { v == null || v === "" ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* nada */ } },
    json(k, def) { try { return JSON.parse(localStorage.getItem(k) || "null") ?? def; } catch (e) { return def; } },
  };
  PF.rebote = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  PF.pausa = (ms = 20) => new Promise((r) => setTimeout(r, ms));

  PF.fmtNum = (n) => U.formatoNumero(n, Number.isInteger(n) ? 0 : 2);
  PF.fmtArea = function (n, crudo) {
    if (!Number.isFinite(n)) return U.limpiar(crudo);
    if (n >= 10000) return `${U.formatoNumero(n, 0)} m² (${U.formatoNumero(n / 10000, 2)} ha)`;
    return `${PF.fmtNum(n)} m²`;
  };
  PF.fmtPesos = function (v) {
    const n = U.numeroColombiano(String(v ?? "").replace(/[$\s]/g, ""));
    if (n == null) return U.limpiar(v);
    return "$ " + Math.round(n).toLocaleString("es-CO");
  };

  /* ---------------- Vistas ---------------- */
  PF.vista = function (nombre) {
    document.querySelectorAll(".pasos button").forEach((b) => b.classList.toggle("activa", b.dataset.vista === nombre));
    $("vistaBuscar").hidden = nombre !== "buscar";
    $("vistaPortafolio").hidden = nombre !== "portafolio";
    $("vistaDocumentos").hidden = nombre !== "documentos";
    PF.vistaActual = nombre;
    window.scrollTo(0, 0);
    if (nombre === "documentos" && PF.alAbrirDocumentos) PF.alAbrirDocumentos();
    if (nombre === "portafolio" && PF.alAbrirPortafolio) PF.alAbrirPortafolio();
  };
  document.querySelectorAll(".pasos button").forEach((b) => b.addEventListener("click", () => PF.vista(b.dataset.vista)));

  // Diálogos: cerrar al hacer clic afuera
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (ev) => { if (ev.target === d) d.close(); }));
  $("btnBase").addEventListener("click", () => $("dlgBase").showModal());
  $("btnGroq").addEventListener("click", () => $("dlgGroq").showModal());

  /* ---------------- Cabecera ---------------- */
  PF.pintarCabecera = function () {
    const b = $("btnBase");
    if (E.base) { $("txtBase").textContent = `Base: ${U.formatoNumero(E.base.n, 0)} registros`; b.className = "pildora ok"; }
    else if (E.bytesCifrados) { $("txtBase").textContent = "Base: falta la contraseña"; b.className = "pildora rev"; }
    else { $("txtBase").textContent = "Base sin abrir"; b.className = "pildora mal"; }
    const g = $("btnGroq");
    if (IP.agente.apiKey()) { $("txtGroq").textContent = "IA: " + IP.agente.modelo().replace(/^openai\//, ""); g.className = "pildora ok"; }
    else { $("txtGroq").textContent = "IA sin configurar"; g.className = "pildora rev"; }
  };

  /* ---------------- Groq ---------------- */
  function pintarGroq() {
    $("groqKey").value = IP.agente.apiKey();
    const m = IP.agente.modelo();
    const lista = [...new Set([m, ...P.groq.modelos])];
    $("groqModelo").innerHTML = lista.map((x) => `<option${x === m ? " selected" : ""}>${U.esc(x)}</option>`).join("");
  }
  $("guardarGroq").addEventListener("click", () => {
    IP.agente.guardarApiKey($("groqKey").value);
    IP.agente.guardarModelo($("groqModelo").value);
    $("estadoGroq").textContent = IP.agente.apiKey() ? "Guardado en este navegador." : "Key borrada.";
    PF.pintarCabecera();
    setTimeout(() => $("dlgGroq").close(), 600);
  });
  PF.asegurarGroq = function () {
    if (IP.agente.apiKey()) return true;
    $("dlgGroq").showModal();
    $("estadoGroq").textContent = "Escriba la API key de Groq para usar la IA.";
    return false;
  };

  /* ---------------- Base ---------------- */
  function pintarEstadoBase(html, clase) {
    const e = $("estadoBase");
    e.className = "estado" + (clase ? " " + clase : "");
    e.innerHTML = html;
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
      PF.pintarCabecera();
      const recordada = PF.local.leer("portafolio_clave");
      if (recordada) { $("clave").value = recordada; $("recordarClave").checked = true; await abrirCifrada(); }
      else { $("dlgBase").showModal(); $("clave").focus(); }
    } catch (e) {
      pintarEstadoBase("No hay base publicada en el repositorio (<code>" + U.esc(P.base_url) + "</code>). Abra un archivo en <b>Actualizar la base</b>.", "mal");
      $("detActualizar").open = true;
      PF.pintarCabecera();
    }
  }

  async function abrirCifrada() {
    const clave = $("clave").value;
    if (!clave) return;
    pintarEstadoBase("Descifrando la base…");
    await PF.pausa();
    try {
      const datos = await B.descifrar(E.bytesCifrados, clave);
      PF.local.escribir("portafolio_clave", $("recordarClave").checked ? clave : "");
      $("formClave").hidden = true;
      usarBase(datos, "cifrada");
      if ($("dlgBase").open) setTimeout(() => $("dlgBase").close(), 700);
    } catch (e) {
      pintarEstadoBase(U.esc(e.message), "mal");
      PF.local.escribir("portafolio_clave", "");
      if (!$("dlgBase").open) $("dlgBase").showModal();
    }
  }
  $("formClave").addEventListener("submit", (ev) => { ev.preventDefault(); abrirCifrada(); });

  $("archivoBase").addEventListener("change", async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const est = $("estadoArchivo");
    est.textContent = "Leyendo " + f.name + "…";
    $("cifrarCaja").hidden = true;
    await PF.pausa();
    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      if (B.esCifrado(bytes) || /\.enc$/i.test(f.name)) {
        E.bytesCifrados = bytes;
        $("formClave").hidden = false;
        pintarEstadoBase("Archivo cifrado " + U.esc(f.name) + ". Escriba la contraseña.");
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
    } catch (e) { est.textContent = "No se pudo leer: " + e.message; }
  });

  $("cifrarBase").addEventListener("click", async () => {
    const a = $("claveNueva").value, b = $("claveNueva2").value, est = $("estadoArchivo");
    if (!E.datosSinCifrar) { est.textContent = "Primero elija el archivo de la base."; return; }
    if (a.length < 8) { est.textContent = "Use una contraseña de al menos 8 caracteres."; return; }
    if (a !== b) { est.textContent = "Las contraseñas no coinciden."; return; }
    est.textContent = "Cifrando…";
    await PF.pausa();
    const blob = await B.cifrar(E.datosSinCifrar, a);
    PF.descargar(blob, "base.enc");
    est.innerHTML = `Listo: <b>base.enc</b> (${(blob.size / 1048576).toFixed(1)} MB). Súbalo a la carpeta <code>base/</code> del repositorio, reemplazando el anterior.`;
  });

  function usarBase(datos, origen) {
    E.base = new B.Base(datos);
    E.reglas = F.reglasBase(E.base);
    const b = E.base, avisos = [];
    if (b.c.fmi < 0) avisos.push("no encontré la columna FOLIO DE MATRÍCULA");
    if (b.faltan.length) avisos.push("faltan columnas de la regla “no aplica”: " + b.faltan.join(", "));
    if (b.c.estado_comercial < 0) avisos.push("falta ESTADO COMERCIAL (esa regla no filtra)");
    if (b.c.viable < 0) avisos.push("falta VIABLE SI/NO (COMERCIAL) (esa regla no filtra)");
    if (b.cedulasDanadas) avisos.push(`${U.formatoNumero(b.cedulasDanadas, 0)} cédulas catastrales vienen dañadas por Excel (ej. 5.00E+28); para esos folios el polígono se busca con el VUR`);
    pintarEstadoBase(`<b>${U.esc(b.archivo || "Base")}</b> · ${U.formatoNumero(b.n, 0)} registros · generada ${U.esc(b.generado || "")}` +
      (origen === "archivo" ? " · <i>solo en esta sesión</i>" : "") +
      (avisos.length ? `<div class="avisos-base">⚠ ${avisos.map(U.esc).join("<br>⚠ ")}</div>` : ""), avisos.length ? "rev" : "ok");
    if (avisos.length) PF.aviso("Base abierta con avisos: " + avisos.join(" · "), "rev", 12000);
    PF.pintarCabecera();
    PF.alCambiarBase.forEach((fn) => fn());
  }

  /* ---------------- Folio nuevo desde una fila de la base ---------------- */
  PF.itemDesdeFila = function (r) {
    const b = E.base, v = (k) => U.limpiar(b.valor(r, k));
    const fmiTxt = v("fmi");
    return {
      id: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      fmi: U.normalizarMatricula(fmiTxt, v("circulo")), fmi_texto: fmiTxt,
      fila_base: b.fila(r), registro: b.registro(r),
      areas_m2: { terreno: Number.isFinite(b.areaT[r]) ? b.areaT[r] : null, construida: Number.isFinite(b.areaC[r]) ? b.areaC[r] : null },
      campos: {
        direccion: v("direccion"), clase: v("subtipo"), tipo_activo: v("tipo_activo"), clasificacion: v("clasificacion"),
        estado_legal: v("estado_legal"), ocupacion: v("ocupacion"), area_terreno: PF.fmtArea(b.areaT[r], v("area_terreno")),
        area_construida: PF.fmtArea(b.areaC[r], v("area_construida")), activo_social: v("activo_social"),
        avaluo_catastral: PF.fmtPesos(b.valor(r, "avaluo_catastral")), avaluo_comercial: PF.fmtPesos(b.valor(r, "avaluo_comercial")),
        departamento: v("departamento"), municipio: v("municipio"), barrio: v("vereda") || "-", enlace: "",
      },
      observaciones: "", vur_texto: "", vur: null, catastro: null, contraste: null, confirmacion: null,
      mapa: "", mapa_origen: "", imagenes: { fachada: null, interior1: null, interior2: null, extra: [] },
      texto: null, abierto: true,
    };
  };

  // Valor de la fila de la base guardada en el folio, por nombre de columna (sin tildes)
  PF.deBase = function (it, ...nombres) {
    const fb = it.fila_base || {};
    for (const n of nombres) {
      const nn = U.normalizar(n);
      for (const [k, v] of Object.entries(fb)) if (U.normalizar(k) === nn && U.limpiar(v) && !/^#N\/?[AD]$/i.test(String(v).trim())) return U.limpiar(v);
    }
    return "";
  };

  /* ---------------- Guardado del portafolio ---------------- */
  // Portafolios guardados con la versión anterior (fotos en lista) → espacios fijos
  PF.migrar = function (port) {
    port = { ...PF.vacioPort(), ...port };
    for (const it of port.items || []) {
      if (!it.imagenes) {
        const fotos = it.fotos || [];
        const fach = fotos.find((f) => f.id === it.fachada) || fotos[0] || null;
        const resto = fotos.filter((f) => f !== fach);
        it.imagenes = { fachada: fach, interior1: resto[0] || null, interior2: resto[1] || null, extra: resto.slice(2) };
      }
      delete it.fotos; delete it.fachada;
      if (!it.areas_m2) it.areas_m2 = { terreno: null, construida: null };
      if (it.texto === undefined) it.texto = null;
      delete it._buscando;
    }
    port.version = 2;
    return port;
  };

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
  const limpioParaGuardar = () => JSON.parse(JSON.stringify(E.port, (k, v) => (k.startsWith("_") ? undefined : v)));
  PF.guardarAhora = async function () {
    const db = await abrirDb();
    if (!db) return;
    try {
      await new Promise((res, rej) => {
        const t = db.transaction("datos", "readwrite");
        t.objectStore("datos").put(limpioParaGuardar(), "port");
        t.oncomplete = res; t.onerror = () => rej(t.error);
      });
    } catch (e) { PF.aviso("No se pudo guardar el portafolio en el navegador: " + e.message, "mal"); }
  };
  const guardarRebote = PF.rebote(PF.guardarAhora, 500);
  PF.guardar = function () { guardarRebote(); PF.alCambiarPort.forEach((fn) => fn()); };
  PF.cargar = async function () {
    const db = await abrirDb();
    if (!db) return;
    const v = await new Promise((res) => {
      const t = db.transaction("datos", "readonly");
      const r = t.objectStore("datos").get("port");
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    });
    if (v && Array.isArray(v.items)) E.port = PF.migrar(v);
  };

  /* ---------------- Exportar / importar el avance ---------------- */
  PF.exportar = function () {
    const datos = { tipo: "portafolio_sae", exportado: U.ahora(), port: limpioParaGuardar() };
    const blob = new Blob([JSON.stringify(datos)], { type: "application/json" });
    PF.descargar(blob, `Avance_portafolio_${PF.nombreArchivo(E.port.solicitante) || "SAE"}_${U.ahora().slice(0, 10)}.json`);
  };
  PF.importar = async function (archivo) {
    const js = JSON.parse(await archivo.text());
    if (!js || js.tipo !== "portafolio_sae" || !js.port) throw new Error("El archivo no es un avance exportado desde esta página.");
    const nuevo = PF.migrar(js.port);
    if (E.port.items.length) {
      const reemplazar = confirm(`El archivo trae ${nuevo.items.length} folio(s). ¿Reemplazar el portafolio actual (${E.port.items.length} folios)?\n\nAceptar = reemplazar · Cancelar = agregar los que no estén`);
      if (!reemplazar) {
        const ya = new Set(E.port.items.map((i) => i.fmi));
        nuevo.items.filter((i) => !ya.has(i.fmi)).forEach((i) => E.port.items.push(i));
        PF.guardar();
        return;
      }
    }
    E.port = nuevo;
    PF.guardar();
  };

  PF.iniciarNucleo = async function () {
    if (!window.CompressionStream || !window.crypto || !crypto.subtle)
      PF.aviso("Este navegador es muy antiguo para abrir la base cifrada. Use Chrome, Edge o Firefox actualizados.", "mal");
    pintarGroq();
    try { IP.gestores.cargar(); } catch (e) { /* sin directorio guardado */ }
    await PF.cargar();
    PF.pintarCabecera();
    if (location.protocol === "file:") {
      pintarEstadoBase("Abierta como archivo local: abra la base en <b>Actualizar la base</b> (o publique la página para leer <code>base/base.enc</code>).", "rev");
      $("detActualizar").open = true;
    } else await buscarBasePublicada();
  };
})();
