# 🤖 WhatsApp Group Bot

Bot de control y moderación para grupos de WhatsApp. Construido con [Baileys](https://github.com/WhiskeySockets/Baileys) + TypeScript.

## ⚡ Características

- **Comandos Admin:** `!kick`, `!ban`, `!warn`, `!promote`, `!demote`
- **Auto-Moderación:** Anti-links, anti-spam, anti-ventas
- **Sistema 2-Strike:** 1ra infracción = advertencia, 2da = expulsión
- **Bienvenida/Despedida** automáticas
- **Ban permanente** con auto-kick si reingresa

## 📋 Requisitos

- **Node.js** 20+ LTS
- **npm** 9+

## 🚀 Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Depwisescript/bot-whatsapp.git
cd bot-whatsapp

# 2. (VPS Ubuntu) Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Instalar dependencias
npm install

# 4. Configurar .env
cp .env.example .env
nano .env
# → OWNER_NUMBER=tu_numero_con_codigo_pais (ej: 5491112345678)

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
| `!warn @user [razón]` | Dar advertencia manual |
| `!warnings @user` | Ver advertencias |
| `!resetwarn @user` | Resetear advertencias |
| `!promote @user` | Hacer admin |
| `!demote @user` | Quitar admin |

### Generales (todos)
| Comando | Descripción |
|---|---|
| `!help` | Lista de comandos |
| `!rules` | Reglas del grupo |
| `!info` | Información del grupo |

## 🛡️ Auto-Moderación

Detecta automáticamente:
- Links de grupos de WhatsApp (`chat.whatsapp.com`)
- Links de Telegram (`t.me`)
- Links de Discord (`discord.gg`)
- Mensajes de ventas/promoción con datos de contacto
- Spam/flood (5+ mensajes en 10 segundos)

**Los admins están exentos de la moderación automática.**

## 🚀 Producción (VPS Ubuntu)

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

## 📁 Estructura

```
src/
├── index.ts              # Entry point
├── config.ts             # Configuración
├── connection.ts         # Conexión WhatsApp
├── commands/
│   ├── index.ts          # Registry de comandos
│   ├── admin.commands.ts # Comandos admin
│   └── general.commands.ts
├── handlers/
│   ├── message.handler.ts  # Router de mensajes
│   ├── moderation.handler.ts # Auto-moderación
│   └── group.handler.ts     # Eventos de grupo
└── services/
    └── db.service.ts     # SQLite (warnings/bans)
```
