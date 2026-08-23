import re

file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

old_poll = """        async function pollStatus() {
            if (!authToken) return;
            try {
                const res = await fetch('/api/dashboard/stats', { headers: { 'X-Auth-Token': authToken }});"""

new_poll = """        async function pollStatus() {
            if (!authToken) return;
            
            try {
                fetch('/api/dashboard/bandwidth', { headers: { 'X-Auth-Token': authToken }})
                    .then(r => r.json())
                    .then(data => {
                        if(!data.error && data.interfaces && data.interfaces.length > 0) {
                            const iface = data.interfaces[0];
                            const now = new Date();
                            const currentMonth = now.getMonth() + 1;
                            const currentYear = now.getFullYear();
                            
                            let monthData = null;
                            if(iface.traffic && iface.traffic.month) {
                                monthData = iface.traffic.month.find(m => m.date.year === currentYear && m.date.month === currentMonth);
                            }
                            
                            const rxBytes = monthData ? monthData.rx : iface.traffic.total.rx;
                            const txBytes = monthData ? monthData.tx : iface.traffic.total.tx;
                            
                            const formatBytes = (bytes) => {
                                if(bytes === 0) return '0 B';
                                const k = 1024;
                                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                                const i = Math.floor(Math.log(bytes) / Math.log(k));
                                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                            };
                            
                            document.getElementById('bw-rx').innerText = formatBytes(rxBytes);
                            document.getElementById('bw-tx').innerText = formatBytes(txBytes);
                            document.getElementById('bw-total').innerText = formatBytes(rxBytes + txBytes);
                        }
                    }).catch(() => {});
            } catch(e) {}
            
            try {
                const res = await fetch('/api/dashboard/stats', { headers: { 'X-Auth-Token': authToken }});"""

html = html.replace(old_poll, new_poll)

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)
print("Poll fixed!")
