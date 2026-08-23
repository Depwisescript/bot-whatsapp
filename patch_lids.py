import re

file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

old_loop = """            data.warnings.forEach(w => {
                const userNum = w.user_jid.split('@')[0];
                const groupName = groupMap[w.group_jid] || w.group_jid.split('@')[0];
                h += `<tr>
                    <td style="font-size:12px; color:#a0aabf; font-weight: bold;">${groupName}</td>
                    <td class="file-name-cell"><a href="https://wa.me/${userNum}" target="_blank" style="color:var(--primary); text-decoration:none;">+${userNum}</a></td>
                    <td style="text-align: center;"><span style="background:var(--accent); color:white; padding: 2px 8px; border-radius: 10px; font-size:12px; font-weight: bold;">${w.count}</span></td>
                    <td style="text-align: center;"><button class="btn btn-danger" style="padding: 4px 8px; font-size:12px;" onclick="clearWarning('${w.group_jid}', '${w.user_jid}')">Perdonar</button></td>
                </tr>`;
            });"""

new_loop = """            data.warnings.forEach(w => {
                const isLid = w.user_jid.includes('@lid');
                const userNum = w.user_jid.split('@')[0];
                const groupName = groupMap[w.group_jid] || w.group_jid.split('@')[0];
                
                let userDisplay = '';
                if (isLid) {
                    userDisplay = `<span style="color: #e6a23c;">👻 Oculto por Privacidad</span><br><span style="font-size: 10px; color: gray;">LID: ${userNum}</span>`;
                } else {
                    userDisplay = `<a href="https://wa.me/${userNum}" target="_blank" style="color:var(--primary); text-decoration:none;">+${userNum}</a>`;
                }

                h += `<tr>
                    <td style="font-size:12px; color:#a0aabf; font-weight: bold;">${groupName}</td>
                    <td class="file-name-cell">${userDisplay}</td>
                    <td style="text-align: center;"><span style="background:var(--accent); color:white; padding: 2px 8px; border-radius: 10px; font-size:12px; font-weight: bold;">${w.count}</span></td>
                    <td style="text-align: center;"><button class="btn btn-danger" style="padding: 4px 8px; font-size:12px;" onclick="clearWarning('${w.group_jid}', '${w.user_jid}')">Perdonar</button></td>
                </tr>`;
            });"""

html = html.replace(old_loop, new_loop)

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)
print("LIDs patched!")
