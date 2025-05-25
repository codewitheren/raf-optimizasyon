# -*- coding: utf-8 -*-
"""
Market Ürün Kategori Tahmini ve Raf Düzeni Optimizasyonu
-------------------------------------------------------
Bu modül, ürün isimlerinden kategori tahmini yapan ve market raf düzenini
birliktelik kurallarına göre optimize eden bir Flask web uygulamasıdır.
"""
import os
import sys
import json
import math
import re
import traceback
from collections import OrderedDict

import joblib
import pandas as pd
import chardet
from flask import Flask, request, jsonify, render_template
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder

# Flask uygulaması
app = Flask(__name__, static_folder='static', static_url_path='')

# Konfigürasyon
PROJECT_ROOT = os.path.dirname(__file__)
MODELS_DIR = os.path.join(PROJECT_ROOT, 'models')
PROCESSED_DATA_DIR = os.path.join(PROJECT_ROOT, 'processed_data')

# Model ve işlemciler
try:
    # Vektörleştirici ve etiket kodlayıcıyı yükle
    vectorizer = joblib.load(os.path.join(PROCESSED_DATA_DIR, 'tfidf_vectorizer.joblib'))
    label_encoder = joblib.load(os.path.join(PROCESSED_DATA_DIR, 'label_encoder.joblib'))
    
    # Modelleri yükle
    models = {
        'naive_bayes': joblib.load(os.path.join(MODELS_DIR, 'naive_bayes_model.joblib')),
        'decision_tree': joblib.load(os.path.join(MODELS_DIR, 'decision_tree_model.joblib')),
        'logistic_regression': joblib.load(os.path.join(MODELS_DIR, 'logistic_regression_model.joblib'))
    }
    print("Modeller ve işlemciler başarıyla yüklendi.")
except Exception as e:
    print(f"Model veya işlemci yükleme hatası: {e}")
    sys.exit(1)

