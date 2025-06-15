# -*- coding: utf-8 -*-
import sys
import os
import json # Added for parsing cabinet data
import math # Added for Euclidean distance
import itertools # Added for combinations
from flask import Flask, render_template, request, jsonify
import joblib
import numpy as np
import pandas as pd
import io
import pandas.errors
import csv
import traceback
from mlxtend.frequent_patterns import apriori
from mlxtend.frequent_patterns import association_rules
from mlxtend.preprocessing import TransactionEncoder
from datetime import datetime # Added for timestamp in validation metrics
# Flask uygulamasını başlat
app = Flask(__name__, static_folder='static', static_url_path='')
# --- Konfigürasyon ---
PROJECT_ROOT = os.path.dirname(__file__)
MODELS_DIR = os.path.join(PROJECT_ROOT, 'models')
PROCESSED_DATA_DIR = os.path.join(PROJECT_ROOT, 'processed_data')
# --- Model ve İşlemcileri Yükle ---
try:
    vectorizer_path = os.path.join(PROCESSED_DATA_DIR, 'tfidf_vectorizer.joblib')
    label_encoder_path = os.path.join(PROCESSED_DATA_DIR, 'label_encoder.joblib')
    vectorizer = joblib.load(vectorizer_path)
    label_encoder = joblib.load(label_encoder_path)
    print("Vektörleştirici ve Etiket Kodlayıcı başarıyla yüklendi.")
except FileNotFoundError as e:
    print(f"İşlemci dosyalarını yükleme hatası: {e}. '{PROCESSED_DATA_DIR}' dizininde dosyaların olduğundan emin olun.")
    sys.exit(1)
except Exception as e:
    print(f"İşlemcileri yüklerken beklenmeyen bir hata oluştu: {e}")
    sys.exit(1)
models = {}
try:
    model_files = {
        'naive_bayes': 'naive_bayes_model.joblib',
        'decision_tree': 'decision_tree_model.joblib',
        'logistic_regression': 'logistic_regression_model.joblib'
    }
    for model_key, model_filename in model_files.items():
        model_path = os.path.join(MODELS_DIR, model_filename)
        models[model_key] = joblib.load(model_path)
        print(f"'{model_key}' modeli {model_path} adresinden başarıyla yüklendi.")
except FileNotFoundError as e:
    print(f"Model dosyası yükleme hatası: {e}. Tüm model .joblib dosyalarının '{MODELS_DIR}' dizininde olduğundan emin olun.")
    sys.exit(1)
except Exception as e:
    print(f"Model yüklerken beklenmeyen bir hata oluştu: {e}")
    sys.exit(1)
