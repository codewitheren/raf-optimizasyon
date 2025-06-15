// --- Helper Functions (Keep existing: toTitleCase, displayError, hideStatusMessages) --- 
function toTitleCase(str) { if (!str) return ''; return str.toLowerCase().split(' ').map(function(word) { if (!word) return ''; return word.charAt(0).toUpperCase() + word.slice(1); }).join(' '); }
function displayError(elementId, message) { const errorDiv = document.getElementById(elementId); errorDiv.textContent = `Hata: ${message || 'Bilinmeyen bir hata oluştu.'}`; errorDiv.style.display = 'block'; }
function hideStatusMessages(...elementIds) { elementIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; }); }

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
                            <div class="rule-if">Eğer <strong>${ifCats}</strong> alınırsa,</div>
                            <div class="rule-then">O zaman <strong>${thenCats}</strong> alınır.</div>
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
            // Save recommendations to window object for later use
            window.latestRecommendations = recMap;
            
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
            
            // Remove existing apply button if it exists
            const existingApplyBtn = document.getElementById('apply-recommendations-btn');
            if (existingApplyBtn) {
                existingApplyBtn.remove();
            }
            
            // Add an "Apply Names" button if recommendations exist
            const applyBtn = document.createElement('button');
            applyBtn.type = 'button';
            applyBtn.id = 'apply-recommendations-btn';
            applyBtn.className = 'recommendation-apply-btn';
            applyBtn.innerHTML = '<i class="icon">✅</i> Önerileri Raflara Uygula';
            applyBtn.addEventListener('click', function() {
                if (window.shelfManager && window.latestRecommendations) {
                    window.shelfManager.applyRecommendations(window.latestRecommendations);
                }
            });
            
            // Add button after the recommendation list
            recList.parentNode.insertBefore(applyBtn, recList.nextSibling);
        } else {
            recList.innerHTML = '<li>Öneri bulunamadı.</li>';
            
            // Remove apply button if no recommendations
            const existingApplyBtn = document.getElementById('apply-recommendations-btn');
            if (existingApplyBtn) {
                existingApplyBtn.remove();
            }
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
                                    <div class="rule-content">Eğer <strong>${ifCats}</strong> alınırsa, O zaman <strong>${thenCats}</strong> alınır.</div>
                                    <div class="rule-metrics">Lift: ${rule.lift.toFixed(2)}</div>
                                  </li>`;
                });
                rulesHtml += '</ul>';
                topRulesDiv.innerHTML = rulesHtml;
            } else {
                topRulesDiv.innerHTML = '<p>Gösterilecek ilişki kuralı bulunamadı.</p>';
            }
        }
    } catch (error) {
        console.error('Playground öneri hatası:', error);
        displayError('playground-error', error.message);
        contentDiv.style.display = 'none';
    } finally {
        loadingDiv.style.display = 'none';
    }
});
// Navbar mobile toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const navbarToggle = document.getElementById('navbar-toggle');
    const navbarMenu = document.getElementById('navbar-menu');
    
    if (navbarToggle && navbarMenu) {
        navbarToggle.addEventListener('click', function() {
            navbarMenu.classList.toggle('active');
            navbarToggle.classList.toggle('active');
        });
        
        // Close menu when clicking on a link
        const navbarLinks = document.querySelectorAll('.navbar-link');
        navbarLinks.forEach(link => {
            link.addEventListener('click', function() {
                navbarMenu.classList.remove('active');
                navbarToggle.classList.remove('active');
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!navbarToggle.contains(event.target) && !navbarMenu.contains(event.target)) {
                navbarMenu.classList.remove('active');
                navbarToggle.classList.remove('active');
            }
        });
    }
    
    // Back to top button functionality
    const backToTopButton = document.getElementById('back-to-top');
    
    if (backToTopButton) {
        // Show/hide button based on scroll position
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                backToTopButton.classList.add('show');
            } else {
                backToTopButton.classList.remove('show');
            }
        });
        
        // Scroll to top when clicked
        backToTopButton.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// Premium Shelf Management System
class PremiumShelfManager {
    constructor() {
        this.shelves = [];
        this.shelfCounter = 0;
        this.selectedShelf = null;
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffset = { x: 0, y: 0 };
        this.currentOperation = null;
        
        // Updated color palette with gradients
        this.colorThemes = [
            {
                name: 'Ocean Blue',
                primary: '#667eea',
                secondary: '#764ba2',
                rgb: '102, 126, 234',
                class: 'color-blue'
            },
            {
                name: 'Forest Green',
                primary: '#56ab2f',
                secondary: '#a8e6cf',
                rgb: '86, 171, 47',
                class: 'color-green'
            },
            {
                name: 'Sunset Red',
                primary: '#ff416c',
                secondary: '#ff4b2b',
                rgb: '255, 65, 108',
                class: 'color-red'
            },
            {
                name: 'Royal Purple',
                primary: '#8360c3',
                secondary: '#2ebf91',
                rgb: '131, 96, 195',
                class: 'color-purple'
            },
            {
                name: 'Warm Orange',
                primary: '#f093fb',
                secondary: '#f5576c',
                rgb: '240, 147, 251',
                class: 'color-orange'
            },
            {
                name: 'Cool Teal',
                primary: '#4ecdc4',
                secondary: '#44a08d',
                rgb: '78, 205, 196',
                class: 'color-teal'
            },
            {
                name: 'Soft Pink',
                primary: '#ffecd2',
                secondary: '#fcb69f',
                rgb: '255, 236, 210',
                class: 'color-pink'
            },
            {
                name: 'Golden Yellow',
                primary: '#ffeaa7',
                secondary: '#fab1a0',
                rgb: '255, 234, 167',
                class: 'color-yellow'
            }
        ];
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.updateShelfCounter();
    }
    
    bindEvents() {
        // Add shelf button
        document.getElementById('add-shelf-btn')?.addEventListener('click', () => {
            this.addPremiumShelf();
        });
        
        // Clear all shelves button
        document.getElementById('clear-all-shelves-btn')?.addEventListener('click', () => {
            this.clearAllShelves();
        });
        
        // Global mouse events for dragging and resizing
        document.addEventListener('mousemove', (e) => this.handleGlobalMouseMove(e));
        document.addEventListener('mouseup', () => this.handleGlobalMouseUp());
        
        // Random colors button
        document.getElementById('random-colors-btn')?.addEventListener('click', () => {
            this.randomizeAllColors();
        });
    }
    
    addPremiumShelf() {
        this.shelfCounter++;
        const storeArea = document.getElementById('store-layout-area');
        
        // Create premium shelf element
        const shelf = document.createElement('div');
        shelf.className = 'premium-shelf shelf-appear';
        shelf.dataset.id = this.shelfCounter;
        shelf.dataset.name = `Raf ${this.shelfCounter}`;
        
        // Random position within store area
        const maxX = storeArea.clientWidth - 140;
        const maxY = storeArea.clientHeight - 100;
        const x = Math.random() * Math.max(0, maxX);
        const y = Math.random() * Math.max(0, maxY);
        
        // Get color theme based on counter (cyclic)
        const colorIndex = (this.shelfCounter - 1) % this.colorThemes.length;
        const colorTheme = this.colorThemes[colorIndex];
        
        shelf.style.left = x + 'px';
        shelf.style.top = y + 'px';
        shelf.style.width = '140px';
        shelf.style.height = '90px';
        shelf.style.position = 'absolute';
        
        // Set CSS custom properties for colors
        shelf.style.setProperty('--shelf-primary-color', colorTheme.primary);
        shelf.style.setProperty('--shelf-secondary-color', colorTheme.secondary);
        shelf.style.setProperty('--shelf-rgb-color', colorTheme.rgb);
        shelf.dataset.colorTheme = colorIndex;
        
        // Premium shelf content with resize handle
        shelf.innerHTML = `
            <div class="shelf-header">
                <span class="shelf-id">#${this.shelfCounter}</span>
                <div class="shelf-menu">
                    <button class="shelf-menu-btn" title="Menü">⋮</button>
                </div>
            </div>
            <div class="shelf-label">Raf ${this.shelfCounter}</div>
            <div class="shelf-category">Kategori Yok</div>
            <div class="shelf-footer">
                <span class="shelf-size">140×90</span>
                <div class="shelf-actions">
                    <button class="shelf-action-btn delete-btn" title="Sil">🗑</button>
                </div>
            </div>
            <div class="resize-handle" title="Yeniden boyutlandır"></div>
        `;
        
        // Make shelf interactive
        this.makePremiumShelfInteractive(shelf);
        
        // Add to store area
        storeArea.appendChild(shelf);
        this.shelves.push(shelf);
        
        // Update counter
        this.updateShelfCounter();
        
        // Show notification with color theme name
        this.showNotification(`${colorTheme.name} temalı premium raf eklendi!`, 'success');
        
        // Remove animation class after animation
        setTimeout(() => {
            shelf.classList.remove('shelf-appear');
        }, 600);
        
        // Trigger shelf appearance animation
        this.triggerShelfAnimation(shelf);
    }
    
    triggerShelfAnimation(shelf) {
        // Add sparkle effect
        this.createSparkleEffect(shelf);
        
        // Add bounce effect
        setTimeout(() => {
            shelf.style.animation = 'shelfBounce 0.6s ease-out';
        }, 300);
        
        setTimeout(() => {
            shelf.style.animation = '';
        }, 900);
    }
    
    createSparkleEffect(shelf) {
        const sparkles = 8;
        const rect = shelf.getBoundingClientRect();
        const storeArea = document.getElementById('store-layout-area');
        
        for (let i = 0; i < sparkles; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                background: radial-gradient(circle, #fff, transparent);
                border-radius: 50%;
                pointer-events: none;
                z-index: 1001;
                left: ${shelf.offsetLeft + shelf.offsetWidth / 2}px;
                top: ${shelf.offsetTop + shelf.offsetHeight / 2}px;
                animation: sparkleAnim 1s ease-out forwards;
                animation-delay: ${i * 0.1}s;
            `;
            
            // Random direction for each sparkle
            const angle = (360 / sparkles) * i;
            const distance = 40;
            const endX = Math.cos(angle * Math.PI / 180) * distance;
            const endY = Math.sin(angle * Math.PI / 180) * distance;
            
            sparkle.style.setProperty('--end-x', endX + 'px');
            sparkle.style.setProperty('--end-y', endY + 'px');
            
            storeArea.appendChild(sparkle);
            
            // Remove sparkle after animation
            setTimeout(() => {
                if (sparkle.parentNode) {
                    sparkle.remove();
                }
            }, 1000 + (i * 100));
        }
    }
    
    showShelfMenu(shelf, event) {
        // Remove existing menu
        const existingMenu = document.querySelector('.shelf-context-menu');
        if (existingMenu) existingMenu.remove();
        
        // Create new menu
        const menu = document.createElement('div');
        menu.className = 'shelf-context-menu';
        menu.style.position = 'absolute';
        menu.style.zIndex = '2000';
        
        // Edit button
        const editBtn = document.createElement('div');
        editBtn.className = 'menu-item';
        editBtn.innerHTML = '<i class="menu-icon">✏️</i> Düzenle';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editShelfLabel(shelf);
            menu.remove();
        });
        
        // Color picker button
        const colorBtn = document.createElement('div');
        colorBtn.className = 'menu-item';
        colorBtn.innerHTML = '<i class="menu-icon">🎨</i> Renk Değiştir';
        colorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showColorPicker(shelf);
            menu.remove();
        });
        
        // Delete button
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'menu-item';
        deleteBtn.innerHTML = '<i class="menu-icon">🗑️</i> Sil';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteShelf(shelf);
            menu.remove();
        });
        
        // Add menu items
        menu.appendChild(editBtn);
        menu.appendChild(colorBtn);
        menu.appendChild(deleteBtn);
        
        // Add menu to body
        document.body.appendChild(menu);
        
        // Position menu
        const rect = event.target.getBoundingClientRect();
        menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
        menu.style.left = `${rect.left + window.scrollX}px`;
        
        // Close menu on outside click
        setTimeout(() => {
            const closeMenu = () => {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            };
            document.addEventListener('click', closeMenu);
        }, 0);
    }
    
    showColorPicker(shelf) {
        // Remove existing color picker
        const existingPicker = document.querySelector('.color-picker-modal');
        if (existingPicker) existingPicker.remove();
        
        // Create color picker modal
        const modal = document.createElement('div');
        modal.className = 'color-picker-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
            animation: modalFadeIn 0.3s ease-out;
        `;
        
        const picker = document.createElement('div');
        picker.className = 'color-picker-container';
        picker.style.cssText = `
            background: white;
            padding: 25px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
            max-width: 500px;
            width: 90%;
            animation: modalSlideIn 0.3s ease-out;
        `;
        
        picker.innerHTML = `
            <h3 style="margin-top: 0; text-align: center; color: #2c3e50; margin-bottom: 20px;">
                🎨 Raf Rengi Seçin
            </h3>
            <div class="color-options" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
                ${this.colorThemes.map((theme, index) => `
                    <div class="color-option ${theme.class} ${parseInt(shelf.dataset.colorTheme) === index ? 'selected' : ''}" 
                         data-index="${index}" 
                         title="${theme.name}"
                         style="background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%);">
                    </div>
                `).join('')}
            </div>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button class="modal-btn cancel-btn" style="padding: 10px 20px; border: 2px solid #6c757d; background: white; color: #6c757d; border-radius: 8px; cursor: pointer; font-weight: 600;">İptal</button>
                <button class="modal-btn apply-btn" style="padding: 10px 20px; border: none; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border-radius: 8px; cursor: pointer; font-weight: 600;">Uygula</button>
            </div>
        `;
        
        modal.appendChild(picker);
        document.body.appendChild(modal);
        
        // Add styles for modal animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes modalFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes modalSlideIn {
                from { opacity: 0; transform: scale(0.8) translateY(-50px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes sparkleAnim {
                0% {
                    opacity: 1;
                    transform: translate(0, 0) scale(1);
                }
                100% {
                    opacity: 0;
                    transform: translate(var(--end-x), var(--end-y)) scale(0.3);
                }
            }
            @keyframes shelfBounce {
                0%, 100% { transform: scale(1); }
                25% { transform: scale(1.05); }
                50% { transform: scale(0.95); }
                75% { transform: scale(1.02); }
            }
        `;
        document.head.appendChild(style);
        
        let selectedIndex = parseInt(shelf.dataset.colorTheme);
        
        // Color option selection
        picker.querySelectorAll('.color-option').forEach((option, index) => {
            option.addEventListener('click', () => {
                picker.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                selectedIndex = index;
            });
        });
        
        // Apply button
        picker.querySelector('.apply-btn').addEventListener('click', () => {
            this.applyColorTheme(shelf, selectedIndex);
            modal.remove();
            style.remove();
        });
        
        // Cancel button
        picker.querySelector('.cancel-btn').addEventListener('click', () => {
            modal.remove();
            style.remove();
        });
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                style.remove();
            }
        });
    }
    
    applyColorTheme(shelf, themeIndex) {
        const theme = this.colorThemes[themeIndex];
        
        // Update shelf colors
        shelf.style.setProperty('--shelf-primary-color', theme.primary);
        shelf.style.setProperty('--shelf-secondary-color', theme.secondary);
        shelf.style.setProperty('--shelf-rgb-color', theme.rgb);
        shelf.dataset.colorTheme = themeIndex;
        
        // Add color change animation
        shelf.style.animation = 'colorChangeAnim 0.8s ease-out';
        
        // Add color change style
        const style = document.createElement('style');
        style.textContent = `
            @keyframes colorChangeAnim {
                0% { transform: scale(1); filter: brightness(1); }
                50% { transform: scale(1.1); filter: brightness(1.2); }
                100% { transform: scale(1); filter: brightness(1); }
            }
        `;
        document.head.appendChild(style);
        
        // Create color splash effect
        this.createColorSplash(shelf, theme);
        
        // Show notification
        this.showNotification(`Raf rengi ${theme.name} olarak değiştirildi!`, 'success');
        
        // Clean up animation
        setTimeout(() => {
            shelf.style.animation = '';
            style.remove();
        }, 800);
    }
    
    createColorSplash(shelf, theme) {
        const splash = document.createElement('div');
        splash.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: radial-gradient(circle, ${theme.primary}, ${theme.secondary}, transparent);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 999;
            animation: splashAnim 0.6s ease-out forwards;
        `;
        
        // Add splash animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes splashAnim {
                0% {
                    width: 0;
                    height: 0;
                    opacity: 0.8;
                }
                50% {
                    width: 120px;
                    height: 120px;
                    opacity: 0.6;
                }
                100% {
                    width: 160px;
                    height: 160px;
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        
        shelf.appendChild(splash);
        
        setTimeout(() => {
            splash.remove();
            style.remove();
        }, 600);
    }
    
    // --- existing methods ---
    makePremiumShelfInteractive(shelf) {
        let dragData = {
            startX: 0,
            startY: 0,
            initialX: 0,
            initialY: 0,
            initialWidth: 0,
            initialHeight: 0
        };
        
        const resizeHandle = shelf.querySelector('.resize-handle');
        
        // Mouse down event for dragging
        shelf.addEventListener('mousedown', (e) => {
            // Don't start drag if clicking on buttons or resize handle
            if (e.target.classList.contains('shelf-action-btn') || 
                e.target.classList.contains('shelf-menu-btn') ||
                e.target.classList.contains('resize-handle')) {
                return;
            }
            
            this.startDrag(shelf, e, dragData);
        });
        
        // Mouse down event for resizing
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                this.startResize(shelf, e, dragData);
                e.stopPropagation();
            });
        }
        
        // Delete button
        const deleteBtn = shelf.querySelector('.delete-btn');
        deleteBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteShelf(shelf);
        });
        
        // Double click to edit label
        shelf.addEventListener('dblclick', (e) => {
            if (e.target.classList.contains('shelf-label')) {
                this.editShelfLabel(shelf);
            }
        });
        
        // Selection
        shelf.addEventListener('click', (e) => {
            if (!e.target.classList.contains('shelf-action-btn') && 
                !e.target.classList.contains('shelf-menu-btn')) {
                this.selectShelf(shelf);
            }
        });
        
        // Menu button
        const menuBtn = shelf.querySelector('.shelf-menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showShelfMenu(shelf, e);
            });
        }
        
        // Tooltip functionality - hover bilgisi göster
        shelf.addEventListener('mouseenter', (e) => {
            const shelfName = shelf.dataset.name;
            const shelfCategory = shelf.querySelector('.shelf-category').textContent;
            const shelfSize = shelf.querySelector('.shelf-size').textContent;
            
            const tooltip = document.createElement('div');
            tooltip.className = 'shelf-tooltip';
            tooltip.innerHTML = `
                <div><strong>Raf:</strong> ${shelfName}</div>
                <div><strong>Kategori:</strong> ${shelfCategory}</div>
                <div><strong>Boyut:</strong> ${shelfSize}</div>
                <div style="font-size:9px;margin-top:3px">Çift tıklayarak isim değiştirebilirsiniz</div>
            `;
            
            document.body.appendChild(tooltip);
            shelf.dataset.tooltipId = Date.now().toString();
            tooltip.dataset.for = shelf.dataset.tooltipId;
            
            this.positionTooltip(tooltip, shelf);
            
            // Tooltip pozisyonunu fare hareket ettikçe güncelle
            shelf.addEventListener('mousemove', this.handleMouseMoveWithTooltip);
        });
        
        shelf.addEventListener('mouseleave', () => {
            this.removeTooltip(shelf);
        });
    }
    
    handleMouseMoveWithTooltip(e) {
        const shelfElement = e.currentTarget;
        const tooltipId = shelfElement.dataset.tooltipId;
        if (tooltipId) {
            const tooltip = document.querySelector(`.shelf-tooltip[data-for="${tooltipId}"]`);
            if (tooltip) {
                // Tooltip'i fare pozisyonuna göre konumlandır
                tooltip.style.left = `${e.pageX + 15}px`;
                tooltip.style.top = `${e.pageY + 15}px`;
            }
        }
    }
    
    positionTooltip(tooltip, shelf) {
        const rect = shelf.getBoundingClientRect();
        tooltip.style.left = `${rect.right + window.scrollX + 10}px`;
        tooltip.style.top = `${rect.top + window.scrollY}px`;
    }
    
    removeTooltip(shelf) {
        const tooltipId = shelf.dataset.tooltipId;
        if (tooltipId) {
            const tooltip = document.querySelector(`.shelf-tooltip[data-for="${tooltipId}"]`);
            if (tooltip) {
                tooltip.remove();
            }
            delete shelf.dataset.tooltipId;
        }
        shelf.removeEventListener('mousemove', this.handleMouseMoveWithTooltip);
    }
    
    startDrag(shelf, e, dragData) {
        this.isDragging = true;
        this.currentOperation = 'drag';
        this.selectedShelf = shelf;
        
        dragData.startX = e.clientX;
        dragData.startY = e.clientY;
        dragData.initialX = shelf.offsetLeft;
        dragData.initialY = shelf.offsetTop;
        
        shelf.classList.add('dragging');
        shelf.style.cursor = 'grabbing';
        shelf.style.zIndex = '1001';
        
        this.selectShelf(shelf);
        e.preventDefault();
    }
    
    startResize(shelf, e, dragData) {
        this.isResizing = true;
        this.currentOperation = 'resize';
        this.selectedShelf = shelf;
        
        dragData.startX = e.clientX;
        dragData.startY = e.clientY;
        dragData.initialWidth = shelf.offsetWidth;
        dragData.initialHeight = shelf.offsetHeight;
        
        shelf.classList.add('resizing');
        shelf.style.cursor = 'nw-resize';
        document.body.style.cursor = 'nw-resize';
        
        this.selectShelf(shelf);
        e.preventDefault();
    }
    
    handleGlobalMouseMove(e) {
        if (!this.selectedShelf) return;
        
        if (this.isDragging && this.currentOperation === 'drag') {
            this.handleDrag(e);
        } else if (this.isResizing && this.currentOperation === 'resize') {
            this.handleResize(e);
        }
    }
    
    handleDrag(e) {
        const shelf = this.selectedShelf;
        const storeArea = document.getElementById('store-layout-area');
        
        // Calculate the initial drag data
        const dragData = {
            startX: parseFloat(shelf.dataset.startX) || e.clientX,
            startY: parseFloat(shelf.dataset.startY) || e.clientY,
            initialX: parseFloat(shelf.dataset.initialX) || shelf.offsetLeft,
            initialY: parseFloat(shelf.dataset.initialY) || shelf.offsetTop
        };
        
        // Store initial values if not already stored
        if (!shelf.dataset.startX) {
            shelf.dataset.startX = e.clientX;
            shelf.dataset.startY = e.clientY;
            shelf.dataset.initialX = shelf.offsetLeft;
            shelf.dataset.initialY = shelf.offsetTop;
        }
        
        const deltaX = e.clientX - parseFloat(shelf.dataset.startX);
        const deltaY = e.clientY - parseFloat(shelf.dataset.startY);
        
        let newX = parseFloat(shelf.dataset.initialX) + deltaX;
        let newY = parseFloat(shelf.dataset.initialY) + deltaY;
        
        // Constrain within store area
        const storeRect = storeArea.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, storeArea.clientWidth - shelf.offsetWidth));
        newY = Math.max(0, Math.min(newY, storeArea.clientHeight - shelf.offsetHeight));
        
        shelf.style.left = newX + 'px';
        shelf.style.top = newY + 'px';
    }
    
    handleResize(e) {
        const shelf = this.selectedShelf;
        
        // Store initial resize values if not already stored
        if (!shelf.dataset.resizeStartX) {
            shelf.dataset.resizeStartX = e.clientX;
            shelf.dataset.resizeStartY = e.clientY;
            shelf.dataset.initialWidth = shelf.offsetWidth;
            shelf.dataset.initialHeight = shelf.offsetHeight;
        }
        
        const deltaX = e.clientX - parseFloat(shelf.dataset.resizeStartX);
        const deltaY = e.clientY - parseFloat(shelf.dataset.resizeStartY);
        
        // Enforce minimum dimensions for readability
        const newWidth = Math.max(100, parseFloat(shelf.dataset.initialWidth) + deltaX);
        const newHeight = Math.max(70, parseFloat(shelf.dataset.initialHeight) + deltaY);
        
        // Ensure changes are applied correctly
        shelf.style.width = newWidth + 'px';
        shelf.style.height = newHeight + 'px';
        
        // Update size display
        const sizeDisplay = shelf.querySelector('.shelf-size');
        if (sizeDisplay) {
            sizeDisplay.textContent = `${Math.round(newWidth)}×${Math.round(newHeight)}`;
        }
        
        // Adjust font size for better readability based on shelf size
        this.adjustContentToFit(shelf, newWidth, newHeight);
    }
    
    // NEW: Adjust content to fit shelf size
    adjustContentToFit(shelf, width, height) {
        const label = shelf.querySelector('.shelf-label');
        const category = shelf.querySelector('.shelf-category');
        
        // Adjust font size based on width
        if (width < 120) {
            label.style.fontSize = '10px';
            category.style.fontSize = '8px';
        } else if (width < 150) {
            label.style.fontSize = '11px';
            category.style.fontSize = '9px';
        } else {
            label.style.fontSize = '12px';
            category.style.fontSize = '10px';
        }
        
        // Truncate text or add ellipsis if needed
        this.ensureTextFits(label, width - 16);
        this.ensureTextFits(category, width - 16);
    }
    
    // NEW: Ensure text fits within element
    ensureTextFits(element, maxWidth) {
        const text = element.textContent;
        if (!text) return;
        
        // Briefly measure text width
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.fontSize = window.getComputedStyle(element).fontSize;
        tempSpan.style.fontFamily = window.getComputedStyle(element).fontFamily;
        tempSpan.textContent = text;
        document.body.appendChild(tempSpan);
        
        const textWidth = tempSpan.offsetWidth;
        document.body.removeChild(tempSpan);
        
        if (textWidth > maxWidth) {
            element.title = text; // Add tooltip with full text
        } else {
            element.removeAttribute('title');
        }
    }
    
    handleGlobalMouseUp() {
        if (this.selectedShelf) {
            // Clean up drag data
            delete this.selectedShelf.dataset.startX;
            delete this.selectedShelf.dataset.startY;
            delete this.selectedShelf.dataset.initialX;
            delete this.selectedShelf.dataset.initialY;
            delete this.selectedShelf.dataset.resizeStartX;
            delete this.selectedShelf.dataset.resizeStartY;
            delete this.selectedShelf.dataset.initialWidth;
            delete this.selectedShelf.dataset.initialHeight;
            
            // Reset styles
            this.selectedShelf.classList.remove('dragging', 'resizing');
            this.selectedShelf.style.cursor = 'grab';
            this.selectedShelf.style.zIndex = '1000';
            document.body.style.cursor = '';
        }
        
        this.isDragging = false;
        this.isResizing = false;
        this.currentOperation = null;
    }
    
    selectShelf(shelf) {
        // Deselect all shelves
        this.shelves.forEach(s => s.classList.remove('selected'));
        
        // Select clicked shelf
        shelf.classList.add('selected');
        this.selectedShelf = shelf;
    }
    
    deleteShelf(shelf) {
        if (confirm('Bu rafı silmek istediğinizden emin misiniz?')) {
            shelf.style.transition = 'all 0.3s ease';
            shelf.style.opacity = '0';
            shelf.style.transform = 'scale(0.5) rotate(180deg)';
            
            setTimeout(() => {
                shelf.remove();
                const index = this.shelves.indexOf(shelf);
                if (index > -1) {
                    this.shelves.splice(index, 1);
                }
                this.updateShelfCounter();
                this.showNotification('Raf başarıyla silindi!', 'info');
            }, 300);
        }
    }
    
    clearAllShelves() {
        if (this.shelves.length === 0) {
            this.showNotification('Silinecek raf bulunmuyor!', 'info');
            return;
        }
        
        if (confirm(`${this.shelves.length} adet rafı silmek istediğinizden emin misiniz?`)) {
            const shelfCount = this.shelves.length;
            
            this.shelves.forEach((shelf, index) => {
                setTimeout(() => {
                    shelf.style.transition = 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
                    shelf.style.opacity = '0';
                    shelf.style.transform = `scale(0.2) rotate(${360 + (index * 45)}deg) translateY(-50px)`;
                    shelf.style.filter = 'blur(5px)';
                    
                    setTimeout(() => {
                        if (shelf.parentNode) {
                            shelf.remove();
                        }
                    }, 400);
                }, index * 150);
            });
            
            setTimeout(() => {
                this.shelves = [];
                this.shelfCounter = 0; // Reset shelf counter here
                this.updateShelfCounter();
                this.showNotification(`${shelfCount} raf başarıyla temizlendi! 🧹`, 'success');
            }, this.shelves.length * 150 + 500);
        }
    }
    
    editShelfLabel(shelf) {
        const labelElement = shelf.querySelector('.shelf-label');
        const currentLabel = labelElement.textContent;
        
        // Görsel bir düzenleme kutusu oluştur
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.value = currentLabel;
        inputElement.style.width = '90%';
        inputElement.style.fontSize = labelElement.style.fontSize || '12px';
        inputElement.style.textAlign = 'center';
        inputElement.style.border = '1px solid #007bff';
        inputElement.style.borderRadius = '4px';
        inputElement.style.padding = '2px';
        inputElement.style.margin = '0 auto';
        inputElement.style.display = 'block';
        
        // Mevcut etiketi gizle ve input ekle
        labelElement.style.display = 'none';
        labelElement.parentNode.insertBefore(inputElement, labelElement.nextSibling);
        
        // Eklenen inputa odaklan
        inputElement.focus();
        inputElement.select();
        
        const saveEdit = () => {
            const newLabel = inputElement.value.trim();
            if (newLabel) {
                labelElement.textContent = newLabel;
                shelf.dataset.name = newLabel;
                this.showNotification('Raf etiketi güncellendi!', 'success');
            }
            
            // Temizlik
            labelElement.style.display = '';
            inputElement.remove();
        };
        
        // Blur olduğunda veya Enter'a basıldığında değişikliği kaydet
        inputElement.addEventListener('blur', saveEdit);
        inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveEdit();
                e.preventDefault();
            }
            if (e.key === 'Escape') {
                labelElement.style.display = '';
                inputElement.remove();
                e.preventDefault();
            }
        });
    }
    
    updateShelfCounter() {
        const counter = document.getElementById('shelf-count');
        if (counter) {
            counter.textContent = this.shelves.length;
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 14px;
            max-width: 300px;
        `;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Hide notification
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }
    
    // Get shelf data for backend
    getShelfData() {
        return this.shelves.map(shelf => ({
            name: shelf.dataset.name || `Raf ${shelf.dataset.id}`,
            x: parseInt(shelf.style.left) || 0,
            y: parseInt(shelf.style.top) || 0,
            width: shelf.offsetWidth,
            height: shelf.offsetHeight
        }));
    }
    
    // Premium Shelf Management System sınıfı içine eklenecek yeni metod
    applyRecommendations(recommendations) {
        if (!recommendations || recommendations.size === 0) {
            this.showNotification('Uygulanacak öneri bulunamadı!', 'error');
            return;
        }
        
        let appliedCount = 0;
        
        this.shelves.forEach(shelf => {
            const shelfName = shelf.dataset.name;
            if (recommendations.has(shelfName)) {
                const category = recommendations.get(shelfName);
                
                // Rafın kategori metnini güncelle
                const categoryElem = shelf.querySelector('.shelf-category');
                if (categoryElem) {
                    categoryElem.textContent = toTitleCase(category);
                    categoryElem.style.color = '#28a745'; // Yeşil renk ile vurgula
                    categoryElem.style.fontWeight = '500';
                    
                    // Geçiş efekti için
                    categoryElem.style.transition = 'all 0.3s ease';
                    categoryElem.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        categoryElem.style.transform = '';
                    }, 500);
                    
                    appliedCount++;
                }
            }
        });
        
        if (appliedCount > 0) {
            this.showNotification(`${appliedCount} rafa kategori önerisi uygulandı!`, 'success');
        } else {
            this.showNotification('Hiçbir raf için eşleşen öneri bulunamadı.', 'info');
        }
    }
    
    // PremiumShelfManager sınıfına eklenecek metod
    randomizeAllColors() {
        if (this.shelves.length === 0) {
            this.showNotification('Renklendirilecek raf bulunamadı!', 'info');
            return;
        }
        
        this.shelves.forEach((shelf, index) => {
            setTimeout(() => {
                const randomIndex = Math.floor(Math.random() * this.colorThemes.length);
                this.applyColorTheme(shelf, randomIndex);
            }, index * 200); // Staggered animation
        });
        
        this.showNotification(`${this.shelves.length} raf rastgele renklendirildi!`, 'success');
    }
}

