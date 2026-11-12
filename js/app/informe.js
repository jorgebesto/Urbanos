/* Informe Word (librería docx) a partir del modelo de js/portafolio/modelo.js. */
(function (g) {
  const IP = (g.IP = g.IP || {});

  IP.generarInforme = async function (port, modelo) {
    const D = g.docx;
    if (!D) throw new Error("No se cargó la librería de Word (js/lib/docx.iife.js).");
    const M = modelo || await IP.modeloInforme(port);
    const I = IP.imagenes;
    const AZUL = IP.PORTAFOLIO.presentacion.azul, GRIS = "5F6B78", CLARO = "EEF3FA";
    const F = "Arial";
    const AL = D.AlignmentType;

    const run = (text, o = {}) => new D.TextRun({ text: String(text ?? ""), font: F, size: 21, ...o });
    const par = (texto, o = {}) => new D.Paragraph({ spacing: { after: 120, line: 300 }, alignment: AL.JUSTIFIED, ...o, children: [run(texto, o.run)] });
    const h1 = (t) => new D.Paragraph({ spacing: { before: 360, after: 160 }, keepNext: true, border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: AZUL, space: 4 } },
      children: [run(t, { bold: true, size: 30, color: AZUL })] });
    const h2 = (t) => new D.Paragraph({ spacing: { before: 240, after: 100 }, keepNext: true, children: [run(t, { bold: true, size: 24, color: AZUL })] });
    const h3 = (t) => new D.Paragraph({ spacing: { before: 200, after: 60 }, keepNext: true, children: [run(t.toUpperCase(), { bold: true, size: 18, color: GRIS, characterSpacing: 20 })] });
    const vineta = (t) => new D.Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [run(t)] });
    const leyenda = (t) => new D.Paragraph({ alignment: AL.CENTER, spacing: { after: 200 }, children: [run(t, { italics: true, size: 17, color: GRIS })] });
    const borde = { style: D.BorderStyle.SINGLE, size: 4, color: "BFC7D1" };
    const bordes = { top: borde, bottom: borde, left: borde, right: borde, insideHorizontal: borde, insideVertical: borde };
    const nada = { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const sinBordes = { top: nada, bottom: nada, left: nada, right: nada, insideHorizontal: nada, insideVertical: nada };
    const celda = (texto, o = {}) => new D.TableCell({
      shading: o.fondo ? { fill: o.fondo, type: D.ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      width: o.ancho ? { size: o.ancho, type: D.WidthType.PERCENTAGE } : undefined,
      verticalAlign: D.VerticalAlign.CENTER, columnSpan: o.span,
      children: [new D.Paragraph({ alignment: o.alinear || AL.LEFT, children: [run(texto, { size: o.tam || 18, bold: o.negrita, color: o.color })] })],
    });
    const tablaDatos = (filas, anchos = [34, 66]) => new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: bordes,
      rows: filas.map(([k, v]) => new D.TableRow({ cantSplit: true, children: [celda(k, { fondo: "F3F5F9", negrita: true, ancho: anchos[0], color: "26323F" }), celda(v, { ancho: anchos[1] })] })) });
    const tablaCab = (cab, filas, anchos) => new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: bordes,
      rows: [new D.TableRow({ tableHeader: true, children: cab.map((c, i) => celda(c, { fondo: AZUL, color: "FFFFFF", negrita: true, ancho: anchos && anchos[i], tam: 17 })) }),
        ...filas.map((f, j) => new D.TableRow({ cantSplit: true, children: f.map((c, i) => celda(c, { ancho: anchos && anchos[i], tam: 17, fondo: j % 2 ? "F7F9FC" : undefined })) }))] });
    async function imagen(url, ancho, alto, recorte) {
      const src = recorte ? await I.recortar(url, ancho / alto, 1400) : url;
      const m = await I.medidas(src);
      const f = Math.min(ancho / m.w, alto / m.h);
      return new D.ImageRun({ type: I.tipo(src), data: I.bytes(src), transformation: { width: Math.round(m.w * f), height: Math.round(m.h * f) } });
    }
    async function rejillaFotos(fotos, pref) {
      const filas = [];
      for (let i = 0; i < fotos.length; i += 2) {
        const celdas = [];
        for (const [k, f] of fotos.slice(i, i + 2).entries()) celdas.push(new D.TableCell({ width: { size: 50, type: D.WidthType.PERCENTAGE }, margins: { top: 60, bottom: 60, left: 60, right: 60 }, children: [
          new D.Paragraph({ alignment: AL.CENTER, children: [await imagen(f.url, 300, 225, true)] }),
          new D.Paragraph({ alignment: AL.CENTER, spacing: { after: 120 }, children: [run(`Foto ${pref}.${i + k + 1}. `, { bold: true, size: 16, color: GRIS }), run(f.pie, { italics: true, size: 16, color: GRIS })] }),
        ] }));
        if (celdas.length === 1) celdas.push(new D.TableCell({ width: { size: 50, type: D.WidthType.PERCENTAGE }, children: [new D.Paragraph("")] }));
        filas.push(new D.TableRow({ cantSplit: true, children: celdas }));
      }
      return new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: sinBordes, rows: filas });
    }
    const enlace = (texto, url) => url
      ? new D.Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new D.ExternalHyperlink({ link: url, children: [run(texto, { color: "0563C1", underline: {}, size: 18 })] })] })
      : new D.Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [run(texto, { size: 18 })] });

    /* ---------- Portada ---------- */
    const portada = [];
    portada.push(new D.Paragraph({ alignment: AL.CENTER, spacing: { before: 1400, after: 600 }, children: [await imagen(await I.plantilla("logo-portada.png"), 420, 150)] }));
    portada.push(new D.Paragraph({ alignment: AL.CENTER, spacing: { after: 160 }, children: [run(M.titulo.toUpperCase(), { bold: true, size: 40, color: AZUL })] }));
    if (M.solicitante) portada.push(new D.Paragraph({ alignment: AL.CENTER, spacing: { after: 80 }, children: [run(M.solicitante, { size: 28, color: "26323F" })] }));
    if (M.tipo || M.radicado) portada.push(new D.Paragraph({ alignment: AL.CENTER, spacing: { after: 80 }, children: [run([M.tipo, M.radicado ? "Radicado " + M.radicado : ""].filter(Boolean).join(" · "), { size: 22, color: GRIS })] }));
    if (M.logo) portada.push(new D.Paragraph({ alignment: AL.CENTER, spacing: { before: 300, after: 300 }, children: [await imagen(M.logo, 170, 110)] }));
    portada.push(new D.Paragraph({ alignment: AL.CENTER, spacing: { before: 600, after: 60 }, children: [run(M.fecha, { size: 22, color: GRIS })] }));
    portada.push(new D.Paragraph({ alignment: AL.CENTER, children: [run("Documento de uso interno", { size: 18, color: GRIS, italics: true })] }));
    portada.push(new D.Paragraph({ alignment: AL.CENTER, spacing: { before: 900 }, children: [await imagen(await I.plantilla("barra.png"), 620, 54)] }));

    /* ---------- Cuerpo ---------- */
    const h = [];
    h.push(h1("1. Objeto y alcance"));
    M.objeto.forEach((p) => h.push(par(p)));
    h.push(par(M.metodo));
    // Cifras
    h.push(new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: sinBordes, rows: [new D.TableRow({ children: M.cifras.map(([n, t]) => new D.TableCell({
      shading: { fill: CLARO, type: D.ShadingType.CLEAR, color: "auto" }, margins: { top: 120, bottom: 120, left: 80, right: 80 }, width: { size: Math.floor(100 / M.cifras.length), type: D.WidthType.PERCENTAGE },
      children: [new D.Paragraph({ alignment: AL.CENTER, children: [run(n, { bold: true, size: 36, color: AZUL })] }), new D.Paragraph({ alignment: AL.CENTER, children: [run(t, { size: 17, color: GRIS })] })] })) })] }));

    if (M.criterios.length) {
      h.push(h1("2. Criterios de búsqueda"));
      h.push(par("Se aplicaron los siguientes filtros sobre la base de inmuebles:"));
      M.criterios.forEach((c) => h.push(vineta(c)));
    }
    const nRes = M.criterios.length ? 3 : 2, nPre = nRes + 1, nCon = nRes + 2;
    h.push(h1(`${nRes}. Resumen de los folios`));
    h.push(tablaCab(M.resumenCab, M.resumen, [6, 14, 22, 15, 15, 13, 15]));
    if (M.mapaGeneral) {
      h.push(new D.Paragraph({ alignment: AL.CENTER, spacing: { before: 200 }, children: [await imagen(M.mapaGeneral, 600, 390)] }));
      h.push(leyenda(`Ubicación general de los folios (el número corresponde al de la tabla).${M.mapaNota ? " " + M.mapaNota : ""}`));
    }

    h.push(h1(`${nPre}. Descripción de los predios`));
    for (const p of M.predios) {
      const pref = `${nPre}.${p.n}`;
      h.push(new D.Paragraph({ pageBreakBefore: p.n > 1, spacing: { before: 120, after: 40 }, keepNext: true, children: [run(`${pref}. Folio ${p.fmi}`, { bold: true, size: 30, color: AZUL })] }));
      h.push(new D.Paragraph({ spacing: { after: 160 }, keepNext: true, children: [run(p.lugar, { bold: true, size: 21, color: "26323F" }), run(p.subtitulo ? "  ·  " + p.subtitulo : "", { size: 21, color: GRIS }), run(p.sello ? "  ·  FMI vs. cédula: " + p.sello : "", { size: 19, color: GRIS })] }));
      if (p.hero) {
        h.push(new D.Paragraph({ alignment: AL.CENTER, spacing: { after: 40 }, children: [await imagen(p.hero, 620, 300, true)] }));
        h.push(leyenda(p.fotos.find((f) => f.url === p.hero) ? (p.fotos.find((f) => f.url === p.hero).pie) : ""));
      }
      for (const [t, texto] of p.secciones) { if (!texto) continue; h.push(h3(t)); h.push(par(texto)); }
      if (p.concepto) {
        h.push(h3("Concepto"));
        h.push(new D.Paragraph({ alignment: AL.JUSTIFIED, spacing: { after: 160, line: 300 }, shading: { type: D.ShadingType.CLEAR, fill: CLARO, color: "auto" },
          border: { left: { style: D.BorderStyle.SINGLE, size: 24, color: AZUL, space: 8 } }, indent: { left: 160, right: 120 }, children: [run(p.concepto)] }));
      }
      h.push(h3("Ficha del predio"));
      h.push(tablaDatos(p.datos));
      if (p.vur) { h.push(h3("Consulta del VUR")); h.push(tablaDatos(p.vur)); }
      if (p.contraste.length) { h.push(h3("Contraste base / VUR / catastro")); h.push(tablaCab(["Campo", "Base", "VUR", "Catastro", "Resultado"], p.contraste, [20, 20, 20, 20, 20])); }
      if (p.fotos.length) { h.push(h3("Registro fotográfico")); h.push(await rejillaFotos(p.fotos, pref)); }
      if (p.fuentes.length) { h.push(h3("Fuentes")); p.fuentes.forEach((f) => h.push(enlace(f.texto, f.url))); }
    }

    h.push(new D.Paragraph({ pageBreakBefore: true, children: [] }));
    h.push(h1(`${nCon}. Conclusiones y recomendaciones`));
    M.conclusiones.forEach((c) => h.push(par(c)));

    const encabezado = new D.Header({ children: [new D.Paragraph({ border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: "D0D6DE", space: 4 } },
      tabStops: [{ type: D.TabStopType.RIGHT, position: 9600 }],
      children: [await imagen(await I.plantilla("logo-sae.png"), 62, 31), run(`\t${M.titulo}${M.solicitante ? " · " + M.solicitante : ""}`, { size: 15, color: GRIS })] })] });
    const pie = new D.Footer({ children: [new D.Paragraph({ tabStops: [{ type: D.TabStopType.RIGHT, position: 9600 }],
      children: [run("Sociedad de Activos Especiales · Uso interno", { size: 15, color: GRIS }), new D.TextRun({ font: F, size: 15, color: GRIS, children: ["\tPágina ", D.PageNumber.CURRENT, " de ", D.PageNumber.TOTAL_PAGES] })] })] });
    const pagina = { size: { width: 12240, height: 15840 }, margin: { top: 1300, bottom: 1100, left: 1200, right: 1200, header: 500, footer: 500 } };

    const doc = new D.Document({
      creator: "SAE – Portafolio", title: M.titulo, description: M.solicitante,
      styles: { default: { document: { run: { font: F, size: 21 } } } },
      sections: [
        { properties: { page: pagina }, children: portada },
        { properties: { page: pagina }, headers: { default: encabezado }, footers: { default: pie }, children: h },
      ],
    });
    return await D.Packer.toBlob(doc);
  };
})(typeof window !== "undefined" ? window : globalThis);
