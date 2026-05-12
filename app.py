import sys
import os

# Añadir la carpeta machine_learning al path
sys.path.append(os.path.join(os.path.dirname(__file__), "machine_learning"))

# Importar y ejecutar el servidor
from inference_hybrid import main
import asyncio

if __name__ == "__main__":
    asyncio.run(main())