# --- Yardımcı Fonksiyon: Birliktelik Analizi ---
def perform_association_analysis(all_categories_by_receipt):
    """Kategori birliktelik analizi yapar."""
    if len(all_categories_by_receipt) <= 1:
        return {'message': 'Birliktelik analizi için yeterli sipariş sayısı yok. En az 2 sipariş gerekiyor.'}

    try:
        # TransactionEncoder ile verileri hazırla
        te = TransactionEncoder()
        te_ary = te.fit_transform(all_categories_by_receipt)
        df = pd.DataFrame(te_ary, columns=te.columns_)
        
        # Farklı min_support değerlerini dene
        min_support = 0.1
        frequent_itemsets = apriori(df, min_support=min_support, use_colnames=True)
        
        if frequent_itemsets.empty and len(all_categories_by_receipt) >= 2:
            min_support = 2 / len(all_categories_by_receipt)
            frequent_itemsets = apriori(df, min_support=min_support, use_colnames=True)
        
        if frequent_itemsets.empty and len(all_categories_by_receipt) >= 2:
            min_support = 1 / len(all_categories_by_receipt)
            frequent_itemsets = apriori(df, min_support=min_support, use_colnames=True)
        
        # Yeterli sıklıkta kategori bulunamadıysa
        if frequent_itemsets.empty:
            return {
                'message': 'Yeterli sıklıkta birlikte bulunan kategori bulunamadı.',
                'min_support_used': min_support,
                'total_transactions': len(all_categories_by_receipt)
            }
        
        # Birliktelik kurallarını oluştur
        rules = association_rules(frequent_itemsets, metric="lift", min_threshold=0.0)
        
        if rules.empty:
            return {
                'message': 'Belirlenen destek eşiğinde ilişki kuralı bulunamadı.',
                'min_support_used': min_support,
                'total_transactions': len(all_categories_by_receipt)
            }
        
        # Lift > 1 olan pozitif kuralları filtrele
        positive_rules = rules[rules['lift'] > 1].copy()
        
        if positive_rules.empty:
            return {
                'message': 'Pozitif ilişki (lift > 1) gösteren kural bulunamadı.',
                'min_support_used': min_support,
                'total_transactions': len(all_categories_by_receipt)
            }
        
        positive_rules.sort_values(by='lift', ascending=False, inplace=True)
        
        # Kuralları temizle (çift yönlü tekrarları kaldır)
        positive_rules_list = []
        processed_pairs = set()
        
        for _, row in positive_rules.iterrows():
            antecedents = frozenset(row['antecedents'])
            consequents = frozenset(row['consequents'])
            pair_key = frozenset([antecedents, consequents])
            
            # Zaten işlenmiş bir çift ise atla
            if pair_key in processed_pairs:
                continue
            
            processed_pairs.add(pair_key)
            reverse_found = False
            higher_confidence_rule = None
            
            # Ters kuralı kontrol et
            for _, rev_row in positive_rules.iterrows():
                rev_antecedents = frozenset(rev_row['antecedents'])
                rev_consequents = frozenset(rev_row['consequents'])
                
                if antecedents == rev_consequents and consequents == rev_antecedents:
                    reverse_found = True
                    if rev_row['confidence'] > row['confidence']:
                        higher_confidence_rule = {
                            'if_categories': list(rev_row['antecedents']),
                            'then_categories': list(rev_row['consequents']),
                            'support': float(rev_row['support']),
                            'confidence': float(rev_row['confidence']),
                            'lift': float(rev_row['lift'])
                        }
                    break
            
            # En yüksek güvene sahip kuralı ekle
            if not reverse_found or higher_confidence_rule is None:
                positive_rules_list.append({
                    'if_categories': list(row['antecedents']),
                    'then_categories': list(row['consequents']),
                    'support': float(row['support']),
                    'confidence': float(row['confidence']),
                    'lift': float(row['lift'])
                })
            else:
                positive_rules_list.append(higher_confidence_rule)
        
        # Sonuçları sırala ve hazırla
        positive_rules_list = sorted(positive_rules_list, key=lambda x: x['lift'], reverse=True)
        top_rules_display = positive_rules_list[:min(10, len(positive_rules_list))]
        
        return {
            'rules_for_display': top_rules_display,
            'all_positive_rules': positive_rules_list,
            'total_positive_rules_found': len(positive_rules_list),
            'min_support_used': min_support,
            'total_transactions': len(all_categories_by_receipt)
        }
    
    except Exception as e:
        app.logger.error(f"Birliktelik analizi hatası: {e}")
        traceback.print_exc()
        return {'error': f'Birliktelik analizi sırasında bir hata oluştu: {str(e)}'}

# --- Euclidean Distance Helper ---
def euclidean_distance(p1, p2):
    """İki nokta arasındaki Öklidyen mesafeyi hesaplar."""
    return math.sqrt((p1['x'] - p2['x'])**2 + (p1['y'] - p2['y'])**2)

