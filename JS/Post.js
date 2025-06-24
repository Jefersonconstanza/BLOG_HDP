// js/post.js

let postID = parseInt(localStorage.getItem("postID"));

document.addEventListener("DOMContentLoaded", () => {
  if (!postID) {
    document.getElementById("post").innerText = "Post no encontrado.";
    return;
  }

  cargarPost(postID);
  cargarComentarios(postID);

  const user = JSON.parse(localStorage.getItem("usuarioActivo"));
  if (!user || user.silenciado) {
    document.getElementById("formComentarioContainer").style.display = "none";
  } else {
    document.getElementById("formComentario").addEventListener("submit", (e) => {
      e.preventDefault();
      guardarComentario(postID, user.usuario);
    });
  }
});

function cargarPost(id) {
  const tx = db.transaction(["posts"], "readonly");
  const store = tx.objectStore("posts");
  const get = store.get(id);

  get.onsuccess = () => {
    const post = get.result;
    if (!post) {
      document.getElementById("post").innerText = "Post no encontrado.";
      return;
    }

  document.getElementById("post").innerHTML = `
  <div class="card shadow">
    <img src="${post.portada}" class="card-img-top" alt="Portada del post">
    <div class="card-body">
      <h2 class="card-title">${post.titulo}</h2>
      <p class="text-muted">
        <strong>${post.categoria}</strong> - ${new Date(post.fecha).toLocaleString()}<br>
        Autor: ${post.autor}
      </p>
      <p class="card-text">${post.contenido}</p>
    </div>
  </div>
`;

  };
}

function cargarComentarios(postID) {
  const tx = db.transaction(["comentarios"], "readonly");
  const store = tx.objectStore("comentarios");
  const index = store.index("postID");

  const comentariosDiv = document.getElementById("comentarios");
  comentariosDiv.innerHTML = "";

  index.openCursor(IDBKeyRange.only(postID)).onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const comentario = cursor.value;
      if (comentario.aprobado) {
        comentariosDiv.innerHTML += `
          <div style="margin-bottom: 10px;">
            <p><strong>${comentario.autor}</strong> dijo:</p>
            <p>${comentario.texto}</p>
            <hr>
          </div>
        `;
      }
      cursor.continue();
    }
  };
}

function guardarComentario(postID, autor) {
  const texto = document.getElementById("comentarioTexto").value.trim();
  const estado = document.getElementById("estadoComentario");

  if (texto === "") {
    estado.innerText = "El comentario no puede estar vacío.";
    return;
  }

  const comentario = {
    postID,
    autor,
    texto,
    aprobado: false, // necesita aprobación del admin
    fecha: new Date().toISOString()
  };

  const tx = db.transaction(["comentarios"], "readwrite");
  tx.objectStore("comentarios").add(comentario).onsuccess = () => {
    estado.innerText = "Comentario enviado para revisión.";
    document.getElementById("formComentario").reset();
  };
}
