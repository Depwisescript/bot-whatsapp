import re

file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

old_loadWarnings = """        async function loadWarnings() {
            const res = await fetch('/api/dashboard/warnings', { headers: { 'X-Auth-Token': authToken }});
            const data = await res.json();
            const container = document.getElementById('spam-container');
            if(!data.warnings || data.warnings.length === 0) {
                container.innerHTML = '<div class="empty-state">✅ No hay infracciones recientes.</div>';
                return;
            }
            let h = '<table class="files-table"><thead><tr><th>Grupo</th><th>Usuario</th><th>Advertencias</th><th>Acción</th></tr></thead><tbody>';
            data.warnings.forEach(w => {
                const userNum = w.user_jid.split('@')[0];
                h += `<tr>
                    <td style="font-size:12px; color:gray;">${w.group_jid.split('@')[0]}</td>
                    <td class="file-name-cell">+${userNum}</td>
                    <td>${w.count}</td>
                    <td><button class="btn btn-danger" onclick="clearWarning('${w.group_jid}', '${w.user_jid}')">Perdonar</button></td>
                </tr>`;
            });
            h += '</tbody></table>';
            container.innerHTML = h;
        }"""

new_loadWarnings = """        async function loadWarnings() {
            let groupMap = {};
            try {
                const resG = await fetch('/api/dashboard/groups', { headers: { 'X-Auth-Token': authToken }});
                const dataG = await resG.json();
                if(dataG.groups) {
                    dataG.groups.forEach(g => {
                        groupMap[g.id] = g.subject;
                    });
                }
            } catch(e) {}

            const res = await fetch('/api/dashboard/warnings', { headers: { 'X-Auth-Token': authToken }});
            const data = await res.json();
            const container = document.getElementById('spam-container');
            if(!data.warnings || data.warnings.length === 0) {
                container.innerHTML = '<div class="empty-state">✅ No hay infracciones recientes.</div>';
                return;
            }
            let h = '<div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 10px;"><table class="files-table"><thead><tr><th>Grupo</th><th>Usuario</th><th>Warns</th><th>Acción</th></tr></thead><tbody>';
            data.warnings.forEach(w => {
                const userNum = w.user_jid.split('@')[0];
                const groupName = groupMap[w.group_jid] || w.group_jid.split('@')[0];
                h += `<tr>
                    <td style="font-size:12px; color:#a0aabf; font-weight: bold;">${groupName}</td>
                    <td class="file-name-cell"><a href="https://wa.me/${userNum}" target="_blank" style="color:var(--primary); text-decoration:none;">+${userNum}</a></td>
                    <td style="text-align: center;"><span style="background:var(--accent); color:white; padding: 2px 8px; border-radius: 10px; font-size:12px; font-weight: bold;">${w.count}</span></td>
                    <td style="text-align: center;"><button class="btn btn-danger" style="padding: 4px 8px; font-size:12px;" onclick="clearWarning('${w.group_jid}', '${w.user_jid}')">Perdonar</button></td>
                </tr>`;
            });
            h += '</tbody></table></div>';
            container.innerHTML = h;
        }"""

html = html.replace(old_loadWarnings, new_loadWarnings)

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)
print("Warnings table patched!")
