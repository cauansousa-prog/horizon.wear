(async () => { await window.AurelDB.storeReady; const { $, $$, icon } = window.Aurel;
let mode = "login",
  currentUser = null,
  available = false,
  busy = false;
function message(text, error = false) {
  $("#authMessage").textContent = text;
  $("#authMessage").classList.toggle("is-error", error);
}
function setMode(next) {
  if (busy) return;
  mode = next;
  const create = mode === "register";
  ["nameField", "confirmField", "termsField"].forEach(
    (id) => ($("#" + id).hidden = !create),
  );
  $("#fullName").required = create;
  $("#confirmPassword").required = create;
  $("#acceptTerms").required = create;
  $("#password").autocomplete = create ? "new-password" : "current-password";
  $("#password").minLength = create ? 8 : 1;
  $("#passwordHelp").textContent = create ? "Use no mínimo 8 caracteres." : "Digite a senha da sua conta.";
  $("#password").type = "password";
  $("#showPassword").textContent = "Mostrar";
  $("#showPassword").setAttribute("aria-pressed", "false");
  $("#confirmPassword").setCustomValidity("");
  $("#authForm").reset();
  $("#authTitle").textContent = create
    ? "SEU PRÓXIMO PASSO."
    : "BEM-VINDO DE VOLTA.";
  $("#authSubtitle").textContent = create
    ? "Crie sua conta e tenha seu espaço na Aurel."
    : "Entre para acessar sua conta Aurel.";
  $("#authSubmit").innerHTML =
    (create ? "Criar minha conta" : "Entrar") + " " + icon("arrow");
  ["login", "register"].forEach((key) => {
    const t = $("#" + key + "Tab");
    t.setAttribute("aria-selected", key === mode);
    t.tabIndex = key === mode ? 0 : -1;
  });
  $("#authPane").setAttribute("aria-labelledby", mode + "Tab");
  if (available) message("");
}
$("#loginTab").addEventListener("click", () => setMode("login"));
$("#registerTab").addEventListener("click", () => setMode("register"));
$(".auth-tabs").addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
    e.preventDefault();
    setMode(
      e.key === "Home"
        ? "login"
        : e.key === "End"
          ? "register"
          : mode === "login"
            ? "register"
            : "login",
    );
    $("#" + mode + "Tab").focus();
  }
});
$("#showPassword").addEventListener("click", () => {
  const show = $("#password").type === "password";
  $("#password").type = show ? "text" : "password";
  $("#showPassword").textContent = show ? "Ocultar" : "Mostrar";
  $("#showPassword").setAttribute(
    "aria-label",
    show ? "Ocultar senha" : "Mostrar senha",
  );
  $("#showPassword").setAttribute("aria-pressed", show);
});
$("#confirmPassword").addEventListener("input", () =>
  $("#confirmPassword").setCustomValidity(""),
);
$("#password").addEventListener("input", () => $("#confirmPassword").setCustomValidity(""));
function showProfile(user, focus = false) {
  currentUser = user;
  document.dispatchEvent(new Event("aurel:session"));
  $("#accessArea").hidden = !!user;
  $("#profileArea").hidden = !user;
  $("#adminLink").hidden = !user?.isAdmin;
  $("#accountLink").classList.toggle("is-signed-in", !!user);
  if (user) {
    $("#profileName").textContent = user.name;
    $("#profileEmail").textContent = user.email;
    $("#profileAvatar").textContent = user.name.trim().charAt(0).toUpperCase();
    if (focus) $("#profileArea").focus();
  }
}
async function request(body) { return window.AurelDB.request(body); }
$("#authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy || !available) return;
  if (
    mode === "register" &&
    $("#password").value !== $("#confirmPassword").value
  ) {
    $("#confirmPassword").setCustomValidity("As senhas precisam ser iguais.");
    $("#confirmPassword").reportValidity();
    return;
  }
  const data = {
    action: mode,
    email: $("#email").value.trim(),
    password: $("#password").value,
    name: $("#fullName").value.trim(),
    terms: $("#acceptTerms").checked ? "2026-09-28" : null,
  };
  busy = true;
  $("#authFields").disabled = true;
  message("Aguarde um instante…");
  try {
    const result = await request(data);
    if (result.pendingEmail) {
      const email = result.pendingEmail;
      busy = false;
      setMode("login");
      $("#email").value = email;
    } else $("#authForm").reset();
    message(result.message || "");
    showProfile(result.user, true);
  } catch (err) {
    message(err.message || "Não foi possível conectar. Tente novamente.", true);
  } finally {
    busy = false;
    $("#authFields").disabled = !available;
  }
});
$("#logout").addEventListener("click", async () => {
  const b = $("#logout");
  b.disabled = true;
  try {
    await request({ action: "logout" });
    showProfile(null);
    setMode("login");
    message("Você saiu da sua conta.");
    $("#email").focus();
  } catch (e) {
    $("#profileMessage").textContent = e.message;
  } finally {
    b.disabled = false;
  }
});
$("#deleteAccount").addEventListener("click", () => {
  $("#deleteForm").reset();
  $("#deleteMessage").textContent = "";
  $("#deleteDialog").showModal();
});
$("#deleteForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = $('#deleteForm button[type="submit"]');
  b.disabled = true;
  try {
    await request({
      action: "delete",
      email: currentUser.email,
      password: $("#deletePassword").value,
    });
    $("#deleteDialog").close();
    showProfile(null);
    setMode("login");
    message("Sua conta foi excluída.");
  } catch (e) {
    $("#deleteMessage").textContent = e.message;
  } finally {
    b.disabled = false;
  }
});
(async () => {
  if (location.protocol === "file:") {
    message("Abra o site pelo servidor para criar sua conta ou entrar.", true);
    return;
  }
  try {
    const data = await request();
    available = true;
    $("#authFields").disabled = false;
    message(window.AurelDB.callbackError || "", !!window.AurelDB.callbackError);
    showProfile(data.user);
    if (window.AurelDB.recovery) openReset();
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  } catch (e) {
    message(
      e.message || "O serviço de contas está indisponível no momento.",
      true,
    );
  }
})();

