/* Presentación de portafolio con la plantilla SAE (PptxGenJS).
   Por cada folio: georreferenciación (imagen satelital + tabla), ficha (tabla + fachada) y fotos de a dos. */
(function (g) {
  const IP = (g.IP = g.IP || {});
  const U = IP.util;
  const I = () => IP.imagenes;

  // Campos de la ficha (diapositiva 2 de cada folio), en el orden de la plantilla
  IP.CAMPOS_FICHA = [
    ["direccion", "DIRECCIÓN"], ["clase", "CLASE"], ["tipo_activo", "TIPO ACTIVO"], ["clasificacion", "CLASIFICACIÓN ACTIVO"],
    ["estado_legal", "ESTADO LEGAL"], ["ocupacion", "ESTADO DE OCUPACIÓN"], ["area_terreno", "ÁREA TERRENO"],
    ["area_construida", "ÁREA CONSTRUÍDA"], ["activo_social", "ACTIVO SOCIAL"], ["avaluo_catastral", "AVALÚO CATASTRAL"],
    ["avaluo_comercial", "AVALÚO COMERCIAL"],
  ];
  IP.CAMPOS_GEO = [["departamento", "DEPARTAMENTO"], ["municipio", "CIUDAD/MUNICIPIO"], ["direccion", "DIRECCIÓN"], ["barrio", "BARRIO"], ["enlace", "ENLACE"]];

  IP.generarPresentacion = async function (port) {
    if (!g.PptxGenJS) throw new Error("No se cargó la librería de presentaciones (js/lib/pptxgen.bundle.js).");
    const P = IP.PORTAFOLIO.presentacion;
    const pptx = new g.PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "SAE – Portafolio";
    pptx.title = "Portafolio " + (port.solicitante || "");
    const img = {
      portada: await I().plantilla("logo-portada.png"),
      foto: await I().plantilla("foto-portada.jpg"),
      barra: await I().plantilla("barra.png"),
      sae: await I().plantilla("logo-sae.png"),
      cierre: await I().plantilla("logo-cierre.png"),
    };
    const fuente = P.fuente;
    const barra = (s) => s.addImage({ data: img.barra, x: 0, y: 7.3, w: 13.333, h: 0.2 });
    const logoSae = (s, x, y) => s.addImage({ data: img.sae, x, y, w: 1.02, h: 0.51 });
    const titulo = (s, texto, x, y) => s.addText(texto, {
      x, y, w: 5.1, h: 0.7, fontFace: P.fuente_titulo, fontSize: 36, bold: true, color: P.azul, align: "center", valign: "middle", margin: 0,
    });
    const marco = (s, b) => s.addShape(pptx.ShapeType.rect, {
      x: b.x - 0.05, y: b.y - 0.05, w: b.w + 0.1, h: b.h + 0.1, fill: { color: "FFFFFF" }, line: { color: "D9D9D9", width: 0.75 },
      shadow: { type: "outer", blur: 5, offset: 2, angle: 45, opacity: 0.35, color: "000000" },
    });
    async function foto(s, url, b) {
      marco(s, b);
      if (!url) {
        s.addText("Sin imagen", { x: b.x, y: b.y, w: b.w, h: b.h, align: "center", valign: "middle", fontFace: fuente, fontSize: 14, color: "7F7F7F", fill: { color: "F2F2F2" } });
        return;
      }
      s.addImage({ data: await I().recortar(url, b.w / b.h), x: b.x, y: b.y, w: b.w, h: b.h });
    }
    const pie = (s, color) => s.addText(P.codigo_formato, { x: 10.49, y: 6.98, w: 2.55, h: 0.29, fontFace: "Calibri", fontSize: 8, color, align: "right", margin: 0 });
    const celdaEt = (t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: P.azul }, align: "center" } });

    // 1. Portada
    let s = pptx.addSlide();
    s.background = { color: "FFFFFF" };
    s.addImage({ data: img.portada, x: 3.09, y: 2.49, w: 7.15, h: 2.52 });
    pie(s, "595959");

    // 2. Solicitante
    s = pptx.addSlide();
    s.addImage({ data: await I().recortar(img.foto, 6.667 / 7.5, 1400), x: 6.667, y: 0, w: 6.667, h: 7.5 });
    barra(s);
    logoSae(s, 0.85, 0.62);
    s.addText([
      { text: "PORTAFOLIO", options: { fontFace: "Montserrat ExtraBold", fontSize: 28, bold: true, color: P.azul_boton, breakLine: true } },
      { text: port.solicitante || "", options: { fontFace: fuente, fontSize: 20, bold: true, color: P.azul_boton } },
    ], { x: 0.79, y: 1.25, w: 4.89, h: 1.92, align: "center", valign: "middle" });
    if (port.logo) {
      const m = await I().medidas(port.logo);
      const b = I().ajustar(m.w, m.h, { x: 1.88, y: 3.26, w: 2.75, h: 2.03 });
      s.addImage({ data: port.logo, ...b });
    }
    s.addText(port.tipo || P.tipo_por_defecto, {
      shape: pptx.ShapeType.roundRect, rectRadius: 0.12, x: 0.79, y: 5.73, w: 4.89, h: 0.67,
      fill: { color: P.azul_boton }, line: { color: P.azul_boton }, color: "FFFFFF", bold: true, fontFace: fuente, fontSize: 20, align: "center", valign: "middle",
      shadow: { type: "outer", blur: 4, offset: 2, angle: 90, opacity: 0.3, color: "000000" },
    });

    // 3. Cada folio
    for (const it of port.items) {
      const c = it.campos || {};
      const fmi = it.fmi_texto || it.fmi;

      // 3a. Georreferenciación
      s = pptx.addSlide();
      await foto(s, it.mapa, { x: 0.31, y: 0.26, w: 6.84, h: 6.82 });
      logoSae(s, 11.7, 0.54);
      titulo(s, fmi, 7.62, 1.95);
      const filasGeo = [[{ text: "GEOREFERENCIACIÓN", options: { colspan: 2, bold: true, color: "FFFFFF", fill: { color: P.azul }, align: "center" } }]];
      for (const [k, et] of IP.CAMPOS_GEO) {
        const v = U.limpiar(c[k]) || "-";
        filasGeo.push([celdaEt(et), k === "enlace" && /^https?:/.test(v)
          ? { text: /google\.[a-z.]+\/maps/.test(v) && v.length > 45 ? "Ver en Google Maps" : v, options: { hyperlink: { url: v }, color: "0563C1", underline: { style: "sng" }, align: "center" } }
          : { text: v, options: { align: "center" } }]);
      }
      s.addTable(filasGeo, { x: 7.47, y: 2.92, w: 5.47, colW: [1.75, 3.72], fontFace: fuente, fontSize: 10, color: "000000", valign: "middle",
        border: { type: "solid", pt: 0.75, color: "000000" }, margin: 0.04, autoPage: false });
      barra(s);

      // 3b. Ficha
      s = pptx.addSlide();
      logoSae(s, 0.85, 0.62);
      titulo(s, fmi, 0.92, 1.73);
      const filasFicha = IP.CAMPOS_FICHA.map(([k, et]) => [
        { text: et, options: { bold: true, color: "FFFFFF", fill: { color: P.azul }, align: "center", fontSize: 9 } },
        { text: U.limpiar(c[k]) || "-", options: { align: "left" } },
      ]);
      s.addTable(filasFicha, { x: 0.41, y: 2.66, w: 5.9, colW: [2.05, 3.85], fontFace: fuente, fontSize: 9.5, color: "000000", valign: "middle",
        border: { type: "solid", pt: 0.75, color: "000000" }, margin: 0.04, autoPage: false });
      const fotos = it.fotos || [];
      const fach = fotos.find((f) => f.id === it.fachada) || fotos[0];
      await foto(s, fach ? fach.url : "", { x: 6.67, y: 1.13, w: 6.43, h: 5.5 });
      barra(s);

      // 3c. Fotos de a dos
      const resto = fotos.filter((f) => f !== fach);
      for (let i = 0; i < resto.length; i += 2) {
        s = pptx.addSlide();
        titulo(s, fmi, 4.12, 0.35);
        logoSae(s, 11.7, 0.54);
        const par = resto.slice(i, i + 2);
        if (par.length === 2) {
          await foto(s, par[0].url, { x: 0.95, y: 1.45, w: 5.43, h: 5.42 });
          await foto(s, par[1].url, { x: 6.97, y: 1.45, w: 5.43, h: 5.42 });
        } else await foto(s, par[0].url, { x: 3.95, y: 1.45, w: 5.43, h: 5.42 });
        barra(s);
      }
    }

    // 4. Cierre
    s = pptx.addSlide();
    s.background = { color: P.azul_cierre };
    s.addImage({ data: img.cierre, x: 3.05, y: 2.57, w: 7.24, h: 2.2 });
    pie(s, "FFFFFF");

    return await pptx.write({ outputType: "blob" });
  };
})(typeof window !== "undefined" ? window : globalThis);
