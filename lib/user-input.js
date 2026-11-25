const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 128) {
    return "Password must be at most 128 characters.";
  }
  return "";
}

export function validateRegistration(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request." };
  }

  if (Object.prototype.hasOwnProperty.call(body, "role") && body.role !== "msme") {
    return {
      ok: false,
      status: 403,
      error: "Registration cannot assign an admin role.",
    };
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0 || body.name.trim().length > 100) {
    return {
      ok: false,
      status: 400,
      error: "Enter a name between 1 and 100 characters.",
    };
  }

  const email = normalizeEmail(body.email);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { ok: false, status: 400, error: "Enter a valid email address." };
  }

  const passwordError = validatePassword(body.password);
  if (passwordError) {
    return { ok: false, status: 400, error: passwordError };
  }

  return {
    ok: true,
    name: body.name.trim(),
    email,
    password: body.password,
  };
}

export function validateLogin(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request." };
  }

  const email = normalizeEmail(body.email);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { ok: false, status: 400, error: "Enter a valid email address and password." };
  }

  if (typeof body.password !== "string" || body.password.length === 0 || body.password.length > 128) {
    return { ok: false, status: 400, error: "Enter a valid email address and password." };
  }

  return { ok: true, email, password: body.password };
}
