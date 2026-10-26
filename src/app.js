(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const appRoot = document.getElementById('app');

    if (!appRoot) {
      return;
    }

    const controller = new window.HomeController(appRoot);
    controller.init();
  });
})();
