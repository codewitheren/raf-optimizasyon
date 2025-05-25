// --- Helper Functions (Keep existing: toTitleCase, displayError, hideStatusMessages) --- 
function toTitleCase(str) { if (!str) return ''; return str.toLowerCase().split(' ').map(function(word) { if (!word) return ''; return word.charAt(0).toUpperCase() + word.slice(1); }).join(' '); }
function displayError(elementId, message) { const errorDiv = document.getElementById(elementId); errorDiv.textContent = `Hata: ${message || 'Bilinmeyen bir hata oluştu.'}`; errorDiv.style.display = 'block'; }
function hideStatusMessages(...elementIds) { elementIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; }); }

// --- Drag & Drop Logic --- NEW ---
const storeArea = document.getElementById('store-layout-area');
const addShelfBtn = document.getElementById('add-shelf-btn');
let shelfCounter = 0;
let draggedItem = null;
let offsetX, offsetY;

function makeShelfDraggable(shelf) {
    shelf.addEventListener('mousedown', (e) => {
        // Prevent drag if editing name
        if (e.target.tagName === 'INPUT') return;
        
        draggedItem = shelf;
        // Calculate offset from the top-left corner of the shelf
        offsetX = e.clientX - shelf.getBoundingClientRect().left;
        offsetY = e.clientY - shelf.getBoundingClientRect().top;
        shelf.style.zIndex = 1001; // Bring above others
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault(); // Prevent default text selection behavior
    });

    // Double click to rename
    shelf.addEventListener('dblclick', (e) => {
        if (e.target.tagName === 'INPUT') return;
        shelf.classList.add('editing');
        const input = shelf.querySelector('input');
        const span = shelf.querySelector('span');
        input.value = span.textContent;
        input.style.display = 'block';
        input.focus();
        input.select();
    });

    // Finish renaming on blur or Enter
    const input = shelf.querySelector('input');
    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            finishRename(e);
        }
    });
}

function finishRename(e) {
     const input = e.target;
     const shelf = input.closest('.shelf-item');
     if (!shelf) return;
     const span = shelf.querySelector('span');
     const newName = input.value.trim();
     span.textContent = newName || `Raf ${shelf.dataset.id || '?'}`; // Use default if empty
     shelf.dataset.name = span.textContent; // Update data attribute
     input.style.display = 'none';
     shelf.classList.remove('editing');
}

function onMouseMove(e) {
    if (!draggedItem) return;

    const storeRect = storeArea.getBoundingClientRect();
    // Calculate desired new top-left position relative to the store area
    let newX = e.clientX - storeRect.left - offsetX;
    let newY = e.clientY - storeRect.top - offsetY;

    // Constrain within boundaries
    const shelfRect = draggedItem.getBoundingClientRect();
    newX = Math.max(0, Math.min(newX, storeRect.width - shelfRect.width));
    newY = Math.max(0, Math.min(newY, storeRect.height - shelfRect.height));

    draggedItem.style.left = `${newX}px`;
    draggedItem.style.top = `${newY}px`;
}

function onMouseUp() {
    if (draggedItem) {
        draggedItem.style.zIndex = 1000; // Reset z-index
        draggedItem = null;
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
}

function addShelf() {
    shelfCounter++;
    const shelf = document.createElement('div');
    shelf.className = 'shelf-item';
    shelf.style.left = `${(shelfCounter % 5) * 90 + 10}px`; // Initial position cascade
    shelf.style.top = `${Math.floor(shelfCounter / 5) * 40 + 10}px`;
    shelf.dataset.id = shelfCounter;
    shelf.dataset.name = `Raf ${shelfCounter}`;
    shelf.innerHTML = `<span>Raf ${shelfCounter}</span><input type="text">`;
    storeArea.appendChild(shelf);
    makeShelfDraggable(shelf);
}

addShelfBtn.addEventListener('click', addShelf);

// Initialize with one shelf
addShelf(); 

function getShelfData() {
    const shelves = [];
    const shelfElements = storeArea.querySelectorAll('.shelf-item');
    const storeRect = storeArea.getBoundingClientRect();

    shelfElements.forEach(shelf => {
        const name = shelf.dataset.name || `Raf ${shelf.dataset.id}`;
        // Use pixel position relative to container top-left
        const x = parseFloat(shelf.style.left) || 0;
        const y = parseFloat(shelf.style.top) || 0;
        
        // Optional: Normalize coordinates (e.g., to 0-1 range)
        // const normalizedX = x / storeRect.width;
        // const normalizedY = y / storeRect.height;

        shelves.push({ 
            name: name, 
            x: x, // Send pixel coordinates 
            y: y  // Send pixel coordinates
        });
    });
    
    if (shelves.length === 0) {
        alert("Lütfen en az bir raf ekleyin ve konumlandırın.");
        return null;
    }
    return shelves;
}

// --- Single Prediction (Keep existing) --- 
document.getElementById('prediction-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const productName = document.getElementById('product_name').value;
    const modelChoice = document.getElementById('model_choice').value;
    const resultDiv = document.getElementById('result');
    const predictionDiv = document.getElementById('prediction');
    
    if (!productName.trim()) {
        alert('Lütfen bir ürün ismi girin.');
        return;
    }
    
    resultDiv.style.display = 'none';
    
    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                product_name: productName,
                model_choice: modelChoice
            }),
        });
        
        const data = await response.json();
        
        if (!response.ok || data.error) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        
        predictionDiv.textContent = `Tahmin Edilen Kategori: ${toTitleCase(data.prediction)}`;
        resultDiv.style.display = 'block';
    } catch (error) {
        console.error('Tahmin hatası:', error);
        predictionDiv.textContent = `Tahmin Hatası: ${error.message}`;
        resultDiv.style.display = 'block';
    }
});