# --- Yardımcı Fonksiyon: Kategorileri Raflara Atama ---
def assign_categories_to_shelves(cabinets, association_results, time_goal):
    """Birliktelik analizi sonuçlarına göre kategorileri raflara atar."""
    shelf_category_assignments = {}
    unassigned_info = {"message": None, "unassigned_cabinets": []}
    visualization_data = {
        "shelf_positions": {},
        "category_scores": {},
        "shelf_distances": {},
        "assignment_explanation": {},
        "optimization_type": time_goal
    }
    
    # Raf pozisyonlarını kaydet
    for cabinet in cabinets:
        visualization_data["shelf_positions"][cabinet["name"]] = {
            "x": cabinet["x"],
            "y": cabinet["y"]
        }
    
    # Geçerli birliktelik kurallarının varlığını kontrol et
    if not association_results or 'message' in association_results:
        unassigned_info["message"] = "Birliktelik analizi kuralları bulunamadığı için kategori ataması yapılamadı."
        unassigned_info["unassigned_cabinets"] = [cabinet['name'] for cabinet in cabinets]
        return shelf_category_assignments, unassigned_info, visualization_data
    
    # Pozitif kuralların varlığını kontrol et
    positive_rules = association_results.get('all_positive_rules', [])
    if not positive_rules:
        unassigned_info["message"] = "Pozitif birliktelik kuralları bulunamadığı için kategori ataması yapılamadı."
        unassigned_info["unassigned_cabinets"] = [cabinet['name'] for cabinet in cabinets]
        return shelf_category_assignments, unassigned_info, visualization_data
    
    # 1. Kategori puanlarını hesapla - lift değerlerine göre önem sıralaması
    category_scores = {}
    category_relations = {}
    
    for rule in positive_rules:
        # İlişki bilgisini kaydet
        for if_cat in rule['if_categories']:
            if if_cat not in category_relations:
                category_relations[if_cat] = []
            for then_cat in rule['then_categories']:
                category_relations[if_cat].append({
                    "category": then_cat,
                    "lift": rule['lift'],
                    "confidence": rule['confidence']
                })
                
        # Tüm kategorilerin lift katkılarını topla
        for category in rule['if_categories'] + rule['then_categories']:
            category_scores[category] = category_scores.get(category, 0) + rule['lift']
    
    # Visualization için kategori puanlarını kaydet
    for category, score in category_scores.items():
        visualization_data["category_scores"][category] = score
    
    # Kategorileri puanlarına göre sırala
    sorted_categories = sorted(category_scores.items(), key=lambda x: x[1], reverse=True)
    
    # 2. Raf yerleşimini hazırla
    shelf_names = [cabinet['name'] for cabinet in cabinets]
    
    # Raflar arası mesafeleri hesapla
    all_shelf_distances = {}
    for i, cab1 in enumerate(cabinets):
        all_shelf_distances[cab1['name']] = {}
        for cab2 in cabinets:
            if cab1['name'] != cab2['name']:
                distance = math.sqrt((cab1['x'] - cab2['x'])**2 + (cab1['y'] - cab2['y'])**2)
                all_shelf_distances[cab1['name']][cab2['name']] = distance
    
    visualization_data["all_shelf_distances"] = all_shelf_distances
    
    if time_goal == 'maximize':
        # İlişkili kategorileri birbirine yakın yerleştir
        # Merkez noktayı hesapla
        if cabinets:
            center_x = sum(c['x'] for c in cabinets) / len(cabinets)
            center_y = sum(c['y'] for c in cabinets) / len(cabinets)
            
            # Rafları merkeze olan uzaklığına göre sırala
            shelf_distances = {}
            for cabinet in cabinets:
                distance = math.sqrt((cabinet['x'] - center_x)**2 + (cabinet['y'] - center_y)**2)
                shelf_distances[cabinet['name']] = distance
                visualization_data["shelf_distances"][cabinet['name']] = distance
            
            # Merkeze yakınlığa göre sırala
            shelf_names = [s[0] for s in sorted(shelf_distances.items(), key=lambda x: x[1])]
            
            # İlişkisi yüksek kategorileri merkeze yakın raflara yerleştir
            for i, (category, score) in enumerate(sorted_categories):
                if i < len(shelf_names):
                    shelf_name = shelf_names[i]
                    shelf_category_assignments[shelf_name] = category
                    # Açıklama ekle
                    visualization_data["assignment_explanation"][shelf_name] = {
                        "category": category,
                        "reason": "Yüksek ilişki puanı",
                        "score": score,
                        "distance_to_center": shelf_distances[shelf_name],
                        "rank": i + 1
                    }
    
    else:  # time_goal == 'minimize'
        # İlişkili kategorileri birbirinden uzak yerleştir
        # Rafları çift/tek olarak grupla
        even_shelves = shelf_names[::2]  # Çift indeksli raflar
        odd_shelves = shelf_names[1::2]  # Tek indeksli raflar
        
        # Kategorileri de benzer şekilde grupla
        even_categories = [cat for i, (cat, score) in enumerate(sorted_categories) if i % 2 == 0]
        even_scores = [score for i, (cat, score) in enumerate(sorted_categories) if i % 2 == 0]
        odd_categories = [cat for i, (cat, score) in enumerate(sorted_categories) if i % 2 == 1]
        odd_scores = [score for i, (cat, score) in enumerate(sorted_categories) if i % 2 == 1]
        
        # Eşleştirmeleri yap
        for i, shelf in enumerate(even_shelves):
            if i < len(even_categories):
                category = even_categories[i]
                score = even_scores[i]
                shelf_category_assignments[shelf] = category
                # Açıklama ekle
                visualization_data["assignment_explanation"][shelf] = {
                    "category": category,
                    "reason": "İlişkili kategorilerden uzaklaştırma (çift indeksli raf)",
                    "score": score,
                    "group": "even",
                    "rank": i * 2 + 1  # Orijinal sıralamayı geri hesapla
                }
                
        for i, shelf in enumerate(odd_shelves):
            if i < len(odd_categories):
                category = odd_categories[i]
                score = odd_scores[i]
                shelf_category_assignments[shelf] = category
                # Açıklama ekle
                visualization_data["assignment_explanation"][shelf] = {
                    "category": category,
                    "reason": "İlişkili kategorilerden uzaklaştırma (tek indeksli raf)",
                    "score": score,
                    "group": "odd",
                    "rank": i * 2 + 2  # Orijinal sıralamayı geri hesapla
                }
    
    # 3. Atanmayan rafları belirle
    unassigned_cabinets = [cabinet['name'] for cabinet in cabinets 
                          if cabinet['name'] not in shelf_category_assignments]
    
    if unassigned_cabinets:
        unassigned_info["message"] = "Bazı raflara yeterli kategori bulunamadığı için atama yapılamadı."
        unassigned_info["unassigned_cabinets"] = unassigned_cabinets
    
    # Kategori ilişkileri matrisini ekle
    visualization_data["category_relations"] = category_relations
    
    return shelf_category_assignments, unassigned_info, visualization_data

