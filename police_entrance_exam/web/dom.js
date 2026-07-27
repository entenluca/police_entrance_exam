(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        if (value == null || value === false) return;
        if (key === 'className') node.className = value;
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
        else if (key === 'text') node.textContent = String(value);
        else if (key === 'html') node.innerHTML = String(value);
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
        else node.setAttribute(key, value === true ? '' : String(value));
      });
    }
    children.flat().forEach((child) => {
      if (child == null || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function svg(attrs, ...children) {
    const node = document.createElementNS(SVG_NS, 'svg');
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'className') node.setAttribute('class', value);
      else node.setAttribute(key, String(value));
    });
    children.flat().forEach((child) => { if (child) node.append(child); });
    return node;
  }

  function svgPath(d, attrs = {}) {
    const node = document.createElementNS(SVG_NS, 'path');
    node.setAttribute('d', d);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function svgCircle(cx, cy, r, attrs = {}) {
    const node = document.createElementNS(SVG_NS, 'circle');
    node.setAttribute('cx', cx);
    node.setAttribute('cy', cy);
    node.setAttribute('r', r);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function svgRect(x, y, w, h, attrs = {}) {
    const node = document.createElementNS(SVG_NS, 'rect');
    node.setAttribute('x', x);
    node.setAttribute('y', y);
    node.setAttribute('width', w);
    node.setAttribute('height', h);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function mount(parent, ...children) {
    parent.replaceChildren(...children.flat().filter((child) => child != null && child !== false));
    return parent;
  }

  function frag(...children) {
    const node = document.createDocumentFragment();
    children.flat().forEach((child) => {
      if (child == null || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function setMultiline(target, value) {
    target.replaceChildren();
    String(value ?? '').split('\n').forEach((line, index) => {
      if (index) target.append(el('br'));
      target.append(line);
    });
  }

  function field(labelText, inputNode) {
    return el('div', { className: 'field' }, el('label', { text: labelText }), inputNode);
  }

  function btn(label, className, attrs = {}) {
    return el('button', { className: `btn ${className}`, type: 'button', text: label, ...attrs });
  }

  function notice(type, ...children) {
    return el('div', { className: `notice notice-${type}` }, ...children);
  }

  const icons = {
    clock: () => svg({ className: 'timer-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' },
      svgCircle('12', '12', '10'), svgPath('M12 6v6l4 2')),
    shield: () => svg({ className: 'block-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' },
      svgPath('M12 2l8 4v6c0 5.25-3.5 10-8 12-4.5-2-8-6.75-8-12V6l8-4z'),
      svgPath('M9 12l2 2 4-4', { 'stroke-width': '2' })),
    check: () => svg({ className: 'result-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' },
      svgCircle('12', '12', '10'), svgPath('M8 12l3 3 5-6')),
    info: () => svg({ className: 'notice-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
      svgCircle('12', '12', '10'), svgPath('M12 16v-4M12 8h.01')),
    user: () => svg({ viewBox: '0 0 24 24', width: '22', height: '22', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
      svgPath('M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2'), svgCircle('12', '7', '4')),
    lock: () => svg({ viewBox: '0 0 24 24', width: '22', height: '22', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
      svgRect('3', '11', '18', '11', { rx: '2' }), svgPath('M7 11V7a5 5 0 0110 0v4')),
    key: () => svg({ viewBox: '0 0 24 24', width: '22', height: '22', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
      svgPath('M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4')),
    logout: () => svg({ className: 'btn-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
      svgPath('M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9')),
    document: () => svg({ viewBox: '0 0 24 24', width: '16', height: '16', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      svgPath('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z'),
      svgPath('M14 2v6h6M16 13H8M16 17H8M10 9H8')),
    shieldSm: () => svg({ className: 'notice-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      svgPath('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z')),
  };

  function icon(name) {
    return icons[name] ? icons[name]() : frag();
  }

  function timerLabel(kind, value) {
    const node = el('div', { className: `timer${kind === 'danger' ? ' danger' : ''}` });
    if (kind === 'global') node.dataset.globalTimer = '';
    if (kind === 'question') node.dataset.questionTimer = '';
    node.append(icon('clock'), ` ${value}`);
    return node;
  }

  function setTimerContent(node, prefix, value) {
    node.replaceChildren(icon('clock'), ` ${prefix}${value}`);
  }

  window.PoliceExamDOM = { el, svg, mount, frag, setMultiline, field, btn, notice, icon, timerLabel, setTimerContent };
})();
