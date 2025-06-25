document.addEventListener("DOMContentLoaded", () => {
  const usuarioActivo = JSON.parse(sessionStorage.getItem("usuarioActivo"));
  if (!usuarioActivo || usuarioActivo.rol !== "admin") {
    alert("Acceso denegado. Solo para administradores.");
    window.location.href = "login.html";
    return;
  }

  // Esperar a que IndexedDB esté lista
  esperarDBListo().then(() => {
    mostrarUsuarios();
    mostrarPosts();
    cargarComentariosPendientes();  // ← Ya existe
    cargarComentariosAprobados();   // ← AÑADE ESTA LÍNEA AQUÍ
  });
});

// Espera activa para asegurar que `db` esté inicializada antes de usarla
function esperarDBListo() {
  return new Promise((resolve) => {
    if (typeof db !== "undefined") {
      resolve();
    } else {
      const intervalo = setInterval(() => {
        if (typeof db !== "undefined") {
          clearInterval(intervalo);
          resolve();
        }
      }, 50);
    }
  });
}

// =================== USUARIOS ===================

function mostrarUsuarios() {
  const tx = db.transaction("usuarios", "readonly");
  const store = tx.objectStore("usuarios");
  const tabla = document.getElementById("tablaUsuarios");
  tabla.innerHTML = "";

  store.openCursor().onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const user = cursor.value;
      tabla.innerHTML += `
        <tr>
          <td>${user.usuario}</td>
          <td>${user.correo}</td>
          <td>${user.rol}</td>
          <td>${user.silenciado ? "Sí" : "No"}</td>
          <td>
            <button class="btn btn-sm btn-${user.silenciado ? "success" : "warning"}" 
              onclick="toggleSilencio('${user.usuario}', ${user.silenciado})">
              ${user.silenciado ? "Desbloquear" : "Silenciar"}
            </button>
            <button class="btn btn-sm btn-danger" onclick="eliminarUsuario('${user.usuario}')">
              Eliminar
            </button>
          </td>
        </tr>
      `;
      cursor.continue();
    }
  };
}

function toggleSilencio(usuario, silenciado) {
  const tx = db.transaction("usuarios", "readwrite");
  const store = tx.objectStore("usuarios");
  const getReq = store.get(usuario);

  getReq.onsuccess = () => {
    const user = getReq.result;
    if (user) {
      user.silenciado = !silenciado;
      store.put(user).onsuccess = mostrarUsuarios;
    }
  };
}

function eliminarUsuario(usuario) {
  if (!confirm(`¿Eliminar al usuario "${usuario}"?`)) return;

  const tx = db.transaction("usuarios", "readwrite");
  tx.objectStore("usuarios").delete(usuario).onsuccess = mostrarUsuarios;
}

// =================== CREAR / EDITAR POST ===================

document.getElementById("formPost").addEventListener("submit", function (e) {
  e.preventDefault();

  const titulo = document.getElementById("titulo").value.trim();
  const contenido = document.getElementById("contenido").value.trim();
  const categoria = document.getElementById("categoria").value;
  const imagenInput = document.getElementById("imagen");
  const autor = JSON.parse(sessionStorage.getItem("usuarioActivo")).usuario;
  const fecha = new Date().toISOString();
  const idEditando = this.dataset.editando;

  if (!titulo || !contenido || !categoria) {
    alert("Todos los campos deben estar completos.");
    return;
  }

  const guardarPost = (portadaFinal) => {
    if (idEditando) {
      const tx = db.transaction("posts", "readwrite");
      const store = tx.objectStore("posts");

      const req = store.get(Number(idEditando));
      req.onsuccess = () => {
        const post = req.result;
        if (post) {
          post.titulo = titulo;
          post.contenido = contenido;
          post.categoria = categoria;
          post.portada = portadaFinal || post.portada || "img/portada_default.jpg";
          post.fecha = fecha;

          store.put(post).onsuccess = () => {
            alert("Post actualizado correctamente.");
            document.getElementById("formPost").reset();
            delete document.getElementById("formPost").dataset.editando;
            mostrarPosts();
          };
        }
      };
    } else {
      const post = {
        titulo,
        contenido,
        categoria,
        portada: portadaFinal || "img/portada_default.jpg",
        autor,
        fecha
      };

      const tx = db.transaction("posts", "readwrite");
      tx.objectStore("posts").add(post).onsuccess = () => {
        alert("Post publicado correctamente.");
        document.getElementById("formPost").reset();
        mostrarPosts();
      };
    }
  };

  if (imagenInput.files.length > 0) {
    const reader = new FileReader();
    reader.onload = () => guardarPost(reader.result);
    reader.readAsDataURL(imagenInput.files[0]);
  } else {
    guardarPost(null); // Para edición, se conserva portada anterior
  }
});

