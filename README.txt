Finapsis Split Pack v3

Hedef: Hiçbir kod/dizayn bozulmadan dosyaları ayırmak.

- index.html: shell (orijinal head kaynakları korunur) + bootstrap loader
- tabs/: view-section blokları ayrı HTML dosyaları
- css/app.css: alindex.html içindeki tüm <style> birleşimi
- js/app.js: alindex.html içindeki tüm inline <script> birleşimi (order korunur)
- js/*.js (screener/companies/...): Şimdilik placeholder. Sonraki adımda app.js içinden ilgili fonksiyonları buraya taşıyacağız.

Kurulum:
Repo root'a şu yapıyı koy:
index.html
tabs/
css/
js/
