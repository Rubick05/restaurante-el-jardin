# Guía de Instalación y Despliegue — Sistema Restaurante El Jardín
> Versión offline-first para uso en dispositivos móviles del personal

---

## Arquitectura de Datos

```
[Dispositivo Mesero / Cocina]
        │
        ▼
┌─────────────────────────┐
│     App React (PWA)     │
│  ┌───────────────────┐  │
│  │   IndexedDB       │  │  ← Aquí viven TODOS los datos:
│  │   (Dexie.js)      │  │    • Pedidos
│  │                   │  │    • Menú
│  │   ~500 MB disp.   │  │    • Cola de sincronización
│  └───────────────────┘  │
└─────────────────────────┘
        │  (cuando hay WiFi)
        ▼
┌─────────────────────────┐
│   Backend Railway       │
│   PostgreSQL (nube)     │  ← Respaldo opcional en la nube
└─────────────────────────┘
```

**Importante:** La app funciona 100% sin internet. Los datos se guardan en el dispositivo (IndexedDB). Si configuras el backend en Railway, los datos se sincronizan automáticamente cuando haya conexión.

---

## Opción A: Solo WiFi Local (Recomendada para empezar)

Esta es la forma más simple. La app se accede desde el navegador del celular, sin instalar nada.

### Requisitos
- Una computadora/laptop en el restaurante con Windows/Linux/Mac
- Router WiFi (el que ya tienes en el restaurante)
- Celulares de meseros y cocina conectados a ese WiFi

### Pasos

#### 1. Instalar Node.js en la PC del restaurante
- Descargar desde: https://nodejs.org (versión LTS)
- Verificar instalación: abrir CMD y escribir `node --version`

#### 2. Clonar/copiar el proyecto
- Copiar la carpeta `restaurante-pelusa` a la PC del restaurante
- O usar Git: `git clone [url-del-repo]`

#### 3. Instalar dependencias
```bash
# En la carpeta principal del proyecto
npm install

# En la carpeta del servidor
cd server
npm install
cd ..
```

#### 4. Configurar para red local
Editar el archivo `vite.config.ts` para que acepte conexiones de otros dispositivos:
```typescript
export default defineConfig({
  server: {
    host: '0.0.0.0',  // Permite acceso desde la red local
    port: 5173
  }
})
```

#### 5. Iniciar la aplicación
```bash
# Iniciar el frontend (desde la carpeta raíz)
npm run dev
```

#### 6. Encontrar la IP de la PC
En Windows, abrir CMD y ejecutar:
```
ipconfig
```
Buscar `Dirección IPv4`, ejemplo: `192.168.1.100`

#### 7. Acceder desde los celulares
En el navegador de cada celular (Chrome recomendado), escribir:
```
http://192.168.1.100:5173
```

> ⚠️ Todos los dispositivos deben estar conectados al mismo WiFi del restaurante

---

## Opción B: Instalar como App en el Celular (PWA)

Si ya tienes la app corriendo (ya sea en red local o en Railway), los usuarios pueden instalarla en su celular como si fuera una app real.

### En Android (Chrome)
1. Abrir la URL de la app en Chrome
2. Tocar el menú (3 puntos arriba a la derecha)
3. Seleccionar **"Agregar a pantalla de inicio"** o **"Instalar app"**
4. Confirmar — aparecerá un ícono en el escritorio del celular
5. La app funciona offline después del primer uso

### En iPhone (Safari)
1. Abrir la URL en Safari
2. Tocar el botón compartir (cuadrado con flecha)
3. Seleccionar **"Agregar a inicio"**
4. Confirmar

> ✅ Esta es la forma más práctica para el personal: se instala una vez y funciona sin internet

---

## Opción C: APK para Android (Sin need de URL)

Esta opción empaqueta la app como un archivo `.apk` que se instala directamente en los celulares, igual que cualquier otra app de Android. **No necesita URL ni navegador.**

### Requisitos en la PC de desarrollo
- Node.js (ya instalado)
- Java JDK 17+: https://adoptium.net
- Android Studio: https://developer.android.com/studio

### Pasos

#### 1. Instalar Capacitor CLI
```bash
npm install -g @capacitor/cli
```

#### 2. Construir la app para producción
```bash
npm run build
```

#### 3. Sincronizar con Capacitor
```bash
npx cap sync android
```

#### 4. Abrir en Android Studio
```bash
npx cap open android
```

