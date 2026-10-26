(function () {
  function HomeController(root) {
    this.model = new window.RecordsModel();
    this.view = new window.HomeView(root);
  }

  HomeController.prototype.init = function () {
    const dashboard = this.model.getDashboard();
    this.view.render(dashboard);
  };

  window.HomeController = HomeController;
})();