# --- Helper Function for Association Analysis ---
def perform_association_analysis(all_categories_by_receipt):
    association_results = {}
    rules_list = []
    frequent_itemsets = pd.DataFrame()
    min_support = 0.1
    if len(all_categories_by_receipt) > 1:
        try:
            te = TransactionEncoder()
            te_ary = te.fit_transform(all_categories_by_receipt)
            df = pd.DataFrame(te_ary, columns=te.columns_)
            
            frequent_itemsets = apriori(df, min_support=min_support, use_colnames=True)
            
            if frequent_itemsets.empty and len(all_categories_by_receipt) >= 2:
                min_support = 2 / len(all_categories_by_receipt)
                frequent_itemsets = apriori(df, min_support=min_support, use_colnames=True)
            if frequent_itemsets.empty and len(all_categories_by_receipt) >= 2:
                 min_support = 1 / len(all_categories_by_receipt)
                 frequent_itemsets = apriori(df, min_support=min_support, use_colnames=True)
            if not frequent_itemsets.empty:
                # Calculate rules based on lift > 0 to capture all potential relationships for scoring
                rules = association_rules(frequent_itemsets, metric="lift", min_threshold=0.0)
                
                if not rules.empty:
                    # Filter for lift > 1 for positive association display and scoring logic
                    positive_rules = rules[rules['lift'] > 1].copy()
                    positive_rules.sort_values(by='lift', ascending=False, inplace=True)
                    all_rules_list = [] # Store all rules (lift > 0) for potential future use
                    for _, row in rules.iterrows():
                         all_rules_list.append({
                            'if_categories': list(row['antecedents']),
                            'then_categories': list(row['consequents']),
                            'support': float(row['support']),
                            'confidence': float(row['confidence']),
                            'lift': float(row['lift'])
                        })
                    # Filter out redundant rules logic
                    positive_rules_list = [] # Store only positive rules (lift > 1)
                    processed_pairs = set()  # Keep track of processed category pairs
                    
                    if not positive_rules.empty:
                        for _, row in positive_rules.iterrows():
                            antecedents = frozenset(row['antecedents'])
                            consequents = frozenset(row['consequents'])
                            
                            # Create a consistent identifier for this rule pair
                            # regardless of direction (A→B or B→A)
                            pair_key = frozenset([antecedents, consequents])
                            
                            # If we already processed this pair, skip
                            if pair_key in processed_pairs:
                                continue
                                
                            # Mark this pair as processed
                            processed_pairs.add(pair_key)
                            
                            # Look for the reverse rule
                            reverse_found = False
                            higher_confidence_rule = None
                            
                            # Check if the reverse rule exists with higher confidence
                            for _, rev_row in positive_rules.iterrows():
                                rev_antecedents = frozenset(rev_row['antecedents'])
                                rev_consequents = frozenset(rev_row['consequents'])
                                
                                # If this is the reverse rule
                                if antecedents == rev_consequents and consequents == rev_antecedents:
                                    reverse_found = True
                                    # Keep only the rule with higher confidence
                                    if rev_row['confidence'] > row['confidence']:
                                        higher_confidence_rule = {
                                            'if_categories': list(rev_row['antecedents']),
                                            'then_categories': list(rev_row['consequents']),
                                            'support': float(rev_row['support']),
                                            'confidence': float(rev_row['confidence']),
                                            'lift': float(rev_row['lift'])
                                        }
                                    break
                            
                            # If no reverse with higher confidence found, use the current rule
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
                        
                        # Sort the filtered rules by lift
                        positive_rules_list = sorted(positive_rules_list, key=lambda x: x['lift'], reverse=True)
                        top_rules_display = positive_rules_list[:min(10, len(positive_rules_list))]
                        association_results = {
                            'rules_for_display': top_rules_display, # Top positive rules for UI
                            'all_positive_rules': positive_rules_list, # All positive rules for calculation
                            'total_positive_rules_found': len(positive_rules_list),
                            'min_support_used': min_support,
                            'total_transactions': len(all_categories_by_receipt)
                        }
                    else:
                         association_results = {
                            'message':'Pozitif ilişki (lift > 1) gösteren kural bulunamadı.',
                            'min_support_used': min_support,
                            'total_transactions': len(all_categories_by_receipt)
                        }
                else:
                    association_results = {
                        'message': 'Belirlenen destek eşiğinde ilişki kuralı bulunamadı.',                        'frequent_itemsets_found': len(frequent_itemsets),
                        'min_support_used': min_support,
                        'total_transactions': len(all_categories_by_receipt)
                    }
            else:
                association_results = {                    'message': 'Yeterli sıklıkta birlikte bulunan kategori bulunamadı (apriori sonucu boş).',
                    'min_support_used': min_support,
                    'total_transactions': len(all_categories_by_receipt)
                }
        except Exception as assoc_error:
            print(f"Birliktelik analizi hatası: {assoc_error}")
            traceback.print_exc()
            association_results = {'error': f'Birliktelik analizi sırasında bir hata oluştu: {str(assoc_error)}'}
    else:
        association_results = {            'message': 'Birliktelik analizi için yeterli sipariş sayısı yok. En az 2 sipariş gerekiyor.'
        }
    return association_results
# --- Euclidean Distance Helper ---
def euclidean_distance(p1, p2):
    """Calculates the Euclidean distance between two points (x, y)."""
    return math.sqrt((p1['x'] - p2['x'])**2 + (p1['y'] - p2['y'])**2)
