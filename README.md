# 🤖 WhatsApp Group Bot

Bot de control y moderación para grupos de WhatsApp. Construido con [Baileys](https://github.com/WhiskeySockets/Baileys) + TypeScript.

## ⚡ Características

- **Comandos Admin:** `!kick`, `!ban`, `!warn`, `!promote`, `!demote`
- **Auto-Moderación Inteligente (IA):** Filtro anti-links, anti-spam, y un detector de **ventas/publicidad potenciado por IA** que analiza el contexto del mensaje antes de actuar.
- **Filtro Anti-NSFW (IA):** Detecta y elimina imágenes y stickers con contenido inapropiado (+18) automáticamente.
- **Sistema de Infracciones:** Totalmente configurable (por defecto 4 faltas = expulsión automática).
- **Sistema de Niveles (XP):** Gamificación, los usuarios ganan experiencia por mensaje
- **Bienvenida/Despedida Personalizable** con variables (`{user}`, `{group}`)
- **Diversión y Utilidad:** Conversor de stickers, recordatorios, encuestas, traductor, clima
- **🔓 Desencriptador VPN Pro:** Módulo nativo para revelar configuraciones protegidas de HTTP Custom (.hc), HTTP Injector (.ehi), NPV Tunnel, DarkTunnel y SSC Custom directamente desde el chat.
- **Ban permanente** con auto-kick si reingresa
- **Slowmode** para limitar la velocidad de mensajes

## 📋 Requisitos

- **Node.js** 20+ LTS
- **npm** 9+
- **Python 3.8+** y `pip` (para el módulo de desencriptación VPN)

## 🚀 Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Depwisescript/bot-whatsapp.git
cd bot-whatsapp

# 2. (VPS Ubuntu) Instalar Node.js 20 LTS, Python 3 y venv
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs python3-pip python3-venv

# 3. Instalar dependencias Node.js y Python (para Desencriptador VPN)
npm install
python3 -m venv scripts/decryption/venv
./scripts/decryption/venv/bin/pip install pycryptodome argon2-cffi msgpack

# 4. Configurar el archivo de variables de entorno (.env)
cp .env.example .env
nano .env

# --- CÓMO CONFIGURAR EL .ENV ---
# En el archivo .env deberás configurar:
# 1. OWNER_NUMBER: Tu número de WhatsApp con código de país (ej: 51999888777).
# 2. MAX_WARNINGS: Límite de faltas permitidas antes de la expulsión (ej: 4).
# 3. EL MOTOR DE INTELIGENCIA ARTIFICIAL (Elige una opción):
#
#    Opción A (Recomendada: Groq - Ultra Rápido y Gratis):
#    - Borra o deja vacío GEMINI_API_KEY=
#    - Pon tu API Key en OPENAI_API_KEY=gsk_... (consíguela en console.groq.com)
#    - Asegúrate de usar OPENAI_BASE_URL=https://api.groq.com/openai/v1
#    - Usa un modelo válido: OPENAI_MODEL=openai/gpt-oss-120b
#
#    Opción B (Google Gemini Studio):
#    - Pon tu API Key en GEMINI_API_KEY=AIzaSy... (consíguela en aistudio.google.com)
#    - Deja OPENAI_API_KEY vacío.

# 5. Ejecutar en desarrollo
npm run dev

# 6. Escanear QR con WhatsApp → Dispositivos vinculados → Vincular dispositivo
```

## 🔧 Comandos

### Admin (solo admins del grupo)
| Comando | Descripción |
|---|---|
| `!kick @user` | Expulsar miembro |
| `!ban @user` | Expulsar + banear permanente |
| `!unban @user` | Quitar ban permanente |
| `!banlist` | Ver lista de baneados |
| `!mute @user Xm` | Silenciar usuario X minutos/horas |
| `!unmute @user` | Des-silenciar usuario |
| `!warn @user [razón]` | Dar advertencia manual |
| `!warnings @user` | Ver advertencias |
| `!resetwarn @user` | Resetear advertencias |
| `!promote @user` | Hacer admin |
| `!demote @user` | Quitar admin |
| `!link` | Ver enlace de invitación |
| `!tagall [msg]` | Mencionar a todos |
| `!del` | Eliminar mensaje (respondiendo) |
| `!status` | Estado y uso de memoria del bot |
| `!setarchivo [nombre]` | Subir archivo (responder a un archivo) |
| `!delarchivo [id]` | Eliminar archivo compartido por su ID |
| `!archivos` | Listar todos los archivos subidos (muestra los IDs) |
| `!slowmode [tiempo]` | Limitar frecuencia de mensajes (ej. 30s) |
| `!setwelcome [msg]` | Personalizar bienvenida al grupo |
| `!setbye [msg]` | Personalizar despedida del grupo |
| `!antinsfw [on/off]` | Activar/desactivar el filtro IA para imágenes +18 |
| `!logs` | Ver auditoría de acciones de moderación |

### Generales y Diversión (todos)
| Comando | Descripción |
|---|---|
| `!help` | Lista de comandos |
| `!rules` | Reglas del grupo |
| `!info` | Información del grupo |
| `!ia [pregunta]` | Hablar con inteligencia artificial Gemini |
| `!imagine [descripción]` | Generar imagen con IA |
| `!level` | Ver tu nivel y progreso actual |
| `!top` | Ver el top 10 usuarios más activos |
| `!perfil @user` | Ver estadísticas completas de un usuario |
| `!sticker` | Convierte una imagen a sticker (respondiendo a la foto) |
| `!toimg` | Convierte un sticker a imagen |
| `!poll [preg] \| [opc1]...` | Crea una encuesta en el grupo |
| `!remind [tiempo] [txt]`| Crea un recordatorio (ej. 30m, 2h) |
| `!traducir [idioma] [txt]`| Traduce un mensaje usando IA |
| `!clima [ciudad]` | Información meteorológica actual |
| `!dado` / `!moneda` | Tira un dado o lanza una moneda al azar |
| `!archivo [nombre]` | Descargar todos los archivos de esa categoría |
| `!entel` | Descargar archivo(s) de configuración Entel |
| `!bitel` | Descargar archivo(s) de configuración Bitel |
| `!movistar` | Descargar archivo(s) de configuración Movistar |
| `!claro` | Descargar archivo(s) de configuración Claro |
| `!injector` | Descargar APK(s) de Injector |
| `!decrypt` / `!revelar` | Desencriptar archivo VPN (.hc, .ehi, NPV) respondiendo o enviando link |
| `!unconfig` | Alias alternativo para extraer datos de túneles VPN |

## 🔓 Módulo de Desencriptación VPN Pro

El bot cuenta con un motor criptográfico avanzado integrado (Node.js + Python) capaz de romper la ofuscación y extraer los datos de configuraciones de VPN protegidas en milisegundos:

- **Formatos de Archivos Soportados:** HTTP Custom (`.hc`), HTTP Injector (`.ehi`) y NPV Tunnel (`.npv`, `.npvt`).  
  👉 **Uso:** Envía el archivo al grupo o chat y responde a ese archivo escribiendo `!decrypt`, `!revelar` o `!unconfig`.
- **Enlaces Soportados:** Dark Tunnel y SSC Custom.  
  👉 **Uso:** Envía un texto al chat tipo `!decrypt darktunnel://...` o `!revelar ssc://...`.

*Nota: Si la configuración descubierta excede los 3500 caracteres, el bot responderá de forma limpia adjuntando el contenido completo en un archivo `.json` ordenado.*

## 🛡️ Auto-Moderación Inteligente

Detecta automáticamente:
- **Links No Autorizados:** WhatsApp (`chat.whatsapp.com`), Telegram (`t.me`), Discord (`discord.gg`).
- **Spam/Flood:** Si un usuario envía más de 5 mensajes en menos de 10 segundos.
- **Publicidad y Ventas (IA):** El bot intercepta mensajes que contengan palabras como "vendo", "precio" o "oferta". Luego, **le envía el mensaje a la IA para confirmar su contexto**. Si la IA determina que es spam de ventas comercial, el bot elimina el mensaje y aplica una falta.
- **Contenido +18 (IA):** Usa visión artificial para escanear imágenes y stickers.

**Los admins están exentos de la moderación automática.**

## 🚀 Producción (VPS Ubuntu)

### Primera Instalación
```bash
# Compilar
npm run build

# Instalar PM2
npm install -g pm2

# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 🔄 Actualizar Bot (ya instalado)
Si ya tienes el bot instalado y quieres actualizarlo con los últimos cambios:
```bash
# 1. Ir a la carpeta del bot
cd bot-whatsapp

# 2. Traer los cambios del repositorio
git pull origin main

# 3. Instalar dependencias nuevas de Node.js y activar entorno de Python (para VPN Decryptor)
npm install
python3 -m venv scripts/decryption/venv
./scripts/decryption/venv/bin/pip install pycryptodome argon2-cffi msgpack

# 4. Recompilar el código
npm run build

# 5. Reiniciar el bot
pm2 restart wa-group-bot
```

> **Nota:** No necesitas volver a escanear el QR, la sesión se mantiene.

### ⚠️ ¿Qué hacer si se desconecta o vence la sesión de WhatsApp?
Si por algún motivo cierras sesión desde tu celular o WhatsApp desconecta el bot, tendrás que volver a vincularlo generando un nuevo código QR. Para hacerlo, sigue estos pasos en tu consola:

```bash
# 1. Ir a la carpeta del bot
cd bot-whatsapp

# 2. Detener el bot
pm2 stop wa-group-bot

# 3. Borrar la sesión antigua (IMPORTANTE)
rm -rf auth_info

# 4. Volver a iniciar el bot
pm2 start wa-group-bot

# 5. Ver la consola para escanear el NUEVO código QR
pm2 logs wa-group-bot
```
*(Presiona `Ctrl + C` para salir de los logs una vez que lo hayas escaneado).*

### Comandos Útiles de PM2
- `pm2 logs wa-group-bot` — Ver logs en tiempo real (útil para ver el QR)
- `pm2 stop wa-group-bot` — Detener el bot
- `pm2 restart wa-group-bot` — Reiniciar el bot
- `pm2 status` — Ver estado del bot

## 📁 Estructura

```
src/
├── index.ts              # Entry point
├── config.ts             # Configuración
├── connection.ts         # Conexión WhatsApp
├── commands/
│   ├── index.ts          # Registry de comandos
│   ├── admin.commands.ts # Comandos admin
│   ├── general.commands.ts
│   └── extra.commands.ts # Comandos extra y desencriptación VPN
├── handlers/
│   ├── message.handler.ts  # Router de mensajes
│   ├── moderation.handler.ts # Auto-moderación
│   └── group.handler.ts     # Eventos de grupo
├── services/
│   ├── db.service.ts         # SQLite (warnings/bans)
│   ├── ai.service.ts         # Integración con Gemini AI
│   ├── file.service.ts       # Gestión de archivos compartidos
│   └── decryption.service.ts # Puente Node.js ↔ Python
└── panel/
    └── panel.ts          # Panel web de administración
```
scripts/
└── decryption/           # Motores Python de criptografía y bridge.py
```

### Configuración de Descargas (Anti-Bloqueo)
El bot utiliza `yt-dlp` para descargar música y videos. Para evitar los bloqueos de Datacenter de YouTube (Errores 403 / Sign in), el bot está configurado para enrutar el tráfico de descarga a través de un proxy SOCKS5 ubicado en una VPS con IP de Perú.
- **Proxy**: `socks5://38.250.116.74:1080`
- **Servicio**: `dante-server`
