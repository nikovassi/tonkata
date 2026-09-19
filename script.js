/* =========================================================================
   TONKATA site script
   - Nav behaviour (scroll state, mobile menu, active link)
   - Scroll reveal animations
   - Dynamic gallery / video / documents loading straight from the GitHub repo
     (drop a file into the right folder on GitHub and it shows up here —
     no code changes needed)
   ========================================================================= */

const REPO_OWNER = "nikovassi";
const REPO_NAME = "tonkata";
const REPO_BRANCH = "main";

const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const VIDEO_EXT = [".mp4", ".webm", ".mov"];
const DOC_EXT = [".pdf"];

function githubApiUrl(path) {
  return `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${REPO_BRANCH}`;
}

async function fetchFolder(path) {
  const res = await fetch(githubApiUrl(path));
  if (res.status === 404) {
    // Folder doesn't exist yet (git has no empty folders) — treat as "nothing added yet".
    return [];
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data;
}

function hasExt(name, list) {
  const lower = name.toLowerCase();
  return list.some((ext) => lower.endsWith(ext));
}

function niceNameFromFile(filename) {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/* ---------------- Header / nav ---------------- */
const header = document.getElementById("siteHeader");
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
const navLinkEls = document.querySelectorAll(".nav-link");

window.addEventListener("scroll", () => {
  header.classList.toggle("scrolled", window.scrollY > 40);
}, { passive: true });

navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.classList.toggle("open", open);
  navToggle.setAttribute("aria-expanded", open ? "true" : "false");
});

navLinkEls.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    navToggle.classList.remove("open");
  });
});

const sections = document.querySelectorAll("main section[id]");
const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        navLinkEls.forEach((link) => {
          link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
        });
      }
    });
  },
  { rootMargin: "-45% 0px -45% 0px" }
);
sections.forEach((s) => navObserver.observe(s));

/* ---------------- Reveal on scroll ---------------- */
const revealEls = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        obs.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
revealEls.forEach((el) => revealObserver.observe(el));

/* ---------------- Footer year ---------------- */
document.getElementById("year").textContent = new Date().getFullYear();

/* ---------------- Lightbox ---------------- */
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxClose = document.getElementById("lightboxClose");

function openLightbox(src, alt) {
  lightboxImg.src = src;
  lightboxImg.alt = alt || "";
  lightbox.classList.add("open");
}
lightboxClose.addEventListener("click", () => lightbox.classList.remove("open"));
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.classList.remove("open");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") lightbox.classList.remove("open");
});

/* ---------------- Gallery tabs ---------------- */
const tabBtns = document.querySelectorAll(".tab-btn");
const galleryPhotos = document.getElementById("galleryPhotos");
const galleryVideos = document.getElementById("galleryVideos");

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    galleryPhotos.hidden = tab !== "photos";
    galleryVideos.hidden = tab !== "videos";
  });
});

/* ---------------- Load gallery photos ---------------- */
async function loadGalleryPhotos() {
  try {
    const files = (await fetchFolder("images/gallery"))
      .filter((f) => f.type === "file" && hasExt(f.name, IMAGE_EXT))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (files.length === 0) {
      galleryPhotos.innerHTML = '<p class="empty-msg">Скоро тук ще има снимки от трасето.</p>';
      return;
    }

    galleryPhotos.innerHTML = files
      .map(
        (f) => `
        <div class="g-item" data-src="${f.download_url}" data-alt="${niceNameFromFile(f.name)}">
          <img src="${f.download_url}" alt="${niceNameFromFile(f.name)}" loading="lazy">
        </div>`
      )
      .join("");

    galleryPhotos.querySelectorAll(".g-item").forEach((el) => {
      el.addEventListener("click", () => openLightbox(el.dataset.src, el.dataset.alt));
    });
  } catch (err) {
    console.error(err);
    galleryPhotos.innerHTML = '<p class="error-msg">Възникна проблем при зареждане на снимките. Презареди страницата.</p>';
  }
}

/* ---------------- Load gallery videos ---------------- */
async function loadGalleryVideos() {
  try {
    const files = (await fetchFolder("videos"))
      .filter((f) => f.type === "file" && hasExt(f.name, VIDEO_EXT))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (files.length === 0) {
      galleryVideos.innerHTML = '<p class="empty-msg">Скоро тук ще има видеа от трасето.</p>';
      return;
    }

    galleryVideos.innerHTML = files
      .map(
        (f) => `
        <div class="v-item">
          <video controls preload="metadata" playsinline>
            <source src="${f.download_url}">
          </video>
        </div>`
      )
      .join("");
  } catch (err) {
    console.error(err);
    galleryVideos.innerHTML = '<p class="error-msg">Възникна проблем при зареждане на видеата. Презареди страницата.</p>';
  }
}

/* ---------------- Results timeline ---------------- */
async function loadResults() {
  const timeline = document.getElementById("resultsTimeline");
  try {
    const res = await fetch("results.json", { cache: "no-store" });
    if (!res.ok) throw new Error("no results.json");
    const results = await res.json();

    if (!Array.isArray(results) || results.length === 0) {
      timeline.innerHTML = '<p class="empty-msg">Скоро — първите резултати за сезона.</p>';
      return;
    }

    // Rendered in the exact order given in results.json.
    // Add new results at the TOP of the array in results.json so the newest shows first.
    timeline.innerHTML = results
      .map((r) => {
        const photo = r.photo
          ? `<div class="t-photo" data-src="images/results/${r.photo}" data-alt="${r.event || ""}">
               <img src="images/results/${r.photo}" alt="${r.event || ""}" loading="lazy">
             </div>`
          : "";
        return `
        <div class="t-item">
          <div class="t-place">${r.place || "—"}<small>${r.placeLabel || "МЯСТО"}</small></div>
          <div>
            <p class="t-event">${r.event || ""}</p>
            <p class="t-meta">${[r.location, r.dateLabel].filter(Boolean).join(" · ")}</p>
            ${r.note ? `<p class="t-meta">${r.note}</p>` : ""}
            ${photo}
          </div>
        </div>`;
      })
      .join("");

    timeline.querySelectorAll(".t-photo").forEach((el) => {
      el.addEventListener("click", () => openLightbox(el.dataset.src, el.dataset.alt));
    });
  } catch (err) {
    console.error(err);
    timeline.innerHTML = '<p class="error-msg">Резултатите не можаха да се заредят.</p>';
  }
}

/* ---------------- Documents (PDF classifications) ---------------- */
async function loadDocuments() {
  const block = document.getElementById("documentsBlock");
  const list = document.getElementById("documentsList");
  try {
    const files = (await fetchFolder("documents"))
      .filter((f) => f.type === "file" && hasExt(f.name, DOC_EXT))
      .sort((a, b) => b.name.localeCompare(a.name));

    // No PDFs yet — keep this whole block hidden instead of showing a
    // "coming soon" placeholder. It appears automatically the moment
    // the first PDF is uploaded to the documents/ folder in GitHub.
    if (files.length === 0) {
      block.hidden = true;
      return;
    }

    list.innerHTML = files
      .map(
        (f) => `
        <a class="doc-item" href="${f.download_url}" target="_blank" rel="noopener">
          <span class="doc-icon">📄</span>
          <span class="doc-name">${niceNameFromFile(f.name)}</span>
          <span class="doc-arrow">Отвори →</span>
        </a>`
      )
      .join("");
    block.hidden = false;
  } catch (err) {
    console.error(err);
    block.hidden = true;
  }
}

loadGalleryPhotos();
loadGalleryVideos();
loadResults();
loadDocuments();
