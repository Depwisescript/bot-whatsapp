import re

file_db = 'src/services/db.service.ts'
with open(file_db, 'r', encoding='utf-8') as f:
    db = f.read()

# Add table creation
db = db.replace(
    "CREATE TABLE IF NOT EXISTS reminders",
    "CREATE TABLE IF NOT EXISTS contacts (jid TEXT PRIMARY KEY, name TEXT);\n  CREATE TABLE IF NOT EXISTS reminders"
)

# Add functions
new_funcs = """
const stmtUpsertContact = db.prepare('INSERT OR REPLACE INTO contacts (jid, name) VALUES (?, ?)');
const stmtGetContact = db.prepare('SELECT name FROM contacts WHERE jid = ?');
const stmtGetAllContacts = db.prepare('SELECT jid, name FROM contacts');

export function saveContactName(jid: string, name: string) {
    if(!jid || !name) return;
    try { stmtUpsertContact.run(jid, name); } catch(e) {}
}
export function getContactName(jid: string): string | null {
    const res = stmtGetContact.get(jid) as any;
    return res ? res.name : null;
}
export function getAllContacts(): Record<string, string> {
    const rows = stmtGetAllContacts.all() as any[];
    const map: Record<string, string> = {};
    rows.forEach(r => { map[r.jid] = r.name; });
    return map;
}
"""

db = db + "\n" + new_funcs

with open(file_db, 'w', encoding='utf-8') as f:
    f.write(db)


file_msg = 'src/handlers/message.handler.ts'
with open(file_msg, 'r', encoding='utf-8') as f:
    msg = f.read()

msg = msg.replace(
    "import { isMuted, addUserXP, getGroupSettings, addAuditLog } from '../services/db.service';",
    "import { isMuted, addUserXP, getGroupSettings, addAuditLog, saveContactName } from '../services/db.service';"
)

msg = msg.replace(
    "const sender = message.key.participant || remoteJid;",
    "const sender = message.key.participant || remoteJid;\n                if(sender && message.pushName) { saveContactName(sender, message.pushName); }"
)

with open(file_msg, 'w', encoding='utf-8') as f:
    f.write(msg)


file_panel = 'src/panel/panel.ts'
with open(file_panel, 'r', encoding='utf-8') as f:
    panel = f.read()

panel = panel.replace(
    "res.json({ warnings: require('../services/db.service').getAllWarnings() });",
    "res.json({ warnings: require('../services/db.service').getAllWarnings(), contacts: require('../services/db.service').getAllContacts() });"
)

with open(file_panel, 'w', encoding='utf-8') as f:
    f.write(panel)


file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

old_loop = """            data.warnings.forEach(w => {
                const isLid = w.user_jid.includes('@lid');
                const userNum = w.user_jid.split('@')[0];
                const groupName = groupMap[w.group_jid] || w.group_jid.split('@')[0];
                
                let userDisplay = '';
                if (isLid) {
                    userDisplay = `<span style="color: #e6a23c;">👻 Oculto por Privacidad</span><br><span style="font-size: 10px; color: gray;">LID: ${userNum}</span>`;
                } else {
                    userDisplay = `<a href="https://wa.me/${userNum}" target="_blank" style="color:var(--primary); text-decoration:none;">+${userNum}</a>`;
                }"""

new_loop = """            data.warnings.forEach(w => {
                const isLid = w.user_jid.includes('@lid');
                const userNum = w.user_jid.split('@')[0];
                const groupName = groupMap[w.group_jid] || w.group_jid.split('@')[0];
                const contactName = data.contacts && data.contacts[w.user_jid] ? data.contacts[w.user_jid] : null;
                
                let userDisplay = '';
                if (isLid) {
                    let lidLabel = contactName ? `👤 ${contactName}` : '👻 Oculto por Privacidad';
                    userDisplay = `<span style="color: #e6a23c; font-weight: bold;">${lidLabel}</span><br><span style="font-size: 10px; color: gray;">LID: ${userNum}</span>`;
                } else {
                    let normalLabel = contactName ? `${contactName} (+${userNum})` : `+${userNum}`;
                    userDisplay = `<a href="https://wa.me/${userNum}" target="_blank" style="color:var(--primary); text-decoration:none; font-weight:bold;">${normalLabel}</a>`;
                }"""

html = html.replace(old_loop, new_loop)

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)


print("Contacts tracking patched!")
