// COLD DAY — landing interactiva (sin dependencias).
(function () {
  "use strict";

  // -------------------------------------------------------------------------
  // URL de la plataforma web (app Angular).
  // TODO(URL): reemplaza por el dominio público real de la app cuando se despliegue.
  // Todos los enlaces con [data-app] se completan a partir de esta base.
  // -------------------------------------------------------------------------
  var APP_URL = "https://app.coldday.com.co";
  var APP_ROUTES = {
    registro: "/registro",
    login: "/login",
    panel: "/panel"
  };

  var enlaces = document.querySelectorAll("[data-app]");
  Array.prototype.forEach.call(enlaces, function (el) {
    var ruta = APP_ROUTES[el.getAttribute("data-app")];
    if (ruta) {
      el.setAttribute("href", APP_URL.replace(/\/$/, "") + ruta);
    }
  });

  // Menú móvil
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Año dinámico en el footer
  var year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  // Formulario B2B: valida y arma un correo (no hay backend en la landing).
  // TODO: cuando exista el endpoint, reemplaza el mailto por un fetch() a
  // POST /api/publico/leads con el JSON del formulario.
  var form = document.getElementById("leadForm");
  var note = document.getElementById("formNote");
  var destino = "contacto@coldday.com.co";

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var data = new FormData(form);
      var requeridos = ["empresa", "contacto", "correo", "telefono", "descripcion"];
      var faltante = requeridos.some(function (campo) {
        return !String(data.get(campo) || "").trim();
      });

      if (faltante) {
        note.textContent = "Completa todos los campos obligatorios (*).";
        note.className = "form__note err";
        return;
      }

      var correo = String(data.get("correo") || "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
        note.textContent = "Ingresa un correo electrónico válido.";
        note.className = "form__note err";
        return;
      }

      var cuerpo =
        "Empresa: " + data.get("empresa") + "\n" +
        "Contacto: " + data.get("contacto") + "\n" +
        "Correo: " + correo + "\n" +
        "Teléfono: " + data.get("telefono") + "\n" +
        "Línea: " + data.get("categoriaServicio") + "\n\n" +
        "Detalle:\n" + data.get("descripcion");

      var url =
        "mailto:" + destino +
        "?subject=" + encodeURIComponent("Cotización B2B — " + data.get("empresa")) +
        "&body=" + encodeURIComponent(cuerpo);

      window.location.href = url;

      note.textContent = "¡Gracias! Se abrirá tu correo para enviar la solicitud a COLD DAY.";
      note.className = "form__note ok";
      form.reset();
    });
  }
})();