// =================== MOSTRAR / EDITAR / ELIMINAR POSTS ===================

function cargarComentariosAprobados() {
  const contenedor = document.getElementById("comentariosAprobados");
  contenedor.innerHTML = "";

  const tx = db.transaction("comentarios", "readonly");
  const store = tx.objectStore("comentarios");

  store.openCursor().onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const comentario = cursor.value;

      if (comentario.estado === "aprobado" || comentario.estado === "oculto") {
        const div = document.createElement("div");
        div.className = "card mb-3 col-md-6";
        div.innerHTML = `
          <div class="card-body">
            <p><strong>Post ID:</strong> ${comentario.postID}</p>
            <p><strong>Usuario:</strong> ${comentario.usuario}</p>
            <p><strong>Comentario:</strong> ${comentario.texto}</p>
            <p><strong>Estado:</strong> 
              <span class="badge ${comentario.estado === "aprobado" ? "bg-success" : "bg-secondary"}">
                ${comentario.estado}
              </span>
            </p>
            <button class="btn btn-sm btn-${comentario.estado === "aprobado" ? "secondary" : "success"} me-2"
              onclick="alternarVisibilidadComentario(${comentario.id}, '${comentario.estado}')">
              ${comentario.estado === "aprobado" ? "Ocultar" : "Hacer público"}
            </button>
            <button class="btn btn-sm btn-danger" onclick="eliminarComentario(${comentario.id})">
              Eliminar
            </button>
          </div>
        `;
        contenedor.appendChild(div);
      }

      cursor.continue();
    } else if (!contenedor.innerHTML) {
      contenedor.innerHTML = `<p class="text-muted">No hay comentarios aprobados u ocultos.</p>`;
    }
  };
}

function alternarVisibilidadComentario(id, estadoActual) {
  const nuevoEstado = estadoActual === "aprobado" ? "oculto" : "aprobado";
  const tx = db.transaction("comentarios", "readwrite");
  const store = tx.objectStore("comentarios");

  store.get(id).onsuccess = (e) => {
    const comentario = e.target.result;
    if (comentario) {
      comentario.estado = nuevoEstado;
      store.put(comentario).onsuccess = () => {
        cargarComentariosAprobados();
        cargarComentariosPendientes();
        cargarComentariosAprobados();
      };
    }
  };
}

