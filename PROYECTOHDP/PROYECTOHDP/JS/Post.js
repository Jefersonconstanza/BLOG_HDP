//Carga de comentarios, publicación y validaciones dentro de un post
function mostrarFormularioComentario(postID) {
  const user = JSON.parse(sessionStorage.getItem("usuarioActivo"));
  if (!user || user.rol === "admin") return;

  const contenedor = document.getElementById(`formComentario-${postID}`);
  contenedor.innerHTML = `
    <form onsubmit="enviarComentario(${postID}); return false;">
      <div class="mb-2">
        <textarea id="comentarioTexto-${postID}" class="form-control" placeholder="Escribe tu comentario..." required></textarea>
      </div>
      <button type="submit" class="btn btn-sm btn-success">Enviar comentario</button>
    </form>
  `;
}

function enviarComentario(postID) {
  const texto = document.getElementById(`comentarioTexto-${postID}`).value.trim();
  const user = JSON.parse(sessionStorage.getItem("usuarioActivo"));
  if (!texto || !user) return;

  //Validar si el usuario está silenciado
  const tx = db.transaction("usuarios", "readonly");
  const store = tx.objectStore("usuarios");
  const req = store.get(user.usuario);

  req.onsuccess = () => {
    const usuarioBD = req.result;
    if (usuarioBD && usuarioBD.silenciado) {
      alert("No puedes comentar porque estás silenciado por un administrador.");
      return;
    }

    const comentario = {
      id: Date.now(),
      postID,
      usuario: user.usuario,
      texto,
      estado: "pendiente"
    };

    const txComentario = db.transaction("comentarios", "readwrite");
    txComentario.objectStore("comentarios").add(comentario).onsuccess = () => {
      alert("Comentario enviado. Espera la aprobación del administrador.");
      document.getElementById(`comentarioTexto-${postID}`).value = "";
    };
  };
}

function mostrarComentarios(postID) {
  const contenedor = document.getElementById(`comentarios-${postID}`);
  const tx = db.transaction("comentarios", "readonly");
  const index = tx.objectStore("comentarios").index("postID");

  let hayComentarios = false;

  index.openCursor(IDBKeyRange.only(postID)).onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const comentario = cursor.value;
      if (comentario.estado === "aprobado" || comentario.estado === "oculto") {
        contenedor.innerHTML += `
          <div class="border p-2 mb-2">
            <strong>${comentario.usuario}:</strong> ${comentario.texto}
            <span class="badge bg-${comentario.estado === "aprobado" ? "success" : "secondary"}">${comentario.estado}</span>
          </div>
        `;
        hayComentarios = true;
      }
      cursor.continue();
    } else if (!hayComentarios) {
      contenedor.innerHTML = `<p class="text-muted">Sin comentarios visibles.</p>`;
    }
  };
}
