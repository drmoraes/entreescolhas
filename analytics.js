/**
 * Entre Escolhas — camada central de eventos de analytics.
 *
 * Objetivo: ter um único ponto de disparo de eventos de funil, para que
 * GA4, Meta Pixel ou qualquer outra ferramenta possa ser plugada depois
 * sem precisar caçar chamadas espalhadas pelo código.
 *
 * Não captura dados sensíveis (CPF, senha, conteúdo de respostas livres).
 * Os payloads abaixo só guardam metadados de navegação/funil.
 */

(function (window) {
  'use strict';

  window.dataLayer = window.dataLayer || [];

  /**
   * Dispara um evento de funil.
   * @param {string} eventName - nome do evento (ver lista abaixo)
   * @param {object} [payload] - dados adicionais não sensíveis
   */
  function trackEvent(eventName, payload) {
    var data = Object.assign({ event: eventName, timestamp: new Date().toISOString() }, payload || {});

    // 1) GA4 (gtag.js) — descomente e configure quando o ID de medição existir:
    // if (typeof gtag === 'function') {
    //   gtag('event', eventName, payload || {});
    // }

    // 2) Meta Pixel — descomente e mapeie o evento equivalente quando o Pixel ID existir:
    // if (typeof fbq === 'function') {
    //   fbq('trackCustom', eventName, payload || {});
    // }

    // 3) Google Tag Manager / dataLayer — já ativo, pronto para qualquer tag conectada ao GTM:
    window.dataLayer.push(data);

    // 4) Log local de depuração (remover ou silenciar em produção, se preferir):
    if (window.localStorage && window.localStorage.getItem('ee_debug_analytics') === '1') {
      console.log('[EntreEscolhas:trackEvent]', eventName, data);
    }
  }

  /**
   * Lista de eventos de funil suportados (referência — não é validação obrigatória):
   * view_home, click_start_test, start_test, answer_question, complete_test,
   * view_report_preview, view_paywall, click_unlock_report, purchase_report,
   * optin_talent_bank, submit_talent_bank, click_whatsapp, click_privacy_policy,
   * click_terms, click_faq
   */

  window.trackEvent = trackEvent;

  // Eventos genéricos que se aplicam a qualquer página, ligados automaticamente
  // por atributos data-event="nome_do_evento" em links/botões.
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-event]').forEach(function (el) {
      el.addEventListener('click', function () {
        trackEvent(el.getAttribute('data-event'), {
          page: window.location.pathname
        });
      });
    });
  });
})(window);
