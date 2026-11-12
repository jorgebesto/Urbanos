/* Texto de contextualización de cada predio y conclusiones generales.
   1) Plantilla: arma frases con los datos (base, VUR, catastro).
   2) "Mejorar con IA": Groq redacta de nuevo los mismos hechos, sin recibir el nombre ni el documento del propietario. */
(function (g) {
  const IP = (g.IP = g.IP || {});
  const U = IP.util;
  const C = (IP.contexto = {});

  C.SECCIONES = [
    ["ubicacion", "Ubicación"],
    ["fisica", "Descripción física"],
    ["juridica", "Situación jurídica"],
    ["catastral", "Situación catastral"],
    ["administrativa", "Situación administrativa"],
    ["concepto", "Concepto"],
  ];

  /* ---------------- Ayudas de redacción ---------------- */
  const MIN = new Set(["DE", "DEL", "LA", "LAS", "LOS", "EL", "Y", "EN"]);
  C.titulo = (s) => U.limpiar(s).toLowerCase().split(/\s+/).map((p, i) => (i && MIN.has(p.toUpperCase()) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(" ");
  const minus = (s) => U.limpiar(s).toLowerCase();
  const articulo = (clasif) => {
    const p = U.normalizar(clasif).split(" ")[0] || "";
    return /A$/.test(p) && !/^(PROGRAMA|SISTEMA|PROBLEMA)$/.test(p) ? "una" : "un";
  };
  const fechaLarga = (s) => {
    const m = String(s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return U.limpiar(s);
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return `${Number(m[1])} de ${meses[Number(m[2]) - 1] || m[2]} de ${m[3]}`;
  };
  // Fechas de la base vienen como 9/25/2024 12:00:00 AM (mes/día) o 25/09/2024 0:00
  const fechaBase = (s) => {
    const t = U.limpiar(s);
    const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return t.slice(0, 10);
    let [d, mes] = [Number(m[1]), Number(m[2])];
    if (/[AP]M/i.test(t) || mes > 12) [d, mes] = [mes, d];
    return fechaLarga(`${d}/${mes}/${m[3]}`);
  };
  const lista = (xs) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);
  function estadoLegal(s) {
    const t = U.limpiar(s);
    if (!t) return "";
    const m = t.match(/^(.*?)\s*(\d{1,3})\s*%?$/);
    const est = U.normalizar(m ? m[1] : t), pct = m ? m[2] : "";
    const p = pct ? ` sobre el ${pct} % del bien` : "";
    if (/^EXTINT/.test(est)) return `con extinción de dominio declarada${p}`;
    if (/PROCESO/.test(est)) return `en proceso de extinción de dominio${p}`;
    if (/IMPROCEDENTE/.test(est)) return `con proceso declarado improcedente${p}`;
    return `en estado legal “${t}”`;
  }

  /* ---------------- Hechos del predio ---------------- */
  C.hechos = function (it) {
    const b = (...n) => g.PF.deBase(it, ...n);
    const c = it.campos || {}, v = it.vur, cat = it.catastro;
    const rural = /RURAL/i.test(c.clase);
    const filasC = it.contraste || [];
    const areaFila = filasC.find((f) => f.campo === "Área de terreno");
    return {
      fmi: it.fmi_texto || it.fmi, departamento: c.departamento, municipio: c.municipio, rural,
      vereda_barrio: U.limpiar(c.barrio) === "-" ? "" : U.limpiar(c.barrio), direccion: c.direccion,
      tipo_activo: c.tipo_activo, clasificacion: c.clasificacion, propiedad_horizontal: b("PROPIEDAD HORIZONTAL"),
      area_terreno: c.area_terreno, area_construida: c.area_construida, estado_fisico: b("ESTADO FISICO"), estrato: b("ESTRATO"),
      nombre_bien: b("NOMBRE DEL BIEN"), estado_legal: c.estado_legal, estado_materializacion: b("ESTADO MATERIALIZACION"),
      estado_inventario: b("ESTADO INVENTARIO"), mecanismo_administracion: b("MECANISMO ADMINISTRACION"), depositario: b("NOMBRE DEPOSITARIO"),
      ocupacion: c.ocupacion, ultima_visita: fechaBase(b("FECHA ULTIMA VISITA")), avaluo_catastral: c.avaluo_catastral,
      vigencia_catastral: b("VIGENCIA CATASTRAL"), avaluo_comercial: c.avaluo_comercial, estado_comercial: b("ESTADO COMERCIAL"),
      activo_social: c.activo_social, cedula_base: b("CEDULA CATASTRAL"), observaciones_visita: U.limpiar(it.observaciones),
      vur: v ? {
        fecha_consulta: fechaLarga(v.fecha_consulta), estado_folio: v.estado_folio, fecha_apertura: fechaLarga(v.fecha_apertura),
        tipo_predio: v.tipo_predio, referencia_catastral: v.referencia_catastral, referencia_anterior: v.referencia_catastral_anterior,
        nupre: v.nupre, direccion: v.direccion, vereda: v.vereda,
        propietarios: (v.propietarios || []).map((p) => ({ nombre: p.nombre, tipo_documento: p.tipo_documento, documento: p.documento, participacion: p.participacion })),
        cabida: v.area_cabida_texto, salvedades: (v.salvedades || []).length, alertas: IP.vur.alertas(v),
        alertas_proteccion: (v.alertas_proteccion || []).length, alertas_procesales: (v.alertas_procesales || []).length,
        tramites: (v.tramites_en_curso || []).length, derivadas: U.limpiar(v.matriculas_derivadas),
      } : null,
      catastro: cat ? {
        fuente_poligono: cat.mapa_fuente, gestor: cat.gestor, numero_predial: (cat.datos || {}).numero_predial,
        area_terreno: (cat.datos || {}).area_terreno_m2 ? U.formatoArea((cat.datos || {}).area_terreno_m2) : "",
      } : null,
      confirmacion: it.confirmacion ? { veredicto: it.confirmacion.veredicto, texto: it.confirmacion.titulo } : null,
      diferencia_area: areaFila && areaFila.vur && areaFila.catastro ? { vur: areaFila.vur, catastro: areaFila.catastro, estado: areaFila.estado, nota: areaFila.nota } : null,
      tiene_mapa: Boolean(it.mapa),
    };
  };

  /* ---------------- Plantilla ---------------- */
  C.plantilla = function (it, port) {
    const h = C.hechos(it);
    const T = {};
    const mun = C.titulo(h.municipio), dep = C.titulo(h.departamento);

    // Ubicación
    let s = `El inmueble identificado con el folio de matrícula inmobiliaria ${h.fmi} se localiza `;
    if (h.vereda_barrio) s += `${h.rural ? "en la vereda" : "en el sector"} ${C.titulo(h.vereda_barrio)} `;
    s += `del municipio de ${mun} (${dep}), en suelo ${h.rural ? "rural" : "urbano"}.`;
    if (U.limpiar(h.direccion)) s += ` Su dirección registrada en la base es ${h.direccion}.`;
    if (h.vur && U.limpiar(h.vur.direccion) && U.normalizarDireccion(h.vur.direccion) !== U.normalizarDireccion(h.direccion)) s += ` En el VUR figura como “${h.vur.direccion}”.`;
    if (h.catastro && h.catastro.fuente_poligono) s += ` Su ubicación se verificó con el polígono publicado por ${h.catastro.fuente_poligono}${h.catastro.numero_predial ? ", número predial " + h.catastro.numero_predial : ""}.`;
    else s += ` No se encontró el polígono del predio en los geoportales consultados; su ubicación se ilustra con la vista aérea aportada.`;
    T.ubicacion = s;

    // Descripción física
    const clas = minus(h.clasificacion) || "inmueble";
    s = `Corresponde a ${articulo(h.clasificacion)} ${clas}`;
    if (/^PROPIEDAD/i.test(h.propiedad_horizontal)) s += " sometido al régimen de propiedad horizontal";
    else if (/^NO PROPIEDAD/i.test(h.propiedad_horizontal)) s += " no sometido al régimen de propiedad horizontal";
    const areas = [];
    if (U.limpiar(h.area_terreno) && !/^0( m²)?$/.test(h.area_terreno)) areas.push(`un área de terreno de ${h.area_terreno}`);
    if (U.limpiar(h.area_construida) && !/^0( m²)?$/.test(h.area_construida)) areas.push(`un área construida de ${h.area_construida}`);
    s += areas.length ? `, con ${lista(areas)} según la base de la SAE.` : ". La base de la SAE no registra áreas para este activo.";
    if (h.vur && h.vur.cabida) s += ` La cabida registrada en el folio es de ${h.vur.cabida}.`;
    if (h.estado_fisico) s += ` Su estado físico se reporta como ${minus(h.estado_fisico)}.`;
    if (h.estrato && !/RURAL|^0$/i.test(h.estrato)) s += ` Se ubica en estrato ${minus(h.estrato)}.`;
    if (h.observaciones_visita) s += ` En la visita se observó: ${h.observaciones_visita.replace(/\.?$/, ".")}`;
    T.fisica = s;

    // Situación jurídica
    s = h.estado_legal ? `De acuerdo con la base de la SAE, el activo se encuentra ${estadoLegal(h.estado_legal)}.` : "La base de la SAE no registra el estado legal del activo.";
    if (h.vur) {
      const v = h.vur;
      s += ` Según la consulta del VUR del ${v.fecha_consulta}, el folio se encuentra ${minus(v.estado_folio) || "sin estado informado"}`;
      s += v.fecha_apertura ? ` y fue abierto el ${v.fecha_apertura}.` : ".";
      if (v.propietarios.length === 1) {
        const p = v.propietarios[0];
        s += ` Figura como propietario ${p.nombre}${p.documento ? ` (${minus(p.tipo_documento) || "documento"} ${p.documento})` : ""}.`;
      } else if (v.propietarios.length > 1) {
        s += ` Figuran como propietarios ${lista(v.propietarios.map((p) => p.nombre + (p.participacion ? ` (${p.participacion})` : "")))}; el VUR solo muestra a quienes intervinieron en la última venta parcial.`;
      } else s += " La consulta no muestra propietarios.";
      const al = [];
      if (v.alertas_proteccion) al.push("alertas de protección, restitución o formalización");
      if (v.alertas_procesales) al.push("alertas de comunicaciones, suspensiones o acumulaciones procesales");
      if (v.tramites) al.push("trámites en curso");
      s += al.length ? ` Registra ${lista(al)}, que deben revisarse.` : " No registra alertas de protección, restitución o procesales, ni trámites en curso.";
      if (v.salvedades) s += ` Presenta ${v.salvedades} salvedad${v.salvedades > 1 ? "es" : ""} en el folio.`;
      if (v.derivadas) s += ` Tiene matrículas derivadas (${v.derivadas}).`;
    } else s += " No se ha consultado el VUR de este folio.";
    T.juridica = s;

    // Situación catastral
    if (h.catastro) {
      s = h.catastro.gestor ? `El catastro del municipio está a cargo de ${h.catastro.gestor}.` : "";
      if (h.catastro.numero_predial) s += ` En el catastro el predio corresponde al número predial ${h.catastro.numero_predial}${h.catastro.area_terreno ? `, con un área de terreno de ${h.catastro.area_terreno}` : ""}.`;
      if (h.confirmacion) s += ` El cotejo entre la matrícula y la cédula catastral dio como resultado: ${h.confirmacion.texto.charAt(0).toLowerCase() + h.confirmacion.texto.slice(1)}.`;
      if (h.diferencia_area && h.diferencia_area.estado !== "ok") s += ` El área de terreno del VUR (${h.diferencia_area.vur}) difiere de la catastral (${h.diferencia_area.catastro})${h.diferencia_area.nota ? ", con una " + h.diferencia_area.nota : ""}.`;
      else if (h.diferencia_area) s += ` El área de terreno del VUR coincide con la catastral.`;
    } else s = "No se ha consultado el catastro para este folio.";
    if (h.cedula_base && !/E\+/i.test(h.cedula_base)) s += ` La cédula catastral registrada en la base es ${h.cedula_base}.`;
    T.catastral = s.trim();

    // Situación administrativa
    s = h.ocupacion ? `El inmueble se reporta ${minus(h.ocupacion)}` : "La base no informa el estado de ocupación del inmueble";
    if (h.mecanismo_administracion) s += `, bajo ${minus(h.mecanismo_administracion)}${h.depositario && !/SOCIEDAD DE ACTIVOS/i.test(h.depositario) ? ` (depositario: ${h.depositario})` : ""}`;
    s += ".";
    if (h.ultima_visita) s += ` La última visita registrada fue el ${h.ultima_visita}.`;
    if (h.avaluo_catastral && !/^\$ 0$/.test(h.avaluo_catastral)) s += ` Cuenta con un avalúo catastral de ${h.avaluo_catastral}${h.vigencia_catastral ? ` (vigencia ${h.vigencia_catastral})` : ""}`;
    else s += " No registra avalúo catastral en la base";
    s += h.avaluo_comercial && !/^\$ 0$/.test(h.avaluo_comercial) ? ` y un avalúo comercial de ${h.avaluo_comercial}.` : " y no tiene avalúo comercial.";
    if (h.estado_comercial) s += ` Su estado comercial es “${minus(h.estado_comercial)}”.`;
    T.administrativa = s;

    T.concepto = C.conceptoPlantilla(it, h, port);
    return T;
  };

  C.verificaciones = function (h) {
    const f = [];
    if (!h.vur) f.push("consultar el VUR del folio");
    else {
      if (U.normalizar(h.vur.estado_folio) && U.normalizar(h.vur.estado_folio) !== "ACTIVO") f.push(`el folio está en estado ${minus(h.vur.estado_folio)}`);
      if (h.vur.alertas_proteccion) f.push("revisar las alertas de protección, restitución o formalización");
      if (h.vur.alertas_procesales) f.push("revisar las alertas procesales");
      if (h.vur.tramites) f.push("revisar los trámites en curso en el folio");
      if (/^EXTINT/i.test(h.estado_legal) && h.vur.propietarios.length && !h.vur.propietarios.some((p) => /FRISCO|FONDO PARA LA REHABILITACION|SOCIEDAD DE ACTIVOS|NACION/i.test(U.sinTildes(p.nombre))))
        f.push("verificar la inscripción de la sentencia de extinción de dominio, pues el VUR no muestra la titularidad a favor del FRISCO o la Nación");
    }
    if (h.confirmacion && h.confirmacion.veredicto === "no_coincide") f.push("aclarar la diferencia entre la matrícula y la cédula catastral");
    else if (h.confirmacion && h.confirmacion.veredicto !== "confirmado") f.push("confirmar la correspondencia entre la matrícula y la cédula catastral con el gestor catastral");
    else if (!h.confirmacion) f.push("consultar el catastro para confirmar la matrícula con la cédula catastral");
    if (h.diferencia_area && h.diferencia_area.estado === "diferente") f.push("aclarar la diferencia de áreas entre el registro y el catastro");
    if (/ocupad|arrendad|invadid/i.test(h.ocupacion) && !/desocup/i.test(h.ocupacion)) f.push(`el inmueble está ${minus(h.ocupacion)}, lo que condiciona su entrega material`);
    if (/PROCESO/i.test(h.estado_legal)) f.push("el activo no tiene aún extinción de dominio declarada, por lo que su destinación sería provisional");
    if (!h.tiene_mapa) f.push("obtener la vista aérea o el polígono del predio");
    return f;
  };

  C.conceptoPlantilla = function (it, h, port) {
    h = h || C.hechos(it);
    const f = C.verificaciones(h);
    const para = U.limpiar(port && port.solicitante) ? ` de ${port.solicitante}` : "";
    if (!f.length) return `Con la información revisada, el predio no presenta impedimentos evidentes para atender la solicitud${para}: el folio está activo, la matrícula corresponde a la cédula catastral, no registra alertas y el inmueble se encuentra ${minus(h.ocupacion) || "sin novedades de ocupación"}.`;
    return `Con la información revisada, el predio podría atender la solicitud${para}, sujeto a las siguientes verificaciones: ${f.join("; ")}.`;
  };

  /* ---------------- Conclusiones generales ---------------- */
  C.conclusionesPlantilla = function (port) {
    const items = port.items || [];
    const bi = port.base_info || {};
    const par = [];
    let s = "";
    if (bi.n) s += `Se revisaron ${U.formatoNumero(bi.n, 0)} registros de la base de inmuebles de la SAE`;
    if (bi.todas_reglas != null) s += `; ${U.formatoNumero(bi.todas_reglas, 0)} cumplen las reglas base (sin trámites, contratos ni comodatos, disponibles comercialmente)`;
    if (port.total_filtrados != null) s += ` y ${U.formatoNumero(port.total_filtrados, 0)} cumplen los criterios de la solicitud`;
    if (s) par.push(s + ".");
    const mun = [...new Set(items.map((i) => `${C.titulo(i.campos.municipio)} (${C.titulo(i.campos.departamento)})`))];
    par.push(`Se seleccionaron ${items.length} folio${items.length === 1 ? "" : "s"} para el portafolio${mun.length ? ", ubicado" + (items.length === 1 ? "" : "s") + " en " + lista(mun) : ""}.`);
    const conf = items.filter((i) => i.confirmacion && i.confirmacion.veredicto === "confirmado").length;
    const desoc = items.filter((i) => /desocup/i.test(i.campos.ocupacion)).length;
    const conVur = items.filter((i) => i.vur).length;
    const datos = [];
    datos.push(`${conVur} de ${items.length} cuentan con consulta del VUR`);
    datos.push(`${conf} tienen la matrícula confirmada con la cédula catastral`);
    datos.push(`${desoc} se encuentran desocupados`);
    par.push(lista(datos).replace(/^./, (x) => x.toUpperCase()) + ".");
    const sinObs = [], conObs = [];
    for (const it of items) (C.verificaciones(C.hechos(it)).length ? conObs : sinObs).push(it.fmi_texto || it.fmi);
    if (sinObs.length) par.push(`Los folios ${lista(sinObs)} no presentan impedimentos evidentes para atender la solicitud.`.replace(/^Los folios (\S+) no presentan/, sinObs.length === 1 ? "El folio $1 no presenta" : "$&"));
    if (conObs.length) par.push(`Los folios ${lista(conObs)} requieren verificaciones antes de su asignación, descritas en el concepto de cada predio.`.replace(/^Los folios (\S+) requieren/, conObs.length === 1 ? "El folio $1 requiere" : "$&"));
    return par.join("\n\n");
  };

  /* ---------------- Con IA ---------------- */
  // Quita nombres y documentos de propietarios y los reemplaza por marcadores que luego se devuelven
  function anonimizar(h) {
    const mapa = [];
    const copia = JSON.parse(JSON.stringify(h));
    if (copia.vur) copia.vur.propietarios = copia.vur.propietarios.map((p, i) => {
      const n = `[PROPIETARIO_${i + 1}]`, d = `[DOCUMENTO_${i + 1}]`;
      mapa.push([n, p.nombre], [d, p.documento]);
      return { ...p, nombre: n, documento: p.documento ? d : "" };
    });
    return { copia, mapa };
  }
  const devolver = (texto, mapa) => mapa.reduce((t, [m, v]) => t.split(m).join(v || ""), String(texto || ""));

  C.mejorarConIA = async function (it, port) {
    const h = C.hechos(it);
    const { copia, mapa } = anonimizar(h);
    let borrador = it.texto && it.texto.secciones ? it.texto.secciones : C.plantilla(it, port);
    for (const [m, v] of mapa) if (v) for (const k of Object.keys(borrador)) borrador = { ...borrador, [k]: String(borrador[k]).split(v).join(m) };
    const sistema = `Eres un profesional de la Sociedad de Activos Especiales (SAE, Colombia) que redacta informes técnicos internos sobre inmuebles para portafolios de destinación.
Redacta en español formal de Colombia, en tercera persona, con frases claras y sin adornos. No inventes datos: usa SOLO los hechos entregados. Conserva exactamente cifras, fechas, números de folio, números prediales y los marcadores entre corchetes como [PROPIETARIO_1] o [DOCUMENTO_1].
Responde SOLO con un objeto JSON con las claves: "ubicacion", "fisica", "juridica", "catastral", "administrativa", "concepto". Cada valor es un párrafo de 2 a 5 frases.
En "concepto" da una opinión técnica prudente sobre si el predio sirve para la solicitud y qué se debe verificar antes de asignarlo; no afirmes que es viable si hay verificaciones pendientes.`;
    const usuario = `Solicitud: ${U.limpiar(port && port.solicitud) || "(no indicada)"}
Solicitante: ${U.limpiar(port && port.solicitante) || "(no indicado)"} ${U.limpiar(port && port.tipo)}

Hechos del predio (JSON):
${JSON.stringify(copia)}

Verificaciones pendientes detectadas: ${JSON.stringify(C.verificaciones(h))}

Borrador actual (mejóralo sin perder información):
${JSON.stringify(borrador)}`;
    const r = await IP.agente.chat(sistema, usuario, { temperatura: 0.2 });
    const out = {};
    for (const [k] of C.SECCIONES) out[k] = devolver(U.limpiar(r[k]) || borrador[k], mapa);
    return out;
  };

  C.conclusionesConIA = async function (port) {
    const resumen = (port.items || []).map((it) => {
      const h = C.hechos(it);
      return { folio: h.fmi, municipio: h.municipio, departamento: h.departamento, clasificacion: h.clasificacion, area_terreno: h.area_terreno,
        ocupacion: h.ocupacion, estado_legal: h.estado_legal, folio_vur: h.vur ? h.vur.estado_folio : "sin consulta",
        confirmacion_fmi: h.confirmacion ? h.confirmacion.texto : "sin consultar", verificaciones: C.verificaciones(h) };
    });
    const sistema = `Eres un profesional de la SAE (Colombia) que redacta las conclusiones de un informe técnico interno de un portafolio de inmuebles.
Español formal, tercera persona, sin inventar datos. Conserva cifras y números de folio. Responde SOLO con JSON: {"conclusiones": "texto en 2 a 4 párrafos separados por \\n\\n"}.
Incluye: el resultado de la búsqueda, qué folios son más adecuados para la solicitud y por qué, y qué verificaciones quedan pendientes.`;
    const usuario = `Solicitud: ${U.limpiar(port.solicitud) || "(no indicada)"}
Solicitante: ${U.limpiar(port.solicitante) || "(no indicado)"}
Conclusiones de la plantilla: ${C.conclusionesPlantilla(port)}
Folios: ${JSON.stringify(resumen)}`;
    const r = await IP.agente.chat(sistema, usuario, { temperatura: 0.2 });
    return U.limpiar(r.conclusiones) || C.conclusionesPlantilla(port);
  };
})(typeof window !== "undefined" ? window : globalThis);