# --- Helper Function for Product Category Prediction ---
def predict_product_categories(products, model_choice):
    """Ürün isimlerinden kategori tahmini yapar."""
    if not products or not model_choice or model_choice not in models:
        return None
        
    try:
        # Ürün isimlerini vektörleştir
        products_vectorized = vectorizer.transform(products)
        
        # Tahmin yap
        model = models[model_choice]
        predictions_numeric = model.predict(products_vectorized)
        
        # Sonucu kategori isimlerine dönüştür
        return label_encoder.inverse_transform(predictions_numeric)
    except Exception as e:
        app.logger.error(f"Kategori tahmini hatası: {e}")
        traceback.print_exc()
        raise

# --- Ana Sayfa ---
@app.route('/')
def home():
    """Ana sayfa."""
    return render_template('index.html')

# --- Tekli Tahmin Endpoint ---
@app.route('/predict', methods=['POST'])
def predict():
    """Tekli ürün tahmin endpoint'i."""
    try:
        # İstek verilerini doğrula
        data = request.get_json()
        if not data or 'product_name' not in data or 'model_choice' not in data:
            return jsonify({'error': 'Eksik veri: product_name veya model_choice'}), 400
        
        product_name = data['product_name']
        model_choice = data['model_choice']
        
        if model_choice not in models:
            return jsonify({'error': f'Geçersiz model seçimi: {model_choice}'}), 400
        
        # Tahmin yap
        categories = predict_product_categories([product_name], model_choice)
        return jsonify({'prediction': categories[0]})
    
    except Exception as e:
        app.logger.error(f"Tahmin hatası: {str(e)}")
        return jsonify({'error': f'Tahmin sırasında bir hata oluştu: {str(e)}'}), 500

