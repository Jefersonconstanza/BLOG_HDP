//Controla la carga de posts, paginación, eventos generales del sitio
let posts = [];
let paginaActual = 1;
const POSTS_POR_PAGINA = 10;

function iniciarMain() {
  if (typeof db === "undefined") {
    setTimeout(iniciarMain, 100);
    return;
  }
  configurarEventos();
  cargarPosts();
}

function configurarEventos() {
  const filtro = document.getElementById("filtroCategoria");
  const busqueda = document.getElementById("busqueda");

  if (filtro) {
    filtro.addEventListener("change", () => {
      paginaActual = 1;
      filtrarYCargarPosts();
    });
  }

  if (busqueda) {
    busqueda.addEventListener("input", () => {
      paginaActual = 1;
      filtrarYCargarPosts();
    });
  }
}

function cargarPosts(callback = null) {
  posts = [];
  const tx = db.transaction("posts", "readonly");
  tx.objectStore("posts").openCursor().onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const post = cursor.value;
      if (validatePost(post)) posts.push(post);
      cursor.continue();
    } else {
      posts.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      if (document.getElementById("contenedorPosts")) {
        filtrarYCargarPosts();
      }
      if (typeof callback === "function") {
        callback(posts);
      }
    }
  };
}

function filtrarYCargarPosts() {
  const categoriaInput = document.getElementById("filtroCategoria");
  const busquedaInput = document.getElementById("busqueda");

  const categoria = categoriaInput ? categoriaInput.value : "todas";
  const termino = busquedaInput ? busquedaInput.value.toLowerCase().trim() : "";

  let filtrados = [...posts];
  if (categoria !== "todas") filtrados = filtrados.filter(p => p.categoria === categoria);
  if (termino) filtrados = filtrados.filter(p =>
    p.titulo.toLowerCase().includes(termino) || p.contenido.toLowerCase().includes(termino)
  );

  mostrarPostsPaginados(filtrados);
}

function mostrarPostsPaginados(lista) {
  const cont = document.getElementById("contenedorPosts");
  const pag = document.getElementById("paginacion");

  if (!cont) return;

  cont.innerHTML = "";
  if (pag) pag.innerHTML = "";

  if (!lista.length) {
    cont.innerHTML = `<p class="text-muted">No se encontraron publicaciones.</p>`;
    return;
  }

  const total = Math.ceil(lista.length / POSTS_POR_PAGINA);
  const inicio = (paginaActual - 1) * POSTS_POR_PAGINA;
  lista.slice(inicio, inicio + POSTS_POR_PAGINA).forEach(mostrarPost);

  if (pag) {
    for (let i = 1; i <= total; i++) {
      const btn = document.createElement("button");
      btn.textContent = i;
      btn.className = `btn btn-sm ${i === paginaActual ? "btn-primary" : "btn-outline-primary"}`;
      btn.onclick = () => { paginaActual = i; mostrarPostsPaginados(lista); };
      pag.appendChild(btn);
    }
  }
}

function validatePost(p) {
  return p && p.id >= 0 && p.titulo && p.contenido && p.categoria && p.fecha && p.autor;
}

function mostrarPost(post) {
  const cont = document.getElementById("contenedorPosts");
  if (!cont) return;

  const card = document.createElement("div");
  card.className = "col-md-6 col-lg-4 d-flex justify-content-center align-items-stretch mb-4";

  const portada = post.portada || 'img/portada_default.jpg';
  const fechaFormat = new Date(post.fecha).toLocaleString();

  const likeBtnID = `likeBtn-${post.id}`;
  const likeCountID = `likeCount-${post.id}`;

  card.innerHTML = `
    <div class="card shadow post-card" style="width: 100%;">
      <img src="${portada}" class="card-img-top" alt="Imagen del post">
      <div class="card-body d-flex flex-column">
        <h5 class="card-title">${post.titulo}</h5>
        <p class="card-text"><strong>Autor:</strong> ${post.autor}</p>
        <p class="card-text"><strong>Categoría:</strong> ${post.categoria}</p>
        <p class="card-text">Publicado: ${fechaFormat}</p>
        <p class="card-text"><strong>Likes:</strong> <span id="${likeCountID}">0</span></p>
        <div class="mt-auto d-flex justify-content-between">
          <button id="${likeBtnID}" class="btn btn-danger btn-sm" onclick="darLike(${post.id})">❤️ Me gusta</button>
          <button class="btn btn-primary btn-sm" onclick="verDetallePost(${post.id})">Ver más</button>
        </div>
      </div>
    </div>
  `;

  cont.appendChild(card);
  actualizarEstadoLike(post.id); // actualiza el texto del contador
  contarLikes(post.id);          // actualiza el valor en el span
}

