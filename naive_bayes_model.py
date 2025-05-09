# Gerekli kütüphanelerin import edilmesi
import joblib # Kaydedilmiş nesneleri (veri, model vb.) yüklemek için
from sklearn.naive_bayes import MultinomialNB # Multinomial Naive Bayes sınıflandırıcısı
from sklearn.metrics import accuracy_score, classification_report # Model performansını değerlendirme metrikleri
import os # Dizin işlemleri için
import numpy as np # NumPy'yı import et

# --- Ayarlar ---
# İşlenmiş verilerin ve kaydedilmiş nesnelerin bulunduğu dizin
processed_data_dir = 'processed_data'
# Eğitilmiş modelin kaydedileceği dizin
model_output_dir = 'models'

# Model kaydedilecek dizin yoksa oluştur (zaten önceki script'lerde oluşturulmuş olabilir ama kontrol etmek iyidir)
os.makedirs(model_output_dir, exist_ok=True)

# --- Veri Yükleme ---
print("Önceden işlenmiş eğitim ve test verileri yükleniyor...")
try:
    # Eğitim verisini yükle
    train_data_path = os.path.join(processed_data_dir, 'train_data.joblib')
    train_data = joblib.load(train_data_path)
    X_train = train_data['X_train']
    y_train = train_data['y_train']

    # Test verisini yükle
    test_data_path = os.path.join(processed_data_dir, 'test_data.joblib')
    test_data = joblib.load(test_data_path)
    X_test = test_data['X_test']
    y_test = test_data['y_test']

    # Label Encoder'ı yükle (kategori isimlerini görmek için)
    encoder_path = os.path.join(processed_data_dir, 'label_encoder.joblib')
    label_encoder = joblib.load(encoder_path)

    print("Veriler başarıyla yüklendi.")
    print(f"Eğitim seti boyutu (X_train): {X_train.shape}")
    print(f"Test seti boyutu (X_test): {X_test.shape}")
except FileNotFoundError as e:
    print(f"Hata: Gerekli veri dosyaları bulunamadı ({e}).")
    print(f"Lütfen önce 'data_preprocessing.py' betiğini çalıştırdığınızdan emin olun.")
    exit()
except Exception as e:
    print(f"Veri yüklenirken bir hata oluştu: {e}")
    exit()

# --- Model Tanımlama ve Eğitme ---
# Amaç: Ürün isimlerine (TF-IDF ile vektörleştirilmiş) bakarak kategorilerini tahmin eden bir Naive Bayes modeli eğitmek.
# Model: Multinomial Naive Bayes (MNB) sınıflandırıcısı.
# Kazanım: Metin sınıflandırma görevlerinde genellikle hızlı ve etkili bir temel modeldir.
#          Özellikle TF-IDF gibi kelime frekanslarına dayalı özelliklerle iyi çalışır.
#          Hesaplama açısından verimlidir.

print("\nMultinomial Naive Bayes modeli tanımlanıyor ve eğitiliyor...")
# Multinomial Naive Bayes sınıflandırıcı nesnesini oluştur
# alpha: Laplace/Lidstone düzeltme parametresi (0'dan büyük olmalı, genellikle 1.0 kullanılır). Sıfır olasılıkları önler.
naive_bayes_model = MultinomialNB(alpha=1.0)

# Modeli eğitim verisi ile eğit
naive_bayes_model.fit(X_train, y_train)

print("Model başarıyla eğitildi.")

# --- Model Değerlendirme ---
print("\nModel test verisi üzerinde değerlendiriliyor...")
# Test verisi üzerinde tahmin yap
y_pred = naive_bayes_model.predict(X_test)

# Doğruluk (Accuracy) skorunu hesapla
accuracy = accuracy_score(y_test, y_pred)
print(f"Model Doğruluğu (Accuracy): {accuracy:.4f}")

# Sınıflandırma Raporu (Precision, Recall, F1-score)
# Raporda gösterilecek etiketleri belirle (y_test ve y_pred'de bulunanlar)
unique_labels = np.unique(np.concatenate((y_test, y_pred)))

# target_names: Raporda sayısal etiketler yerine gerçek kategori isimlerini gösterir
# labels: Rapora dahil edilecek sınıfları belirtir
print("\nSınıflandırma Raporu:")
report = classification_report(
    y_test, 
    y_pred, 
    labels=unique_labels, # Sadece mevcut etiketleri kullan
    target_names=label_encoder.classes_[unique_labels], # Mevcut etiketlere karşılık gelen isimleri kullan
    zero_division=0
)
print(report)

# --- Model Kaydetme ---
print("\nEğitilmiş Naive Bayes modeli kaydediliyor...")
# Modeli .joblib formatında kaydet
model_path = os.path.join(model_output_dir, 'naive_bayes_model.joblib')
joblib.dump(naive_bayes_model, model_path)
print(f"Model başarıyla '{model_path}' olarak kaydedildi.")

print("\nNaive Bayes modeli eğitimi ve değerlendirmesi tamamlandı.")

