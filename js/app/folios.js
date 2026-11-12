/* Vista 2: portafolio. Cada folio con sus datos, VUR, polígono, imágenes en espacios fijos y texto de contexto. */
(function () {
  const IP = window.IP, PF = window.PF;
  const U = IP.util, C = IP.contexto;
  const { $, esc, E } = PF;

  const SLOTS = [["aerea", "Vista aérea"], ["fachada", "Fachada"], ["interior1", "Interior 1"], ["interior2", "Interior 2"]];

  /* ---------------- Pendientes ---------------- */
  PF.pendientes = function (it) {
    const im = it.imagenes || {};
    return [
      { k: "vur", t: "VUR", ok: Boolean(it.vur) },
      { k: "mapa", t: "Vista aérea", ok: Boolean(it.mapa) },
      { k: "fachada", t: "Fachada", ok: Boolean(im.fachada) },
      { k: "interiores", t: `Interiores ${[im.interior1, im.interior2].filter(Boolean).length}/2`, ok: Boolean(im.interior1 && im.interior2) },
      { k: "texto", t: it.texto ? (it.texto.origen === "ia" ? "Texto con IA" : "Texto editado") : "Texto automático", ok: true, info: !it.texto },
    ];
  };
  PF.textoDe = (it) => (it.texto && it.texto.secciones) || C.plantilla(it, E.port);

  function pintarResumen() {
    const items = E.port.items;
    $("cuentaPort").textContent = items.length;
    if (!items.length) { $("resumenPend").textContent = ""; return; }
    const falta = {};
    for (const it of items) for (const p of PF.pendientes(it)) if (!p.ok) falta[p.k] = (falta[p.k] || 0) + 1;
    const nombres = { vur: "VUR", mapa: "vista aérea", fachada: "fachada", interiores: "interiores" };
    const listos = items.filter((it) => PF.pendientes(it).every((p) => p.ok)).length;
    $("resumenPend").textContent = `${items.length} folio(s) · ${listos} completo(s)` +
      (Object.keys(falta).length ? " · faltan: " + Object.entries(falta).map(([k, n]) => `${nombres[k]} en ${n}`).join(", ") : "");
  }

  /* ---------------- Tarjetas ---------------- */
  function pintarPortafolio() {
    pintarResumen();
    const cont = $("items");
    if (!E.port.items.length) {
      cont.innerHTML = `<div class="vacio">Todavía no hay folios. Agréguelos desde <b>1. Buscar folios</b>.</div>`;
      return;
    }
    cont.innerHTML = "";
    E.port.items.forEach((it, i) => cont.appendChild(tarjeta(it, i)));
  }
  PF.pintarPortafolio = pintarPortafolio;

  function tarjeta(it, i) {
    const nodo = $("tplItem").content.firstElementChild.cloneNode(true);
    nodo.dataset.id = it.id;
    nodo.querySelector(".item-num").textContent = i + 1;
    nodo.querySelector(".item-fmi").textContent = it.fmi_texto || it.fmi;
    nodo.querySelector(".item-lugar").textContent = [C.titulo(it.campos.municipio), C.titulo(it.campos.departamento)].filter(Boolean).join(", ") +
      (it.campos.clasificacion ? " · " + C.titulo(it.campos.clasificacion) : "") + (it.campos.area_terreno ? " · " + it.campos.area_terreno : "");
    pintarPendientes(nodo, it);
    const cuerpo = nodo.querySelector(".item-cuerpo");
    cuerpo.hidden = !it.abierto;
    nodo.classList.toggle("abierto", Boolean(it.abierto));
    nodo.querySelector(".item-abrir").setAttribute("aria-expanded", String(Boolean(it.abierto)));
    if (it.abierto) llenarCuerpo(nodo, it);
    return nodo;
  }
  function pintarPendientes(nodo, it) {
    const conf = it.confirmacion;
    const sello = conf ? `<li class="p-${{ confirmado: "ok", no_coincide: "mal", revisar: "rev" }[conf.veredicto] || "gris"}" title="${esc(conf.titulo)}">FMI ${esc(IP.TEXTO_CONFIRMACION[conf.veredicto] || "")}</li>` : "";
    nodo.querySelector(".pendientes").innerHTML = sello + PF.pendientes(it).map((p) => `<li class="${p.info ? "p-gris" : p.ok ? "p-ok" : "p-falta"}">${p.ok && !p.info ? "✓" : p.info ? "•" : "✕"} ${esc(p.t)}</li>`).join("");
  }
  function llenarCuerpo(nodo, it) {
    const filas = [...IP.CAMPOS_FICHA, ["departamento", "DEPARTAMENTO"], ["municipio", "CIUDAD/MUNICIPIO"], ["barrio", "BARRIO / VEREDA"], ["enlace", "ENLACE (GOOGLE MAPS)"]];
    nodo.querySelector(".campos-ficha").innerHTML = filas.map(([k, et]) =>
      `<label class="campo-linea"><span>${esc(et)}</span><input data-campo-ficha="${k}" value="${esc(it.campos[k] || "")}"></label>`).join("");
    nodo.querySelector('[data-campo="observaciones"]').value = it.observaciones || "";
    nodo.querySelector(".vur").value = it.vur_texto || "";
    pintarVur(nodo, it);
    pintarCatastro(nodo, it);
    pintarSlots(nodo, it);
    pintarExtras(nodo, it);
    pintarTexto(nodo, it);
  }
  const nodoDe = (it) => document.querySelector(`.item[data-id="${it.id}"]`);
  const itemDe = (el) => { const art = el.closest(".item"); return art ? [art, E.port.items.find((x) => x.id === art.dataset.id)] : [null, null]; };
  function refrescar(it) {
    const art = nodoDe(it);
    if (art) art.replaceWith(tarjeta(it, E.port.items.indexOf(it)));
    pintarResumen();
  }

  function pintarVur(nodo, it) {
    const box = nodo.querySelector(".vur-res");
    const v = it.vur;
    if (!v) { box.innerHTML = `<p class="nota">Sin consulta del VUR.</p>`; return; }
    const al = IP.vur.alertas(v);
    box.innerHTML = `<dl class="mini-dl">
      <div><dt>Consulta</dt><dd>${esc(v.fecha_consulta || "")} ${esc(v.hora_consulta || "")}</dd></div>
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
    if (it._buscando) { box.innerHTML = `<p class="nota cargando">Buscando en el catastro…</p>`; return; }
    if (!c) { box.innerHTML = `<p class="nota">Usa la cédula de la base y, si ya pegó el VUR, su referencia catastral.</p>`; return; }
    const fuentes = (c.fuentes || []).map((f) => `<li class="f-${esc(f.estado)}"><b>${esc(f.fuente)}</b>: ${esc(f.estado === "ok" ? "encontrado" : f.mensaje || f.estado)}${(f.enlaces || []).slice(0, 1).map((e) => ` · <a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.texto)}</a>`).join("")}</li>`).join("");
    box.innerHTML = (c.mapa_fuente ? `<p>Polígono de <b>${esc(c.mapa_fuente)}</b>.</p>` : `<p class="mal-t">No se encontró el polígono: suba o pegue la vista aérea.</p>`) +
      (it.confirmacion ? `<p>${esc(it.confirmacion.titulo)}</p>` : "") +
      (fuentes ? `<details class="fuentes-det"><summary>Fuentes consultadas</summary><ul class="fuentes">${fuentes}</ul></details>` : "") +
      (it._errorMapa ? `<p class="mal-t">${esc(it._errorMapa)}</p>` : "");
  }

  /* ---------------- Imágenes ---------------- */
  function imagenSlot(it, k) { return k === "aerea" ? (it.mapa ? { url: it.mapa } : null) : (it.imagenes || {})[k]; }
  function pintarSlots(nodo, it) {
    nodo.querySelector(".slots").innerHTML = SLOTS.map(([k, t]) => {
      const img = imagenSlot(it, k);
      let nota = "Obligatoria";
      if (k === "aerea") nota = it.mapa ? (it.mapa_origen === "auto" ? "Generada con el polígono" : "Subida a mano") : it.catastro && !it.catastro.mapa_fuente ? "Obligatoria: no hay polígono" : "Se genera con el polígono";
      return `<div class="slot${img ? " lleno" : k === "aerea" && !(it.catastro && !it.catastro.mapa_fuente) ? "" : " falta"}" data-slot="${k}" tabindex="0" title="Haga clic y pegue con Ctrl+V, o arrastre una imagen">
        <div class="slot-img">${img ? `<img src="${img.url}" alt="${t}">` : `<span>Arrastre o pegue aquí<br><small>(Ctrl+V)</small></span>`}</div>
        <div class="slot-pie"><span><b>${t}</b><small>${img && k !== "aerea" ? "Lista" : nota}</small></span>
          <span class="slot-acc"><label class="mini boton">Elegir<input type="file" accept="image/*" data-slot-archivo="${k}" hidden></label>${img ? `<button type="button" class="mini" data-slot-quitar="${k}" aria-label="Quitar">✕</button>` : ""}</span></div>
      </div>`;
    }).join("");
  }
  function pintarExtras(nodo, it) {
    const ex = (it.imagenes || {}).extra || [];
    nodo.querySelector(".extras").innerHTML = ex.map((f, k) => `<figure class="extra"><img src="${f.url}" alt="Foto adicional ${k + 1}"><figcaption>
      <button type="button" class="mini" data-extra="izq" data-i="${k}" aria-label="Antes">←</button>
      <button type="button" class="mini" data-extra="der" data-i="${k}" aria-label="Después">→</button>
      <button type="button" class="mini" data-extra="quitar" data-i="${k}" aria-label="Quitar">✕</button></figcaption></figure>`).join("");
  }
  async function ponerImagen(it, k, archivo) {
    const r = await IP.imagenes.reducir(archivo, 1600);
    if (k === "aerea") { it.mapa = r.url; it.mapa_origen = "manual"; }
    else it.imagenes[k] = { url: r.url, w: r.w, h: r.h };
    PF.guardar();
    refrescar(it);
    const s = nodoDe(it) && nodoDe(it).querySelector(`[data-slot="${k}"]`);
    if (s) s.focus();
  }

  // Pegar con Ctrl+V en el recuadro activo
  document.addEventListener("paste", async (ev) => {
    const slot = document.activeElement && document.activeElement.closest && document.activeElement.closest(".slot");
    if (!slot) return;
    const arch = [...(ev.clipboardData || {}).items || []].find((x) => x.type.startsWith("image/"));
    if (!arch) { PF.aviso("Lo copiado no es una imagen.", "rev", 3000); return; }
    ev.preventDefault();
    const [, it] = itemDe(slot);
    if (it) await ponerImagen(it, slot.dataset.slot, arch.getAsFile());
  });
  $("items").addEventListener("dragover", (ev) => { const s = ev.target.closest(".slot"); if (s) { ev.preventDefault(); s.classList.add("encima"); } });
  $("items").addEventListener("dragleave", (ev) => { const s = ev.target.closest(".slot"); if (s) s.classList.remove("encima"); });
  $("items").addEventListener("drop", async (ev) => {
    const s = ev.target.closest(".slot");
    if (!s) return;
    ev.preventDefault();
    s.classList.remove("encima");
    const f = [...ev.dataTransfer.files].find((x) => x.type.startsWith("image/"));
    const [, it] = itemDe(s);
    if (f && it) await ponerImagen(it, s.dataset.slot, f);
  });

  /* ---------------- Texto de contexto ---------------- */
  function pintarTexto(nodo, it) {
    const sec = PF.textoDe(it);
    nodo.querySelector(".secciones-texto").innerHTML = C.SECCIONES.map(([k, t]) =>
      `<label class="campo seccion-${k}"><span class="sec-tit">${esc(t)}</span><textarea data-texto="${k}" rows="4">${esc(sec[k] || "")}</textarea></label>`).join("");
    const est = nodo.querySelector(".estado-texto");
    est.textContent = it._textoCargando ? "Redactando con IA…" : !it.texto ? "Automático: se actualiza con los datos del predio." : it.texto.origen === "ia" ? `Mejorado con IA (${it.texto.fecha}). Puede editarlo.` : `Editado a mano (${it.texto.fecha}).`;
    ajustarTextos(nodo);
  }
  function autoAlto(t) {
    if (!t.isConnected) return;
    t.style.height = "auto";
    if (t.scrollHeight) t.style.height = Math.min(420, t.scrollHeight + 4) + "px";
  }
  const ajustarTextos = (nodo) => requestAnimationFrame(() => nodo.querySelectorAll(".secciones-texto textarea").forEach(autoAlto));
  async function textoIA(it) {
    if (!PF.asegurarGroq()) return;
    it._textoCargando = true;
    const n = nodoDe(it); if (n && it.abierto) pintarTexto(n, it);
    try {
      const sec = await C.mejorarConIA(it, E.port);
      it.texto = { secciones: sec, origen: "ia", fecha: U.ahora() };
    } catch (e) { PF.aviso(`Folio ${it.fmi_texto}: ${e.message}`, "mal", 9000); }
    it._textoCargando = false;
    PF.guardar();
    refrescar(it);
  }

  /* ---------------- VUR y catastro ---------------- */
  async function leerVur(art, it) {
    const texto = art.querySelector(".vur").value;
    const box = art.querySelector(".vur-res");
    const consultas = IP.vur.leerTexto(texto);
    if (!consultas.length) { box.innerHTML = `<p class="mal-t">No reconocí una consulta “Datos Básicos” del VUR en el texto.</p>`; return false; }
    const v = consultas.find((c) => c.matricula_normalizada === it.fmi) || consultas[0];
    if (v.matricula_normalizada !== it.fmi) {
      box.innerHTML = `<p class="mal-t">La consulta pegada es del folio ${esc(v.matricula)}, no del ${esc(it.fmi_texto || it.fmi)}. No se guardó.</p>`;
      return false;
    }
    it.vur = v; it.vur_texto = texto;
    if (/RURAL/i.test(it.campos.clase) && U.limpiar(v.vereda) && (!U.limpiar(it.campos.barrio) || it.campos.barrio === "-")) it.campos.barrio = v.vereda;
    PF.guardar();
    return true;
  }

  async function buscarPoligono(it) {
    it._buscando = true; it._errorMapa = "";
    refrescar(it);
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
      PF.guardar();
      refrescar(it);
    }
  }

  /* ---------------- Eventos ---------------- */
  $("items").addEventListener("input", (ev) => {
    const [art, it] = itemDe(ev.target);
    if (!it) return;
    const k = ev.target.dataset.campoFicha;
    if (k) { it.campos[k] = ev.target.value; if (k === "enlace") it.enlace_auto = false; PF.guardar(); return; }
    if (ev.target.dataset.campo === "observaciones") { it.observaciones = ev.target.value; PF.guardar(); return; }
    const t = ev.target.dataset.texto;
    if (t) {
      if (!it.texto) it.texto = { secciones: { ...C.plantilla(it, E.port) }, origen: "editado", fecha: U.ahora() };
      it.texto.secciones[t] = ev.target.value;
      if (it.texto.origen !== "ia") it.texto.origen = "editado";
      it.texto.fecha = U.ahora();
      autoAlto(ev.target);
      art.querySelector(".estado-texto").textContent = it.texto.origen === "ia" ? `Mejorado con IA y editado (${it.texto.fecha}).` : `Editado a mano (${it.texto.fecha}).`;
      PF.guardar();
    }
  });
  $("items").addEventListener("change", async (ev) => {
    const [art, it] = itemDe(ev.target);
    if (!it) return;
    const k = ev.target.dataset.slotArchivo;
    if (k && ev.target.files[0]) { await ponerImagen(it, k, ev.target.files[0]); return; }
    if (ev.target.dataset.acc === "extras") {
      for (const f of ev.target.files) {
        try { const r = await IP.imagenes.reducir(f, 1600); it.imagenes.extra.push({ url: r.url, w: r.w, h: r.h }); }
        catch (e) { PF.aviso("No se pudo leer " + f.name, "mal", 4000); }
      }
      PF.guardar(); pintarExtras(art, it);
    }
  });
  $("items").addEventListener("click", async (ev) => {
    const [art, it] = itemDe(ev.target);
    if (!it) return;
    const b = ev.target.closest("[data-acc], [data-slot-quitar], [data-extra]");
    const slot = ev.target.closest(".slot");
    if (slot && !b && !ev.target.closest("label")) slot.focus();
    if (!b) return;
    const acc = b.dataset.acc;
    const idx = E.port.items.indexOf(it);
    if (acc === "abrir") { it.abierto = !it.abierto; PF.guardar(); refrescar(it); return; }
    if (acc === "quitar") { if (confirm(`¿Quitar el folio ${it.fmi_texto || it.fmi} del portafolio?`)) { E.port.items.splice(idx, 1); PF.guardar(); pintarPortafolio(); PF.pintarTabla(); } return; }
    if (acc === "subir" && idx > 0) { E.port.items.splice(idx - 1, 0, E.port.items.splice(idx, 1)[0]); PF.guardar(); pintarPortafolio(); return; }
    if (acc === "bajar" && idx < E.port.items.length - 1) { E.port.items.splice(idx + 1, 0, E.port.items.splice(idx, 1)[0]); PF.guardar(); pintarPortafolio(); return; }
    if (acc === "leerVur") { b.disabled = true; if (await leerVur(art, it)) await buscarPoligono(it); else b.disabled = false; return; }
    if (acc === "poligono") { b.disabled = true; await buscarPoligono(it); return; }
    if (acc === "textoPlantilla") {
      if (it.texto && !confirm("Se reemplaza el texto actual por el de la plantilla (automático). ¿Continuar?")) return;
      it.texto = null; PF.guardar(); refrescar(it); return;
    }
    if (acc === "textoIA") { await textoIA(it); return; }
    const q = b.dataset.slotQuitar;
    if (q) {
      if (q === "aerea") { it.mapa = ""; it.mapa_origen = ""; } else it.imagenes[q] = null;
      PF.guardar(); refrescar(it); return;
    }
    const ex = b.dataset.extra;
    if (ex) {
      const lista = it.imagenes.extra, i = Number(b.dataset.i);
      if (ex === "quitar") lista.splice(i, 1);
      if (ex === "izq" && i > 0) lista.splice(i - 1, 0, lista.splice(i, 1)[0]);
      if (ex === "der" && i < lista.length - 1) lista.splice(i + 1, 0, lista.splice(i, 1)[0]);
      PF.guardar(); pintarExtras(art, it);
    }
  });

  $("buscarTodos").addEventListener("click", async () => {
    const b = $("buscarTodos");
    const pend = E.port.items.filter((it) => !it.mapa);
    if (!pend.length) { PF.aviso("Todos los folios ya tienen vista aérea.", "ok", 3000); return; }
    b.disabled = true;
    for (let k = 0; k < pend.length; k++) { b.textContent = `Buscando ${k + 1} de ${pend.length}…`; await buscarPoligono(pend[k]); }
    b.textContent = "Buscar polígonos de todos"; b.disabled = false;
  });
  $("textosTodos").addEventListener("click", async () => {
    if (!PF.asegurarGroq()) return;
    const pend = E.port.items.filter((it) => !it.texto || it.texto.origen !== "editado");
    if (!pend.length) return;
    const b = $("textosTodos");
    b.disabled = true;
    for (let k = 0; k < pend.length; k++) { b.textContent = `Redactando ${k + 1} de ${pend.length}…`; await textoIA(pend[k]); await PF.pausa(800); }
    b.textContent = "✦ Mejorar textos de todos con IA"; b.disabled = false;
  });
  $("exportarAvance").addEventListener("click", () => PF.exportar());
  $("importarAvance").addEventListener("change", async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    try { await PF.importar(f); pintarPortafolio(); PF.pintarTabla(); PF.aviso("Avance importado.", "ok", 4000); }
    catch (e) { PF.aviso(e.message, "mal", 6000); }
  });
  $("vaciarPort").addEventListener("click", () => {
    if (!confirm("¿Vaciar el portafolio? Se borran los folios, el VUR pegado, los mapas y las fotos guardados en este navegador.\n\nSi quiere conservarlo, primero use “Exportar avance”.")) return;
    E.port = PF.vacioPort();
    PF.guardarAhora(); pintarPortafolio(); PF.pintarTabla();
    PF.alCambiarPort.forEach((fn) => fn());
  });

  PF.alCambiarPort.push(pintarResumen);
  PF.alAbrirPortafolio = pintarPortafolio;
})();
