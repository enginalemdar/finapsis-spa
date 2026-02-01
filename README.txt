Finapsis Split Pack v2

- index.html: shell + bootstrap loader
- tabs/: view-section parçaları
- css/app.css: global css
- js/app.part01..06.js: app.js parçaları (sadece bölündü, içerik aynı, sırayla yüklenir)

Kurulum:
1) Bu yapıyı GitHub Pages / Cloudflare Pages köküne koy.
2) index.html açılınca tabs/*.html inject eder.
3) Ardından js/app.part*.js dosyalarını sırayla yükler.
