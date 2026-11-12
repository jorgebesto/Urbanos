/* Ajustes del portafolio. Se pueden cambiar aquí sin tocar el resto del código. */
(function (g) {
  const IP = (g.IP = g.IP || {});

  IP.PORTAFOLIO = {
    // Archivo de la base cifrada dentro del repositorio
    base_url: "base/base.enc",

    // Reglas base (se aplican siempre que estén marcadas en la página)
    reglas: {
      // Valores que cuentan como "no aplica" en las 12 columnas de trámites, contratos y comodatos
      no_aplica: ["", "#N/D", "#N/A", "N/D", "N/A", "NA", "NO APLICA", "NO", "0", "-"],
      // Un contrato SIGMA en alguno de estos estados no saca al predio
      sigma_ignorar_estados: ["TERMINADO"],
      // ESTADO COMERCIAL permitido
      estado_comercial: ["NO ESTA EN PROCESO COMERCIAL", "PROXIMO EN VENTA", "PENDIENTE PUBLICACION"],
      // VIABLE SI/NO (COMERCIAL) permitido
      viable: ["NO", "0"],
    },

    // Filtros del panel (clave de columna en js/portafolio/base.js → título)
    panel: [
      ["departamento", "Departamento"],
      ["municipio", "Municipio"],
      ["subtipo", "Subtipo activo (urbano / rural)"],
      ["clasificacion", "Clasificación activo"],
      ["activo_social", "Activo social"],
      ["ph", "Propiedad horizontal"],
      ["estado_legal", "Estado legal"],
      ["estado_materializacion", "Estado materialización"],
      ["estado_inventario", "Estado inventario"],
      ["ocupacion", "Estado de ocupación"],
    ],

    // Agente de IA (Groq). La API key NO va aquí: se escribe en la página y queda en el navegador.
    groq: {
      url: "https://api.groq.com/openai/v1/chat/completions",
      modelo: "llama-3.3-70b-versatile",
      modelos: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"],
    },

    // Presentación
    presentacion: {
      codigo_formato: "FO-CC-006  V03 - 01/10/2026",
      tipo_por_defecto: "ESAL",
      azul: "002060",
      azul_boton: "00094A",
      azul_cierre: "0F2B62",
      fuente: "Montserrat",
      fuente_titulo: "Work Sans SemiBold",
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
