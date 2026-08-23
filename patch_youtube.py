import re

file_ts = 'src/services/youtube.service.ts'
with open(file_ts, 'r', encoding='utf-8') as f:
    code = f.read()

# Fix downloadVideo
new_code = """
            await execAsync(command);
            
            if (!fs.existsSync(filePath)) {
                throw new Error("FILE_TOO_LARGE");
            }
            
            const stats = fs.statSync(filePath);"""

code = code.replace("""
            await execAsync(command);
            
            const stats = fs.statSync(filePath);""", new_code)

# Fix downloadAudio as well
new_code_audio = """
            await execAsync(command);
            
            if (!fs.existsSync(filePath)) {
                throw new Error("FILE_TOO_LARGE");
            }
            
            const stats = fs.statSync(filePath);"""
            
code = code.replace("""
            await execAsync(command);
            
            const stats = fs.statSync(filePath);""", new_code_audio)


with open(file_ts, 'w', encoding='utf-8') as f:
    f.write(code)

print("YouTube service patched!")
