/**
 * Raf Düzeni Görselleştirme Modülü
 * Bu modül, raf yerleşimlerini ve kategori ilişkilerini görselleştiren fonksiyonları içerir.
 */

console.log("Visualization module loaded!");

// Görselleştirme UI Elemanları
let visualizationContainer;
let shelfMapContainer;
let categoryScoresChart;
let relationshipMatrixContainer;
let visualizationExplanation;
let tabButtons;
let vizPanels;

// Veri Yapıları
let vizData = {};
let selectedShelf = null;

/**
 * Görselleştirme arayüzünü başlatır
 */
function initializeVisualization() {
    console.log("Initializing visualization UI");
    
    // UI elemanlarını al
    visualizationContainer = document.getElementById('visualization-container');
    shelfMapContainer = document.getElementById('shelf-map-container');
    categoryScoresChart = document.getElementById('category-scores-chart');
    relationshipMatrixContainer = document.getElementById('relationship-matrix-container');
    visualizationExplanation = document.getElementById('visualization-explanation');
    
    // DOM elemanlarının varlığını kontrol et
    if (!visualizationContainer || !shelfMapContainer || !categoryScoresChart || 
        !relationshipMatrixContainer || !visualizationExplanation) {
        console.error("One or more visualization containers not found in the DOM");
        return;
    }
    
    // Tab düğmelerini ve panelleri al
    tabButtons = document.querySelectorAll('.viz-tab');
    vizPanels = document.querySelectorAll('.viz-panel');
    
    if (!tabButtons.length || !vizPanels.length) {
        console.warn("Tab buttons or panels not found");
    }
    
    // Tab düğmelerine tıklama olayı ekle
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Aktif düğmeyi ve paneli bul
            const tabId = button.id.replace('tab-', '');
            const panelId = tabId + '-viz';
            
            // Tüm düğmeleri ve panelleri pasifleştir
            tabButtons.forEach(btn => btn.classList.remove('active'));
            vizPanels.forEach(panel => panel.classList.remove('active'));
            
            // Seçilen düğmeyi ve paneli aktifleştir
            button.classList.add('active');
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.classList.add('active');
            } else {
                console.warn(`Panel with id ${panelId} not found`);
            }
        });
    });
    
    // Başlangıç açıklamasını göster - Optimizasyon tipine bağlı olarak farklı açıklamalar
    if (vizData && vizData.optimization_type) {
        if (vizData.optimization_type === 'maximize') {
            visualizationExplanation.innerHTML = `
                <p>Bu görselleştirme, <strong>birlikte sıklıkla satın alınan kategorilerin yakın raflara yerleştirildiği</strong> optimizasyon sonuçlarını göstermektedir.</p>
                <ul>
                    <li><strong>Raf Haritası</strong>: Mavi tonları kategori puanlarını gösterir (koyu mavi = yüksek puan). Yeşil çizgiler kategori ilişkilerini gösterir, kalınlık ve renk tonu ilişki gücünü belirtir.</li>
                    <li><strong>Kategori Puanları</strong>: Her kategorinin birliktelik analizinden elde edilen puanını gösterir.</li>
                    <li><strong>İlişki Matrisi</strong>: Kategoriler arasındaki ilişkileri matris şeklinde gösterir.</li>
                </ul>
                <p>Detaylı bilgi için raf veya kategori üzerine tıklayabilirsiniz.</p>
            `;
        } else {
            visualizationExplanation.innerHTML = `
                <p>Bu görselleştirme, <strong>birlikte sıklıkla satın alınan kategorilerin birbirinden uzak raflara yerleştirildiği</strong> optimizasyon sonuçlarını göstermektedir.</p>
                <ul>
                    <li><strong>Raf Haritası</strong>: Raflar iki gruba ayrılmıştır (kırmızı ve yeşil). İlişkili kategoriler farklı gruplara atanır. Kesikli çizgiler kategori ilişkilerini gösterir.</li>
                    <li><strong>Kategori Puanları</strong>: Her kategorinin birliktelik analizinden elde edilen puanını gösterir.</li>
                    <li><strong>İlişki Matrisi</strong>: Kategoriler arasındaki ilişkileri matris şeklinde gösterir.</li>
                </ul>
                <p style="margin-top: 10px;"><strong>Neden ilişkili ürünleri uzak yerleştiriyoruz?</strong> Bu strateji, müşterilerin mağazada daha fazla dolaşmasını sağlayarak daha fazla ürün keşfetmelerine ve satın alma olasılığını artırmaya yöneliktir.</p>
                <p>Çizgilerdeki değerler "İlişki Gücü / Mesafe" formatındadır. Detaylı bilgi için raf veya kategori üzerine tıklayabilirsiniz.</p>
            `;
        }
    } else {
        visualizationExplanation.innerHTML = `
            <p>Raf düzeni optimizasyonu sonuçlarını görselleştirmek için yukarıdaki sekmeleri kullanabilirsiniz:</p>
            <ul>
                <li><strong>Raf Haritası</strong>: Raflar arasındaki mesafeleri ve ilişkileri gösterir.</li>
                <li><strong>Kategori Puanları</strong>: Her kategorinin birliktelik analizinden elde edilen puanını gösterir.</li>
                <li><strong>İlişki Matrisi</strong>: Kategoriler arasındaki ilişkileri matris şeklinde gösterir.</li>
            </ul>
            <p>Detaylı bilgi için raf veya kategori üzerine tıklayabilirsiniz.</p>
        `;
    }
}

