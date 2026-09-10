export function completarCredenciales({ cuenta, password, inputEmail, inputPassword }) {
  inputEmail.value = cuenta.email;
  inputPassword.value = password;
}
