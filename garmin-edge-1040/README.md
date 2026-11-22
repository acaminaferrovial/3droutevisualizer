# Route3D Live — Campo de Datos para Garmin Edge 1040

Este proyecto **Garmin Connect IQ (Monkey C)** añade una pantalla de datos aumentados en tu **Garmin Edge 1040** conectada en tiempo real a tu servidor privado de **Route3D**.

Mientras sigues tu GPX con el mapa nativo y ClimbPro, al deslizar a esta pantalla verás en base a tu ubicación GPS y rumbo real:
- **Viento relativo al manillar** (flecha rotada dinámicamente + `FAVOR` / `LATERAL` / `CONTRA`), rachas e impacto estimado en vatios (`+W` / `-W`).
- **Temperatura, sensación térmica y probabilidad de lluvia** en tu posición.
- **Fuente de agua potable más cercana** (tus fuentes privadas + OpenStreetMap en 3.5 km).
- **Segmento privado más cercano** (distancia y pendiente media).

---

## Cómo compilar e instalar en tu Garmin Edge 1040

1. **Instala el SDK oficial de Garmin Connect IQ**
   - Descarga el **Connect IQ SDK Manager** desde [developer.garmin.com/connect-iq/sdk](https://developer.garmin.com/connect-iq/sdk/).
   - Instala la extensión oficial **Monkey C** en VS Code y genera tu clave de desarrollador (`.der`) desde la paleta (`Monkey C: Generate a Developer Key`).

2. **Prueba en el simulador del Edge 1040**
   - Abre la carpeta `garmin-edge-1040/` en VS Code.
   - Ejecuta `Monkey C: Run` seleccionando el dispositivo **`edge1040`**.
   - En el simulador puedes simular una ruta GPS (`Simulation → Fit Data`) y configurar `apiUrl` y `apiKey` desde `File → Edit Persistent Storage → Edit Application.Properties Data`.

3. **Obtén tu clave privada en Route3D**
   - Entra en **Route3D → Mi Perfil → Integración Garmin Edge 1040** y pulsa **Generar clave Garmin**.
   - Copia la clave (`r3d_...`) y la URL de tu servidor en PRO (`https://tu-dominio-pro.com/api/garmin/live`).

4. **Instalar en tu Garmin Edge 1040 físico**
   - **Opción rápida (USB):** compila con `Monkey C: Build for Device` (`edge1040`) y copia el archivo `.prg` generado a la carpeta `GARMIN/APPS` del Edge 1040 conectado por USB.
   - **Opción recomendada (Beta privada en Connect IQ Store):** empaqueta un `.iq` (`Monkey C: Export Project`) y súbelo como **Beta App** en la Connect IQ Store. Solo tú podrás verla e instalarla desde tu móvil, y además podrás cambiar la URL y tu clave API cómodamente desde la app **Garmin Connect IQ** del teléfono.
