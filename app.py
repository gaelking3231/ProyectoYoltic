import sys
import os

# Añadir la carpeta machine_learning al path
sys.path.append(os.path.join(os.path.dirname(__file__), "machine_learning"))

# Importar y ejecutar el servidor
import asyncio
import os
import sys

# Forzar flush de logs para verlos en tiempo real en Azure
print("--- [DEBUG] Cargando servidor Yoltic ---", flush=True)

try:
    from machine_learning.inference_hybrid import main
    print("--- [DEBUG] Importación exitosa ---", flush=True)
except Exception as e:
    print(f"--- [ERROR] Falló la importación: {str(e)} ---", flush=True)
    sys.exit(1)

if __name__ == "__main__":
    try:
        # Azure asigna el puerto en la variable PORT
        port = int(os.environ.get("PORT", 8080))
        print(f"--- Servidor AI Yoltic Dual activo en puerto {port} ---", flush=True)
        
        # Arrancar el loop de asyncio
        asyncio.run(main())
    except Exception as e:
        print(f"--- [CRASH] El servidor se detuvo: {str(e)} ---", flush=True)
        sys.exit(1)
