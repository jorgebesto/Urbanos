/* Base de inmuebles para el portafolio.
   - Lee la exportación del sistema (CSV con ; o , — UTF-8 o Windows-1252) o un .xlsx.
   - Guarda cada columna como diccionario (valores únicos + índice por fila): ocupa poco y filtra rápido.
   - La base se publica CIFRADA (AES-GCM, clave derivada de una contraseña con PBKDF2) y comprimida (gzip),
     porque el repositorio y GitHub Pages son públicos. Solo se descifra en el navegador de quien tiene la clave. */
(function (g) {
  const IP = (g.IP = g.IP || {});
  const U = IP.util;
  const B = (IP.base = {});

  const MAGIA = "SAEPORT1";
  const ITERACIONES = 250000;

  /* Columnas que usa la página. La clave es el encabezado normalizado (sin tildes ni signos). */
  B.COL = {
    idactivo: ["IDACTIVO"],
    fmi: ["FOLIO DE MATRICULA", "FMI", "MATRICULA INMOBILIARIA", "MATRICULA"],
    circulo: ["CIRCULO REGISTRAL"],
    tipo_activo: ["TIPO ACTIVO"],
    subtipo: ["SUBTIPO ACTIVO"],
    clasificacion: ["CLASIFICACION ACTIVO"],
    departamento: ["DEPARTAMENTO"],
    municipio: ["MUNICIPIO"],
    vereda: ["VEREDA"],
    direccion: ["DIRECCION"],
    descripcion: ["DESCRIPCION"],
    territorial: ["DIRECCION TERRITORIAL"],
    cedula: ["CEDULA CATASTRAL"],
    activo_social: ["ACTIVO SOCIAL"],
    ph: ["PROPIEDAD HORIZONTAL"],
    area_construida: ["AREA CONSTRUIDA"],
    unidad_construida: ["UNIDAD MEDIDA AREA CONSTRUIDA"],
    area_terreno: ["AREA TERRENO"],
    unidad_terreno: ["UNIDAD MEDIDA TERRENO", "UNIDAD MEDIDA AREA TERRENO"],
    estrato: ["ESTRATO"],
    nombre_bien: ["NOMBRE DEL BIEN"],
    estado_fisico: ["ESTADO FISICO"],
    estado_legal: ["ESTADO LEGAL"],
    estado_materializacion: ["ESTADO MATERIALIZACION"],
    estado_inventario: ["ESTADO INVENTARIO"],
    avaluo_catastral: ["AVALUO CATASTRAL"],
    avaluo_comercial: ["AVALUO COMERCIAL"],
    ocupacion: ["ESTADO DE OCUPACION"],
    estado_comercial: ["ESTADO COMERCIAL"],
    viable: ["VIABLE SI NO COMERCIAL", "VIABLE SI NO"],
    contrato_sigma: ["NUMERO DE CONTRATO SIGMA"],
    estado_sigma: ["ESTADO DEL CONTRATO SIGMA"],
  };

  /* Las 12 columnas que deben estar en "no aplica" (regla base). */
  B.NO_APLICA = [
    "EN TRAMITE PROVISIONAL", "EN TRAMITE DEFINITIVAS", "DESTINADO PROVISIONAL", "EN PROCESO REMOCION",
    "DECRETO 888", "NUMERO CONTRATO TESEO", "TIPO CONTRATO", "TIPO DE CONTRATO TESEO",
    "NUMERO DE CONTRATO SIGMA", "ESTADO DEL CONTRATO SIGMA", "COMODATOS TERRITORIALES",
    "PROCESO EN EL QUE SE ENCUENTRA COMERCIAL",
  ];

  /* ---------------- Lectura de CSV ---------------- */
  function decodificar(bytes) {
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes.subarray(3));
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch (e) { return new TextDecoder("windows-1252").decode(bytes); }
  }
  function separador(texto) {
    const linea = texto.slice(0, Math.max(0, texto.indexOf("\n")) || 5000);
    const n = (c) => linea.split(c).length - 1;
    const c = [[";", n(";")], ["\t", n("\t")], [",", n(",")]].sort((a, b) => b[1] - a[1]);
    return c[0][1] ? c[0][0] : ";";
  }
  // Recorre el CSV y llama fila(campos) por cada registro. Respeta comillas y saltos de línea dentro de comillas.
  function recorrerCsv(texto, sep, fila) {
    const S = sep.charCodeAt(0), Q = 34, N = 10, R = 13;
    const L = texto.length;
    let campos = [], campo = "", i = 0, enComillas = false, inicio = 0;
    while (i < L) {
      const c = texto.charCodeAt(i);
      if (enComillas) {
        if (c === Q) {
          if (texto.charCodeAt(i + 1) === Q) { campo += texto.slice(inicio, i + 1); i += 2; inicio = i; continue; }
          campo += texto.slice(inicio, i); enComillas = false; i++; inicio = i; continue;
        }
        i++; continue;
      }
      if (c === Q && i === inicio && campo === "") { enComillas = true; i++; inicio = i; continue; }
      if (c === S) { campos.push(campo + texto.slice(inicio, i)); campo = ""; i++; inicio = i; continue; }
      if (c === N || c === R) {
        campos.push(campo + texto.slice(inicio, i)); campo = "";
        if (c === R && texto.charCodeAt(i + 1) === N) i++;
        i++; inicio = i;
        fila(campos); campos = [];
        continue;
      }
      i++;
    }
    if (inicio < L || campo || campos.length) { campos.push(campo + texto.slice(inicio, L)); fila(campos); }
  }

  /* ---------------- Construcción de la base en diccionarios ---------------- */
  class Constructor {
    constructor(encabezados) {
      const vistos = {};
      this.cols = [];      // posición en el archivo → índice de columna guardada (o -1)
      this.nombres = [];   // clave normalizada
      this.etiquetas = []; // encabezado original
      encabezados.forEach((h0) => {
        const h = String(h0 ?? "").trim();
        const base = U.normalizar(h);
        if (!base) { this.cols.push(-1); return; }
        vistos[base] = (vistos[base] || 0) + 1;
        const clave = vistos[base] === 1 ? base : `${base} (${vistos[base]})`;
        this.cols.push(this.nombres.length);
        this.nombres.push(clave);
        this.etiquetas.push(h);
      });
      this.mapas = this.nombres.map(() => new Map([["", 0]]));
      this.dict = this.nombres.map(() => [""]);
      this.idx = this.nombres.map(() => []);
      this.n = 0;
    }
    agregar(campos) {
      if (!campos.some((x) => x != null && String(x).trim() !== "")) return;
      for (let p = 0; p < this.cols.length; p++) {
        const k = this.cols[p];
        if (k < 0) continue;
        const v = campos[p] == null ? "" : String(campos[p]).trim();
        const m = this.mapas[k];
        let id = m.get(v);
        if (id === undefined) { id = this.dict[k].length; m.set(v, id); this.dict[k].push(v); }
        this.idx[k].push(id);
      }
      this.n++;
    }
    terminar(meta) {
      return { formato: MAGIA, ...meta, n: this.n, nombres: this.nombres, etiquetas: this.etiquetas, dict: this.dict, idx: this.idx };
    }
  }

  B.desdeCsv = function (bytes, nombreArchivo) {
    const texto = decodificar(bytes);
    const sep = separador(texto);
    let cons = null;
    recorrerCsv(texto, sep, (campos) => {
      if (!cons) {
        // La fila de encabezados es la primera que tenga FOLIO DE MATRICULA o FMI
        const n = campos.map(U.normalizar);
        if (n.some((x) => B.COL.fmi.includes(x))) cons = new Constructor(campos);
        return;
      }
      cons.agregar(campos);
    });
    if (!cons) throw new Error("No encontré la columna FOLIO DE MATRÍCULA en el archivo.");
    return cons.terminar({ archivo: nombreArchivo || "", generado: U.ahora() });
  };

  B.desdeXlsx = async function (buffer, nombreArchivo) {
    const libro = await IP.xlsx.leer(buffer);
    const hoja = libro.hojas.reduce((a, b) => (b.filas.length > a.filas.length ? b : a), libro.hojas[0]);
    let cons = null;
    for (const f of hoja.filas) {
      const campos = (f || []).map((x) => (x instanceof Date ? x.toISOString().slice(0, 10) : x));
      if (!cons) { if (campos.map(U.normalizar).some((x) => B.COL.fmi.includes(x))) cons = new Constructor(campos); continue; }
      cons.agregar(campos);
    }
    if (!cons) throw new Error("No encontré la columna FOLIO DE MATRÍCULA en el Excel.");
    return cons.terminar({ archivo: nombreArchivo || "", generado: U.ahora() });
  };

  /* ---------------- Cifrado ---------------- */
  async function clave(contrasena, sal) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(contrasena), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sal, iterations: ITERACIONES, hash: "SHA-256" },
      material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function comprimir(bytes) {
    const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function descomprimir(bytes) {
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  B.cifrar = async function (datos, contrasena) {
    const json = new TextEncoder().encode(JSON.stringify(datos));
    const gz = await comprimir(json);
    const sal = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const k = await clave(contrasena, sal);
    const cif = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, gz));
    const cab = new TextEncoder().encode(MAGIA);
    return new Blob([cab, sal, iv, cif], { type: "application/octet-stream" });
  };

  B.descifrar = async function (bytes, contrasena) {
    const cab = new TextDecoder().decode(bytes.subarray(0, 8));
    if (cab !== MAGIA) throw new Error("El archivo no es una base cifrada de esta página.");
    const sal = bytes.subarray(8, 24), iv = bytes.subarray(24, 36), cif = bytes.subarray(36);
    const k = await clave(contrasena, sal);
    let gz;
    try { gz = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, k, cif)); }
    catch (e) { throw new Error("Contraseña incorrecta."); }
    return JSON.parse(new TextDecoder().decode(await descomprimir(gz)));
  };

  B.esCifrado = (bytes) => bytes.length > 36 && new TextDecoder().decode(bytes.subarray(0, 8)) === MAGIA;

  /* ---------------- Base lista para consultar ---------------- */
  // Unidad → factor a m²
  function factorUnidad(u) {
    const n = U.normalizar(u);
    if (!n || /METRO|^M2$|^MTS?2?$/.test(n)) return 1;
    if (/HECT|^HAS?$/.test(n)) return 10000;
    if (/FANEG|PLAZA|^CUADRAS?$/.test(n)) return 6400;
    if (/VARA/.test(n)) return 0.64;
    return 1;
  }

  class Base {
    constructor(d) {
      this.d = d;
      this.n = d.n;
      this.nombres = d.nombres;
      this.etiquetas = d.etiquetas;
      this.pos = new Map(d.nombres.map((x, i) => [x, i]));
      this.idx = d.idx.map((a) => (Array.isArray(a) ? Uint32Array.from(a) : a));
      this.dict = d.dict;
      this.archivo = d.archivo; this.generado = d.generado;
      // Columnas que usa la página
      this.c = {};
      for (const [k, ops] of Object.entries(B.COL)) {
        const i = ops.map((o) => this.pos.get(o)).find((x) => x !== undefined);
        this.c[k] = i === undefined ? -1 : i;
      }
      this.noAplica = B.NO_APLICA.map((n) => this.pos.get(n)).filter((x) => x !== undefined);
      this.faltan = B.NO_APLICA.filter((n) => !this.pos.has(n));
      // Áreas en m²
      this.areaT = this.areas("area_terreno", "unidad_terreno");
      this.areaC = this.areas("area_construida", "unidad_construida");
      // FMI normalizado → filas
      this.porFmi = new Map();
      if (this.c.fmi >= 0) {
        const dn = this.dict[this.c.fmi].map((v) => U.normalizarMatricula(v));
        const ix = this.idx[this.c.fmi];
        for (let r = 0; r < this.n; r++) {
          const k = dn[ix[r]];
          if (!k) continue;
          if (!this.porFmi.has(k)) this.porFmi.set(k, []);
          this.porFmi.get(k).push(r);
        }
      }
      // Cédulas catastrales dañadas por Excel (notación científica)
      this.cedulasDanadas = 0;
      if (this.c.cedula >= 0) {
        const mal = this.dict[this.c.cedula].map((v) => /^\d(?:[.,]\d+)?E\+\d+$/i.test(v));
        const ix = this.idx[this.c.cedula];
        for (let r = 0; r < this.n; r++) if (mal[ix[r]]) this.cedulasDanadas++;
      }
    }
    areas(col, unidad) {
      const out = new Float64Array(this.n).fill(NaN);
      const ic = this.c[col], iu = this.c[unidad];
      if (ic < 0) return out;
      const nums = this.dict[ic].map((v) => (v === "" ? NaN : (U.numeroColombiano(v) ?? NaN)));
      const fac = iu >= 0 ? this.dict[iu].map(factorUnidad) : null;
      const a = this.idx[ic], b = iu >= 0 ? this.idx[iu] : null;
      for (let r = 0; r < this.n; r++) out[r] = nums[a[r]] * (fac ? fac[b[r]] : 1);
      return out;
    }
    valor(r, col) {
      const i = typeof col === "number" ? col : (this.c[col] ?? this.pos.get(col) ?? -1);
      return i < 0 || i === undefined ? "" : this.dict[i][this.idx[i][r]];
    }
    // Fila completa como objeto { encabezado original: valor }
    fila(r) {
      const o = {};
      this.nombres.forEach((n, i) => { o[this.etiquetas[i]] = this.dict[i][this.idx[i][r]]; });
      return o;
    }
    // Lo que necesitan los módulos del investigador de predios (mismo formato que una fila del Excel de la empresa)
    registro(r) {
      const v = (k) => U.limpiar(this.valor(r, k));
      const ced = v("cedula");
      return {
        _fila_base: r, fmi: v("fmi"), circulo: v("circulo"), departamento: v("departamento"), municipio: v("municipio"),
        vereda: v("vereda"), direccion: v("direccion"), descripcion: v("descripcion"),
        cedula_catastral: /E\+/i.test(ced) ? "" : ced, propiedad_horizontal: v("ph"),
      };
    }
    // Valores distintos de una columna con su conteo sobre las filas dadas
    conteos(col, filas) {
      const i = typeof col === "number" ? col : this.pos.get(col);
      const cuenta = new Uint32Array(this.dict[i].length);
      const ix = this.idx[i];
      if (filas) for (const r of filas) cuenta[ix[r]]++;
      else for (let r = 0; r < this.n; r++) cuenta[ix[r]]++;
      return this.dict[i].map((v, k) => [v, cuenta[k]]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
    }
  }
  B.Base = Base;
})(typeof window !== "undefined" ? window : globalThis);
