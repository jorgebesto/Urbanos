# Portafolio de folios · SAE

Página web independiente para preparar portafolios de inmuebles a partir de la base de activos de la SAE:

1. **Buscar folios:** filtra la base (cifrada) con reglas base, filtros y un agente de IA (Groq) que convierte la solicitud escrita en filtros.
2. **Portafolio:** por cada folio se pega la consulta del VUR, se busca el polígono en el IGAC y los gestores catastrales, se cargan las fotos (vista aérea, fachada, interiores) y se arma el texto de contextualización.
3. **Documentos:** genera la presentación de portafolio (PowerPoint, plantilla SAE) y el informe técnico (Word y PDF), con vista previa.

Es una página estática (HTML y JavaScript, sin servidor). La consulta a los geoportales de los gestores catastrales (`js/catastro/`) se tomó del proyecto *Investigador de predios*, pero este proyecto es independiente: no lo necesita ni comparte datos con él.

## Publicar en GitHub Pages

1. Cree un repositorio nuevo, por ejemplo `portafolio-sae`, y suba todo el contenido de esta carpeta.
2. En **Settings → Pages**, elija la rama `main` y la carpeta `/ (root)`.
3. La página queda en `https://SU_USUARIO.github.io/portafolio-sae/`.

## La base, cifrada

El repositorio y la página son públicos, así que la base **nunca** se sube sin cifrar. Va en `base/base.enc`:

1. En la página presione **Base** y luego **Actualizar la base**.
2. Elija la exportación del sistema tal cual sale (CSV o Excel). Si la abre y guarda en Excel, la cédula catastral se daña (`5.00E+28`).
3. Escriba una contraseña y descargue `base.enc`.
4. Súbalo a la carpeta `base/`, reemplazando el anterior.

## Agente de IA (Groq)

En el botón **IA** se escribe la API key de Groq, que queda solo en el navegador; el modelo recomendado es `llama-3.3-70b-versatile`.

- **Al filtrar:** a Groq solo van los nombres de las columnas, sus valores posibles y la solicitud.
- **Al mejorar textos:** van los datos del predio sin el nombre ni el documento del propietario.

## Archivos

```
index.html            la página
css/estilos.css       diseño (identidad SAE)
base/base.enc         base cifrada (la crea la misma página)
plantilla/            logos, barra y foto de portada de la plantilla SAE
js/catastro/          lector del VUR y consultas al IGAC (SINIC, base pública) y a los gestores catastrales
js/app/config.js      reglas base, modelo de Groq, colores: lo que se ajusta
js/app/               base, filtros, agente, portafolio, textos, mapas, presentación e informe
js/lib/               PptxGenJS y docx (copiadas para no depender de internet)
```
