(function () {
  const defaultStats = [
    { label: 'Total Documents', value: 12450, icon: 'fa-folder-open' },
    { label: 'Requests', value: 685, icon: 'fa-file-signature' },
    { label: 'Records', value: 3520, icon: 'fa-box-archive' },
    { label: 'Transfers', value: 210, icon: 'fa-truck-fast' }
  ];

  const defaultModules = [
    {
      title: 'Documents Monitoring',
      description: 'Monitor incoming and outgoing documents.',
      icon: 'fa-folder-tree',
      link: 'documents.html'
    },
    {
      title: 'Requests',
      description: 'FOI, Billing, Certified True Copy and Receiving.',
      icon: 'fa-file-circle-question',
      link: 'requests.html'
    },
    {
      title: 'Dockets',
      description: 'Track issuances and associated document references.',
      icon: 'fa-map-location-dot',
      link: 'dockets.html'
    },
    {
      title: 'Users',
      description: 'Access user roles, permissions and offices.',
      icon: 'fa-users',
      link: 'users.html'
    }
  ];

  function RecordsModel() {
    this.stats = defaultStats;
    this.modules = defaultModules;
  }

  RecordsModel.prototype.getStats = function () {
    return this.stats;
  };

  RecordsModel.prototype.getModules = function () {
    return this.modules;
  };

  RecordsModel.prototype.getDashboard = function () {
    return {
      stats: this.getStats(),
      modules: this.getModules()
    };
  };

  window.RecordsModel = RecordsModel;
})();
