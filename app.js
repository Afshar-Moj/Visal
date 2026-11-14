const demoProfiles = [
  {name:"نگار",age:28,city:"تهران",gender:"زن",initial:"ن",bio:"علاقه‌مند به کتاب، پیاده‌روی و کشف کافه‌های دنج.",tags:["کتاب","طبیعت","گفت‌وگو"]},
  {name:"آرمان",age:31,city:"شیراز",gender:"مرد",initial:"آ",bio:"موسیقی، سفر و یادگرفتن چیزهای تازه بخش مهم زندگی من‌اند.",tags:["موسیقی","سفر","هنر"]},
  {name:"رها",age:26,city:"اصفهان",gender:"زن",initial:"ر",bio:"از طبیعت‌گردی، عکاسی و گفت‌وگوهای صمیمی لذت می‌برم.",tags:["عکاسی","طبیعت","سینما"]}
];

const grid = document.querySelector("#profile-grid");
const cityFilter = document.querySelector("#city-filter");
const genderFilter = document.querySelector("#gender-filter");
const searchInput = document.querySelector("#search-input");
const count = document.querySelector("#result-count");
const empty = document.querySelector("#empty-state");

function renderProfiles() {
  const city = cityFilter.value;
  const gender = genderFilter.value;
  const term = searchInput.value.trim().toLocaleLowerCase("fa");
  const filtered = demoProfiles.filter(profile => {
    const matchesCity = !city || profile.city === city;
    const matchesGender = !gender || profile.gender === gender;
    const searchable = [profile.name, profile.city, profile.bio, ...profile.tags].join(" ").toLocaleLowerCase("fa");
    return matchesCity && matchesGender && (!term || searchable.includes(term));
  });

  count.textContent = `${filtered.length} پروفایل نمونه`;
  empty.hidden = filtered.length !== 0;
  grid.innerHTML = filtered.map(profile => `
    <article class="profile-card">
      <div class="profile-cover"><div class="profile-avatar" aria-hidden="true">${profile.initial}</div></div>
      <div class="profile-body">
        <div class="profile-name"><h3>${profile.name}، ${profile.age}</h3><span>۱۸+ · نمونه</span></div>
        <p class="profile-meta">${profile.city}</p>
        <p class="profile-bio">${profile.bio}</p>
        <div class="tags">${profile.tags.map(tag => `<span>${tag}</span>`).join("")}</div>
        <div class="card-actions"><button type="button" data-demo-action="message">ارسال پیام</button><button type="button" data-demo-action="report">گزارش نمونه</button></div>
      </div>
    </article>
  `).join("");
}

[cityFilter, genderFilter, searchInput].forEach(control => control.addEventListener("input", renderProfiles));
document.querySelector("#reset-filters").addEventListener("click", () => {
  cityFilter.value = "";
  genderFilter.value = "";
  searchInput.value = "";
  renderProfiles();
});

grid.addEventListener("click", event => {
  const action = event.target.closest("button[data-demo-action]")?.dataset.demoAction;
  if (!action) return;
  const notice = action === "message"
    ? "پیام‌رسانی در نسخهٔ آزمایشی فعال نیست. در نسخهٔ واقعی، پیام‌دادن رایگان خواهد بود."
    : "این فقط یک دکمهٔ نمایشی است؛ سامانهٔ گزارش در نسخهٔ واقعی پیاده‌سازی می‌شود.";
  window.alert(notice);
});

renderProfiles();