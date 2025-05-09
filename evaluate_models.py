# Gerekli kütüphanelerin import edilmesi
import joblib # Kaydedilmiş nesneleri (veri, model vb.) yüklemek için
from sklearn.metrics import accuracy_score, classification_report, precision_score, log_loss, roc_auc_score # Model performansını değerlendirme metrikleri
import numpy as np # Sayısal işlemler için
import os # Dizin işlemleri için
import warnings # Uyarıları yönetmek için

# Olası uyarıları (örn. zero_division) bastırmak için
warnings.filterwarnings("ignore")

# --- Ayarlar ---
# İşlenmiş verilerin ve kaydedilmiş nesnelerin bulunduğu dizin
processed_data_dir = 'processed_data'
# Eğitilmiş modellerin bulunduğu dizin
model_dir = 'models'

# Model isimleri ve dosya yolları
model_files = {
    "Decision Tree": os.path.join(model_dir, 'decision_tree_model.joblib'),
    "Logistic Regression": os.path.join(model_dir, 'logistic_regression_model.joblib'),
    "Naive Bayes": os.path.join(model_dir, 'naive_bayes_model.joblib')
}

# --- Veri Yükleme ---
print("Önceden işlenmiş test verileri ve label encoder yükleniyor...")
try:
    # Test verisini yükle
    test_data_path = os.path.join(processed_data_dir, 'test_data.joblib')
    test_data = joblib.load(test_data_path)
    X_test = test_data['X_test']
    y_test = test_data['y_test']

    # Label Encoder'ı yükle
    encoder_path = os.path.join(processed_data_dir, 'label_encoder.joblib')
    label_encoder = joblib.load(encoder_path)
    all_classes = label_encoder.classes_ # Tüm sınıf etiketleri
    encoded_all_classes = label_encoder.transform(all_classes) # Tüm sınıfların kodlanmış hali

    print("Veriler başarıyla yüklendi.")
    print(f"Test seti boyutu (X_test): {X_test.shape}")
    print(f"Test seti etiket boyutu (y_test): {y_test.shape}")
    print(f"Toplam sınıf sayısı: {len(all_classes)}")

except FileNotFoundError as e:
    print(f"Hata: Gerekli veri veya encoder dosyaları bulunamadı ({e}).")
    print(f"Lütfen önce 'data_preprocessing.py' betiğini çalıştırdığınızdan emin olun.")
    exit()
except Exception as e:
    print(f"Veri yüklenirken bir hata oluştu: {e}")
    exit()