function mostrarPosts() {
  const contenedor = document.getElementById("listaPosts");
  contenedor.innerHTML = "";

  const tx = db.transaction(["posts", "likes"], "readonly");
  const store = tx.objectStore("posts");

  store.openCursor().onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const post = cursor.value;
      const div = document.createElement("div");
      div.className = "card mb-3";

      const portada = post.portada || "img/portada_default.jpg";
      const fechaFormat = new Date(post.fecha).toLocaleString();
      const likeBtnID = `likeBtn-${post.id}`;
      const likeCountID = `likeCount-${post.id}`;
      const comentariosID = `comentarios-${post.id}`;

      div.innerHTML = `
        <img src="${portada}" class="card-img-top" alt="Portada">
        <div class="card-body">
          <h5 class="card-title">${post.titulo}</h5>
          <p>${post.contenido}</p>
          <p><strong>Categoría:</strong> ${post.categoria}</p>
          <p><strong>Autor:</strong> ${post.autor}</p>
          <p><strong>Fecha:</strong> ${fechaFormat}</p>
          <button class="btn btn-sm btn-outline-danger mb-2" id="${likeBtnID}" onclick="verLikesPost(${post.id})">❤️ Ver Me gustas</button>
          <p><small class="text-muted" id="${likeCountID}">Cargando likes...</small></p>
          <button class="btn btn-sm btn-primary me-2" onclick="editarPost(${post.id})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarPost(${post.id})">Eliminar</button>
          <div class="mt-3" id="${comentariosID}"></div>
        </div>
      `;

      contenedor.appendChild(div);

      contarLikes(post.id);
      cargarComentariosAprobadosPorPost(post.id, comentariosID);

      cursor.continue();
    } else if (!contenedor.innerHTML) {
      contenedor.innerHTML = `<p class="text-muted">No hay publicaciones disponibles.</p>`;
    }
  };
}

function verLikesPost(postID) {
  const tx = db.transaction("likes", "readonly");
  const index = tx.objectStore("likes").index("postID");
  const req = index.getAll(IDBKeyRange.only(postID));

  req.onsuccess = () => {
    const likes = req.result;
    if (!likes.length) {
      alert("Este post aún no tiene me gustas.");
    } else {
      const usuarios = likes.map(l => l.usuario).join(", ");
      alert(`Usuarios que dieron me gusta: ${usuarios}`);
    }
  };
}

function contarLikes(postID) {
  const countEl = document.getElementById(`likeCount-${postID}`);
  let count = 0;

  const tx = db.transaction("likes", "readonly");
  const index = tx.objectStore("likes").index("postID");
  index.openCursor(IDBKeyRange.only(postID)).onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      count++;
      cursor.continue();
    } else {
      countEl.textContent = `${count} ${count === 1 ? "me gusta" : "me gustas"}`;
    }
  };
}

function cargarComentariosAprobadosPorPost(postID, contenedorID) {
  const contenedor = document.getElementById(contenedorID);
  const tx = db.transaction("comentarios", "readonly");
  const index = tx.objectStore("comentarios").index("postID");

  let found = false;

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
        found = true;
      }
      cursor.continue();
    } else if (!found) {
      contenedor.innerHTML = `<p class="text-muted">Sin comentarios visibles.</p>`;
    }
  };
}

function eliminarPost(id) {
  if (!confirm("¿Seguro que deseas eliminar este post?")) return;

  const tx = db.transaction("posts", "readwrite");
  tx.objectStore("posts").delete(id).onsuccess = mostrarPosts;
}

function editarPost(id) {
  const tx = db.transaction("posts", "readonly");
  const store = tx.objectStore("posts");

  store.get(id).onsuccess = (e) => {
    const post = e.target.result;
    if (post) {
      document.getElementById("titulo").value = post.titulo;
      document.getElementById("contenido").value = post.contenido;
      document.getElementById("categoria").value = post.categoria;
      document.getElementById("formPost").dataset.editando = post.id;
      alert("Editando post: recuerda presionar 'Publicar' para guardar los cambios.");
    }
  };
}

// =================== MODERACIÓN DE COMENTARIOS ===================

