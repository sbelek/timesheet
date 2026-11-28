/* © 2026 Sherkhan (github.com/sbelek). All rights reserved. See LICENSE.
   Выбор точки объекта на карте (Google Maps) — шторка в стиле приложения.
   Вызов: SM.openMap({ title, site?, addr?, onDone(r) }), r = { lat, lon, addr, name? } */
(function () {
  const SM = window.SM; if (!SM) return;
  const $ = s => document.querySelector(s);
  const T = SM.T, I = SM.I;

  const css = document.createElement('style');
  css.textContent = `
  #mapBox{position:relative;height:52dvh;min-height:280px;border:1px solid var(--div);background:repeating-linear-gradient(135deg,var(--n300) 0 6px,var(--n200) 6px 12px)}
  #mapBox .mapph{position:absolute;left:12px;right:12px;bottom:10px}
  .mrow{display:flex;gap:8px;margin:12px 0 10px}.mrow .in{flex:1}.mrow .b{width:auto;flex:none;height:48px}
  #mdlg .seg button{min-height:44px}`;
  document.head.appendChild(css);

  const dlg = document.createElement('dialog');
  dlg.id = 'mdlg'; dlg.className = 'sheet'; document.body.appendChild(dlg);
  let map = null, marker = null, picked = null;

  function open(opts) {
    const s = opts.site;
    dlg.innerHTML = `<div class="pan tall"><div class="sh-h"><button class="link" id="mX" type="button" autofocus>${T('Cancel', 'Отмена')}</button><b>${SM.esc(opts.title)}</b><button class="link y" id="mOk" type="button">${T('Done', 'Готово')}</button></div>
    <div class="sh-b">
      ${s ? `<label class="lbl fl" for="mName">${T('Name', 'Название')}</label><input id="mName" class="in" value="${SM.esc(s.name)}">` : ''}
      <div class="mrow"><input id="mQ" class="in" placeholder="${T('Find an address on the map', 'Найти адрес на карте')}" enterkeyhint="search"><button class="b out" id="mFind" type="button">${T('Find', 'Найти')}</button></div>
      <div id="mapBox"><div class="mapph" id="mLoad">${T('Loading map…', 'Загружаю карту…')}</div></div>
      <div class="seg mt8"><button class="on" id="mStreet" type="button">${T('Map', 'Схема')}</button><button id="mSat" type="button">${T('Satellite', 'Спутник')}</button></div>
      <button class="b out mt8" id="mMe" type="button">${I.nav()}${T("I'm here", 'Я здесь')}</button>
      <p class="hint mt8" id="mHint">${T('Tap your building — a marker will appear there. You can drag the marker.', 'Нажмите на своё здание — там появится метка. Метку можно перетащить.')}</p>
      <label class="lbl fl" for="mAddr">${T('Address', 'Адрес')}</label><input id="mAddr" class="in" value="${SM.esc(s ? s.addr || '' : (opts.addr || ''))}" placeholder="${T('Fills in automatically after you pick a point', 'Заполнится сам после выбора точки')}">
    </div></div>`;
    picked = s && s.lat != null ? { lat: s.lat, lon: s.lon } : null;
    map = null; marker = null;
    SM.openSheet(dlg);

    $('#mX').onclick = () => SM.closeSheet(dlg);
    $('#mOk').onclick = () => {
      if (!picked) return SM.toast(T('Mark a point on the map first', 'Сначала отметьте точку на карте'));
      const r = { lat: picked.lat, lon: picked.lon, addr: $('#mAddr').value.trim() };
      if (s) r.name = ($('#mName').value || '').trim() || s.name;
      SM.closeSheet(dlg); opts.onDone(r);
    };

    const find = async () => {
      const q = $('#mQ').value.trim();
      if (!q) { $('#mHint').textContent = T('Type an address in the search box.', 'Введите адрес в поле поиска.'); $('#mQ').focus(); return; }
      if (!map || !window.google?.maps) { $('#mHint').textContent = T('The map is still loading, please wait…', 'Карта ещё загружается, подождите…'); return; }
      $('#mHint').textContent = T('Searching…', 'Ищу…');
      const p = await SM.fwdGeocode(q);
      if (!p) { $('#mHint').textContent = T('Address not found. Try wording it differently.', 'Адрес не найден. Попробуйте иначе.'); return; }
      map.setCenter({ lat: p.lat, lng: p.lon });
      map.setZoom(18);
      setPoint(window.google.maps, p.lat, p.lon, false);
      if (p.addr) $('#mAddr').value = p.addr;
      $('#mHint').textContent = T('Found — the marker is on the address. Adjust it if needed and tap “Done”.', 'Нашёл — метка на адресе. Поправьте, если нужно, и нажмите «Готово».');
    };
    $('#mFind').onclick = find;
    $('#mQ').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); find(); } };

    SM.loadGoogle().then(g => init(g, s, opts)).catch(e => {
      const el = $('#mLoad'); if (el) el.textContent = e.message;
    });
  }

  async function setPoint(g, lat, lon, fill) {
    picked = { lat, lon };
    if (!marker) {
      // квадратная красная метка — как на карте объектов
      marker = new g.Marker({
        position: { lat, lng: lon },
        map,
        draggable: true,
        icon: { path: 'M-1 -1H1V1H-1Z', scale: 9, fillColor: '#ec3013', fillOpacity: 1, strokeColor: '#201e1d', strokeWeight: 2 }
      });
      marker.addListener('dragend', () => {
        const p = marker.getPosition();
        setPoint(g, p.lat(), p.lng(), true);
      });
    } else {
      marker.setPosition({ lat, lng: lon });
    }
    if (fill) {
      $('#mHint').textContent = T('Looking up the address…', 'Определяю адрес…');
      const a = await SM.geocode(lat, lon);
      if (a) $('#mAddr').value = a;
      $('#mHint').textContent = a
        ? T('Point selected. Check the address and tap “Done”.', 'Точка выбрана. Проверьте адрес и нажмите «Готово».')
        : T('Point selected. Address not found — type it yourself.', 'Точка выбрана. Адрес не определился — впишите сами.');
    }
  }

  async function init(g, s, opts) {
    const box = $('#mapBox'); if (!box || !dlg.open) return;
    box.innerHTML = '';
    map = new g.Map(box, {
      zoom: 11,
      center: { lat: 43.70, lng: -79.42 },
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: 'greedy'
    });

    const setMapType = t => {
      map.setMapTypeId(t);
      $('#mStreet').classList.toggle('on', t === 'roadmap');
      $('#mSat').classList.toggle('on', t === 'satellite');
    };
    $('#mStreet').onclick = () => setMapType('roadmap');
    $('#mSat').onclick = () => setMapType('satellite');

    map.addListener('click', e => setPoint(g, e.latLng.lat(), e.latLng.lng(), true));

    $('#mMe').onclick = async () => {
      try {
        const p = await SM.getPos();
        map.setCenter({ lat: p.lat, lng: p.lon });
        map.setZoom(18);
      } catch (e) { SM.toast(T('Could not get your location', 'Не удалось определить место')); }
    };

    const q = s ? (s.addr || '').trim() : (opts.addr || '').trim();
    // Адрес главнее: если сохранённая точка далеко от адреса (например, привязана «Я здесь»), ставим метку по адресу
    if (picked && q) {
      const a = await SM.fwdGeocode(q);
      if (!map) return;
      const far = a && SM.dist(a, picked) > 300;
      const p = far ? a : picked;
      map.setCenter({ lat: p.lat, lng: p.lon });
      map.setZoom(18);
      setPoint(g, p.lat, p.lon, false);
      if (far) { const d = Math.round(SM.dist(a, s)); $('#mHint').textContent = T(`Marker placed by the address (the old point was ${d} m away). Adjust it if needed and tap “Done”.`, `Метка поставлена по адресу (старая точка была в ${d} м). Поправьте, если нужно, и нажмите «Готово».`); }
    } else if (picked) {
      map.setCenter({ lat: picked.lat, lng: picked.lon });
      map.setZoom(18);
      setPoint(g, picked.lat, picked.lon, false);
    } else {
      if (q) {
        const p = await SM.fwdGeocode(q);
        if (p && map) { map.setCenter({ lat: p.lat, lng: p.lon }); map.setZoom(18); }
      } else {
        SM.getPos().then(p => { if (map) { map.setCenter({ lat: p.lat, lng: p.lon }); map.setZoom(17); } }).catch(() => {});
      }
    }
  }

  SM.openMap = open;
})();
