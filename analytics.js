/**
 * Entre Escolhas — camada central de analytics + carregamento do Google Analytics 4.
 *
 * Este arquivo é incluído em todas as páginas públicas. Ele:
 *   1) Carrega o GA4 (gtag.js) automaticamente — basta configurar o ID abaixo.
 *   2) Expõe trackEvent() para os eventos de funil (já espalhados pelo site).
 *   3) Expõe trackPurchaseOnce() para registrar a receita sem contar 2x.
 *
 * Não captura dados sensíveis (CPF, senha, conteúdo de respostas livres).
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  ⚙️  CONFIGURE AQUI  →  cole o seu Measurement ID do GA4 (formato G-XXXXXXX)
 *      Onde achar: Google Analytics → Admin → Fluxos de dados → seu site →
 *      "ID de métricas" (começa com G-).
 *      Enquanto ficar 'G-XXXXXXXXXX', o GA4 NÃO carrega (nada quebra) e os
 *      eventos continuam indo para o dataLayer normalmente.
 * ═══════════════════════════════════════════════════════════════════════
 */
(function (window, document) {
  'use strict';

  // Aceita também window.EE_GA4_ID definido antes deste script (opcional).
  var GA4_MEASUREMENT_ID = window.EE_GA4_ID || 'G-XXXXXXXXXX';

  var GA4_ACTIVE = /^G-[A-Z0-9]{6,}$/.test(GA4_MEASUREMENT_ID) &&
                   GA4_MEASUREMENT_ID !== 'G-XXXXXXXXXX';

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  // Carrega o gtag.js só quando há um ID válido configurado — assim, em
  // desenvolvimento/produção sem ID, não há requisição quebrada nem erro.
  if (GA4_ACTIVE) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
    (document.head || document.documentElement).appendChild(s);
    gtag('js', new Date());
    // send_page_view padrão = true → cada página com este script já conta um page_view.
    gtag('config', GA4_MEASUREMENT_ID, { anonymize_ip: true });
  }

  // Mapeia alguns nomes internos para os nomes RECOMENDADOS do GA4, que ganham
  // relatórios prontos (aquisição, checkout, conversão). Os demais viram
  // eventos personalizados com o mesmo nome.
  var GA4_ALIAS = {
    lead_register: 'sign_up',
    lead_recover: 'login',
    start_test: 'tutorial_begin',
    complete_test: 'tutorial_complete',
    start_checkout: 'begin_checkout',
    view_report_preview: 'view_item',
    optin_talent_bank: 'generate_lead'
    // 'purchase' já é padrão do GA4 (não precisa de alias).
  };

  /**
   * Dispara um evento de funil (dataLayer + GA4, se ativo).
   * @param {string} eventName
   * @param {object} [payload] dados não sensíveis
   */
  function trackEvent(eventName, payload) {
    payload = payload || {};
    var data = Object.assign({ event: eventName, timestamp: new Date().toISOString() }, payload);
    window.dataLayer.push(data);

    if (GA4_ACTIVE && typeof window.gtag === 'function') {
      var gaName = GA4_ALIAS[eventName] || eventName;
      window.gtag('event', gaName, payload);
    }

    if (window.localStorage && localStorage.getItem('ee_debug_analytics') === '1') {
      console.log('[EntreEscolhas:trackEvent]', eventName, data);
    }
  }

  /**
   * Registra a compra no GA4 UMA ÚNICA VEZ por transação (dedupe via
   * localStorage) — evita contar receita em dobro quando a página recarrega
   * ou o cliente reabre o relatório já pago.
   * @param {object} opts
   * @param {'single'|'combo'} opts.kind
   * @param {number} opts.value  valor em reais
   * @param {string} [opts.journey]
   * @param {string} [opts.transaction_id]  id único (ex.: id do pagamento ou access token)
   * @returns {boolean} true se disparou agora, false se já havia sido contada
   */
  function trackPurchaseOnce(opts) {
    opts = opts || {};
    var kind = opts.kind === 'combo' ? 'combo' : 'single';
    var value = Number(opts.value || 0);
    var tid = String(opts.transaction_id || '').trim() ||
              (kind + ':' + (opts.journey || 'x') + ':' + Math.random().toString(36).slice(2));
    var key = 'ee_purchase_' + tid;
    try { if (localStorage.getItem(key)) return false; } catch (e) { /* localStorage bloqueado */ }

    trackEvent('purchase', {
      transaction_id: tid,
      value: value,
      currency: 'BRL',
      items: [{
        item_id: kind === 'combo' ? 'combo_4_jornadas' : ('jornada_' + (opts.journey || '')),
        item_name: kind === 'combo' ? 'Combo — 4 jornadas' : 'Relatório completo de jornada',
        item_category: kind,
        price: value,
        quantity: 1
      }]
    });

    try { localStorage.setItem(key, String(Date.now())); } catch (e) {}
    return true;
  }

  window.trackEvent = trackEvent;
  window.trackPurchaseOnce = trackPurchaseOnce;
  window.eeAnalytics = { ga4Active: GA4_ACTIVE, measurementId: GA4_ACTIVE ? GA4_MEASUREMENT_ID : null };

  /**
   * Eventos de funil suportados (referência):
   *   view_home, view_journey_page, view_test_intro, start_test, answer_question,
   *   complete_test, view_report_preview, view_paywall, start_checkout,
   *   purchase, lead_register, lead_recover, optin_talent_bank,
   *   submit_talent_bank, view_talent_bank_page, click_faq, click_whatsapp
   */

  // Liga automaticamente qualquer link/botão com data-event="nome_do_evento".
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-event]').forEach(function (el) {
      el.addEventListener('click', function () {
        trackEvent(el.getAttribute('data-event'), { page: window.location.pathname });
      });
    });
  });
})(window, document);
