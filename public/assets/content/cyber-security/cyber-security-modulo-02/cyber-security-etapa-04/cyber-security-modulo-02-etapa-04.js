(function () {
  window.CL.curso.registrarEtapa("cyber-security-modulo-02", 4, {
    titulo: "Backups e recuperação",
    codigoInicial: { "html": "<h1>Guia de segurança digital</h1>\n", "css": "", "js": "" },
    verificar: function (codigo) {
      return new RegExp("<li\\b", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