/**
 * Görselleştirmeyi başlatır ve görüntüler
 * @param {Object} data - Raflar, kategoriler ve ilişkiler hakkında veri 
 */
function renderVisualization(data) {
    console.log("renderVisualization called with data:", data);
    
    if (!data) {
        console.error("Visualization data is undefined or null");
        return;
    }
    
    vizData = data;
    visualizationContainer.style.display = 'block';
    
    // Her bir görselleştirmeyi oluştur
    renderShelfMap();
    renderCategoryScores();
    renderRelationshipMatrix();
}

/**
 * Raf haritasını oluşturur
 */
function renderShelfMap() {
    if (!vizData || !vizData.shelf_positions) return;
    
    // Konteyner içeriğini temizle
    shelfMapContainer.innerHTML = '';
    
    // Raflar arası mesafeleri ve kenarları eklemek için hazırlık
    const shelfPositions = vizData.shelf_positions;
    const shelfDistances = vizData.all_shelf_distances || {};
    const assignments = vizData.assignment_explanation || {};
    
    // X ve Y için ölçeklendirme faktörlerini hesapla
    const containerRect = shelfMapContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Raf pozisyonlarını normalize etmek için min/max değerleri bul
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    Object.values(shelfPositions).forEach(pos => {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
    });
    
    // Boşluk bırakmak için margin ekle
    const margin = 30;
    const scaleX = (containerWidth - 2 * margin) / (maxX - minX || 1);
    const scaleY = (containerHeight - 2 * margin) / (maxY - minY || 1);
    
    // Raf düğümlerini ekle
    for (const [shelfName, position] of Object.entries(shelfPositions)) {
        const assignment = assignments[shelfName] || {};
        const category = assignment.category || 'Atanmadı';
        const nodeSize = 60; // Düğüm boyutu
        
        // Raf pozisyonunu konteyner içine ölçeklendir
        const x = (position.x - minX) * scaleX + margin;
        const y = (position.y - minY) * scaleY + margin;
        
        // Raf düğümünü oluştur
        const shelfNode = document.createElement('div');
        shelfNode.className = 'shelf-node';
        shelfNode.style.width = `${nodeSize}px`;
        shelfNode.style.height = `${nodeSize}px`;
        shelfNode.style.left = `${x - nodeSize/2}px`;
        shelfNode.style.top = `${y - nodeSize/2}px`;
        
        // Düğüme özel stil ekle (zaman hedefine göre)
        if (assignment.rank) {
            // Merkeze yakın olanların daha koyu renk olması için hesaplamayı değiştir
            // Rank değeri düşük olan merkeze yakındır, yüksek olan uzaktır
            // 20 ile 90 arasında bir değer üretiyoruz, merkeze yakın olanlar için düşük değer (koyu renk)
            const colorIntensity = Math.min(20 + (assignment.rank * 10), 90);
            
            if (vizData.optimization_type === 'maximize') {
                shelfNode.style.backgroundColor = `hsl(211, 100%, ${colorIntensity}%)`;
            } else {
                // Minimize durumunda farklı bir renk şeması kullan
                if (assignment.group === 'even') {
                    shelfNode.style.backgroundColor = `hsl(354, 70%, ${colorIntensity}%)`;
                } else {
                    shelfNode.style.backgroundColor = `hsl(150, 70%, ${colorIntensity}%)`;
                }
            }
        }
        
        // Düğüm içeriği
        shelfNode.innerHTML = `
            <div style="text-align: center; line-height: 1.2;">
                <div style="font-size: 0.7rem;">${shelfName}</div>
                <div style="font-size: 0.65rem; opacity: 0.8; margin-top: 2px;">${toTitleCase(category)}</div>
            </div>
        `;
        
        // Raf detaylarını göstermek için tıklama olayı ekle
        shelfNode.addEventListener('click', () => {
            selectedShelf = shelfName;
            showShelfDetails(shelfName, assignment);
        });
        
        shelfMapContainer.appendChild(shelfNode);
        
        // Raf ID'sini veri özelliği olarak ekle (kenarlar için gerekli)
        shelfNode.dataset.shelfName = shelfName;
    }
    
    // Raflar arası ilişkileri ve kenarları göster (hem maximize hem minimize için)
    // Tüm raflar arasındaki kenarları göster
    const shelfNodes = shelfMapContainer.querySelectorAll('.shelf-node');
    const shelfNodeMap = new Map();
    
    // Düğüm elemanlarını bir haritada tut
    shelfNodes.forEach(node => {
        shelfNodeMap.set(node.dataset.shelfName, node);
    });
    
    // Optimize edilmek istenen şeye göre ilişki çizgilerini farklılaştır
    const isMaximize = vizData.optimization_type === 'maximize';
    
    // Raflar arası mesafeleri göster
    for (const [shelf1, distances] of Object.entries(shelfDistances)) {
        for (const [shelf2, distance] of Object.entries(distances)) {
            // Sadece ilişkili raflar arasında kenarları göster
            const assignment1 = assignments[shelf1] || {};
            const assignment2 = assignments[shelf2] || {};
            const category1 = assignment1.category;
            const category2 = assignment2.category;
            
            // Kategori ilişkisini kontrol et
            let areRelated = false;
            let relationStrength = 0;
            const categoryRelations = vizData.category_relations || {};
            
            if (category1 && category2 && categoryRelations[category1]) {
                const relations = categoryRelations[category1];
                const relation = relations.find(rel => rel.category === category2);
                if (relation) {
                    areRelated = true;
                    relationStrength = relation.lift;
                }
            }
            
            if (!areRelated) continue;
            
            // Düğümleri al
            const node1 = shelfNodeMap.get(shelf1);
            const node2 = shelfNodeMap.get(shelf2);
            
            if (!node1 || !node2) continue;
            
            // Düğüm pozisyonlarını al
            const rect1 = node1.getBoundingClientRect();
            const rect2 = node2.getBoundingClientRect();
            const containerRect = shelfMapContainer.getBoundingClientRect();
            
            // Düğüm merkezlerinin koordinatları
            const x1 = rect1.left + rect1.width/2 - containerRect.left;
            const y1 = rect1.top + rect1.height/2 - containerRect.top;
            const x2 = rect2.left + rect2.width/2 - containerRect.left;
            const y2 = rect2.top + rect2.height/2 - containerRect.top;
            
            // Kenar uzunluğunu ve açısını hesapla
            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.sqrt(dx*dx + dy*dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            // Düğüm yarıçapı
            const nodeRadius = rect1.width/2;
            
            // İlişki gücüne ve optimizasyon tipine göre kenar genişliğini ve rengini belirle
            let edgeWidth = 1;
            let edgeColor = 'rgba(200, 200, 200, 0.5)'; // Varsayılan değer
            let edgeStyle = 'solid'; // Varsayılan stil

            if (isMaximize) {
                // Maximize için - ilişkiler yeşilden griye
                if (relationStrength > 3) {
                    edgeWidth = 4;
                    edgeColor = 'rgba(40, 167, 69, 0.7)'; // Çok güçlü - yeşil
                } else if (relationStrength > 2) {
                    edgeWidth = 3;
                    edgeColor = 'rgba(92, 184, 92, 0.6)'; // Güçlü - yeşil
                } else if (relationStrength > 1.5) {
                    edgeWidth = 2;
                    edgeColor = 'rgba(23, 162, 184, 0.5)'; // Orta - mavi
                } else if (relationStrength > 1.2) {
                    edgeWidth = 1.5;
                    edgeColor = 'rgba(108, 117, 125, 0.4)'; // Zayıf - gri
                }
                edgeStyle = 'solid';
            } else {
                // Minimize için - ilişkiler kırmızıdan turuncuya
                if (relationStrength > 3) {
                    edgeWidth = 4;
                    edgeColor = 'rgba(220, 53, 69, 0.7)'; // Çok güçlü - kırmızı
                } else if (relationStrength > 2) {
                    edgeWidth = 3;
                    edgeColor = 'rgba(255, 107, 107, 0.6)'; // Güçlü - açık kırmızı
                } else if (relationStrength > 1.5) {
                    edgeWidth = 2;
                    edgeColor = 'rgba(255, 193, 7, 0.5)'; // Orta - sarı
                } else if (relationStrength > 1.2) {
                    edgeWidth = 1.5;
                    edgeColor = 'rgba(255, 136, 0, 0.4)'; // Zayıf - turuncu
                }
                edgeStyle = 'dashed'; // Kesikli çizgi ile minimize gösterimi
            }
            
            // Mesafe değerlendirmesi ekle - minimum senaryo başarısını göstermek için
            if (!isMaximize && edgeColor) {
                // Minimize durumunda uzak mesafe başarıdır - mesafe arttıkça kenar opacity'si azalır
                // Normalleştirilmiş mesafe (minimum: 50, maximum: 400 - bu değerler gerçek verilere göre ayarlanabilir)
                const minDist = 50;
                const maxDist = 400;
                const normalizedDistance = Math.min(Math.max(distance, minDist), maxDist);
                const opacity = (maxDist - normalizedDistance) / (maxDist - minDist); // Büyük mesafeler için düşük opacity
                
                // Opacity'yi kenar rengine uygula - RGBA renk formatını güvenli şekilde düzenle
                if (edgeColor.startsWith('rgba')) {
                    // RGBA rengi için son parametreyi (opacity) değiştir
                    const rgbaParts = edgeColor.split(',');
                    if (rgbaParts.length === 4) {
                        rgbaParts[3] = ` ${opacity})`;
                        edgeColor = rgbaParts.join(',');
                    }
                } else if (edgeColor.startsWith('rgb')) {
                    // RGB rengi için RGBA'ya dönüştür
                    edgeColor = edgeColor.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
                }
            }
            
            // Kenarı oluştur ve ekle
            const edge = document.createElement('div');
            edge.className = 'shelf-edge';
            edge.style.width = `${length - 2*nodeRadius}px`;
            edge.style.height = `${edgeWidth}px`;
            edge.style.left = `${x1 + nodeRadius * Math.cos(angle * Math.PI / 180)}px`;
            edge.style.top = `${y1 + nodeRadius * Math.sin(angle * Math.PI / 180)}px`;
            edge.style.backgroundColor = edgeColor;
            edge.style.transform = `rotate(${angle}deg)`;
            
            // Minimize için kesikli çizgi stili
            if (edgeStyle === 'dashed' && edgeColor) {
                edge.style.borderTop = `${edgeWidth}px dashed ${edgeColor}`;
                edge.style.backgroundColor = 'transparent';
            }
            
            // Kenar etiketini ekle (ilişki gücü + mesafe)
            if (relationStrength > 1) {
                const edgeLabel = document.createElement('div');
                edgeLabel.className = 'edge-label';
                
                // Minimize için mesafe de göster
                if (!isMaximize) {
                    const distanceText = distance.toFixed(0);
                    edgeLabel.textContent = `${relationStrength.toFixed(1)} / ${distanceText}`;
                    edgeLabel.title = `İlişki: ${relationStrength.toFixed(1)}, Mesafe: ${distanceText}`;
                    
                    // Başarılı ayrıştırma için görsel ipucu
                    if (distance > 200 && relationStrength > 1.5) {
                        edgeLabel.style.border = '1px solid green';
                    } else if (distance < 100 && relationStrength > 1.5) {
                        edgeLabel.style.border = '1px solid red';
                    }
                } else {
                    edgeLabel.textContent = relationStrength.toFixed(1);
                }
                
                // Etiketi kenarın ortasına yerleştir
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                edgeLabel.style.left = `${midX - 15}px`;
                edgeLabel.style.top = `${midY - 10}px`;
                
                shelfMapContainer.appendChild(edgeLabel);
            }
            
            shelfMapContainer.appendChild(edge);
        }
    }
    
    // Lejant ekle
    const legend = document.getElementById('shelf-map-legend');
    legend.innerHTML = '';
    
    if (vizData.optimization_type === 'maximize') {
        // Merkeze uzaklık lejantı - Koyu renk (merkeze yakın) -> Açık renk (merkeze uzak)
        legend.innerHTML = `
            <div class="legend-item">
                <div class="legend-color" style="background-color: hsl(211, 100%, 20%);"></div>
                <div>Merkeze Yakın (Yüksek Puanlı Kategoriler)</div>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: hsl(211, 100%, 50%);"></div>
                <div>Orta Uzaklık</div>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: hsl(211, 100%, 80%);"></div>
                <div>Merkeze Uzak (Düşük Puanlı Kategoriler)</div>
            </div>
            <div class="legend-item" style="width: 100%; margin-top: 8px; border-top: 1px solid #e0e0e0; padding-top: 8px;">
                <div style="margin-bottom: 5px;">İlişki Çizgileri (İlişki Gücü / Lift):</div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <span style="display: flex; align-items: center;">
                        <div style="width: 20px; height: 4px; background-color: rgba(40, 167, 69, 0.7); margin-right: 5px;"></div>
                        <span>Çok Güçlü (>3)</span>
                    </span>
                    <span style="display: flex; align-items: center;">
                        <div style="width: 20px; height: 3px; background-color: rgba(92, 184, 92, 0.6); margin-right: 5px;"></div>
                        <span>Güçlü (>2)</span>
                    </span>
                    <span style="display: flex; align-items: center;">
                        <div style="width: 20px; height: 2px; background-color: rgba(23, 162, 184, 0.5); margin-right: 5px;"></div>
                        <span>Orta (>1.5)</span>
                    </span>
                </div>
            </div>
        `;
    } else {
        // Minimize için grup ve mesafe lejantı 
        legend.innerHTML = `
            <div style="width: 100%; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0;">
                <div style="font-weight: bold; margin-bottom: 5px;">Raf Kategorileri:</div>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: hsl(354, 70%, 30%);"></div>
                        <div>Grup 1 - Yüksek Puanlı</div>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: hsl(150, 70%, 30%);"></div>
                        <div>Grup 2 - Yüksek Puanlı</div>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: hsl(354, 70%, 70%);"></div>
                        <div>Grup 1 - Düşük Puanlı</div>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: hsl(150, 70%, 70%);"></div>
                        <div>Grup 2 - Düşük Puanlı</div>
                    </div>
                </div>
            </div>
            <div style="width: 100%;">
                <div style="font-weight: bold; margin-bottom: 5px;">İlişki Çizgileri (İlişki Gücü / Mesafe):</div>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
                    <span style="display: flex; align-items: center;">
                        <div style="width: 20px; border-top: 4px dashed rgba(220, 53, 69, 0.7); margin-right: 5px;"></div>
                        <span>Çok Güçlü İlişki (>3)</span>
                    </span>
                    <span style="display: flex; align-items: center;">
                        <div style="width: 20px; border-top: 3px dashed rgba(255, 107, 107, 0.6); margin-right: 5px;"></div>
                        <span>Güçlü İlişki (>2)</span>
                    </span>
                    <span style="display: flex; align-items: center;">
                        <div style="width: 20px; border-top: 2px dashed rgba(255, 193, 7, 0.5); margin-right: 5px;"></div>
                        <span>Orta İlişki (>1.5)</span>
                    </span>
                </div>
                <div style="margin-top: 8px; font-style: italic; font-size: 0.8rem; color: #555;">
                    İlişkili kategoriler farklı gruplara atanır (kırmızı ve yeşil). Çizgilerin soluklaşması, kategorilerin
                    başarıyla uzak yerleştirildiğini gösterir. Etiketlerde ilk sayı ilişki gücünü, ikinci sayı mesafeyi belirtir.
                </div>
            </div>
        `;
    }
}

/**
 * Seçilen raf hakkında detaylı bilgileri gösterir
 */
function showShelfDetails(shelfName, assignmentData) {
    if (!shelfName || !assignmentData) return;
    
    const category = assignmentData.category || 'Atanmadı';
    const reason = assignmentData.reason || '';
    const score = assignmentData.score || 0;
    
    let detailsHtml = `
        <div class="shelf-details" style="display: block;">
            <h4 style="margin-top: 0;">${shelfName} Detayları</h4>
            <div class="shelf-detail-item">
                <span class="shelf-detail-label">Atanan Kategori:</span> ${toTitleCase(category)}
            </div>
            <div class="shelf-detail-item">
                <span class="shelf-detail-label">Atama Nedeni:</span> ${reason}
            </div>
            <div class="shelf-detail-item">
                <span class="shelf-detail-label">Kategori Puanı:</span> ${score.toFixed(2)}
            </div>
            <div class="shelf-detail-item">
                <span class="shelf-detail-label">Puan Sıralaması:</span> ${assignmentData.rank || 'N/A'}
            </div>
    `;
    
    // İlişkili kategorileri de göster
    const categoryRelations = vizData.category_relations || {};
    if (category in categoryRelations) {
        const relations = categoryRelations[category];
        if (relations && relations.length > 0) {
            detailsHtml += `
                <div class="shelf-detail-item" style="margin-top: 10px;">
                    <span class="shelf-detail-label">İlişkili Kategoriler:</span>
                    <ul style="margin-top: 5px; padding-left: 20px;">
            `;
            
            // İlişki gücüne göre sırala
            const sortedRelations = [...relations].sort((a, b) => b.lift - a.lift);
            
            sortedRelations.forEach(rel => {
                let relationClass = '';
                if (rel.lift > 3) relationClass = 'relationship-very-strong';
                else if (rel.lift > 2) relationClass = 'relationship-strong';
                else if (rel.lift > 1.5) relationClass = 'relationship-moderate';
                else if (rel.lift > 1.2) relationClass = 'relationship-weak';
                else relationClass = 'relationship-very-weak';
                
                detailsHtml += `
                    <li>
                        <span class="category-name">${toTitleCase(rel.category)}</span>
                        <span class="matrix-cell-value ${relationClass}" 
                              style="display: inline-flex; width: 25px; height: 18px; font-size: 0.7rem; margin-left: 5px;">
                            ${rel.lift.toFixed(1)}
                        </span>
                    </li>
                `;
            });
            
            detailsHtml += `</ul></div>`;
        }
    }
    
    detailsHtml += `</div>`;
    
    visualizationExplanation.innerHTML = detailsHtml;
}

/**
 * Kategori puanları görselleştirmesini oluşturur
 */
function renderCategoryScores() {
    if (!vizData || !vizData.category_scores) return;
    
    // Konteyner içeriğini temizle
    categoryScoresChart.innerHTML = '';
    
    const categoryScores = vizData.category_scores;
    
    // Puanlara göre sırala
    const sortedScores = Object.entries(categoryScores)
        .sort((a, b) => b[1] - a[1]);
    
    // En yüksek puanı bul (ölçeklendirme için)
    const maxScore = sortedScores.length > 0 ? sortedScores[0][1] : 1;
    
    // Her kategori için çubuk oluştur
    sortedScores.forEach(([category, score], index) => {
        // Puanı 0-100 aralığına ölçeklendir
        const scaledScore = (score / maxScore) * 100;
        
        // Çubuk rengini belirle (sıralamaya göre)
        // Merkeze yakın olanların daha koyu renk olması için hesaplamayı değiştir
        // Yüksek puanlı kategoriler daha koyu renkli (20% lightness)
        // Düşük puanlı kategoriler daha açık renkli (90% lightness)
        const colorIntensity = Math.min(20 + (index * 10), 90);
        const barColor = `hsl(211, 100%, ${colorIntensity}%)`;
        
        // Çubuk elemanını oluştur
        const categoryBar = document.createElement('div');
        categoryBar.className = 'category-bar';
        categoryBar.innerHTML = `
            <div class="category-bar-fill" style="width: ${scaledScore}%; background-color: ${barColor};">
                <span class="category-name-label">${toTitleCase(category)}</span>
            </div>
            <span class="category-score-label">${score.toFixed(2)}</span>
        `;
        
        // Kategori detaylarını göstermek için tıklama olayı ekle
        categoryBar.addEventListener('click', () => {
            showCategoryDetails(category, score, index + 1);
        });
        
        categoryScoresChart.appendChild(categoryBar);
    });
    
    // Kategori puanları için lejant ekle
    const legend = document.createElement('div');
    legend.className = 'category-scores-legend';
    legend.style.marginTop = '15px';
    legend.style.fontSize = '0.8rem';
    legend.innerHTML = `
        <div class="legend-container" style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
            <div class="legend-item">
                <div class="legend-color" style="background-color: hsl(211, 100%, 20%);"></div>
                <div>Yüksek Puanlı Kategoriler</div>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: hsl(211, 100%, 50%);"></div>
                <div>Orta Puanlı Kategoriler</div>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: hsl(211, 100%, 80%);"></div>
                <div>Düşük Puanlı Kategoriler</div>
            </div>
        </div>
    `;
    
    categoryScoresChart.appendChild(legend);
}

/**
 * Seçilen kategori hakkında detaylı bilgileri gösterir
 */
function showCategoryDetails(category, score, rank) {
    if (!category) return;
    
    // Kategori ilişkilerini al
    const categoryRelations = vizData.category_relations || {};
    const relations = categoryRelations[category] || [];
    
    // Atanan rafı bul
    const assignments = vizData.assignment_explanation || {};
    let assignedShelf = null;
    
    for (const [shelf, data] of Object.entries(assignments)) {
        if (data.category === category) {
            assignedShelf = shelf;
            break;
        }
    }
    
    // Detay HTML'ini oluştur
    let detailsHtml = `
        <div class="shelf-details" style="display: block;">
            <h4 style="margin-top: 0;">${toTitleCase(category)} Kategori Detayları</h4>
            <div class="shelf-detail-item">
                <span class="shelf-detail-label">Kategori Puanı:</span> ${score.toFixed(2)}
            </div>
            <div class="shelf-detail-item">
                <span class="shelf-detail-label">Puan Sıralaması:</span> ${rank}
            </div>
            <div class="shelf-detail-item">
                <span class="shelf-detail-label">Atandığı Raf:</span> ${assignedShelf || 'Atanmadı'}
            </div>
    `;
    
    // İlişkili kategorileri göster
    if (relations.length > 0) {
        detailsHtml += `
            <div class="shelf-detail-item" style="margin-top: 10px;">
                <span class="shelf-detail-label">İlişkili Olduğu Kategoriler:</span>
                <ul style="margin-top: 5px; padding-left: 20px;">
        `;
        
        // İlişki gücüne göre sırala
        const sortedRelations = [...relations].sort((a, b) => b.lift - a.lift);
        
        sortedRelations.forEach(rel => {
            let relationClass = '';
            if (rel.lift > 3) relationClass = 'relationship-very-strong';
            else if (rel.lift > 2) relationClass = 'relationship-strong';
            else if (rel.lift > 1.5) relationClass = 'relationship-moderate';
            else if (rel.lift > 1.2) relationClass = 'relationship-weak';
            else relationClass = 'relationship-very-weak';
            
            // İlişkili kategori için atanan rafı bul
            let relatedShelf = null;
            for (const [shelf, data] of Object.entries(assignments)) {
                if (data.category === rel.category) {
                    relatedShelf = shelf;
                    break;
                }
            }
            
            detailsHtml += `
                <li>
                    <span class="category-name">${toTitleCase(rel.category)}</span>
                    <span class="matrix-cell-value ${relationClass}" 
                          style="display: inline-flex; width: 25px; height: 18px; font-size: 0.7rem; margin-left: 5px;">
                        ${rel.lift.toFixed(1)}
                    </span>
                    ${relatedShelf ? `<span style="font-size: 0.8rem; color: #6c757d; margin-left: 5px;">(Raf: ${relatedShelf})</span>` : ''}
                </li>
            `;
        });
        
        detailsHtml += `</ul></div>`;
    }
    
    detailsHtml += `</div>`;
    
    visualizationExplanation.innerHTML = detailsHtml;
}

/**
 * İlişki matrisini oluşturur
 */
function renderRelationshipMatrix() {
    if (!vizData || !vizData.category_relations) return;
    
    // Konteyner içeriğini temizle
    relationshipMatrixContainer.innerHTML = '';
    
    const categoryRelations = vizData.category_relations || {};
    const categoryScores = vizData.category_scores || {};
    
    // Tüm kategorileri topla ve puanlarına göre sırala
    const allCategories = new Set();
    Object.keys(categoryRelations).forEach(cat => {
        allCategories.add(cat);
        categoryRelations[cat].forEach(rel => {
            allCategories.add(rel.category);
        });
    });
    
    // Kategorileri sırala (puanlarına göre)
    const sortedCategories = Array.from(allCategories)
        .sort((a, b) => (categoryScores[b] || 0) - (categoryScores[a] || 0));
    
    // Matris tablosunu oluştur
    const table = document.createElement('table');
    table.className = 'matrix-table';
    
    // Başlık satırını oluştur
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th></th>'; // Sol üst köşe boş
    
    sortedCategories.forEach(category => {
        const th = document.createElement('th');
        th.textContent = toTitleCase(category);
        th.title = toTitleCase(category);
        headerRow.appendChild(th);
    });
    
    table.appendChild(headerRow);
    
    // Her kategori için satır oluştur
    sortedCategories.forEach(category1 => {
        const row = document.createElement('tr');
        
        // Satır başlığı (kategori adı)
        const rowHeader = document.createElement('th');
        rowHeader.textContent = toTitleCase(category1);
        rowHeader.title = toTitleCase(category1);
        row.appendChild(rowHeader);
        
        // Diğer kategorilerle ilişkileri göster
        sortedCategories.forEach(category2 => {
            const cell = document.createElement('td');
            cell.className = 'matrix-cell';
            
            // İlişki gücünü bul
            let relationStrength = 0;
            if (categoryRelations[category1]) {
                const relation = categoryRelations[category1].find(r => r.category === category2);
                if (relation) {
                    relationStrength = relation.lift;
                }
            }
            
            // Aynı kategori için köşegen hücreler
            if (category1 === category2) {
                cell.style.backgroundColor = '#f8f9fa';
            } 
            // İlişki varsa göster
            else if (relationStrength > 0) {
                let cellClass = '';
                
                if (relationStrength > 3) cellClass = 'relationship-very-strong';
                else if (relationStrength > 2) cellClass = 'relationship-strong';
                else if (relationStrength > 1.5) cellClass = 'relationship-moderate';
                else if (relationStrength > 1.2) cellClass = 'relationship-weak';
                else cellClass = 'relationship-very-weak';
                
                cell.innerHTML = `<div class="matrix-cell-value ${cellClass}">${relationStrength.toFixed(1)}</div>`;
                
                // İlişki detaylarını göstermek için tıklama olayı ekle
                cell.addEventListener('click', () => {
                    showRelationshipDetails(category1, category2, relationStrength);
                });
            }
            
            row.appendChild(cell);
        });
        
        table.appendChild(row);
    });
    
    relationshipMatrixContainer.appendChild(table);
    
    // Matris lejantını ekle
    const legend = document.createElement('div');
    legend.className = 'matrix-legend';
    legend.style.marginTop = '15px';
    legend.style.fontSize = '0.8rem';
    legend.innerHTML = `
        <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
            <div class="legend-item">
                <div class="matrix-cell-value relationship-very-strong" style="width: 20px; height: 15px; font-size: 0.7rem;">3+</div>
                <div>Çok Güçlü İlişki</div>
            </div>
            <div class="legend-item">
                <div class="matrix-cell-value relationship-strong" style="width: 20px; height: 15px; font-size: 0.7rem;">2+</div>
                <div>Güçlü İlişki</div>
            </div>
            <div class="legend-item">
                <div class="matrix-cell-value relationship-moderate" style="width: 20px; height: 15px; font-size: 0.7rem;">1.5+</div>
                <div>Orta İlişki</div>
            </div>
            <div class="legend-item">
                <div class="matrix-cell-value relationship-weak" style="width: 20px; height: 15px; font-size: 0.7rem;">1.2+</div>
                <div>Zayıf İlişki</div>
            </div>
            <div class="legend-item">
                <div class="matrix-cell-value relationship-very-weak" style="width: 20px; height: 15px; font-size: 0.7rem;">1+</div>
                <div>Çok Zayıf İlişki</div>
            </div>
        </div>
    `;
    
    relationshipMatrixContainer.appendChild(legend);
}

/**
 * Seçilen kategori ilişkileri hakkında detaylı bilgileri gösterir
 */
function showRelationshipDetails(category1, category2, lift) {
    if (!category1 || !category2) return;
    
    // İlgili kategori ilişkisini bul
    const categoryRelations = vizData.category_relations || {};
    let relationDetails = null;
    
    if (categoryRelations[category1]) {
        relationDetails = categoryRelations[category1].find(r => r.category === category2);
    }
    
    // İlişki yoksa çık
    if (!relationDetails) return;
    
    // Kategorilerin atandığı rafları bul
    const assignments = vizData.assignment_explanation || {};
    let shelf1 = null, shelf2 = null;
    
    for (const [shelf, data] of Object.entries(assignments)) {
        if (data.category === category1) {
            shelf1 = shelf;
        } else if (data.category === category2) {
            shelf2 = shelf;
        }
        
        if (shelf1 && shelf2) break;
    }
    
    // Raflar arası mesafeyi bul
    let shelfDistance = null;
    if (shelf1 && shelf2 && vizData.all_shelf_distances && 
        vizData.all_shelf_distances[shelf1] && 
        vizData.all_shelf_distances[shelf1][shelf2]) {
        shelfDistance = vizData.all_shelf_distances[shelf1][shelf2];
    }
    
    // İlişki gücüne göre sınıf belirle
    let relationClass = '';
    if (lift > 3) relationClass = 'relationship-very-strong';
    else if (lift > 2) relationClass = 'relationship-strong';
    else if (lift > 1.5) relationClass = 'relationship-moderate';
    else if (lift > 1.2) relationClass = 'relationship-weak';
    else relationClass = 'relationship-very-weak';
    
    // Detay HTML'ini oluştur
    let detailsHtml = `
        <div class="shelf-details" style="display: block;">
            <h4 style="margin-top: 0;">Kategori İlişki Detayları</h4>
            <div class="shelf-detail-item">
                <span class="shelf-detail-label">Kategoriler:</span> 
                ${toTitleCase(category1)} ve ${toTitleCase(category2)}
            </div>
            <div class="shelf-detail-item">
                <span class="shelf-detail-label">İlişki Gücü (Lift):</span> 
                <span class="matrix-cell-value ${relationClass}" 
                      style="display: inline-flex; width: 30px; height: 20px; font-size: 0.8rem; margin-left: 5px;">
                    ${lift.toFixed(2)}
                </span>
            </div>
            <div class="shelf-detail-item">
                <span class="shelf-detail-label">Güven (Confidence):</span> 
                ${relationDetails.confidence ? (relationDetails.confidence * 100).toFixed(1) + '%' : 'N/A'}
            </div>
    `;
    
    // Atandığı raflar ve aralarındaki mesafe
    if (shelf1 && shelf2) {
        detailsHtml += `
            <div class="shelf-detail-item">
                <span class="shelf-detail-label">Atandıkları Raflar:</span> 
                ${shelf1} ve ${shelf2}
            </div>
        `;
        
        if (shelfDistance !== null) {
            detailsHtml += `
                <div class="shelf-detail-item">
                    <span class="shelf-detail-label">Raflar Arası Mesafe:</span> 
                    ${shelfDistance.toFixed(1)} birim
                </div>
            `;
        }
        
        // Optimizasyon hedefine göre yorumla
        detailsHtml += `
            <div class="shelf-detail-item" style="margin-top: 10px; padding: 8px; background-color: #f0f7ff; border-radius: 4px;">
                <span class="shelf-detail-label">Optimizasyon Yorumu:</span><br>
        `;
        
        if (vizData.optimization_type === 'maximize') {
            if (shelfDistance !== null) {
                if (shelfDistance < 100 && lift > 1.5) {
                    detailsHtml += `<span style="color: #28a745;">✓ İlişkili kategoriler başarıyla yakın raflara yerleştirilmiş.</span>`;
                } else if (shelfDistance > 200 && lift > 1.5) {
                    detailsHtml += `<span style="color: #dc3545;">✗ İlişkili kategoriler uzak raflara yerleştirilmiş. Bu rafları birbirine daha yakın konumlandırmak müşteri deneyimini iyileştirebilir.</span>`;
                } else {
                    detailsHtml += `<span style="color: #ffc107;">⚠ İlişkili kategoriler orta mesafede raflara yerleştirilmiş.</span>`;
                }
            }
        } else { // minimize
            if (shelfDistance !== null) {
                if (shelfDistance > 200 && lift > 1.5) {
                    detailsHtml += `
                        <span style="color: #28a745;">✓ İlişkili kategoriler başarıyla uzak raflara yerleştirilmiş.</span>
                        <p style="margin-top: 5px; font-size: 0.85rem;">Bu düzenleme mağaza içi dolaşımı artırır ve müşterilerin daha fazla ürünle karşılaşmasını sağlar. Örneğin, süt almak için gelen bir müşteri, peynir ürünlerine ulaşmak için mağazada daha fazla mesafe katetmek zorunda kalır.</p>
                    `;
                } else if (shelfDistance < 100 && lift > 1.5) {
                    detailsHtml += `
                        <span style="color: #dc3545;">✗ İlişkili kategoriler yakın raflara yerleştirilmiş.</span>
                        <p style="margin-top: 5px; font-size: 0.85rem;">Bu rafları birbirinden uzaklaştırmak mağaza içi dolaşımı artırabilir. Birlikte satın alınan ürünleri mağazanın farklı noktalarına yerleştirmek, müşterilerin mağazayı daha fazla dolaşmasını ve daha fazla ürünle karşılaşmasını sağlar.</p>
                    `;
                } else {
                    detailsHtml += `
                        <span style="color: #ffc107;">⚠ İlişkili kategoriler orta mesafede raflara yerleştirilmiş.</span>
                        <p style="margin-top: 5px; font-size: 0.85rem;">Bu kategoriler arasındaki mesafeyi daha da artırmak mağaza içi dolaşımı optimize edebilir.</p>
                    `;
                }
            }
        }
        
        detailsHtml += `</div>`;
    }
    
    detailsHtml += `</div>`;
    
    visualizationExplanation.innerHTML = detailsHtml;
}

// Tüm fonksiyonları global scope'a (window nesnesine) ekle
window.initializeVisualization = initializeVisualization;
window.renderVisualization = renderVisualization;
window.renderShelfMap = renderShelfMap;
window.renderCategoryScores = renderCategoryScores;
window.renderRelationshipMatrix = renderRelationshipMatrix;
window.showShelfDetails = showShelfDetails;
window.showCategoryDetails = showCategoryDetails;
window.showRelationshipDetails = showRelationshipDetails;
