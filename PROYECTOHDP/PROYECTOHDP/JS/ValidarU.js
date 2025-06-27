//Validación del login y registro de usuarios
document.addEventListener("DOMContentLoaded", () => {
  let checkReady = setInterval(() => {
    if (typeof db !== "undefined" && db) {
      clearInterval(checkReady);

      const formRegistro = document.getElementById("formRegistro");
      const formLogin = document.getElementById("formLogin");

      if (formRegistro) {
        formRegistro.addEventListener("submit", function (e) {
          e.preventDefault();

          const usuario = document.getElementById("registroUsuario").value.trim();
          const correo = document.getElementById("registroCorreo").value.trim().toLowerCase();
          const contrasena = document.getElementById("registroClave").value.trim();
          const mensaje = document.getElementById("mensajeRegistro");

          if (contrasena.length < 8 || !/[!@#$%^&*()+\-_=]/.test(contrasena) || /\s/.test(contrasena)) {
            mensaje.textContent = "La contraseña debe tener al menos 8 caracteres, un símbolo y sin espacios.";
            return;
          }

          const transaccion = db.transaction(["usuarios"], "readwrite");
          const store = transaccion.objectStore("usuarios");
          const buscar = store.get(usuario);

          buscar.onsuccess = () => {
            if (buscar.result) {
              mensaje.textContent = "Ese nombre de usuario ya está registrado.";
            } else {
              const indexCorreo = store.index("correo");
              const checkCorreo = indexCorreo.get(correo);

              checkCorreo.onsuccess = () => {
                if (checkCorreo.result) {
                  mensaje.textContent = "Ese correo ya está registrado.";
                } else {
                  store.add({
                    usuario,
                    correo,
                    contrasena,
                    silenciado: false,
                    rol: "usuario"
                  });
                  mensaje.textContent = "Registro exitoso. Ahora puedes iniciar sesión.";
                  formRegistro.reset();
                }
              };
            }
          };
        });
      }

      if (formLogin) {
        formLogin.addEventListener("submit", function (e) {
          e.preventDefault();

          const correo = document.getElementById("loginCorreo").value.trim().toLowerCase();
          const clave = document.getElementById("loginClave").value.trim();
          const mensaje = document.getElementById("mensajeLogin");

          const transaccion = db.transaction(["usuarios"], "readonly");
          const store = transaccion.objectStore("usuarios");
          const indexCorreo = store.index("correo");
          const buscar = indexCorreo.get(correo);

          buscar.onsuccess = () => {
            const usuario = buscar.result;
            if (usuario && usuario.contrasena === clave) {
              sessionStorage.setItem("usuarioActivo", JSON.stringify(usuario));
              mensaje.textContent = "Inicio de sesión exitoso. Redirigiendo...";
              setTimeout(() => {
                location.href = usuario.rol === "admin" ? "admin.html" : "index.html";
              }, 1000);
            } else {
              mensaje.textContent = "Correo o contraseña incorrectos.";
            }
          };
        });
      }
    }
  }, 100);
});
