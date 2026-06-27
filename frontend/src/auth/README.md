# Autenticación (Authentication)

Este módulo contiene la interfaz de usuario de autenticación de DockUS. Es el punto de entrada para que los usuarios inicien sesión o se registren en la plataforma, conectándose con la API de autenticación del backend y delegando la gestión de la sesión resultante al `SessionContext` del sistema.

## Archivos y Responsabilidades

- **`AuthPanel.tsx`**: Componente principal de autenticación que renderiza un formulario dual de login y registro con un diseño académico-premium (tarjeta centrada con logotipo, selector de modo `Entrar`/`Registro` tipo toggle, y transiciones animadas). Gestiona internamente el estado del formulario (email, contraseña, nombre, apellidos y etiqueta de sesión opcional) y alterna entre los modos `LOGIN` y `REGISTER` mediante un estado local. Al enviar el formulario, invoca `authApi.login()` o `authApi.register()` según el modo activo y, tras una respuesta exitosa, ejecuta el callback `onAuthSuccess` que recibe como prop para que el componente padre registre la nueva sesión en el `SessionProvider`. Los mensajes de error y éxito se muestran condicionalmente con estilos diferenciados (rojo para errores, verde para confirmaciones), detectando palabras clave como "error" o "inválid" en el contenido del mensaje para determinar el tono visual.