# --- Robust CSV Reading Helper ---
def read_csv_robust(file_storage):
    """CSV dosyasını güvenli şekilde okur ve satırları ürün listelerine dönüştürür."""
    file_storage.seek(0)
    raw_bytes = file_storage.read()
    encoding = chardet.detect(raw_bytes).get('encoding', 'utf-8')
    text = raw_bytes.decode(encoding, errors='replace').lstrip('\ufeff').strip()
    
    all_receipts_items = []
    for line in text.splitlines():
        items = [item.strip() for item in re.split(r',\s*', line) if item.strip()]
        if items:
            all_receipts_items.append(items)
            
    if not all_receipts_items:
        raise ValueError('CSV dosyası boş veya veri içermiyor.')
        
    return all_receipts_items

# --- Toplu Tahmin ve Birliktelik Analizi Endpoint ---
@app.route("/predict_bulk", methods=["POST"])
def predict_bulk():
    """Toplu tahmin ve birliktelik analizi endpoint'i."""
    # İstek doğrulama
    if 'csv_file' not in request.files: 
        return jsonify({'error': 'CSV dosyası eksik'}), 400
    
    file = request.files['csv_file']
    if file.filename == '' or not file.filename.endswith('.csv'): 
        return jsonify({'error': 'Geçerli bir CSV dosyası seçilmedi'}), 400
    
    if 'model_choice' not in request.form: 
        return jsonify({'error': 'Model seçimi belirtilmedi'}), 400
    
    model_choice = request.form['model_choice']
    if model_choice not in models: 
        return jsonify({'error': f'Geçersiz model seçimi: {model_choice}'}), 400

    try:
        # CSV dosyasını oku
        try:
            all_receipts_items = read_csv_robust(file)
        except Exception as csv_err:
            app.logger.error(f"CSV verileri işlenemedi: {csv_err}")
            return jsonify({'error': f'CSV verileri işlenemedi: {str(csv_err)}'}), 400

        # Sipariş sonuçlarını ve kategori listelerini oluştur
        results_by_receipt = OrderedDict()
        all_categories_by_receipt = []
        
        for index, row_items in enumerate(all_receipts_items, 1):
            receipt_id = f"Siparis_{index:02d}"
            products_in_receipt = [str(item).strip() for item in row_items if str(item).strip()]
            
            if not products_in_receipt: 
                continue
                
            try:
                # Tahmin yap
                predictions_categories = predict_product_categories(products_in_receipt, model_choice)
                
                # Sonuçları kaydet
                receipt_predictions = []
                receipt_categories = set()
                
                for product_name, category in zip(products_in_receipt, predictions_categories):
                    receipt_predictions.append({'product': product_name, 'category': category})
                    receipt_categories.add(category)
                
                if receipt_categories: 
                    all_categories_by_receipt.append(list(receipt_categories))
                if receipt_predictions: 
                    results_by_receipt[receipt_id] = receipt_predictions
                    
            except Exception as prediction_error:
                app.logger.error(f"Tahmin hatası {receipt_id}: {prediction_error}")
                results_by_receipt[receipt_id] = [
                    {'error': f'Bu siparişteki ürünler için tahmin başarısız oldu: {str(prediction_error)}'}
                ]

        # Sonuçların geçerliliğini kontrol et
        if not results_by_receipt: 
            return jsonify({'error': 'CSV satırlarında geçerli ürün bulunamadı veya işlenemedi.'}), 400
            
        # Birliktelik analizi yap
        association_results = perform_association_analysis(all_categories_by_receipt)
        
        # Sonuçları döndür
        return jsonify({
            'results': OrderedDict(sorted(results_by_receipt.items())),
            'association_analysis': association_results
        })

    except Exception as e:
        app.logger.error(f"Toplu tahmin hatası: {e}")
        traceback.print_exc()
        return jsonify({'error': f'İşlem sırasında beklenmeyen bir hata oluştu: {str(e)}'}), 500