# --- Model Değerlendirme Fonksiyonu ---
def evaluate_model(model_name, model_path, X_test, y_test, label_encoder):
    """Belirtilen modeli yükler ve çeşitli metriklerle değerlendirir."""
    print(f"\n--- {model_name} Modeli Değerlendiriliyor ---")
    try:
        # Modeli yükle
        model = joblib.load(model_path)
        print(f"'{model_path}' model dosyası başarıyla yüklendi.")

        # Tahminleri yap (hem sınıf etiketi hem de olasılık)
        y_pred = model.predict(X_test)
        # Olasılık tahminleri ROC AUC ve Log Loss için gereklidir
        try:
            y_pred_proba = model.predict_proba(X_test)
            has_proba = True
        except AttributeError:
            print("Uyarı: Bu model 'predict_proba' metodunu desteklemiyor. ROC AUC ve Log Loss hesaplanamayacak.")
            y_pred_proba = None
            has_proba = False

        # 1. Doğruluk (Accuracy)
        accuracy = accuracy_score(y_test, y_pred)
        print(f"1. Doğruluk (Accuracy): {accuracy:.4f}")

        # 2. Sınıflandırma Raporu (Precision, Recall, F1-score içerir)
        print("\n2. Sınıflandırma Raporu:")
        # Raporda gösterilecek etiketleri belirle (y_test ve y_pred'de bulunanlar)
        unique_labels_in_report = np.unique(np.concatenate((y_test, y_pred)))
        # target_names: Raporda sayısal etiketler yerine gerçek kategori isimlerini gösterir
        # labels: Rapora dahil edilecek sınıfları belirtir
        # zero_division=0: Bir sınıfta hiç doğru tahmin yoksa uyarı yerine 0 değeri basar
        report = classification_report(
            y_test,
            y_pred,
            labels=unique_labels_in_report, # Sadece mevcut etiketleri kullan
            target_names=label_encoder.classes_[unique_labels_in_report], # Mevcut etiketlere karşılık gelen isimleri kullan
            zero_division=0
        )
        print(report)

        # 3. Ağırlıklı Ortalama Hassasiyet (Weighted Average Precision)
        # Çok sınıflı durumda genel bir precision değeri verir, sınıf dengesizliğini dikkate alır.
        weighted_precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
        print(f"3. Ağırlıklı Ortalama Hassasiyet (Weighted Precision): {weighted_precision:.4f}")

        if has_proba:
            # 4. Log Kaybı (Log Loss)
            # Modelin tahmin olasılıklarının doğruluğunu ölçer. Daha düşük değer daha iyidir.
            # labels parametresi, yalnızca y_test ve y_pred içinde bulunan sınıfları dikkate almasını sağlar.
            try:
                # unique_labels_in_report, y_test ve y_pred'deki benzersiz kodlanmış etiketleri içerir
                logloss = log_loss(y_test, y_pred_proba, labels=unique_labels_in_report)
                print(f"4. Log Kaybı (Log Loss): {logloss:.4f}")
            except ValueError as e:
                print(f"Log Loss hesaplanırken hata: {e}")
                # Bu hata genellikle y_pred_proba'nın sütun sayısıyla unique_labels_in_report'un eşleşmemesinden kaynaklanır,
                # ancak önceki düzeltmelerle bu durumun oluşmaması gerekir.
                print("Olası neden: Modelin olasılık tahminlerinin formatında beklenmedik bir durum.")


            # 5. ROC AUC Skoru (One-vs-Rest, Ağırlıklı Ortalama)
            # Modelin sınıfları ne kadar iyi ayırabildiğini ölçer. 1'e yakın olması iyidir.
            # labels parametresi, yalnızca y_test ve y_pred içinde bulunan sınıfları dikkate almasını sağlar.
            try:
                # ROC AUC için y_test'in one-hot encoding'e ihtiyacı olabilir, ancak scikit-learn bunu genellikle predict_proba ile halleder.
                # unique_labels_in_report, y_test ve y_pred'deki benzersiz kodlanmış etiketleri içerir
                roc_auc = roc_auc_score(y_test, y_pred_proba, multi_class='ovr', average='weighted', labels=unique_labels_in_report)
                print(f"5. ROC AUC Skoru (Weighted OvR): {roc_auc:.4f}")
            except ValueError as e:
                 print(f"ROC AUC hesaplanırken hata: {e}")
                 # Bu hata genellikle test setinde tek bir sınıf olması veya labels ile y_pred_proba uyumsuzluğundan kaynaklanır.
                 print("Olası neden: Test setinde sadece bir sınıf bulunması veya olasılık tahminlerinde sorun.")

        print(f"--- {model_name} Değerlendirmesi Tamamlandı ---")

    except FileNotFoundError:
        print(f"Hata: {model_path} model dosyası bulunamadı.")
    except Exception as e:
        print(f"{model_name} değerlendirilirken bir hata oluştu: {e}")

# --- Modelleri Değerlendirme ---
print("\nEğitilmiş modeller test verisi üzerinde değerlendiriliyor...")

for model_name, model_path in model_files.items():
    evaluate_model(model_name, model_path, X_test, y_test, label_encoder)

print("\nTüm modellerin değerlendirilmesi tamamlandı.")