// --- Bulk Prediction & Association (Restored side-by-side receipt display) --- 
document.getElementById('bulk-prediction-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const csvFile = document.getElementById('csv_file').files[0];
    const modelChoice = document.getElementById('bulk_model_choice').value;
    
    const resultDiv = document.getElementById('bulk-result');
    const loadingDiv = document.getElementById('bulk-loading');
    const errorDiv = document.getElementById('bulk-error');
    const contentDiv = document.getElementById('bulk-content');
    const predictionsDiv = document.getElementById('bulk-predictions');
    const associationResultsContainer = document.getElementById('association-results-container');
    const associationRulesDiv = document.getElementById('association-rules');
    const associationInfoDiv = document.getElementById('association-info');
    
    if (!csvFile) {
        alert('Lütfen bir CSV dosyası seçin.');
        return;
    }
    
    // Sonuç alanlarını temizle ve yükleniyor mesajını göster
    hideStatusMessages('bulk-error', 'bulk-content');
    predictionsDiv.innerHTML = '';
    associationRulesDiv.innerHTML = '';
    associationInfoDiv.innerHTML = '';
    associationResultsContainer.style.display = 'none';
    loadingDiv.style.display = 'block';
    resultDiv.style.display = 'block';
    
    const formData = new FormData();
    formData.append('csv_file', csvFile);
    formData.append('model_choice', modelChoice);
    
    try {
        const response = await fetch('/predict_bulk', {
            method: 'POST',
            body: formData,
        });
        
        const data = await response.json();
        
        if (!response.ok || data.error) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        
        contentDiv.style.display = 'block';
        
        // Tahmin sonuçlarını fiş şeklinde yan yana göster (RESTORED)
        if (data.results && Object.keys(data.results).length > 0) {
            let predictionsHtml = '<div class="receipts-container" style="display: flex; flex-wrap: nowrap; overflow-x: auto; gap: 15px; padding-bottom: 10px;">';
            
            for (const [receiptId, predictions] of Object.entries(data.results)) {
                predictionsHtml += `<div class="receipt-container">
                    <div class="receipt-header" style="background-color: #f8f9fa; padding: 8px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">
                        <div class="receipt-title">Fiş</div>
                    </div>
                    <div class="receipt-content" style="padding: 10px;">
                        <ul class="receipt-item-list">`;
                
                if (Array.isArray(predictions)) {
                    predictions.forEach(p => {
                        if (p.error) {
                            predictionsHtml += `<li class="receipt-error">${p.error}</li>`;
                        } else {
                            predictionsHtml += `<li class="receipt-item">
                                <span class="product-name">${p.product}</span> 
                                <span class="category-name">${toTitleCase(p.category)}</span>
                            </li>`;
                        }
                    });
                }
                
                predictionsHtml += `</ul>
                    </div>
                    <div class="receipt-footer" style="padding: 5px; text-align: right; border-top: 1px solid #eee;">
                        <div class="order-number">${receiptId.replace('Siparis_', '#')}</div>
                    </div>
                </div>`;
            }
            
            predictionsHtml += '</div>';
            predictionsDiv.innerHTML = predictionsHtml;
        } else {
            predictionsDiv.innerHTML = '<p>Tahmin edilecek ürün bulunamadı.</p>';
        }
        
        // Birliktelik analizi sonuçlarını göster - IMPROVED DISPLAY
        if (data.association_analysis) {
            associationResultsContainer.style.display = 'block';
            
            if (data.association_analysis.message) {
                // Birliktelik analizi mesajı varsa göster
                associationInfoDiv.innerHTML = `<p class="association-message">${data.association_analysis.message}</p>`;
            } else if (data.association_analysis.rules_for_display && data.association_analysis.rules_for_display.length > 0) {
                // Kuralları göster - IMPROVED LAYOUT
                let rulesHtml = '<div class="association-rules-container">';
                
                data.association_analysis.rules_for_display.forEach((rule, index) => {
                    const ifCats = rule.if_categories.map(cat => `<span class="category-highlight-if">${toTitleCase(cat)}</span>`).join(', ');
                    const thenCats = rule.then_categories.map(cat => `<span class="category-highlight-then">${toTitleCase(cat)}</span>`).join(', ');
                    
                    // Add a CSS class based on confidence level
                    let confidenceClass = '';
                    if (rule.confidence > 0.7) confidenceClass = 'high-confidence';
                    else if (rule.confidence > 0.4) confidenceClass = 'medium-confidence';
                    else confidenceClass = 'low-confidence';
                    
                    rulesHtml += `
                    <div class="rule-card ${confidenceClass}">
                        <div class="rule-number">#${index + 1}</div>
                        <div class="rule-content">
                            <div class="rule-if"><strong>${ifCats}</strong> kategorisinden alınırsa,</div>
                            <div class="rule-then"><strong>${thenCats}</strong> kategorisinden alınır.</div>
                        </div>
                        <div class="rule-metrics">
                            <div class="metric"><span class="metric-label">Destek:</span> <span class="metric-value">${rule.support.toFixed(3)}</span></div>
                            <div class="metric"><span class="metric-label">Güven:</span> <span class="metric-value">${rule.confidence.toFixed(3)}</span></div>
                            <div class="metric"><span class="metric-label">Lift:</span> <span class="metric-value">${rule.lift.toFixed(2)}</span></div>
                        </div>
                    </div>`;
                });
                
                rulesHtml += '</div>';
                associationRulesDiv.innerHTML = rulesHtml;
                
                // Improved analysis summary
                let infoHtml = `
                <div class="association-summary">
                    <h4>Analiz Özeti</h4>
                    <div class="summary-metrics">
                        <div class="summary-metric">
                            <div class="summary-label">Analiz Edilen Sipariş</div>
                            <div class="summary-value">${data.association_analysis.total_transactions || 0}</div>
                        </div>
                        <div class="summary-metric">
                            <div class="summary-label">Minimum Destek Değeri</div>
                            <div class="summary-value">${data.association_analysis.min_support_used?.toFixed(3) || 'N/A'}</div>
                        </div>
                        <div class="summary-metric">
                            <div class="summary-label">Bulunan Pozitif Kural (Lift > 1)</div>
                            <div class="summary-value">${data.association_analysis.total_positive_rules_found || 0}</div>
                        </div>
                    </div>
                    <p class="rule-note"><i>Not: Kurallar güven değerine göre renklendirilmiştir. 
                    Yüksek güven yeşil, orta güven mavi, düşük güven gri ile gösterilir. 
                    Her kural çiftinden sadece yüksek güven değerine sahip olan gösterilmektedir.</i></p>
                </div>`;
                associationInfoDiv.innerHTML = infoHtml;
                
                // Add custom styles for the new layout
                const style = document.createElement('style');
                style.textContent = `
                    .association-rules-container {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                        gap: 15px;
                        margin-bottom: 20px;
                    }
                    .rule-card {
                        background-color: #f8f9fa;
                        border-radius: 8px;
                        padding: 15px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                        display: flex;
                        flex-direction: column;
                        position: relative;
                        border-left: 4px solid #6c757d;
                    }
                    .rule-card.high-confidence {
                        border-left-color: #28a745;
                        background-color: #f1f9f4;
                    }
                    .rule-card.medium-confidence {
                        border-left-color: #007bff;
                        background-color: #f0f7ff;
                    }
                    .rule-number {
                        position: absolute;
                        top: 8px;
                        right: 8px;
                        font-size: 0.8rem;
                        color: #6c757d;
                        font-weight: 500;
                    }
                    .rule-content {
                        margin-bottom: 12px;
                        line-height: 1.4;
                    }
                    .rule-if, .rule-then {
                        margin-bottom: 5px;
                    }
                    .rule-metrics {
                        display: flex;
                        justify-content: space-between;
                        font-size: 0.85rem;
                        border-top: 1px solid rgba(0,0,0,0.1);
                        padding-top: 10px;
                        margin-top: auto;
                    }
                    .metric {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .metric-label {
                        font-size: 0.75rem;
                        color: #6c757d;
                        margin-bottom: 3px;
                    }
                    .metric-value {
                        font-weight: 600;
                    }
                    .category-highlight-if {
                        color: #0056b3;
                        font-weight: 500;
                        background-color: rgba(0, 86, 179, 0.1);
                        padding: 2px 4px;
                        border-radius: 3px;
                    }
                    .category-highlight-then {
                        color: #28a745;
                        font-weight: 500;
                        background-color: rgba(40, 167, 69, 0.1);
                        padding: 2px 4px;
                        border-radius: 3px;
                    }
                    .association-summary {
                        background-color: #f8f9fa;
                        border-radius: 8px;
                        padding: 15px;
                        margin-top: 20px;
                    }
                    .association-summary h4 {
                        margin-top: 0;
                        margin-bottom: 15px;
                        font-size: 1.1rem;
                        color: #343a40;
                        text-align: center;
                    }
                    .summary-metrics {
                        display: flex;
                        justify-content: space-around;
                        margin-bottom: 15px;
                    }
                    .summary-metric {
                        text-align: center;
                    }
                    .summary-label {
                        font-size: 0.85rem;
                        color: #6c757d;
                        margin-bottom: 5px;
                    }
                    .summary-value {
                        font-size: 1.1rem;
                        font-weight: 600;
                        color: #343a40;
                    }
                    .rule-note {
                        font-size: 0.8rem;
                        color: #6c757d;
                        text-align: center;
                        margin-top: 10px;
                        margin-bottom: 0;
                    }
                    .association-message {
                        padding: 15px;
                        background-color: #f8f9fa;
                        border-radius: 8px;
                        text-align: center;
                        color: #6c757d;
                        font-style: italic;
                    }
                `;
                document.head.appendChild(style);
            } else {
                associationRulesDiv.innerHTML = '<p class="association-message">Gösterilecek birliktelik kuralı bulunamadı.</p>';
            }
        }
    } catch (error) {
        console.error('Toplu analiz hatası:', error);
        displayError('bulk-error', error.message);
        contentDiv.style.display = 'none';
    } finally {
        loadingDiv.style.display = 'none';
    }
});