function verDetallePost(id) {
  localStorage.setItem("postID", id);
  window.location.href = "post.html";
}

//LIKES
function darLike(postID) {
  const user = JSON.parse(sessionStorage.getItem("usuarioActivo"));
  if (!user) return alert("Debes iniciar sesión para dar me gusta.");

  const tx = db.transaction("likes", "readwrite");
  const store = tx.objectStore("likes");
  const index = store.index("postID_usuario");

  index.get([postID, user.usuario]).onsuccess = (e) => {
    const resultado = e.target.result;

    if (resultado) {
      store.delete(resultado.id).onsuccess = () => {
        actualizarEstadoLike(postID);
        contarLikes(postID);
      };
    } else {
      store.add({ postID, usuario: user.usuario }).onsuccess = () => {
        actualizarEstadoLike(postID);
        contarLikes(postID);
      };
    }
  };
}

function actualizarEstadoLike(postID) {
  const btn = document.getElementById(`likeBtn-${postID}`);
  if (!btn) return;
  const user = JSON.parse(sessionStorage.getItem("usuarioActivo"));
  if (!user) return;

  const tx = db.transaction("likes", "readonly");
  const index = tx.objectStore("likes").index("postID_usuario");

  index.get([postID, user.usuario]).onsuccess = (e) => {
    const like = e.target.result;
    if (like) {
      btn.classList.remove("btn-outline-danger");
      btn.classList.add("btn-danger");
      btn.textContent = "💔 Quitar Me gusta";
    } else {
      btn.classList.remove("btn-danger");
      btn.classList.add("btn-outline-danger");
      btn.textContent = "❤️ Me gusta";
    }
  };
}

function contarLikes(postID) {
  const countEl = document.getElementById(`likeCount-${postID}`);
  if (!countEl) return;
  let count = 0;

  const tx = db.transaction("likes", "readonly");
  const store = tx.objectStore("likes");
  const index = store.index("postID");
  const req = index.openCursor(IDBKeyRange.only(postID));

  req.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      count++;
      cursor.continue();
    } else {
      countEl.textContent = `${count} ${count === 1 ? "me gusta" : "me gustas"}`;
    }
  };
}

function cerrarSesion() {
  if (confirm("¿Estás seguro que deseas cerrar sesión?")) {
    sessionStorage.removeItem("usuarioActivo");
    window.location.href = "login.html";
  }
}

function verificarBotonCerrarSesion() {
  const user = JSON.parse(sessionStorage.getItem("usuarioActivo"));
  const btn = document.getElementById("botonCerrarSesion");
  if (btn) {
    btn.style.display = user ? "inline-block" : "none";
  }
}

document.addEventListener("DOMContentLoaded", verificarBotonCerrarSesion);

const toggle = document.getElementById("darkModeToggle");
const body = document.body;

if (localStorage.getItem("dark-mode") === "enabled") {
  body.classList.add("dark-mode");
}

toggle?.addEventListener("click", () => {
  body.classList.toggle("dark-mode");
  const enabled = body.classList.contains("dark-mode");
  localStorage.setItem("dark-mode", enabled ? "enabled" : "disabled");
});

iniciarMain();