const demoProfiles = [
  { name: "نگار", age: 28, city: "تهران", gender: "زن", initial: "ن", bio: "علاقه‌مند به کتاب، پیاده‌روی و کشف کافه‌های دنج.", tags: ["کتاب", "طبیعت", "گفت‌وگو"] },
  { name: "آرمان", age: 31, city: "شیراز", gender: "مرد", initial: "آ", bio: "موسیقی، سفر و یادگرفتن چیزهای تازه بخش مهم زندگی من‌اند.", tags: ["موسیقی", "سفر", "هنر"] },
  { name: "رها", age: 26, city: "اصفهان", gender: "زن", initial: "ر", bio: "از طبیعت‌گردی، عکاسی و گفت‌وگوهای صمیمی لذت می‌برم.", tags: ["عکاسی", "طبیعت", "سینما"] }
];

const grid = document.querySelector("#profile-grid");
const cityFilter = document.querySelector("#city-filter");
const genderFilter = document.querySelector("#gender-filter");
const searchInput = document.querySelector("#search-input");
const count = document.querySelector("#result-count");
const empty = document.querySelector("#empty-state");

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function createProfileCard(profile) {
  const card = document.createElement("article");
  card.className = "profile-card";

  const cover = createTextElement("div", "profile-cover", "");
  const avatar = createTextElement("div", "profile-avatar", profile.initial);
  avatar.setAttribute("aria-hidden", "true");
  cover.append(avatar);

  const body = document.createElement("div");
  body.className = "profile-body";

  const heading = document.createElement("div");
  heading.className = "profile-name";
  heading.append(
    createTextElement("h3", "", `${profile.name}، ${profile.age}`),
    createTextElement("span", "", "۱۸+ · نمونه")
  );

  body.append(
    heading,
    createTextElement("p", "profile-meta", profile.city),
    createTextElement("p", "profile-bio", profile.bio)
  );

  const tags = document.createElement("div");
  tags.className = "tags";
  profile.tags.forEach(tag => tags.append(createTextElement("span", "", tag)));
  body.append(tags);

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const messageButton = createTextElement("button", "", "ارسال پیام");
  messageButton.type = "button";
  messageButton.dataset.demoAction = "message";

  const reportButton = createTextElement("button", "", "گزارش نمونه");
  reportButton.type = "button";
  reportButton.dataset.demoAction = "report";

  actions.append(messageButton, reportButton);
  body.append(actions);
  card.append(cover, body);
  return card;
}

function renderProfiles() {
  const city = cityFilter.value;
  const gender = genderFilter.value;
  const term = searchInput.value.trim().toLocaleLowerCase("fa");

  const filtered = demoProfiles.filter(profile => {
    const matchesCity = !city || profile.city === city;
    const matchesGender = !gender || profile.gender === gender;
    const searchable = [profile.name, profile.city, profile.bio, ...profile.tags]
      .join(" ")
      .toLocaleLowerCase("fa");
    return matchesCity && matchesGender && (!term || searchable.includes(term));
  });

  count.textContent = `${filtered.length} پروفایل نمونه`;
  empty.hidden = filtered.length !== 0;

  const cards = document.createDocumentFragment();
  filtered.forEach(profile => cards.append(createProfileCard(profile)));
  grid.replaceChildren(cards);
}

[cityFilter, genderFilter, searchInput].forEach(control => {
  control.addEventListener("input", renderProfiles);
});

document.querySelector("#reset-filters").addEventListener("click", () => {
  cityFilter.value = "";
  genderFilter.value = "";
  searchInput.value = "";
  renderProfiles();
});

grid.addEventListener("click", event => {
  const button = event.target.closest("button[data-demo-action]");
  if (!button || !grid.contains(button)) return;

  const notice = button.dataset.demoAction === "message"
    ? "پیام‌رسانی در نسخهٔ آزمایشی فعال نیست. در نسخهٔ واقعی، پیام‌دادن رایگان خواهد بود."
    : "این فقط یک دکمهٔ نمایشی است؛ سامانهٔ گزارش در نسخهٔ واقعی پیاده‌سازی می‌شود.";

  window.alert(notice);
});

renderProfiles();
