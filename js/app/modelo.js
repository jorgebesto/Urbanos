/* Contenido del informe (un solo modelo para el Word, la vista previa y el PDF). */
(function (g) {
  const IP = (g.IP = g.IP || {});
  const U = IP.util;
  const C = () => IP.contexto;

  const lista = (xs) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);

  IP.modeloInforme = async function (port, opciones = {}) {
    const items = port.items || [];
    const bi = port.base_info || {};
    const fecha = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
    const sol = U.limpiar(port.solicitante);

    // Objeto y alcance
    const objeto = [];
    objeto.push(`El presente informe se elabora para atender la solicitud${sol ? ` de ${sol}${U.limpiar(port.tipo) ? ` (${port.tipo})` : ""}` : ""}${U.limpiar(port.radicado) ? `, radicada con el número ${port.radicado}` : ""}` +
      (U.limpiar(port.solicitud) ? `, en la que se pide: “${port.solicitud.trim().replace(/[.\s]+$/, "")}”.` : "."));
    objeto.push(`Presenta ${items.length} folio${items.length === 1 ? "" : "s"} de matrícula inmobiliaria de activos administrados por la Sociedad de Activos Especiales (SAE) que cumplen los criterios de la solicitud, con su contextualización física, jurídica, catastral y administrativa, un concepto técnico por predio y el registro fotográfico.`);
    const metodo = `Los folios se seleccionaron de la base de inmuebles de la SAE${bi.archivo ? ` (${bi.archivo}${bi.generado ? ", " + bi.generado.slice(0, 10) : ""})` : ""}. Para cada folio se consultó la Ventanilla Única de Registro (VUR) de la Superintendencia de Notariado y Registro, se ubicó el predio en los servicios catastrales del IGAC y de los gestores catastrales, y se cotejó la matrícula inmobiliaria con la cédula catastral.`;
    const cifras = [];
    if (bi.n) cifras.push([U.formatoNumero(bi.n, 0), "registros en la base"]);
    if (bi.todas_reglas != null) cifras.push([U.formatoNumero(bi.todas_reglas, 0), "cumplen las reglas base"]);
    if (port.total_filtrados != null) cifras.push([U.formatoNumero(port.total_filtrados, 0), "cumplen la solicitud"]);
    cifras.push([String(items.length), "seleccionados"]);

    // Mapa general
    let mapaGeneral = null, mapaNota = "";
    const conCoord = items.map((it, i) => ({ lat: it.catastro && it.catastro.lat, lon: it.catastro && it.catastro.lon, etiqueta: i + 1 })).filter((p) => Number.isFinite(p.lat));
    if (opciones.mapa !== false && conCoord.length) {
      try { mapaGeneral = await IP.mapaImagen.generarGeneral(conCoord); } catch (e) { mapaNota = e.message; }
    }
    if (conCoord.length < items.length) mapaNota = `${items.length - conCoord.length} folio(s) sin coordenadas no aparecen en el mapa.`;

    // Resumen
    const resumen = items.map((it, i) => [String(i + 1), it.fmi_texto || it.fmi, `${C().titulo(it.campos.municipio)} (${C().titulo(it.campos.departamento)})`,
      C().titulo(it.campos.clasificacion), it.campos.area_terreno || "-", it.campos.ocupacion || "-",
      it.confirmacion ? IP.TEXTO_CONFIRMACION[it.confirmacion.veredicto] : "Sin consultar"]);

    // Predios
    const predios = [];
    for (const [i, it] of items.entries()) {
      const c = it.campos, v = it.vur, im = it.imagenes || {};
      const sec = (it.texto && it.texto.secciones) || C().plantilla(it, port);
      const datos = IP.CAMPOS_FICHA.map(([k, e]) => [e.charAt(0) + e.slice(1).toLowerCase(), U.limpiar(c[k]) || "-"]);
      datos.splice(1, 0, ["Departamento / municipio", `${C().titulo(c.departamento)} / ${C().titulo(c.municipio)}`], ["Barrio / vereda", U.limpiar(c.barrio) || "-"]);
      datos.push(["Cédula catastral (base)", g.PF ? g.PF.deBase(it, "CEDULA CATASTRAL") || "-" : "-"]);
      const vurFilas = v ? [
        ["Fecha de consulta", `${v.fecha_consulta || ""}${v.no_consulta ? " · consulta No. " + v.no_consulta : ""}`],
        ["Estado del folio", v.estado_folio || "-"], ["Fecha de apertura", v.fecha_apertura || "-"],
        ["Referencia catastral", v.referencia_catastral || "-"], ["Referencia anterior", v.referencia_catastral_anterior || "-"],
        ["NUPRE", v.nupre || "-"], ["Propietario(s)", v.propietarios_texto || "-"], ["Cabida", v.area_cabida_texto || "-"],
        ["Salvedades", String((v.salvedades || []).length)], ["Alertas", IP.vur.alertas(v).join("; ") || "Ninguna"],
      ] : null;
      const est = (IP.textos && IP.textos.ESTADO) || {};
      const contraste = (it.contraste || []).filter((f) => f.excel || f.vur || f.catastro)
        .map((f) => [f.campo, f.excel || "-", f.vur || "-", f.catastro || "-", (est[f.estado] || "") + (f.nota ? ` (${f.nota})` : "")]);
      const fotos = [];
      if (it.mapa) fotos.push({ url: it.mapa, pie: it.mapa_origen === "auto" ? `Vista aérea con el polígono del predio (${(it.catastro || {}).mapa_fuente || "catastro"}).` : "Vista aérea del predio." });
      if (im.fachada) fotos.push({ url: im.fachada.url, pie: "Fachada." });
      if (im.interior1) fotos.push({ url: im.interior1.url, pie: "Interior." });
      if (im.interior2) fotos.push({ url: im.interior2.url, pie: "Interior." });
      (im.extra || []).forEach((f) => fotos.push({ url: f.url, pie: "Registro fotográfico de la visita." }));
      const fuentes = [];
      if (v) fuentes.push({ texto: `VUR – consulta Datos Básicos del ${v.fecha_consulta || ""}${v.no_consulta ? " (No. " + v.no_consulta + ")" : ""}`, url: (IP.CONFIG.enlaces || {}).vur || "" });
      for (const f of (it.catastro && it.catastro.fuentes) || []) if (f.estado === "ok") for (const e of (f.enlaces || []).slice(0, 1)) fuentes.push({ texto: `${f.fuente} – ${e.texto}`, url: e.url });
      if (U.limpiar(c.enlace)) fuentes.push({ texto: "Ubicación en Google Maps", url: c.enlace });
      fuentes.push({ texto: `Base de inmuebles de la SAE${bi.generado ? " (" + bi.generado.slice(0, 10) + ")" : ""}`, url: "" });
      predios.push({
        n: i + 1, fmi: it.fmi_texto || it.fmi,
        lugar: `${C().titulo(c.municipio)}, ${C().titulo(c.departamento)}`,
        subtitulo: [C().titulo(c.clasificacion), /RURAL/i.test(c.clase) ? "Rural" : /URBAN/i.test(c.clase) ? "Urbano" : "", c.area_terreno].filter(Boolean).join(" · "),
        sello: it.confirmacion ? IP.TEXTO_CONFIRMACION[it.confirmacion.veredicto] : "",
        hero: im.fachada ? im.fachada.url : it.mapa || "",
        secciones: C().SECCIONES.filter(([k]) => k !== "concepto").map(([k, t]) => [t, sec[k] || ""]),
        concepto: sec.concepto || "",
        observaciones: U.limpiar(it.observaciones),
        datos, vur: vurFilas, contraste, fotos, fuentes,
      });
    }

    const conclusiones = (U.limpiar(port.conclusiones) || C().conclusionesPlantilla(port)).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    return {
      titulo: "Informe técnico de folios para portafolio", fecha, solicitante: sol, tipo: U.limpiar(port.tipo), radicado: U.limpiar(port.radicado),
      solicitud: U.limpiar(port.solicitud), objeto, metodo, criterios: port.filtros || [], cifras, mapaGeneral, mapaNota,
      resumenCab: ["No.", "Folio", "Municipio", "Clasificación", "Área de terreno", "Ocupación", "FMI vs. cédula"], resumen,
      predios, conclusiones, logo: port.logo || "",
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