# --- Helper Function for Category Assignment to Shelves ---
def assign_categories_to_shelves(cabinets, association_results, time_goal):
    """
    Birliktelik analizi sonuçlarına ve optimize hedefine göre kategorileri raflara atar.
    Args:
        cabinets (list): Rafların konumlarını ve bilgilerini içeren liste
        association_results (dict): Birliktelik analizi sonuçları
        time_goal (str): Optimizasyon hedefi ('maximize' veya 'minimize')
    Returns:
        tuple: (shelf_category_assignments, unassigned_info)
    """
    shelf_category_assignments = {}
    unassigned_info = {"message": None, "unassigned_cabinets": []}
    
    # Birliktelik analizinde kural bulunmadıysa boş sonuç döndür
    if not association_results or 'message' in association_results:
        unassigned_info["message"] = "Birliktelik analizi kuralları bulunamadığı için kategori ataması yapılamadı."
        unassigned_info["unassigned_cabinets"] = [cabinet['name'] for cabinet in cabinets]
        return shelf_category_assignments, unassigned_info
    
    # Pozitif birliktelik kuralları (Lift > 1)
    positive_rules = association_results.get('all_positive_rules', [])
    
    if not positive_rules:
        unassigned_info["message"] = "Pozitif birliktelik (Lift > 1) kuralları bulunamadığı için kategori ataması yapılamadı."
        unassigned_info["unassigned_cabinets"] = [cabinet['name'] for cabinet in cabinets]
        return shelf_category_assignments, unassigned_info
    
    # 1. Her kategori için ilişki puanı hesapla
    category_scores = {}
    for rule in positive_rules:
        # Antesedan (If) kategorileri
        for category in rule['if_categories']:
            if category not in category_scores:
                category_scores[category] = 0
            # Bu kategorinin toplam lift katkısını ekle
            category_scores[category] += rule['lift'] 
            
        # Konseküent (Then) kategorileri
        for category in rule['then_categories']:
            if category not in category_scores:
                category_scores[category] = 0
            # Bu kategorinin toplam lift katkısını ekle 
            category_scores[category] += rule['lift']
    
    # 2. Raflar arası mesafeleri hesapla
    shelf_distances = {}
    for i, cabinet1 in enumerate(cabinets):
        total_distance = 0
        for j, cabinet2 in enumerate(cabinets):
            if i != j:
                # İki raf arası Öklid mesafesini hesapla
                distance = math.sqrt(
                    (cabinet1['x'] - cabinet2['x'])**2 + 
                    (cabinet1['y'] - cabinet2['y'])**2
                )
                total_distance += distance
        
        # Her rafın diğer tüm raflara ortalama mesafesi
        if len(cabinets) > 1:
            shelf_distances[cabinet1['name']] = total_distance / (len(cabinets) - 1)
        else:
            shelf_distances[cabinet1['name']] = 0
    
    # 3. Rafları mesafeye göre sırala
    # Düşük mesafe = merkezi raf, yüksek mesafe = çevresel raf
    sorted_shelves = sorted(shelf_distances.items(), key=lambda x: x[1])
    shelf_names = [shelf[0] for shelf in sorted_shelves]
    
    # 4. Kategorileri puanlarına göre sırala (ilişki gücüne göre)
    sorted_categories = sorted(category_scores.items(), key=lambda x: x[1], reverse=True)
    
    # 5. İki listeyi uygun şekilde eşleştir
    if time_goal == 'maximize':
        # İlişkili kategorileri birbirine yakın yerleştirmek için:
        # İlişkili kategoriler arasındaki mesafeyi azalt
        # Yüksek ilişkili kategorileri, mesafesi birbirine yakın raflara yerleştir
        # Bu için kategorileri mesafeye dayalı olarak gruplandırabiliriz
        
        # Önce rafları mesafelerine göre gruplandır 
        # Merkeze yakın raflar, çevreye yakın raflar gibi
        shelf_groups = []
        remaining_shelves = shelf_names.copy()
        
        # Merkez noktayı bul
        if cabinets:
            center_x = sum(c['x'] for c in cabinets) / len(cabinets)
            center_y = sum(c['y'] for c in cabinets) / len(cabinets)
            
            # Rafları merkeze olan uzaklığa göre sırala
            shelf_distances_to_center = {}
            for cabinet in cabinets:
                dist_to_center = math.sqrt(
                    (cabinet['x'] - center_x)**2 + 
                    (cabinet['y'] - center_y)**2
                )
                shelf_distances_to_center[cabinet['name']] = dist_to_center
            
            # Merkeze yakınlığa göre sırala
            sorted_by_center = sorted(shelf_distances_to_center.items(), key=lambda x: x[1])
            shelf_names = [s[0] for s in sorted_by_center]
        
        # İlişkisi yüksek kategorileri yakındaki raflara yerleştir
        for i, (category, score) in enumerate(sorted_categories):
            if i < len(shelf_names):
                shelf_category_assignments[shelf_names[i]] = category
        
    else:  # time_goal == 'minimize'
        # İlişkili kategorileri birbirinden uzak yerleştirmek için:
        # İlişkili kategoriler arasındaki mesafeyi artır
        # Yüksek ilişkili kategorileri, mesafesi birbirine uzak raflara yerleştir
        
        # Rafları çift/tek olarak iki gruba ayır ve ilişkili kategorileri karşıt gruplara ata
        even_shelves = shelf_names[::2]  # Çift indeksli raflar
        odd_shelves = shelf_names[1::2]  # Tek indeksli raflar
        
        # Yüksek ilişkili kategorileri çift/tek raflara dağıt
        even_categories = [cat for i, (cat, _) in enumerate(sorted_categories) if i % 2 == 0]
        odd_categories = [cat for i, (cat, _) in enumerate(sorted_categories) if i % 2 == 1]
        
        # Eşleştirme yap
        for i, shelf in enumerate(even_shelves):
            if i < len(even_categories):
                shelf_category_assignments[shelf] = even_categories[i]
                
        for i, shelf in enumerate(odd_shelves):
            if i < len(odd_categories):
                shelf_category_assignments[shelf] = odd_categories[i]
    
    # 6. Atanmayan rafları belirle
    unassigned_cabinets = [cabinet['name'] for cabinet in cabinets 
                          if cabinet['name'] not in shelf_category_assignments]
    
    if unassigned_cabinets:
        unassigned_info["message"] = "Bazı raflara yeterli kategori bulunamadığı için atama yapılamadı."
        unassigned_info["unassigned_cabinets"] = unassigned_cabinets
    
    return shelf_category_assignments, unassigned_info
