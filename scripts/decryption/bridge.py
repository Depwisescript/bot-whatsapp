#!/usr/bin/env python3
import sys
import os
import json

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Falta parámetro (ruta del archivo o enlace)."}), file=sys.stderr)
        sys.exit(1)

    target = sys.argv[1].strip()

    try:
        import Crypto
        import argon2
        import HTTPCUSTOM
        import HTTPINJECTOR
        import NPVTUNNEL
        import DARKTUNNEL
        import SSCCUSTOM
    except ImportError as e:
        print(json.dumps({"error": f"❌ Falta librería Python en la VPS ({str(e)}). Por favor ejecuta: ./scripts/decryption/venv/bin/pip install pycryptodome argon2-cffi msgpack"}), file=sys.stderr)
        sys.exit(1)

    result = None
    first_error = None

    # Si es una URL de Dark Tunnel o SSC
    if target.startswith("darktunnel://"):
        try:
            result = DARKTUNNEL.run(target.encode('utf-8'))
        except Exception as e:
            pass
    elif target.startswith("ssc://"):
        try:
            result = SSCCUSTOM.run(target.encode('utf-8'))
        except Exception as e:
            pass
    elif os.path.exists(target):
        try:
            with open(target, "rb") as f:
                file_bytes = f.read()
        except Exception as e:
            print(json.dumps({"error": f"No se pudo leer el archivo: {str(e)}"}), file=sys.stderr)
            sys.exit(1)

        ext = os.path.splitext(target)[1].lower()
        
        # Intentar según extensión principal
        if ext == ".hc":
            try: result = HTTPCUSTOM.run(file_bytes)
            except Exception: pass
        elif ext == ".ehi":
            try: result = HTTPINJECTOR.run(file_bytes)
            except Exception: pass
        elif ext in [".npv", ".npvt", ".npvtsub"]:
            try: result = NPVTUNNEL.run(file_bytes)
            except Exception: pass
        elif ext == ".dt":
            try: result = DARKTUNNEL.run(file_bytes)
            except Exception: pass

        if result and result.startswith("ERROR:"):
            first_error = result
            result = None
        
        # Si falló o no tiene extensión conocida, probar todos uno por uno en orden
        if not result:
            modules = [HTTPCUSTOM, HTTPINJECTOR, NPVTUNNEL, DARKTUNNEL, SSCCUSTOM]
            for mod in modules:
                try:
                    res = mod.run(file_bytes)
                    if res and isinstance(res, str) and len(res.strip()) > 10 and not res.startswith("ERROR:"):
                        result = res
                        break
                    elif res and res.startswith("ERROR:") and not first_error:
                        first_error = res
                except Exception:
                    continue

    if result and not result.startswith("ERROR:"):
        print(result)
        sys.exit(0)
    elif first_error:
        print(json.dumps({"error": first_error}))
        sys.exit(1)
    else:
        print(json.dumps({"error": "Formato no compatible o archivo corrupto/protegido con un cifrado desconocido."}))
        sys.exit(1)

if __name__ == "__main__":
    main()
