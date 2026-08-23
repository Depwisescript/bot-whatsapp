import re

file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

# Remove any existing proxy load logic if it exists (it probably doesn't)
# Insert the toggle logic after cfg-autoreply
target = "document.getElementById('cfg-autoreply').value ="
if target in html:
    # Find the end of this line
    idx = html.find('\n', html.find(target))
    
    new_logic = """
                const pxy = env.YOUTUBE_PROXY !== undefined ? env.YOUTUBE_PROXY : 'socks5://38.250.116.74:1080';
                if(pxy && pxy.trim() !== '') {
                    document.getElementById('cfg-proxy-toggle').checked = true;
                    document.getElementById('cfg-proxy').value = pxy;
                    document.getElementById('cfg-proxy').style.display = 'block';
                } else {
                    document.getElementById('cfg-proxy-toggle').checked = false;
                    document.getElementById('cfg-proxy').value = 'socks5://38.250.116.74:1080';
                    document.getElementById('cfg-proxy').style.display = 'none';
                }
"""
    
    html = html[:idx] + new_logic + html[idx:]
    with open(file_html, 'w', encoding='utf-8') as f:
        f.write(html)
    print("Fixed loadSettings!")
else:
    print("Target not found.")