function cargarComentariosPendientes() {
  const contenedor = document.getElementById("comentariosPendientes");
  contenedor.innerHTML = "";

  const tx = db.transaction("comentarios", "readonly");
  const store = tx.objectStore("comentarios");
  const index = store.index("estado");
  const req = index.openCursor("pendiente");

  req.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const comentario = cursor.value;

      const div = document.createElement("div");
      div.className = "card mb-3";
      div.innerHTML = `
        <div class="card-body">
          <p><strong>Post ID:</strong> ${comentario.postID}</p>
          <p><strong>Usuario:</strong> ${comentario.usuario}</p>
          <p><strong>Comentario:</strong> ${comentario.texto}</p>
          <button class="btn btn-success btn-sm" onclick="aprobarComentario(${comentario.id})">Aprobar</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarComentario(${comentario.id})">Eliminar</button>
        </div>
      `;
      contenedor.appendChild(div);

      cursor.continue();
    } else if (!contenedor.innerHTML) {
      contenedor.innerHTML = `<p class="text-muted">No hay comentarios pendientes.</p>`;
    }
  };
}

function aprobarComentario(id) {
  const tx = db.transaction("comentarios", "readwrite");
  const store = tx.objectStore("comentarios");
  const req = store.get(id);

  req.onsuccess = () => {
    const comentario = req.result;
    comentario.estado = "aprobado";
    store.put(comentario);

    tx.oncomplete = () => {
      alert("Comentario aprobado");
      location.reload(); // ← recarga toda la página
    };
  };
}

function eliminarComentario(id) {
  const tx = db.transaction("comentarios", "readwrite");
  tx.objectStore("comentarios").delete(id).onsuccess = cargarComentariosPendientes;
}

function cerrarSesion() {
  if (confirm("¿Estás seguro que deseas cerrar sesión?")) {
    sessionStorage.removeItem("usuarioActivo");
    window.location.href = "login.html";
  }
}

// Mostrar u ocultar el botón si hay usuario activo
function verificarBotonCerrarSesion() {
  const user = JSON.parse(sessionStorage.getItem("usuarioActivo"));
  const btn = document.getElementById("botonCerrarSesion");
  if (btn) {
    btn.style.display = user ? "inline-block" : "none";
  }
}

function cargarComentariosAprobados() {
  const contenedor = document.getElementById("comentariosAprobados");
  contenedor.innerHTML = "";

  const tx = db.transaction(["comentarios", "posts"], "readonly");
  const storeComentarios = tx.objectStore("comentarios");
  const storePosts = tx.objectStore("posts");
  const index = storeComentarios.index("estado");
  const req = index.openCursor("aprobado");

  req.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const comentario = cursor.value;

      // Obtener título del post relacionado
      const postReq = storePosts.get(comentario.postID);
      postReq.onsuccess = () => {
        const post = postReq.result;
        const titulo = post ? post.titulo : "Post no encontrado";

        const div = document.createElement("div");
        div.className = "card mb-2";
        div.innerHTML = `
          <div class="card-body">
            <p><strong>Post:</strong> ${titulo}</p>
            <p><strong>Prueba:</strong> ${comentario.texto}</p>
            <button class="btn btn-danger btn-sm" onclick="eliminarComentarioAprobado(${comentario.id})">Eliminar</button>
          </div>
        `;
        contenedor.appendChild(div);
      };

      cursor.continue();
    }
  };
}
function eliminarComentarioAprobado(id) {
  const tx = db.transaction("comentarios", "readwrite");
  const store = tx.objectStore("comentarios");
  store.delete(id);

  tx.oncomplete = () => {
    alert("Comentario eliminado");
    location.reload(); // refresca la lista
  };
}

// Ejecutarlo cuando cargue todo
document.addEventListener("DOMContentLoaded", verificarBotonCerrarSesion);

  const toggle = document.getElementById("darkModeToggle");
  const body = document.body;

  // Cargar estado previo (si se desea)
  if (localStorage.getItem("dark-mode") === "enabled") {
    body.classList.add("dark-mode");
  }

  toggle.addEventListener("click", () => {
    body.classList.toggle("dark-mode");
    const enabled = body.classList.contains("dark-mode");
    localStorage.setItem("dark-mode", enabled ? "enabled" : "disabled");
  });
