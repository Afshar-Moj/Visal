import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.VISAL_SUPABASE_CONFIG || {};
const form = document.querySelector("#auth-form");
const message = document.querySelector("#auth-message");
const modeButtons = [...document.querySelectorAll("[data-auth-mode]")];
const registrationFields = [...document.querySelectorAll("[data-registration-field]")];
const passwordConfirm = document.querySelector("#password-confirm");
const submitButton = document.querySelector("#auth-submit");
const authStatus = document.querySelector("#auth-status");
const logoutButton = document.querySelector("#logout-button");

let supabase = null;
let mode = "signup";

const messages = {
  "Invalid login credentials": "ایمیل یا گذرواژه درست نیست.",
  "Email not confirmed": "ابتدا ایمیلت را تأیید کن و سپس وارد شو.",
  "User already registered": "این ایمیل قبلاً ثبت‌نام کرده است؛ وارد شو.",
  "Password should be at least 6 characters": "گذرواژه کوتاه است؛ حداقل ۱۰ نویسه انتخاب کن."
};

function showMessage(text, type = "info") {
  message.textContent = text;
  message.dataset.type = type;
  message.hidden = !text;
}

function setMode(nextMode) {
  mode = nextMode;
  modeButtons.forEach(button => {
    const selected = button.dataset.authMode === mode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  registrationFields.forEach(field => {
    field.hidden = mode === "login";
    field.querySelectorAll("input, select, textarea").forEach(input => {
      input.required = mode === "signup" && input.dataset.optional !== "true";
    });
  });

  passwordConfirm.required = mode === "signup";
  passwordConfirm.closest(".form-field").hidden = mode === "login";
  submitButton.textContent = mode === "signup" ? "ساخت حساب رایگان" : "ورود به وصال";
  showMessage("");
}

function getAge(birthDate) {
  const today = new Date();
  const date = new Date(`${birthDate}T00:00:00`);
  let age = today.getFullYear() - date.getFullYear();
  const beforeBirthday =
    today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate());
  if (beforeBirthday) age--;
  return age;
}

function friendlyError(error) {
  return messages[error.message] || "انجام درخواست ممکن نشد. اطلاعات را بررسی کن و دوباره تلاش کن.";
}

function updateSignedInState(session) {
  const signedIn = Boolean(session?.user);
  authStatus.textContent = signedIn
    ? `وارد‌شده با ${session.user.email}`
    : "هنوز وارد حساب نشده‌ای.";
  logoutButton.hidden = !signedIn;
  form.hidden = signedIn;
}

modeButtons.forEach(button => {
  button.addEventListener("click", () => setMode(button.dataset.authMode));
});

logoutButton.addEventListener("click", async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) showMessage(friendlyError(error), "error");
  else {
    updateSignedInState(null);
    showMessage("با موفقیت خارج شدی.", "success");
  }
});

setMode("signup");

if (!config.url || !config.anonKey) {
  showMessage("اتصال پایگاه داده هنوز تنظیم نشده است. پس از ساخت پروژهٔ Supabase، نشانی پروژه و کلید عمومی را در فایل supabase-config.js وارد کنید.", "warning");
  submitButton.disabled = true;
} else {
  supabase = createClient(config.url, config.anonKey);
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) showMessage(friendlyError(error), "error");
    updateSignedInState(data?.session || null);
  });

  supabase.auth.onAuthStateChange((_event, session) => updateSignedInState(session));
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!supabase) return;

  const data = new FormData(form);
  const email = String(data.get("email")).trim();
  const password = String(data.get("password"));

  if (mode === "signup") {
    const birthDate = String(data.get("birth_date"));
    if (getAge(birthDate) < 18) {
      showMessage("ثبت‌نام در وصال فقط برای افراد ۱۸ سال به بالا امکان‌پذیر است.", "error");
      return;
    }
    if (password !== String(data.get("password_confirm"))) {
      showMessage("تکرار گذرواژه با گذرواژه یکسان نیست.", "error");
      return;
    }
    if (!form.querySelector("#accept-rules").checked) {
      showMessage("برای ادامه، تأیید کن که بالای ۱۸ سال هستی و قوانین را پذیرفته‌ای.", "error");
      return;
    }
  }

  submitButton.disabled = true;
  submitButton.textContent = "لطفاً صبر کن…";
  showMessage("");

  try {
    if (mode === "login") {
      const { data: result, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      updateSignedInState(result.session);
      showMessage("خوش آمدی. وارد وصال شدی.", "success");
    } else {
      const metadata = {
        display_name: String(data.get("display_name")).trim(),
        city: String(data.get("city")).trim(),
        gender: String(data.get("gender") || ""),
        birth_date: String(data.get("birth_date")),
        bio: String(data.get("bio") || "").trim()
      };

      const { data: result, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata }
      });
      if (error) throw error;

      if (result.session) {
        updateSignedInState(result.session);
        showMessage("حساب وصال ساخته شد. خوش آمدی!", "success");
      } else {
        showMessage("درخواست ثبت‌نام دریافت شد. برای فعال‌شدن حساب، ایمیلت را باز کن و پیوند تأیید را بزن.", "success");
      }
    }
  } catch (error) {
    showMessage(friendlyError(error), "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = mode === "signup" ? "ساخت حساب رایگان" : "ورود به وصال";
  }
});