# --- Playground Recommendation Endpoint --- 
@app.route('/playground_recommend', methods=['POST'])
def playground_recommend():
    """Raf kategori önerileri endpoint'i."""
    # İstek doğrulama
    if 'csv_file' not in request.files: 
        return jsonify({'error': 'CSV dosyası eksik'}), 400
        
    file = request.files['csv_file']
    if file.filename == '': 
        return jsonify({'error': 'CSV dosyası seçilmedi'}), 400
        
    if 'model_choice' not in request.form: 
        return jsonify({'error': 'Model seçimi belirtilmedi'}), 400
        
    model_choice = request.form['model_choice']
    if model_choice not in models: 
        return jsonify({'error': f'Geçersiz model seçimi: {model_choice}'}), 400
        
    if 'time_goal' not in request.form or request.form['time_goal'] not in ['maximize', 'minimize']: 
        return jsonify({'error': 'Geçerli bir zaman hedefi belirtilmedi'}), 400
        
    time_goal = request.form['time_goal']
    
    if 'cabinets' not in request.form: 
        return jsonify({'error': 'Raf verileri bulunamadı'}), 400
        
    try:
        cabinets = json.loads(request.form['cabinets'])
        if not cabinets or not isinstance(cabinets, list): 
            raise ValueError('Geçersiz raf verisi')
    except Exception as e:
        return jsonify({'error': f'Raf bilgisi geçersiz format: {str(e)}'}), 400

    try:
        # CSV dosyasını oku
        try:
            all_receipts_items = read_csv_robust(file)
        except Exception as csv_err:
            return jsonify({'error': f'CSV verileri işlenemedi: {str(csv_err)}'}), 400

        # Tahminleri yap ve kategorileri topla
        all_categories_by_receipt = []
        
        for row_items in all_receipts_items:
            products_in_receipt = [str(item).strip() for item in row_items if str(item).strip()]
            
            if not products_in_receipt:
                continue
                
            try:
                # Tahmin yap
                predictions_categories = predict_product_categories(products_in_receipt, model_choice)
                
                # Kategorileri kaydet
                receipt_categories = set(predictions_categories)
                if receipt_categories:
                    all_categories_by_receipt.append(list(receipt_categories))
                    
            except Exception as e:
                app.logger.error(f"Tahmin hatası: {e}")
                continue

        # Verilerin geçerliliğini kontrol et
        if not all_categories_by_receipt:
            return jsonify({
                'error': 'CSV dosyasında işlenebilir ürün bulunamadı. Geçerli ürün isimleri içeren bir CSV yükleyin.'
            }), 400
            
        # Yeterli veri yoksa, veriyi çoğalt
        if len(all_categories_by_receipt) < 2:
            all_categories_by_receipt.append(all_categories_by_receipt[0])
        
        # Birliktelik analizi yap
        association_results = perform_association_analysis(all_categories_by_receipt)
        
        if 'message' in association_results:
            return jsonify({
                'error': f"Kategori ataması yapılamadı: {association_results['message']}"
            }), 400
        
        # Kategorileri raflara ata
        shelf_category_assignments, unassigned_info, visualization_data = assign_categories_to_shelves(
            cabinets, association_results, time_goal
        )
        
        # Özet bilgileri hazırla
        association_analysis_summary = {
            'total_transactions': len(all_categories_by_receipt),
            'min_support_used': association_results.get('min_support_used', None),
            'total_positive_rules_found': len(association_results.get('all_positive_rules', [])), 
            'top_rules_for_display': association_results.get('rules_for_display', [])
        }
        
        # Visualization data'yı logla
        app.logger.info(f"Visualization data: {json.dumps(visualization_data, indent=2)}")
        
        # Sonuçları döndür
        return jsonify({
            'recommendations': shelf_category_assignments,
            'unassigned_info': unassigned_info,
            'association_analysis_summary': association_analysis_summary,
            'visualization_data': visualization_data
        })
        
    except Exception as e:
        app.logger.error(f"Playground recommend hatası: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Beklenmeyen bir hata oluştu: {str(e)}'}), 500

# --- Uygulamayı Çalıştır ---
if __name__ == '__main__':
    print("Market Kategori Tahmini ve Raf Optimizasyon Uygulaması Başlatılıyor...")
    try:
        app.run(host='0.0.0.0', port=5000, debug=False)
    except Exception as e:
        print(f"Uygulama başlatılırken hata oluştu: {e}")
        traceback.print_exc()