// Güncellenen getShelfData fonksiyonu - sadece Premium Shelf Manager'ı kullanır
function getShelfData() {
    if (window.shelfManager) {
        const shelves = window.shelfManager.getShelfData();
        
        if (shelves.length === 0) {
            alert("Lütfen en az bir raf ekleyin ve konumlandırın.");
            return null;
        }
        return shelves;
    }
    
    alert("Raf sistemi henüz yüklenmedi. Lütfen sayfayı yenileyin.");
    return null;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize premium shelf manager
    window.shelfManager = new PremiumShelfManager();
    
    // Remove any existing old shelf items
    const oldShelves = document.querySelectorAll('.shelf-item');
    oldShelves.forEach(shelf => shelf.remove());
    
    const heroSection = document.querySelector('.hero');
    const floatingCards = document.querySelectorAll('.hero-visual .floating-card');
    const heroBackground = document.querySelector('.hero-background'); // Arka planı seç

    if (heroSection && floatingCards.length > 0) {
        heroSection.addEventListener('mousemove', function(e) {
            const rect = heroSection.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // Fare pozisyonunu -1 ile 1 arasında normalize et
            const deltaX = (x - centerX) / centerX;
            const deltaY = (y - centerY) / centerY;

            // Floating cards için parallax efekti
            floatingCards.forEach((card, index) => {
                const baseIntensity = 8; // Temel hareket yoğunluğu (px)
                // Kartın index'ine göre derinlik faktörü (uzaktaki kartlar daha az hareket eder)
                const depthFactor = 1 + (index * 0.4); 
                
                const moveX = -deltaX * baseIntensity * (1 / depthFactor);
                const moveY = -deltaY * baseIntensity * (1 / depthFactor);

                const rotateFactor = 6; // Temel rotasyon faktörü (derece)
                const rotateXVal = deltaY * rotateFactor * (1 / depthFactor);
                const rotateYVal = -deltaX * rotateFactor * (1 / depthFactor);
                
                // Hafif bir ölçek efekti de eklenebilir
                // const scaleEffect = 1 + (1 - (Math.abs(deltaX) + Math.abs(deltaY)) / 2) * 0.03; // Merkeze yakınsa hafif büyüt

                card.style.transform = `translate(${moveX}px, ${moveY}px) rotateX(${rotateXVal}deg) rotateY(${rotateYVal}deg)`;
                // card.style.transform = `translate(${moveX}px, ${moveY}px) rotateX(${rotateXVal}deg) rotateY(${rotateYVal}deg) scale(${scaleEffect})`;
            });

            // Hero background için parallax efekti (çok daha hafif)
            if (heroBackground) {
                const bgIntensity = 30; // Arka plan için hareket yoğunluğu
                const bgMoveX = -deltaX * bgIntensity * 0.1; // Arka plan daha az ve ters yönde hareket edebilir
                const bgMoveY = -deltaY * bgIntensity * 0.1;
                // CSS'de background-position: center center; veya 50% 50%; varsayılıyor
                heroBackground.style.backgroundPosition = `calc(50% + ${bgMoveX}px) calc(50% + ${bgMoveY}px)`;
            }
        });

        heroSection.addEventListener('mouseleave', function() {
            // Fare bölümden ayrıldığında kartları ve arka planı orijinal pozisyonuna döndür
            floatingCards.forEach(card => {
                card.style.transform = 'translate(0,0) rotateX(0) rotateY(0) scale(1)'; // Ölçek de sıfırlanır
            });
            if (heroBackground) {
                heroBackground.style.backgroundPosition = `center center`; // Veya orijinal pozisyonu
            }
        });
    }

    // Kademeli giriş animasyonu (CSS'te zaten varsa bu kısım düzenlenebilir veya kaldırılabilir)
    const heroElementsToAnimate = [
        document.querySelector('.hero-title'),
        document.querySelector('.hero-subtitle'),
        document.querySelector('.hero-buttons'),
        ...floatingCards // Kartları da animasyona dahil et
    ];

    heroElementsToAnimate.forEach((el, index) => {
        if (el) {
            // Eğer CSS'te zaten 'animation' ile karmaşık giriş animasyonları varsa,
            // bu JS kısmı o animasyonları tetikleyecek bir class ekleyebilir.
            // Basit opacity/transform için inline stil uygundur.
            el.style.opacity = '0';
            el.style.transform = 'translateY(25px)'; // Biraz daha aşağıdan başlasın
            // Her eleman için farklı ve yumuşak bir geçiş
            el.style.transition = `opacity 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) ${index * 0.12}s, transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) ${index * 0.12}s`;
            
            setTimeout(() => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 100 + (index * 120)); // Kademeli gecikme
        }
    });

});