#### 5. Generar el APK
En Android Studio:
- Menú `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
- El archivo `.apk` se genera en `android/app/build/outputs/apk/debug/`

#### 6. Instalar en los celulares
- Copiar el `.apk` al celular (WhatsApp, USB, Google Drive)
- En el celular: `Configuración → Seguridad → Instalar apps de fuentes desconocidas` (activar)
- Abrir el archivo `.apk` y aceptar instalación

---

## Opción D: Despliegue en Railway (Acceso desde cualquier lugar)

Esta opción sube la app a internet para que sea accesible desde cualquier red, no solo el WiFi del restaurante.

### Requisitos
- Cuenta en Railway: https://railway.app
- Cuenta en GitHub con el repositorio del proyecto

### Pasos

#### 1. Subir código a GitHub
```bash
git add .
git commit -m "Deploy producción"
git push origin main
```

#### 2. Crear proyecto en Railway
1. Entrar a https://railway.app
2. `New Project` → `Deploy from GitHub repo`
3. Seleccionar el repositorio

#### 3. Configurar variables de entorno en Railway
En Railway, ir a tu servicio → `Variables`:
```
DATABASE_URL = [la URL de PostgreSQL de Railway]
NODE_ENV = production
PORT = 3001
```

#### 4. Configurar el build
En Railway → `Settings → Build`:
- Build command: `npm install && npm run build`
- Start command: `cd server && npm start`

#### 5. Obtener la URL pública
Railway asigna una URL como: `https://restaurante-jardin.up.railway.app`

Esta URL funciona desde **cualquier celular con internet**, sin importar en qué red esté.

#### 6. Configurar dominio personalizado (opcional)
En Railway → `Settings → Domains` → Agregar dominio propio como `app.restauranteeljardin.com`

---

## Base de Datos: Estado Actual vs. Futuro

### Estado Actual
```
Todos los datos: IndexedDB en cada dispositivo
✅ Funciona offline
✅ No necesita internet
❌ Datos no se comparten entre dispositivos
❌ Si se borra el navegador, se pierden los datos
```

### Estado Futuro (con Railway activo)
```
Datos locales: IndexedDB (para trabajar offline)
         ↕️ se sincronizan
Datos en nube: PostgreSQL en Railway
✅ Funciona offline
✅ Datos compartidos entre todos los dispositivos
✅ Backup automático en la nube
✅ Cocina ve pedidos del mesero en tiempo real
```

> 💡 Para activar la sincronización con Railway, el backend ya está parcialmente implementado. Se necesita completar los endpoints de `/api/sincronizar` y configurar el WebSocket para tiempo real.

---

## Configuración de Red Local Recomendada para el Restaurante

```
Router WiFi del restaurante
         │
    ─────┴─────
    │         │
    PC        WiFi
(servidor)    │
         ─────┴────────────────
         │          │          │
    Celular 1   Celular 2   Tablet
    (Mesero 1)  (Mesero 2)  (Cocina)
```

### Recomendaciones
1. **Asignar IP fija a la PC servidor** — en la configuración del router, para que la URL no cambie
2. **WiFi dedicado** — si es posible, una red WiFi solo para los dispositivos del restaurante (seguridad)
3. **UPS para la PC** — para que el servidor no se caiga si hay corte de luz momentáneo
4. **Chrome en todos los celulares** — mejor soporte para PWA e IndexedDB

---

## Resolución de Problemas Comunes

| Problema | Causa | Solución |
|----------|-------|----------|
| "No puedo acceder desde el celular" | Firewall de Windows | Abrir puerto 5173 en el Firewall de Windows |
| "Los datos no aparecen en otro celular" | Cada dispositivo tiene su IndexedDB | Normal — necesitas Railway para sincronizar |
| "Se perdieron los datos" | Alguien limpió los datos del navegador | Usar Railway como respaldo o hacer export manual |
| "La app no carga sin internet" | PWA no activada | Instalar la app desde el navegador primero con internet |
| Error al instalar APK | "fuentes desconocidas" bloqueado | Activar en Configuración del Android |

---

## Resumen de Opciones

| Opción | Complejidad | Costo | Requiere Internet | Comparte Datos |
|--------|-------------|-------|-------------------|----------------|
| A — WiFi Local | Baja | $0 | Solo WiFi local | No (por ahora) |
| B — PWA Instalada | Muy Baja | $0 | Solo WiFi local | No (por ahora) |
| C — APK Android | Media | $0 | Solo WiFi local | No (por ahora) |
| D — Railway | Alta | ~$25/mes | Sí (cualquier red) | ✅ Sí |

**Recomendación para empezar:** Opción A + B (WiFi local + instalar como PWA). Cuando el negocio lo requiera, migrar a Opción D con Railway para sincronización completa.
