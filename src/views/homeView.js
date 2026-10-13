(function () {
  function HomeView(root) {
    this.root = root;
  }

  HomeView.prototype.render = function (dashboard) {
    const { stats, modules } = dashboard;

    this.root.innerHTML = `
      <section class="hero">
        <div class="overlay">
          <div class="hero-content">
            <h1>DHSUD-CAR</h1>
            <h2>RECORDS SHELTER</h2>
            <p>Smart Housing Electronic Library for Tracking, Evaluation and Records Management</p>
            <a href="#modules" class="btn">Explore Modules</a>
          </div>
        </div>
      </section>

      <section id="welcome">
        <div class="container">
          <h2>Welcome to the Records Shelter</h2>
          <p>
            The Records Shelter serves as the centralized digital platform of DHSUD-CAR for
            managing documents, monitoring requests, organizing dockets, maintaining records
            inventories, and facilitating records transfer and custody.
          </p>
        </div>
      </section>

      <section class="statistics">
        ${stats.map(stat => `
          <div class="stat-box">
            <i class="fa-solid ${stat.icon}"></i>
            <h2 class="counter" data-target="${stat.value}">0</h2>
            <p>${stat.label}</p>
          </div>
        `).join('')}
      </section>

      <section id="modules">
        <div class="title">
          <h2>Core Modules</h2>
          <p>Select a module to continue</p>
        </div>

        <div class="module-grid">
          ${modules.map(module => `
            <div class="card">
              <i class="fa-solid ${module.icon}"></i>
              <h3>${module.title}</h3>
              <p>${module.description}</p>
              <button onclick="window.location.href='${module.link}'">Open Module</button>
            </div>
          `).join('')}
        </div>
      </section>
    `;

    this.initCounters();
  };

  HomeView.prototype.initCounters = function () {
    const counters = document.querySelectorAll('.counter');
    const speed = 200;

    counters.forEach(counter => {
      const updateCount = () => {
        const target = Number(counter.getAttribute('data-target'));
        const count = Number(counter.innerText.replace(/,/g, '')) || 0;
        const increment = target / speed;

        if (count < target) {
          counter.innerText = Math.ceil(count + increment).toLocaleString();
          setTimeout(updateCount, 10);
        } else {
          counter.innerText = target.toLocaleString();
        }
      };

      updateCount();
    });
  };

  window.HomeView = HomeView;
})();
