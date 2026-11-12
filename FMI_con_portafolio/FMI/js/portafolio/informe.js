/* Informe Word sencillo de los folios del portafolio (librería docx). */
(function (g) {
  const IP = (g.IP = g.IP || {});
  const U = IP.util;

  IP.generarInforme = async function (port, extra = {}) {
    const D = g.docx;
    if (!D) throw new Error("No se cargó la librería de Word (js/lib/docx.iife.js).");
    const I = IP.imagenes;
    const AZUL = IP.PORTAFOLIO.presentacion.azul;
    const F = "Arial";

    const p = (texto, op = {}) => new D.Paragraph({ spacing: { after: 80 }, ...op, children: [new D.TextRun({ text: String(texto ?? ""), font: F, size: 20, ...(op.run || {}) })] });
    const etiquetaValor = (et, v) => new D.Paragraph({ spacing: { after: 40 }, children: [
      new D.TextRun({ text: et + ": ", bold: true, font: F, size: 20 }), new D.TextRun({ text: String(v ?? "") || "-", font: F, size: 20 })] });
    const titulo = (t, nivel = D.HeadingLevel.HEADING_2) => new D.Paragraph({ heading: nivel, spacing: { before: 240, after: 100 },
      children: [new D.TextRun({ text: t, font: F, bold: true, color: AZUL, size: nivel === D.HeadingLevel.HEADING_1 ? 32 : 24 })] });
    const borde = { style: D.BorderStyle.SINGLE, size: 4, color: "999999" };
    const bordes = { top: borde, bottom: borde, left: borde, right: borde, insideHorizontal: borde, insideVertical: borde };
    const sinBordes = Object.fromEntries(Object.keys(bordes).map((k) => [k, { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" }]));
    const celda = (texto, op = {}) => new D.TableCell({
      shading: op.cabecera ? { fill: AZUL, type: D.ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      width: op.ancho ? { size: op.ancho, type: D.WidthType.PERCENTAGE } : undefined,
      children: [new D.Paragraph({ children: [new D.TextRun({ text: String(texto ?? ""), font: F, size: op.tam || 18, bold: Boolean(op.cabecera || op.negrita), color: op.cabecera ? "FFFFFF" : undefined })] })],
    });
    const tabla = (cabecera, filas, anchos) => new D.Table({
      width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: bordes,
      rows: [
        ...(cabecera ? [new D.TableRow({ tableHeader: true, children: cabecera.map((c, i) => celda(c, { cabecera: true, ancho: anchos && anchos[i] })) })] : []),
        ...filas.map((f) => new D.TableRow({ children: f.map((c, i) => celda(c, { ancho: anchos && anchos[i], negrita: !cabecera && i === 0 })) })),
      ],
    });
    async function imagen(url, anchoMax, altoMax) {
      const m = await I.medidas(url);
      const f = Math.min(anchoMax / m.w, altoMax / m.h);
      return new D.ImageRun({ type: I.tipo(url), data: I.bytes(url), transformation: { width: Math.round(m.w * f), height: Math.round(m.h * f) } });
    }
    async function fotosEnTabla(lista) {
      const filas = [];
      for (let i = 0; i < lista.length; i += 2) {
        const par = lista.slice(i, i + 2);
        const celdas = [];
        for (const f of par) celdas.push(new D.TableCell({ width: { size: 50, type: D.WidthType.PERCENTAGE }, children: [
          new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [await imagen(f.url, 300, 260)] }),
          new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 120 }, children: [new D.TextRun({ text: f.pie || "", font: F, size: 16, italics: true })] }),
        ] }));
        if (celdas.length === 1) celdas.push(new D.TableCell({ width: { size: 50, type: D.WidthType.PERCENTAGE }, children: [new D.Paragraph("")] }));
        filas.push(new D.TableRow({ children: celdas }));
      }
      return new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: sinBordes, rows: filas });
    }

    const hijos = [];
    hijos.push(titulo("Informe de folios para portafolio", D.HeadingLevel.HEADING_1));
    hijos.push(etiquetaValor("Solicitante", [port.solicitante, port.tipo].filter(Boolean).join(" – ")));
    hijos.push(etiquetaValor("Fecha", U.ahora().slice(0, 10)));
    if (U.limpiar(port.solicitud)) hijos.push(etiquetaValor("Solicitud", port.solicitud));
    if (extra.base) hijos.push(etiquetaValor("Base consultada", `${extra.base.archivo || "base"} (${extra.base.generado || ""}, ${U.formatoNumero(extra.base.n, 0)} registros)`));
    if ((port.filtros || []).length) {
      hijos.push(p("Filtros aplicados:", { run: { bold: true } }));
      for (const f of port.filtros) hijos.push(new D.Paragraph({ bullet: { level: 0 }, children: [new D.TextRun({ text: f, font: F, size: 20 })] }));
    }
    if (extra.totalFiltrados != null) hijos.push(etiquetaValor("Folios que cumplían los filtros", U.formatoNumero(extra.totalFiltrados, 0)));
    hijos.push(etiquetaValor("Folios seleccionados para el portafolio", port.items.length));

    hijos.push(titulo("Resumen"));
    hijos.push(tabla(["No.", "FMI", "Municipio", "Clasificación", "Área terreno", "Estado legal", "Ocupación", "FMI vs. cédula"],
      port.items.map((it, i) => [i + 1, it.fmi_texto || it.fmi, [it.campos.municipio, it.campos.departamento].filter(Boolean).join(" – "), it.campos.clasificacion,
        it.campos.area_terreno, it.campos.estado_legal, it.campos.ocupacion, it.confirmacion ? IP.TEXTO_CONFIRMACION[it.confirmacion.veredicto] || "" : "Sin revisar"]),
      [5, 12, 18, 14, 12, 14, 11, 14]));

    let n = 0;
    for (const it of port.items) {
      n++;
      const c = it.campos || {};
      hijos.push(new D.Paragraph({ pageBreakBefore: true, children: [] }));
      hijos.push(titulo(`${n}. Folio ${it.fmi_texto || it.fmi} – ${[c.municipio, c.departamento].filter(Boolean).join(", ")}`));

      hijos.push(p("Datos de la base", { run: { bold: true } }));
      const filasBase = IP.CAMPOS_FICHA.map(([k, et]) => [et, U.limpiar(c[k]) || "-"]);
      const fb = it.fila_base || {};
      const busca = (...nombres) => { for (const n0 of nombres) for (const [k, v] of Object.entries(fb)) if (U.normalizar(k) === n0 && U.limpiar(v)) return v; return ""; };
      filasBase.push(["CÉDULA CATASTRAL", busca("CEDULA CATASTRAL") || "-"]);
      filasBase.push(["ESTADO COMERCIAL", busca("ESTADO COMERCIAL") || "-"]);
      filasBase.push(["IDACTIVO", busca("IDACTIVO") || "-"]);
      hijos.push(tabla(null, filasBase, [35, 65]));

      const v = it.vur;
      hijos.push(p(""));
      if (v) {
        hijos.push(p(`Consulta del VUR${v.fecha_consulta ? " del " + v.fecha_consulta : ""}${v.no_consulta ? " (No. " + v.no_consulta + ")" : ""}`, { run: { bold: true } }));
        hijos.push(tabla(null, [
          ["Referencia catastral", v.referencia_catastral || "-"],
          ["Referencia catastral anterior", v.referencia_catastral_anterior || "-"],
          ["NUPRE", v.nupre || "-"],
          ["Estado del folio", v.estado_folio || "-"],
          ["Tipo de predio", v.tipo_predio || "-"],
          ["Dirección", v.direccion || "-"],
          ["Vereda", v.vereda || "-"],
          ["Propietarios", v.propietarios_texto || "-"],
          ["Cabida (área)", v.area_cabida_texto || (v.area_terreno_m2 ? U.formatoArea(v.area_terreno_m2) : "-")],
          ["Salvedades", String((v.salvedades || []).length)],
        ], [35, 65]));
        if (U.limpiar(v.cabida_linderos)) { hijos.push(p("Cabida y linderos:", { run: { bold: true } })); hijos.push(p(v.cabida_linderos, { run: { size: 18 } })); }
        const al = IP.vur.alertas(v);
        if (al.length) { hijos.push(p("Alertas:", { run: { bold: true } })); al.forEach((a) => hijos.push(new D.Paragraph({ bullet: { level: 0 }, children: [new D.TextRun({ text: a, font: F, size: 20 })] }))); }
      } else hijos.push(p("Sin consulta del VUR para este folio.", { run: { italics: true } }));

      hijos.push(p(""));
      hijos.push(p("Catastro y georreferenciación", { run: { bold: true } }));
      const cat = it.catastro;
      if (cat) {
        hijos.push(etiquetaValor("Polígono tomado de", cat.mapa_fuente || "No se encontró polígono"));
        if (cat.gestor) hijos.push(etiquetaValor("Gestor catastral", cat.gestor));
        if ((cat.datos || {}).numero_predial) hijos.push(etiquetaValor("Número predial (catastro)", cat.datos.numero_predial));
        if ((cat.datos || {}).area_terreno_m2) hijos.push(etiquetaValor("Área de terreno (catastro)", U.formatoArea(cat.datos.area_terreno_m2)));
      } else hijos.push(p("No se consultó el catastro.", { run: { italics: true } }));
      if (U.limpiar(c.enlace)) hijos.push(etiquetaValor("Ubicación", c.enlace));
      if (it.confirmacion) hijos.push(etiquetaValor("FMI vs. cédula catastral", it.confirmacion.titulo));

      const filasC = (it.contraste || []).filter((f) => f.excel || f.vur || f.catastro);
      if (filasC.length) {
        hijos.push(p(""));
        hijos.push(p("Contraste base / VUR / catastro", { run: { bold: true } }));
        const est = (IP.textos && IP.textos.ESTADO) || {};
        hijos.push(tabla(["Campo", "Base", "VUR", "Catastro", "Resultado"],
          filasC.map((f) => [f.campo, f.excel || "-", f.vur || "-", f.catastro || "-", (est[f.estado] || f.estado || "") + (f.nota ? " (" + f.nota + ")" : "")]),
          [20, 20, 20, 20, 20]));
      }

      const imgs = [];
      if (it.mapa) imgs.push({ url: it.mapa, pie: "Imagen satelital con el polígono" });
      const fotos = it.fotos || [];
      const fach = fotos.find((f) => f.id === it.fachada) || fotos[0];
      if (fach) imgs.push({ url: fach.url, pie: "Fachada" });
      fotos.filter((f) => f !== fach).forEach((f, i) => imgs.push({ url: f.url, pie: "Foto " + (i + 1) }));
      if (imgs.length) {
        hijos.push(p(""));
        hijos.push(p("Imágenes", { run: { bold: true } }));
        hijos.push(await fotosEnTabla(imgs));
      }
      if (U.limpiar(it.observaciones)) { hijos.push(p("")); hijos.push(etiquetaValor("Observaciones", it.observaciones)); }
    }

    const doc = new D.Document({
      creator: "SAE – Portafolio", title: "Informe de folios",
      styles: { default: { document: { run: { font: F, size: 20 } } } },
      sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: hijos }],
    });
    return await D.Packer.toBlob(doc);
  };
})(typeof window !== "undefined" ? window : globalThis);