# --- Helper Function for Product Category Prediction ---
def predict_category(product_name, model_choice):
    """
    Ürün isminden kategori tahmini yapar.
    
    Args:
        product_name (str): Tahmin edilecek ürün ismi
        model_choice (str): Kullanılacak model ('naive_bayes', 'decision_tree', 'logistic_regression')
        
    Returns:
        str: Tahmin edilen kategori adı
    """
    if not product_name or not model_choice or model_choice not in models:
        return None
        
    try:
        # Ürün ismini vektörleştir
        product_name_vectorized = vectorizer.transform([product_name])
        
        # Modeli seç ve tahmin yap
        model = models[model_choice]
        prediction_numeric = model.predict(product_name_vectorized)
        
        # Sayısal tahmini kategori ismine dönüştür
        prediction_category = label_encoder.inverse_transform(prediction_numeric)[0]
        
        return prediction_category
    except Exception as e:
        app.logger.error(f"Kategori tahmini sırasında hata: {product_name}, hata: {e}")
        return None
# --- Ana Sayfa ---
@app.route('/')
def home():  # 'index' yerine 'home' kullanın
    return render_template('index.html')
# --- Hakkında Sayfası ---
@app.route('/about')
def about():
    return render_template('about.html')
# --- İletişim Sayfası ---
@app.route('/contact', methods=['GET'])
def contact():
    return render_template('contact.html')

@app.route('/contact', methods=['POST'])
def contact_post():
    try:
        name = request.form.get('name')
        email = request.form.get('email')
        company = request.form.get('company', '')
        subject = request.form.get('subject')
        message = request.form.get('message')
        
        # Burada email gönderme logic'i olacak
        app.logger.info(f"Contact form: {name} ({email}) - {subject}")
        
        return jsonify({
            'status': 'success',
            'message': 'Mesajınız başarıyla gönderildi! En kısa sürede size dönüş yapacağız.'
        })
    except Exception as e:
        app.logger.error(f"Contact form error: {e}")
        return jsonify({
            'status': 'error',
            'message': 'Mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.'
        }), 500
@app.route('/career')
def career():
    return render_template('career.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/cookies')
def cookies():
    return render_template('cookies.html')

