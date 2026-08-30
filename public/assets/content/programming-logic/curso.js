(function () {
  window.CL.curso.registrarCurso({
    id: 'programming-logic',
    nome: 'LogProg',
    linguagem: 'programming-logic',
    descricao: 'Aprenda os fundamentos da lógica de programação.'
  });

  var ordem = window.CL.curso.ORDEM_CURSOS;
  var indice = ordem.indexOf('programming-logic');
  if (indice !== -1) ordem.splice(indice, 1);
  ordem.unshift('programming-logic');
})();
