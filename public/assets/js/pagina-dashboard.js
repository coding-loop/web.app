/* Dashboard do aluno: resumo visual derivado do progresso local atual. */
(function () {
  'use strict';

  window.CL = window.CL || {};
  const CL = window.CL;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char];
    });
  }

  function stepKey(moduloId, step) {
    return CL.curso.chaveEtapa ? CL.curso.chaveEtapa(moduloId, step) : moduloId + ':' + step;
  }

  async function renderDashboard() {
    const root = document.getElementById('cl-page-dashboard');
    if (!root || !CL.curso || !CL.curso.CURSOS) return;

    const progress = CL.api && CL.api.listProgress ? await CL.api.listProgress() : {};
    const exercises = CL.api && CL.api.listExercises ? await CL.api.listExercises() : {};
    const profile = CL.api && CL.api.getProfile ? await CL.api.getProfile() : {};
    const courses = CL.curso.ORDEM_CURSOS.map(function (id) { return CL.curso.CURSOS[id]; }).filter(Boolean);
    const completedSteps = Object.keys(progress).filter(function (id) { return progress[id] && progress[id].concluida; }).length;
    const completedModules = courses.reduce(function (sum, course) {
      return sum + course.modulos.filter(function (module) { return CL.curso.moduloConcluido(module, progress); }).length;
    }, 0);

    const user = CL.auth && CL.auth.getUser ? CL.auth.getUser() : null;
    const greeting = document.getElementById('dashboard-boas-vindas');
    const summary = document.getElementById('dashboard-resumo');
    if (greeting) greeting.textContent = 'Olá' + (user && user.name ? ', ' + user.name.split(' ')[0] : '') + '!';
    if (summary) summary.textContent = completedSteps ? 'Você já concluiu ' + completedSteps + ' etapa' + (completedSteps === 1 ? '.' : 's.') : 'Sua próxima etapa está esperando por você.';
    document.getElementById('dashboard-etapas-concluidas').textContent = completedSteps;
    document.getElementById('dashboard-modulos-concluidos').textContent = completedModules;
    document.getElementById('dashboard-codigos-salvos').textContent = Object.keys(exercises).length;

    const cards = document.getElementById('dashboard-cursos');
    if (cards) cards.innerHTML = courses.map(function (course) {
      const total = course.modulos.reduce(function (sum, module) { return sum + module.etapas.length; }, 0);
      const completed = course.modulos.reduce(function (sum, module) {
        return sum + module.etapas.filter(function (_, index) { return progress[stepKey(module.id, index + 1)] && progress[stepKey(module.id, index + 1)].concluida; }).length;
      }, 0);
      const percent = total ? Math.round((completed / total) * 100) : 0;
      return '<a class="cl-dashboard-course cl-dashboard-course-' + escapeHtml(course.id) + '" href="#course/' + encodeURIComponent(course.id) + '">' +
        '<div class="cl-dashboard-course-top"><span>' + escapeHtml(course.nome) + '</span><small>' + percent + '%</small></div>' +
        '<div class="cl-dashboard-progress"><span style="width:' + percent + '%"></span></div><small>' + completed + ' de ' + total + ' etapas concluídas</small></a>';
    }).join('');

    const position = profile && profile.idePosition;
    const firstCourse = courses[0];
    const continueLink = document.getElementById('dashboard-continuar');
    const mission = document.getElementById('dashboard-proxima-missao');
    if (position && position.moduloId) {
      const found = CL.curso.encontrarModulo(position.moduloId);
      if (found) {
        const step = position.etapa || 1;
        if (continueLink) continueLink.href = 'ide.html?modulo=' + encodeURIComponent(position.moduloId);
        if (mission) mission.textContent = 'Continue no módulo ' + found.modulo.nome + ', etapa ' + step + '.';
        return;
      }
    }
    if (firstCourse && firstCourse.modulos[0]) {
      if (continueLink) continueLink.href = 'ide.html?modulo=' + encodeURIComponent(firstCourse.modulos[0].id);
      if (mission) mission.textContent = 'Comece por ' + firstCourse.modulos[0].nome + '.';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (CL.pages && CL.pages.dashboard) CL.pages.dashboard.init = renderDashboard;
  });
})();