# --- Dokümantasyon Sayfası ---
@app.route('/documentation')
def documentation():
    return render_template('documentation.html')
# --- SSS Sayfası ---
@app.route('/faq')
def faq():
    return render_template('faq.html')
# --- Blog Sayfası ---
@app.route('/blog')
def blog():
    return render_template('blog.html')
# --- API Sayfası ---
@app.route('/api')
def api():
    return render_template('api.html')
# --- Tekli Tahmin Endpoint ---
@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        if not data or 'product_name' not in data or 'model_choice' not in data:
            return jsonify({'error': 'Eksik veri: product_name veya model_choice'}), 400
        product_name = data['product_name']
        model_choice = data['model_choice']
        if model_choice not in models:
            return jsonify({'error': f'Geçersiz model seçimi: {model_choice}'}), 400
        product_name_vectorized = vectorizer.transform([product_name])
        model = models[model_choice]
        prediction_numeric = model.predict(product_name_vectorized)
        prediction_category = label_encoder.inverse_transform(prediction_numeric)[0]
        return jsonify({'prediction': prediction_category})
    except Exception as e:
        print(f"Ürün tahmini sırasında hata: {product_name}, hata: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Tahmin sırasında bir hata oluştu: {str(e)}'}), 500
# --- Toplu Tahmin ve Birliktelik Analizi Endpoint ---
@app.route("/predict_bulk", methods=["POST"])
def predict_bulk():
    if 'csv_file' not in request.files: return jsonify({'error': 'Dosya kısmı eksik'}), 400
    file = request.files['csv_file']
    if file.filename == '': return jsonify({'error': 'Dosya seçilmedi'}), 400
    if 'model_choice' not in request.form: return jsonify({'error': 'Model seçimi belirtilmedi'}), 400
    model_choice = request.form['model_choice']
    if model_choice not in models: return jsonify({'error': f'Geçersiz model seçimi: {model_choice}'}), 400
    if not file or not file.filename.endswith('.csv'): return jsonify({'error': 'Geçersiz dosya türü. Lütfen bir CSV dosyası yükleyin.'}), 400
    try:
        file.seek(0)
        try:
            csv_content_bytes = file.read()
            try: csv_content = csv_content_bytes.decode('utf-8')
            except UnicodeDecodeError: 
                try: csv_content = csv_content_bytes.decode('iso-8859-9')
                except UnicodeDecodeError: csv_content = csv_content_bytes.decode('latin-1')
        except Exception as decode_err: return jsonify({'error': f'Yüklenen dosya okunamadı veya kodlanamadı: {str(decode_err)}'}), 400
        csv_data = io.StringIO(csv_content)
        try:
            dialect = csv.Sniffer().sniff(csv_data.read(1024))
            csv_data.seek(0)
            reader = csv.reader(csv_data, dialect)
            all_receipts_items = list(reader)
        except Exception as e: return jsonify({'error': f'CSV verileri işlenemedi: {str(e)}'}), 400
        if not all_receipts_items: return jsonify({'error': 'CSV dosyası boş veya veri içermiyor.'}), 400
        model = models[model_choice]
        results_by_receipt = {}
        all_categories_by_receipt = []
        all_predicted_categories = set()
        for index, row_items in enumerate(all_receipts_items, 1):
            receipt_id = f"Siparis_{index}"
            receipt_predictions = []
            receipt_categories = set()
            products_in_receipt = [str(item).strip() for item in row_items if str(item).strip()]
            if not products_in_receipt: continue
            try:
                products_vectorized = vectorizer.transform(products_in_receipt)
                predictions_numeric = model.predict(products_vectorized)
                predictions_categories = label_encoder.inverse_transform(predictions_numeric)
                for product_name, category in zip(products_in_receipt, predictions_categories):
                    receipt_predictions.append({'product': product_name, 'category': category})
                    receipt_categories.add(category)
                    all_predicted_categories.add(category)
                if receipt_categories: all_categories_by_receipt.append(list(receipt_categories))
            except Exception as prediction_error:
                print(f"Toplu - Tahmin hatası {receipt_id} (satır {index}): {prediction_error}")
                results_by_receipt[receipt_id] = [{'error': f'Bu siparişteki ürünler için tahmin başarısız oldu: {str(prediction_error)}'}]
                continue
            if receipt_predictions: results_by_receipt[receipt_id] = receipt_predictions
        if not results_by_receipt and not all_categories_by_receipt: return jsonify({'error': 'CSV satırlarında geçerli ürün bulunamadı veya işlenemedi.'}), 400
        
        association_results = perform_association_analysis(all_categories_by_receipt)
        
        return jsonify({
            'results': results_by_receipt,
            'association_analysis': association_results
        })
    except Exception as e:
        print(f"Toplu tahmin sırasında hata: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Toplu tahmin sırasında beklenmeyen bir hata oluştu: {str(e)}'}), 500
# --- Playground Recommendation Endpoint --- UPDATED --- 
@app.route('/playground_recommend', methods=['POST'])
def playground_recommend():
    if 'csv_file' not in request.files: return jsonify({'error': 'CSV dosyası kısmı eksik'}), 400
    file = request.files['csv_file']
    if file.filename == '': return jsonify({'error': 'CSV dosyası seçilmedi'}), 400
    if 'model_choice' not in request.form: return jsonify({'error': 'Model seçimi belirtilmedi'}), 400
    model_choice = request.form['model_choice']
    if model_choice not in models: return jsonify({'error': f'Geçersiz model seçimi: {model_choice}'}), 400
    if 'time_goal' not in request.form or request.form['time_goal'] not in ['maximize', 'minimize']: return jsonify({'error': 'Geçerli bir zaman hedefi (time_goal: maximize veya minimize) belirtilmedi'}), 400
    time_goal = request.form['time_goal']
    
    if 'cabinets' not in request.form: return jsonify({'error': 'Raf verileri bulunamadı'}), 400
    try:
        cabinets = json.loads(request.form['cabinets']) # Parse from JSON string
        if not cabinets or not isinstance(cabinets, list): raise ValueError()
    except Exception as e:
        return jsonify({'error': f'Raf bilgisi geçersiz format: {str(e)}'}), 400
    
    try:
        # Eksik değişkenleri tanımla
        all_predicted_categories = set()
        results_by_receipt = {}
        # CSV'yi oku - farklı kodlamaları dene
        file.seek(0)
        try:
            csv_content_bytes = file.read()
            try: 
                csv_content = csv_content_bytes.decode('utf-8')
            except UnicodeDecodeError: 
                try: 
                    csv_content = csv_content_bytes.decode('iso-8859-9')  # Turkish encoding
                except UnicodeDecodeError: 
                    try:
                        csv_content = csv_content_bytes.decode('cp1254')  # Windows Turkish
                    except UnicodeDecodeError:
                        csv_content = csv_content_bytes.decode('latin-1')  # Fallback
        except Exception as decode_err:
            return jsonify({'error': f'CSV dosyası okunamadı: {str(decode_err)}'}), 400
            
        # CSV'yi doğrudan okuyup işleyerek predict_bulk ile aynı yöntemle işle
        csv_data = io.StringIO(csv_content)
        
        try:
            # CSV formatını algıla ve oku
            try:
                dialect = csv.Sniffer().sniff(csv_data.read(1024))
                csv_data.seek(0)
                reader = csv.reader(csv_data, dialect)
                all_receipts_items = list(reader)
            except Exception as dialect_err:
                # Sniffer başarısız olursa varsayılan virgül ayırıcı kullan
                csv_data.seek(0)
                reader = csv.reader(csv_data)
                all_receipts_items = list(reader)
        except Exception as csv_err:
            return jsonify({'error': f'CSV verileri işlenemedi: {str(csv_err)}'}), 400
            
        if not all_receipts_items:
            return jsonify({'error': 'CSV dosyası boş veya veri içermiyor.'}), 400
        
        # Her sipariş için kategorileri tahmin et
        all_receipts_with_predictions = {}
        all_categories_by_receipt = []  # Birden çok sipariş için bir liste
        
        # Her satırı ayrı bir sipariş olarak işle - predict_bulk ile aynı mantık
        for index, row_items in enumerate(all_receipts_items, 1):
            receipt_id = f"Siparis_{index}"
            receipt_predictions = []
            receipt_categories = set()  # Bu siparişteki benzersiz kategoriler
            
            # Satırdaki her hücreyi bir ürün olarak temizle
            products_in_receipt = [str(item).strip() for item in row_items if str(item).strip()]
            
            if not products_in_receipt:
                continue  # Boş siparişleri atla
            
            # Ürünleri vektörleştir ve tahmin et
            try:
                # Modeli seç ve tanımla
                model = models[model_choice]
                products_vectorized = vectorizer.transform(products_in_receipt)
                predictions_numeric = model.predict(products_vectorized)
                predictions_categories = label_encoder.inverse_transform(predictions_numeric)
                # Tahmin edilen kategorileri ekle
                for product_name, category in zip(products_in_receipt, predictions_categories):
                    receipt_predictions.append({'product': product_name, 'category': category})
                    receipt_categories.add(category)
                    # Tüm tahmin edilen kategorileri bir sete ekle
                    all_predicted_categories.add(category)
                # Sipariş kategorilerini listeye ekle
                if receipt_categories:
                    all_categories_by_receipt.append(list(receipt_categories))
            except Exception as prediction_error:
                print(f"Toplu - Tahmin hatası {receipt_id} (satır {index}): {prediction_error}")
                results_by_receipt[receipt_id] = [{'error': f'Bu siparişteki ürünler için tahmin başarısız oldu: {str(prediction_error)}'}]
                continue
            # Tahmin edilen ürünleri sonuçlara ekle
            if receipt_predictions:
                results_by_receipt[receipt_id] = receipt_predictions
        
        if not all_categories_by_receipt:
            return jsonify({'error': 'CSV dosyasında işlenebilir ve tahmin edilebilir ürün bulunamadı. Lütfen geçerli ürün isimleri içeren bir CSV yükleyin.'}), 400
        
        # Birliktelik analizi yap - en az 2 sipariş olmalı
        if len(all_categories_by_receipt) < 2:
            # Eğer sadece bir sipariş varsa, aynı veriyi 2 kez koyarak minimum eşiği geç
            # Bu, tek sipariş durumunda da çalışmasını sağlar
            all_categories_by_receipt.append(all_categories_by_receipt[0])
            
        association_results = perform_association_analysis(all_categories_by_receipt)
        
        # Eğer birliktelik analizi sonuçları yoksa, basit bir hata mesajı döndür
        if 'message' in association_results:
            return jsonify({
                'error': f"Kategori ataması yapılamadı: {association_results['message']}"
            }), 400
        
        # Kategorileri puanla ve raflara ata
        shelf_category_assignments, unassigned_info = assign_categories_to_shelves(
            cabinets, 
            association_results, 
            time_goal
        )
        
        # Ön tarafa gönderilecek birliktelik analizi özeti
        association_analysis_summary = {
            'total_transactions': len(all_categories_by_receipt),
            'min_support_used': association_results.get('min_support_used', None),
            'total_positive_rules_found': len(association_results.get('all_positive_rules', [])), 
            'top_rules_for_display': association_results.get('rules_for_display', [])
        }
        
        return jsonify({
            'recommendations': shelf_category_assignments,
            'unassigned_info': unassigned_info,
            'association_analysis_summary': association_analysis_summary
        })
        
    except Exception as e:
        app.logger.error(f"Playground recommend hatası: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Beklenmeyen bir hata oluştu: {str(e)}'}), 500
# --- API endpoints (opsiyonel) ---
@app.route('/api/v1/predict', methods=['POST'])
def api_predict():
    try:
        data = request.get_json()
        product_name = data.get('product_name')
        model_choice = data.get('model', 'logistic_regression')
        
        prediction = predict_category(product_name, model_choice)
        
        return jsonify({
            'status': 'success',
            'prediction': prediction,
            'product': product_name,
            'model': model_choice
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400

@app.route('/api/v1/predict/bulk', methods=['POST'])
def api_predict_bulk():
    try:
        data = request.get_json()
        products = data.get('products', [])
        model_choice = data.get('model', 'logistic_regression')
        
        predictions = []
        for product in products:
            pred = predict_category(product, model_choice)
            predictions.append({
                'product': product,
                'category': pred
            })
        
        return jsonify({
            'status': 'success',
            'predictions': predictions,
            'total': len(predictions),
            'model': model_choice
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400
# --- Uygulamayı Çalıştır ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
