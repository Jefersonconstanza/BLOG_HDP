let db;

const request = indexedDB.open("BlogDB", 2);

request.onerror = function () {
  console.error("Error al abrir la base de datos");
};

request.onupgradeneeded = (event) => {
  db = event.target.result;

  // Crear almacén de usuarios
  if (!db.objectStoreNames.contains("usuarios")) {
    const usuariosStore = db.createObjectStore("usuarios", { keyPath: "usuario" });
    usuariosStore.createIndex("correo", "correo", { unique: true });
  }

  // Crear almacén de posts
  if (!db.objectStoreNames.contains("posts")) {
    const postStore = db.createObjectStore("posts", { keyPath: "id", autoIncrement: true });
    postStore.createIndex("categoria", "categoria", { unique: false });
  }

  // Crear almacén de comentarios
  if (!db.objectStoreNames.contains("comentarios")) {
    const comentarioStore = db.createObjectStore("comentarios", { keyPath: "id", autoIncrement: true });
    comentarioStore.createIndex("postID", "postID", { unique: false });
    comentarioStore.createIndex("estado", "estado", { unique: false });
  }

  // ✅ Crear almacén de likes (uno por usuario y por post)
  if (!db.objectStoreNames.contains("likes")) {
    const likesStore = db.createObjectStore("likes", { keyPath: "id", autoIncrement: true });
    likesStore.createIndex("usuario", "usuario", { unique: false });
    likesStore.createIndex("postID_usuario", ["postID", "usuario"], { unique: true });
    likesStore.createIndex("postID", "postID", { unique: false }); // para contar likes
  }
};

request.onsuccess = function (event) {
  db = event.target.result;
  console.log("Base de datos cargada correctamente");

  // Crear admin por defecto si no existe
  const tx = db.transaction("usuarios", "readwrite");
  const store = tx.objectStore("usuarios");

  const buscarAdmin = store.get("admin");
  buscarAdmin.onsuccess = () => {
    if (!buscarAdmin.result) {
      const admin = {
        usuario: "admin",
        correo: "admin@blog.com",
        contrasena: "Admin123!",
        rol: "admin",
        silenciado: false
      };
      store.add(admin).onsuccess = () => {
        console.log("Usuario admin creado correctamente");
      };
    } else {
      console.log("Admin ya existe");
    }
  };
};