// --- Playground Recommendation --- UPDATED ---
document.getElementById('playground-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const shelves = getShelfData(); // Get shelf data from drag-drop area
    if (!shelves) return; // Stop if validation failed (e.g., no shelves)

    const csvFile = document.getElementById('playground_csv_file').files[0];
    const modelChoice = document.getElementById('playground_model_choice').value;
    const timeGoal = document.getElementById('time_goal').value;

    const resultDiv = document.getElementById('playground-result');
    const loadingDiv = document.getElementById('playground-loading');
    const errorDiv = document.getElementById('playground-error');
    const contentDiv = document.getElementById('playground-content');
    const recList = document.getElementById('recommendation-list');
    const unassignedDiv = document.getElementById('unassigned-info');
    const assocInfoDiv = document.getElementById('playground-association-info');
    const topRulesDiv = document.getElementById('playground-top-rules');
    
    // Doğrulama metrik elementleri - null kontrolü ekle
    const avgCategoryScore = document.getElementById('avg-category-score');
    const optimizationScore = document.getElementById('optimization-score');
    const consistencyIndicator = document.getElementById('consistency-indicator');

    if (!csvFile) {
        alert('Lütfen sipariş verilerini içeren bir CSV dosyası seçin.');
        return;
    }

    hideStatusMessages('playground-error', 'playground-content', 'unassigned-info');
    loadingDiv.style.display = 'block';
    resultDiv.style.display = 'block';
    recList.innerHTML = ''; 
    unassignedDiv.innerHTML = '';
    assocInfoDiv.innerHTML = '';
    topRulesDiv.innerHTML = '';
    
    // Metrikleri sıfırla - null kontrolü ekle
    if (avgCategoryScore) avgCategoryScore.textContent = '-';
    if (optimizationScore) optimizationScore.textContent = '-';
    if (consistencyIndicator) consistencyIndicator.style.width = '0%';

    const formData = new FormData();
    // Send shelves as a JSON string
    formData.append('cabinets', JSON.stringify(shelves)); // Use 'cabinets' key as expected by backend
    formData.append('csv_file', csvFile);
    formData.append('model_choice', modelChoice);
    formData.append('time_goal', timeGoal);

    try {
        const response = await fetch('/playground_recommend', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (!response.ok || data.error) {
            let assocSummary = '';
            if (data.association_analysis && data.association_analysis.message) {
                assocSummary = `<p><em>Birliktelik Analizi Notu: ${data.association_analysis.message}</em></p>`;
            }
            throw new Error((data.error || `HTTP error! status: ${response.status}`) + assocSummary);
        }

        contentDiv.style.display = 'block';

        // Display Recommendations
        if (data.recommendations && Object.keys(data.recommendations).length > 0) {
            // Create a map for quick lookup
            const recMap = new Map(Object.entries(data.recommendations));
            // Display in the order the shelves were originally defined/retrieved
            const orderedHtml = shelves.map(shelf => {
                const category = recMap.get(shelf.name);
                if (category) {
                    return `<li class="recommendation-item">
                                <span class="cabinet-name">${shelf.name}</span>
                                <span class="recommended-category">${toTitleCase(category)}</span>
                            </li>`;
                }
                return ''; // Should only happen if backend didn't assign a category
            }).join('');
            recList.innerHTML = orderedHtml || '<li>Öneri listesi oluşturulamadı.</li>'; 
        } else {
            recList.innerHTML = '<li>Öneri bulunamadı.</li>';
        }

        // Display Unassigned Cabinet Info
        if (data.unassigned_info && data.unassigned_info.message) {
            let unassignedHtml = `<p>${data.unassigned_info.message}</p>`;
            if (data.unassigned_info.unassigned_cabinets && data.unassigned_info.unassigned_cabinets.length > 0) {
                unassignedHtml += `Atanamayan Raflar: ${data.unassigned_info.unassigned_cabinets.join(', ')}`;
            }
            unassignedDiv.innerHTML = unassignedHtml;
            unassignedDiv.style.display = 'block';
        }
        
        // Display Association Summary
        if (data.association_analysis_summary) {
            const summary = data.association_analysis_summary;
            let summaryHtml = `<p>Toplam ${summary.total_transactions || 0} sipariş analiz edildi. Min. Destek: ${summary.min_support_used ? summary.min_support_used.toFixed(3) : 'N/A'}. Bulunan Kural Sayısı (Lift > 1): ${summary.total_positive_rules_found || 0}.</p>`;
            assocInfoDiv.innerHTML = summaryHtml;

            if (summary.top_rules_for_display && summary.top_rules_for_display.length > 0) {
                let rulesHtml = '<h5>Gösterilen İlk Kurallar (Lift > 1):</h5><ul class="association-rules-list">';
                 summary.top_rules_for_display.forEach(rule => {
                    const ifCats = rule.if_categories.map(cat => `<span class="category-highlight-if">${toTitleCase(cat)}</span>`).join(', ');
                    const thenCats = rule.then_categories.map(cat => `<span class="category-highlight-then">${toTitleCase(cat)}</span>`).join(', ');
                    rulesHtml += `<li class="rule-item" style="font-size: 0.85rem;">
                                    <div class="rule-content">Eğer <strong>${ifCats}</strong> kategorisinden alınırsa, O zaman <strong>${thenCats}</strong> kategorisinden alınır.</div>
                                    <div class="rule-metrics">Lift: ${rule.lift.toFixed(2)}</div>
                                  </li>`;
                });
                rulesHtml += '</ul>';
                topRulesDiv.innerHTML = rulesHtml;
            } else {
                topRulesDiv.innerHTML = '<p>Gösterilecek ilişki kuralı bulunamadı.</p>';
            }
        }
        
        // Render the visualization if data is available
        if (data.visualization_data) {
            console.log("Visualization data received:", data.visualization_data);
            
            try {
                // Initialize the visualization components on first load
                if (typeof initializeVisualization === 'function') {
                    console.log("initializeVisualization is available");
                    initializeVisualization();
                    // Render the visualization with the data
                    renderVisualization(data.visualization_data);
                } else {
                    console.error('Visualization module is not loaded properly. initializeVisualization function not found.');
                    console.log("Available global functions:", Object.keys(window).filter(key => typeof window[key] === 'function'));
                }
            } catch (error) {
                console.error("Error rendering visualization:", error);
                alert("Görselleştirme oluşturulurken bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin.");
            }
        } else {
            console.warn("No visualization_data received from server");
        }

    } catch (error) {
        console.error('Playground öneri hatası:', error);
        displayError('playground-error', error.message);
        contentDiv.style.display = 'none';
    } finally {
        loadingDiv.style.display = 'none';
    }
});