let emailAction = "recover", emailBusy = false, emailCooldownUntil = 0;
function openEmail(action) {
  emailAction = action;
  $("#emailDialogTitle").textContent = action === "recover" ? "RECUPERAR SENHA" : "CONFIRMAR CADASTRO";
  $("#emailDialogHelp").textContent = action === "recover" ? "Receba um link para escolher uma nova senha." : "Receba um novo link. Abra apenas o e-mail mais recente; os anteriores podem expirar.";
  $("#supportEmail").value = $("#email").value.trim();
  $("#emailMessage").textContent = "";
  $("#emailDialog").showModal();
}
$("#forgotPassword").addEventListener("click", () => openEmail("recover"));
$("#resendConfirmation").addEventListener("click", () => openEmail("resend"));
$("#emailForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (emailBusy) return;
  if (Date.now() < emailCooldownUntil) {
    $("#emailMessage").textContent = "Aguarde um minuto antes de solicitar outro e-mail.";
    return;
  }
  const button = event.target.querySelector('[type="submit"]');
  emailBusy = button.disabled = true;
  $("#emailMessage").textContent = "Enviando…";
  try {
    const result = await request({ action: emailAction, email: $("#supportEmail").value.trim().toLowerCase() });
    emailCooldownUntil = Date.now() + 60000;
    $("#emailMessage").textContent = result.message;
  } catch (error) { $("#emailMessage").textContent = error.message; }
  finally { emailBusy = button.disabled = false; }
});
function openReset() {
  if (!$("#resetDialog").open) $("#resetDialog").showModal();
}
document.addEventListener("aurel:recovery", openReset);
$("#resetDialog").addEventListener("cancel", event => event.preventDefault());
$("#cancelReset").addEventListener("click", async () => {
  try {
    await request({ action: "logout" });
    $("#resetDialog").close(); showProfile(null);
  } catch (error) { $("#resetMessage").textContent = error.message; }
});
[$("#resetPassword"), $("#resetConfirm")].forEach(input => input.addEventListener("input", () => $("#resetConfirm").setCustomValidity("")));
$("#resetForm").addEventListener("submit", async event => {
  event.preventDefault();
  if ($("#resetPassword").value !== $("#resetConfirm").value) {
    $("#resetConfirm").setCustomValidity("As senhas precisam ser iguais.");
    $("#resetConfirm").reportValidity(); return;
  }
  const button = event.target.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const result = await request({ action: "reset", newPassword: $("#resetPassword").value });
    $("#resetDialog").close(); event.target.reset(); showProfile(null); setMode("login"); message(result.message);
  } catch (error) { $("#resetMessage").textContent = error.message; }
  finally { button.disabled = false; }
});

$("#editProfile").addEventListener("click", () => {
  $("#profileForm").reset();
  $("#editName").value = currentUser.name;
  $("#editMessage").textContent = "";
  $("#profileDialog").showModal();
});
$("#changePassword").addEventListener("click", () => {
  $("#passwordForm").reset();
  $("#repeatNewPassword").setCustomValidity("");
  $("#changeMessage").textContent = "";
  $("#passwordDialog").showModal();
});
$("#profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const data = await request({
      action: "profile",
      email: currentUser.email,
      password: $("#profilePassword").value,
      name: $("#editName").value.trim(),
    });
    showProfile(data.user);
    $("#profileDialog").close();
    $("#profileForm").reset();
    $("#profileMessage").textContent = "Seu nome foi atualizado.";
  } catch (err) {
    $("#editMessage").textContent = err.message;
  } finally {
    button.disabled = false;
  }
});
$("#repeatNewPassword").addEventListener("input", () =>
  $("#repeatNewPassword").setCustomValidity(""),
);
$("#newPassword").addEventListener("input", () =>
  $("#repeatNewPassword").setCustomValidity(""),
);
$("#passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ($("#newPassword").value !== $("#repeatNewPassword").value) {
    $("#repeatNewPassword").setCustomValidity(
      "As novas senhas precisam ser iguais.",
    );
    $("#repeatNewPassword").reportValidity();
    return;
  }
  const button = e.target.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const data = await request({
      action: "password",
      email: currentUser.email,
      password: $("#currentPassword").value,
      newPassword: $("#newPassword").value,
    });
    showProfile(data.user);
    $("#passwordDialog").close();
    $("#passwordForm").reset();
    $("#profileMessage").textContent =
      "Senha atualizada. Suas outras sessões foram encerradas.";
  } catch (err) {
    $("#changeMessage").textContent = err.message;
  } finally {
    button.disabled = false;
  }
});

})();
