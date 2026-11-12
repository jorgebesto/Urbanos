/* Vista 3: documentos. Datos del solicitante, conclusiones, pendientes, descargas y vista previa. */
(function () {
  const IP = window.IP, PF = window.PF;
  const U = IP.util, C = IP.contexto;
  const { $, esc, E } = PF;
  let sucio = true, cacheModelo = null, cacheSlides = null, previa = "informe";

  /* ---------------- Solicitante ---------------- */
  function pintarSolicitante() {
    $("solicitante").value = E.port.solicitante || "";
    $("tipoSolicitante").value = E.port.tipo || "";
    $("tipoSolicitante").placeholder = IP.PORTAFOLIO.presentacion.tipo_por_defecto;
    $("radicado").value = E.port.radicado || "";
    $("textoSolicitud").value = E.port.solicitud || "";
    $("conclusiones").value = E.port.conclusiones || "";
    $("conclusiones").placeholder = E.port.items.length ? C.conclusionesPlantilla(E.port) : "Agregue folios al portafolio.";
    $("estadoConc").textContent = E.port.conclusiones ? "" : "Si la deja vacía, el informe usa el texto de la plantilla (gris).";
    $("logoPrevia").innerHTML = E.port.logo ? `<img src="${E.port.logo}" alt="Logo del solicitante"><button type="button" class="mini" id="quitarLogo">Quitar logo</button>` : "";
  }
  PF.pintarSolicitante = pintarSolicitante;
  const campo = (id, k) => $(id).addEventListener("input", (e) => { E.port[k] = e.target.value; PF.guardar(); });
  campo("solicitante", "solicitante"); campo("tipoSolicitante", "tipo"); campo("radicado", "radicado"); campo("textoSolicitud", "solicitud");
  $("conclusiones").addEventListener("input", (e) => { E.port.conclusiones = e.target.value; $("estadoConc").textContent = "Editado a mano."; PF.guardar(); });
  $("logoSolicitante").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    E.port.logo = (await IP.imagenes.reducir(f, 800)).url;
    e.target.value = "";
    PF.guardar(); pintarSolicitante();
  });
  $("logoPrevia").addEventListener("click", (e) => { if (e.target.id === "quitarLogo") { E.port.logo = ""; PF.guardar(); pintarSolicitante(); } });
  $("concPlantilla").addEventListener("click", () => {
    if (!E.port.items.length) return;
    E.port.conclusiones = C.conclusionesPlantilla(E.port);
    $("conclusiones").value = E.port.conclusiones;
    $("estadoConc").textContent = "Generado con la plantilla. Puede editarlo.";
    PF.guardar();
  });
  $("concIA").addEventListener("click", async () => {
    if (!E.port.items.length || !PF.asegurarGroq()) return;
    const b = $("concIA");
    b.disabled = true; $("estadoConc").textContent = "Redactando con IA…";
    try {
      E.port.conclusiones = await C.conclusionesConIA(E.port);
      $("conclusiones").value = E.port.conclusiones;
      $("estadoConc").textContent = "Mejorado con IA. Puede editarlo.";
      PF.guardar();
    } catch (e) { $("estadoConc").textContent = e.message; }
    b.disabled = false;
  });

  /* ---------------- Pendientes ---------------- */
  function pintarPendientes() {
    const items = E.port.items;
    if (!items.length) { $("pendDocs").innerHTML = `<p class="nota">Agregue folios al portafolio.</p>`; return; }
    const faltas = [];
    if (!U.limpiar(E.port.solicitante)) faltas.push("Falta el nombre del solicitante");
    for (const it of items) {
      const f = PF.pendientes(it).filter((p) => !p.ok).map((p) => p.t.replace(/ \d\/2$/, ""));
      if (f.length) faltas.push(`${it.fmi_texto || it.fmi}: falta ${f.join(", ").toLowerCase()}`);
    }
    $("pendDocs").innerHTML = faltas.length
      ? `<p class="pend-tit">Pendiente (se puede generar igual):</p><ul>${faltas.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
      : `<p class="pend-ok">✓ Todo listo: ${items.length} folio(s) completos.</p>`;
  }

  /* ---------------- Vista previa ---------------- */
  async function modelo() {
    if (!sucio && cacheModelo) return cacheModelo;
    cacheModelo = await IP.modeloInforme(E.port);
    cacheSlides = null;
    sucio = false;
    return cacheModelo;
  }
  async function slides() {
    if (!sucio && cacheSlides) return cacheSlides;
    if (sucio) { sucio = false; cacheModelo = null; }
    cacheSlides = await IP.modeloDiapositivas(E.port);
    return cacheSlides;
  }
  async function pintarPrevia() {
    const items = E.port.items;
    $("previaInforme").hidden = previa !== "informe";
    $("previaPresentacion").hidden = previa !== "presentacion";
    if (!items.length) {
      $("previaInforme").innerHTML = $("previaPresentacion").innerHTML = `<div class="vacio">Agregue folios al portafolio para ver la vista previa.</div>`;
      return;
    }
    const caja = previa === "informe" ? $("previaInforme") : $("previaPresentacion");
    caja.innerHTML = `<div class="vacio cargando">Preparando la vista previa…</div>`;
    try {
      if (previa === "informe") {
        const html = IP.informeHtml(await modelo(), await IP.imagenesInforme());
        const f = document.createElement("iframe");
        f.className = "marco-informe";
        f.title = "Vista previa del informe";
        f.onload = () => { try { f.style.height = f.contentDocument.documentElement.scrollHeight + 20 + "px"; } catch (e) { /* nada */ } };
        f.srcdoc = html;
        caja.innerHTML = "";
        caja.appendChild(f);
      } else {
        caja.innerHTML = IP.diapositivasHtml(await slides());
        escalar();
      }
    } catch (e) { caja.innerHTML = `<div class="vacio">No se pudo armar la vista previa: ${esc(e.message)}</div>`; console.error(e); }
  }
  function escalar() {
    document.querySelectorAll(".pv-marco").forEach((m) => m.style.setProperty("--k", m.clientWidth / 960));
  }
  window.addEventListener("resize", PF.rebote(escalar, 100));
  document.querySelectorAll("[data-previa]").forEach((b) => b.addEventListener("click", () => {
    previa = b.dataset.previa;
    document.querySelectorAll("[data-previa]").forEach((x) => x.classList.toggle("activa", x === b));
    pintarPrevia();
  }));
  $("actualizarPrevia").addEventListener("click", () => { sucio = true; pintarPrevia(); });

  /* ---------------- Descargas ---------------- */
  const nombreBase = () => `${PF.nombreArchivo(E.port.solicitante) || "SAE"}_${U.ahora().slice(0, 10)}`;
  async function generar(boton, texto, fn) {
    if (!E.port.items.length) { $("estadoGen").textContent = "Agregue folios al portafolio primero."; return; }
    boton.disabled = true;
    $("estadoGen").textContent = texto;
    try { await fn(); $("estadoGen").textContent = "Listo."; }
    catch (e) { $("estadoGen").textContent = "Error: " + e.message; console.error(e); }
    boton.disabled = false;
  }
  $("genPptx").addEventListener("click", () => generar($("genPptx"), "Generando la presentación…", async () => {
    PF.descargar(await IP.generarPresentacion(E.port, await slides()), `Portafolio_${nombreBase()}.pptx`);
  }));
  $("genDocx").addEventListener("click", () => generar($("genDocx"), "Generando el informe en Word…", async () => {
    PF.descargar(await IP.generarInforme(E.port, await modelo()), `Informe_folios_${nombreBase()}.docx`);
  }));
  $("genPdf").addEventListener("click", () => generar($("genPdf"), "Abriendo la impresión: elija “Guardar como PDF”…", async () => {
    await IP.imprimirInforme(IP.informeHtml(await modelo(), await IP.imagenesInforme()));
  }));

  PF.alCambiarPort.push(() => { sucio = true; if (PF.vistaActual === "documentos") pintarPendientes(); });
  PF.alAbrirDocumentos = () => { pintarSolicitante(); pintarPendientes(); pintarPrevia(); };
})();
